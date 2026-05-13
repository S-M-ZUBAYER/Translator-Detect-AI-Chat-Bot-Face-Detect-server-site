const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const { createChatWithRetry, openai } = require("./utils");

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_CONTEXT_CHARS = 6000;
const MIN_SIMILARITY = 0.80;
const BEST_MATCH_MIN_SIMILARITY = 0.60;
const INDEX_VERSION = 2;
const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
    "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on",
    "or", "please", "should", "the", "this", "to", "use", "what", "when",
    "where", "which", "why", "with", "you", "your"
]);

const memoryIndexes = new Map();
const TRANSLATED_RETRIEVAL_LANGS = new Set([
    "ar", "bn", "gu", "hi", "id", "ja", "kn", "ko", "ml", "my",
    "pt", "ru", "si", "ta", "th", "tl", "ur", "vi", "zh"
]);

function getTextHash(text) {
    return crypto
        .createHash("sha256")
        .update(text || "", "utf8")
        .digest("hex");
}

function extractUrls(text) {
    if (!text || typeof text !== "string") return [];

    return [...new Set(text.match(/https?:\/\/\S+/g) || [])]
        .map(url => url.replace(/[),.;]+$/, ""));
}

function splitQABlocks(text) {
    if (!text || typeof text !== "string") return [];

    const matches = [...text.matchAll(/(^|\n)(Q-\d+[:.]\s*[\s\S]*?)(?=\nQ-\d+[:.]|$)/g)];
    if (!matches.length) {
        return text
            .split(/\n{3,}/)
            .map(chunk => chunk.trim())
            .filter(Boolean);
    }

    return matches.map(match => match[2].trim()).filter(Boolean);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSearchTerms(text) {
    if (!text || typeof text !== "string") return [];

    const matches = text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, " ")
        .match(/[a-z0-9]+/g);

    return (matches || []).filter(word =>
        word.length > 1 && !STOP_WORDS.has(word)
    );
}

function getRelevantTextByKeyword(allText, question, maxContextChars = MAX_CONTEXT_CHARS) {
    const chunks = splitQABlocks(allText);
    const terms = getSearchTerms(question);

    if (!chunks.length || !terms.length) return "";

    const exactQuestionMatch = question.match(/\bq[-\s]?(\d+)\b/i);
    const scoredChunks = chunks
        .map((chunk, index) => {
            const lowerChunk = chunk.toLowerCase();
            let score = 0;

            for (const term of terms) {
                const matches = lowerChunk.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, "g"));
                if (matches) score += matches.length;
                if (lowerChunk.includes(term)) score += 0.5;
            }

            const firstLine = lowerChunk.split("\n")[0] || "";
            for (const term of terms) {
                if (firstLine.includes(term)) score += 5;
            }

            if (extractUrls(chunk).length) score += 1;
            if (exactQuestionMatch && lowerChunk.includes(`q-${exactQuestionMatch[1]}`)) score += 100;

            return { chunk, index, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index);

    let selectedText = "";

    for (const item of scoredChunks) {
        const nextText = selectedText
            ? `${selectedText}\n\n${item.chunk}`
            : item.chunk;

        if (nextText.length > maxContextChars) break;
        selectedText = nextText;
    }

    return selectedText;
}

function parseQABlocks(text) {
    return splitQABlocks(text)
        .map((chunk, index) => {
            const lines = chunk.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const firstLine = lines[0] || "";
            const questionMatch = firstLine.match(/^(Q-\d+)[:.]\s*(.+)$/i);
            const answerMatch = chunk.match(/Answer:\s*([\s\S]*)$/i);
            const variantMatch = chunk.match(/(?:Alternative Questions|Question Variants|Variants):\s*([\s\S]*?)(?=\nAnswer:|$)/i);

            const id = questionMatch ? questionMatch[1].toUpperCase() : `FAQ-${index + 1}`;
            const question = questionMatch ? questionMatch[2].trim() : firstLine;
            const variants = variantMatch
                ? variantMatch[1]
                    .split(/\r?\n|;/)
                    .map(item => item.replace(/^[-*]\s*/, "").trim())
                    .filter(Boolean)
                : [];
            const answer = answerMatch ? answerMatch[1].trim() : lines.slice(1).join("\n");

            if (!question || !answer) return null;

            return {
                id,
                question,
                variants,
                answer,
                urls: extractUrls(chunk),
                content: chunk.trim(),
            };
        })
        .filter(Boolean);
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getEmbeddingPath(outputDir, productSlug) {
    return path.join(outputDir, `${productSlug}_embeddings.json`);
}

function loadEmbeddingIndex(outputDir, productSlug) {
    const embeddingPath = getEmbeddingPath(outputDir, productSlug);

    try {
        if (!fs.existsSync(embeddingPath)) return null;
        const data = fs.readJsonSync(embeddingPath);
        if (!data || !Array.isArray(data.items)) return null;
        memoryIndexes.set(embeddingPath, data);
        return data;
    } catch (error) {
        console.warn(`${productSlug} embedding index load failed:`, error.message);
        return null;
    }
}

async function rebuildEmbeddingIndex({ allText, outputDir, productName, productSlug }) {
    const faqItems = parseQABlocks(allText);
    const embeddingPath = getEmbeddingPath(outputDir, productSlug);

    if (!faqItems.length) {
        memoryIndexes.delete(embeddingPath);
        if (fs.existsSync(embeddingPath)) fs.removeSync(embeddingPath);
        return null;
    }

    const embeddingInputs = faqItems.map(item =>
        [
            item.question,
            ...item.variants,
            item.answer.slice(0, 1000),
        ].join("\n").slice(0, 2500)
    );

    const embeddingResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: embeddingInputs,
    });

    const items = faqItems.map((item, index) => ({
        ...item,
        embedding: embeddingResponse.data[index].embedding,
    }));

    const indexData = {
        product: productName,
        model: EMBEDDING_MODEL,
        parserVersion: INDEX_VERSION,
        sourceHash: getTextHash(allText),
        updatedAt: new Date().toISOString(),
        items,
    };

    fs.ensureDirSync(outputDir);
    fs.writeJsonSync(embeddingPath, indexData);
    memoryIndexes.set(embeddingPath, indexData);
    console.log(`${productName} embedding index rebuilt:`, {
        items: items.length,
        parserVersion: INDEX_VERSION,
        file: embeddingPath,
    });
    return indexData;
}

async function ensureEmbeddingIndex({ allText, outputDir, productName, productSlug }) {
    const embeddingPath = getEmbeddingPath(outputDir, productSlug);
    const sourceHash = getTextHash(allText);
    const loadedIndex = memoryIndexes.get(embeddingPath) || loadEmbeddingIndex(outputDir, productSlug);

    if (
        loadedIndex &&
        loadedIndex.sourceHash === sourceHash &&
        loadedIndex.model === EMBEDDING_MODEL &&
        loadedIndex.parserVersion === INDEX_VERSION &&
        Array.isArray(loadedIndex.items) &&
        loadedIndex.items.length
    ) {
        return loadedIndex;
    }

    return rebuildEmbeddingIndex({ allText, outputDir, productName, productSlug });
}

async function getRelevantTextByEmbedding({ allText, question, outputDir, productName, productSlug }) {
    if (!question || !allText) return "";

    const indexData = await ensureEmbeddingIndex({ allText, outputDir, productName, productSlug });
    if (!indexData?.items?.length) return "";

    const queryEmbeddingResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: question,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    const scoredMatches = indexData.items
        .map(item => ({
            ...item,
            similarity: cosineSimilarity(queryEmbedding, item.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity);
    const strongMatches = scoredMatches.filter(item => item.similarity >= MIN_SIMILARITY);
    const matches = strongMatches.length
        ? strongMatches
        : scoredMatches.slice(0, 1).filter(item => item.similarity >= BEST_MATCH_MIN_SIMILARITY);

    console.log(`${productName} embedding matches:`, matches.map(item => ({
        id: item.id,
        similarity: Number(item.similarity.toFixed(4)),
        question: item.question,
    })));

    let selectedText = "";

    for (const item of matches) {
        const nextText = selectedText
            ? `${selectedText}\n\n${item.content}`
            : item.content;

        if (nextText.length > MAX_CONTEXT_CHARS) break;
        selectedText = nextText;
    }

    return selectedText;
}

async function translateQuestionForRetrieval(question, detectedLang) {
    if (!question || !TRANSLATED_RETRIEVAL_LANGS.has(detectedLang)) return "";

    const translationResponse = await createChatWithRetry({
        model: "gpt-4.1-mini",
        messages: [
            {
                role: "system",
                content: "Translate the user's support question to concise English for FAQ search. Return only the translated question.",
            },
            { role: "user", content: question },
        ],
        max_completion_tokens: 120,
        temperature: 0,
    });

    return translationResponse?.choices?.[0]?.message?.content?.trim() || "";
}

async function findRelevantTextForQuestion({
    allText,
    question,
    detectedLang,
    outputDir,
    productName,
    productSlug,
}) {
    const findByQuestion = async (searchQuestion, sourceLabel) => {
        let relevantText = "";

        try {
            relevantText = await getRelevantTextByEmbedding({
                allText,
                question: searchQuestion,
                outputDir,
                productName,
                productSlug,
            });
        } catch (embeddingError) {
            console.warn(`${productName} ${sourceLabel} embedding search failed:`, embeddingError.message);
        }

        if (relevantText) {
            console.log(`${productName} retrieval source: ${sourceLabel} embedding`);
            return relevantText;
        }

        relevantText = getRelevantTextByKeyword(allText, searchQuestion);
        if (relevantText) {
            console.log(`${productName} retrieval source: ${sourceLabel} keyword fallback`);
        }

        return relevantText;
    };

    let relevantText = "";

    if (TRANSLATED_RETRIEVAL_LANGS.has(detectedLang)) {
        try {
            const englishSearchQuestion = await translateQuestionForRetrieval(question, detectedLang);
            if (englishSearchQuestion) {
                relevantText = await findByQuestion(englishSearchQuestion, "translated query");
            }
        } catch (translationError) {
            console.warn(`${productName} translated retrieval failed:`, translationError.message);
        }
    }

    if (!relevantText) {
        relevantText = await findByQuestion(question, "original query");
    }

    if (!relevantText) {
        console.log(`${productName} retrieval source: no match`);
    }

    return relevantText;
}

function createConciseSupportContext({
    productName,
    latestUserMessage,
    detectedLang,
    relevantText,
    relevantLinks,
}) {
    return `
You are Grozziie ${productName} support.
Reply in the same language/script as the latest user message.
Use "亲" for Chinese replies and "Boss" for other languages.
Answer only from the provided product knowledge or conversation history.
Do not use outside knowledge.
If the user is only greeting or casual chatting, reply naturally and briefly.
If the answer is not in the provided knowledge, politely say you do not have this information.
Include any relevant image/video/page URL exactly if useful.
Keep product answers clear and helpful, usually 2 to 5 short sentences.
End every response with exactly one marker: __HAS_ANSWER__:true or __HAS_ANSWER__:false

Latest user message: "${latestUserMessage}"
Detected language hint: "${detectedLang}"

${productName} knowledge:
${relevantText || `No matching ${productName} information was found for this question.`}

Relevant URLs:
${relevantLinks?.length ? relevantLinks.join("\n") : "No relevant URLs found."}
`;
}

module.exports = {
    extractUrls,
    getRelevantTextByKeyword,
    getRelevantTextByEmbedding,
    findRelevantTextForQuestion,
    rebuildEmbeddingIndex,
    createConciseSupportContext,
};
