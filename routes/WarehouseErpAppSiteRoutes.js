const express = require("express");
const mammoth = require("mammoth");
const multer = require("multer");
const FormData = require("form-data");
const { uuid } = require("uuidv4");
const { convert } = require("pdf-poppler");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const {
    extractTextFromTXT,
    detectLanguage,
    getFallbackMessage,
    createChatWithRetry,
} = require("../utils/utils");
const {
    extractUrls: extractFaqUrls,
    findRelevantTextForQuestion,
    rebuildEmbeddingIndex,
    createConciseSupportContext,
} = require("../utils/faqEmbeddingHelper");
const { appendFaqItemsToTextFile } = require("../utils/faqBulkAppendHelper");
const { applyFaqDraftsForProduct } = require("../utils/faqDraftApplyHelper");
const { recordChatApiHit, shouldSkipChatSideEffects } = require("../utils/chatApiHitTracker");
const pool = require("../config/db");

require("dotenv").config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const PRODUCT_NAME = "Warehouse ERP App Site";
const ROUTE_BASE = "/chatBot/warehouseErpAppSite";
const outputDir = path.join(__dirname, "Output", PRODUCT_NAME);
const outputFilePath = path.join(outputDir, "extracted_text.txt");
const faqEmbeddingConfig = {
    outputDir,
    productName: PRODUCT_NAME,
    productSlug: "warehouse_erp_app_site",
};

let extractedAllText = extractTextFromTXT(outputFilePath);

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDailyChatMessage(message) {
    const text = (message || "").toLowerCase().trim();
    if (!text) return false;

    return /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's your day|what are you doing|what's your name|who are you|are you a robot|thank you|thanks|good answer|you are good|you're good|you are smart|you're smart|i like you|do you like me)\b/i.test(text);
}

function answerMatchesDetectedLanguage(answer, detectedLang) {
    if (!answer || !detectedLang) return true;

    if (detectedLang === "zh") {
        return /[\u4e00-\u9fff]/.test(answer) && !/[\u3040-\u30ff]/.test(answer);
    }

    if (detectedLang === "ja") {
        return /[\u3040-\u30ff]/.test(answer);
    }

    return true;
}

async function rewriteAnswerInDetectedLanguage(answer, detectedLang, lastUserMsg) {
    if (!answer || answerMatchesDetectedLanguage(answer, detectedLang)) return answer;

    const languageInstruction = detectedLang === "zh"
        ? "Rewrite the answer in Simplified Chinese only. Do not use Japanese or English except product names."
        : detectedLang === "ja"
            ? "Rewrite the answer in Japanese only. Do not use Chinese or English except product names."
            : `Rewrite the answer in the same language as this user message: "${lastUserMsg}".`;

    const rewriteResponse = await createChatWithRetry({
        model: "gpt-4.1-mini",
        messages: [
            {
                role: "system",
                content: `${languageInstruction}
Keep the meaning exactly the same.
Do not add new information.
Do not add the __HAS_ANSWER__ marker.`,
            },
            { role: "user", content: answer },
        ],
        max_completion_tokens: 800,
        temperature: 0.1,
    });

    return rewriteResponse?.choices?.[0]?.message?.content?.trim() || answer;
}

async function rebuildWarehouseErpAppSiteEmbeddings() {
    try {
        await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });
    } catch (embeddingError) {
        console.warn(`${PRODUCT_NAME} embedding rebuild failed:`, embeddingError.message);
    }
}

async function appendTextToKnowledgeFile({ text, category }) {
    if (!text) {
        return { success: false, status: 400, message: "Text is required in the request body." };
    }

    if (!category) {
        return { success: false, status: 400, message: "Category is required in the request body." };
    }

    await fs.ensureDir(outputDir);

    let currentContent = await fs.pathExists(outputFilePath)
        ? await fs.readFile(outputFilePath, "utf8")
        : "";

    const normalizedCategory = String(category).toUpperCase();
    const sectionHeader = `\n===== ${normalizedCategory} SECTION =====\n`;
    const categoryRegex = new RegExp(
        `===== ${escapeRegExp(normalizedCategory)} SECTION =====([\\s\\S]*?)(?=====|$)`,
        "i"
    );
    const formattedText = `${String(text).trim()}\n\n\n\n\n`;

    if (categoryRegex.test(currentContent)) {
        currentContent = currentContent.replace(categoryRegex, (match, existingSectionText) => {
            return `===== ${normalizedCategory} SECTION =====\n${existingSectionText.trim()}\n\n${formattedText}`;
        });
    } else {
        currentContent += `${sectionHeader}${formattedText}`;
    }

    await fs.writeFile(outputFilePath, currentContent, "utf8");
    extractedAllText = currentContent;

    return {
        success: true,
        message: `Text successfully added to ${category} section!`,
        filePath: outputFilePath,
    };
}

async function extractImageTextFromBuffer(imageBuffer, apiKey) {
    const imageBase64 = imageBuffer.toString("base64");
    const response = await axios.post(
        "https://api.openai.com/v1/responses",
        {
            model: "gpt-4.1",
            input: [
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: "Extract all readable text from this image. Return raw text only." },
                        { type: "input_image", image_url: `data:image/png;base64,${imageBase64}` },
                    ],
                },
            ],
            max_output_tokens: 2000,
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        }
    );

    return response.data.output[0].content[0].text?.trim() || "";
}

router.post(`${ROUTE_BASE}/extractText`, upload.single("docxFile"), async (req, res) => {
    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        if (!category) {
            return res.status(400).json({ error: "No category specified." });
        }

        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        const extractedText = result.value.replace(/\n+/g, "\n").trim();
        const formattedText = `${extractedText}\n\n\n\n\n`;

        await fs.ensureDir(outputDir);

        const sectionHeader = `\n\n===== ${String(category).toUpperCase()} SECTION =====\n`;
        const currentContent = `${sectionHeader}${formattedText}`;

        await fs.writeFile(outputFilePath, currentContent, "utf8");
        extractedAllText = currentContent;
        await rebuildWarehouseErpAppSiteEmbeddings();

        res.json({
            success: true,
            message: `Text successfully added to ${category} section!`,
            filePath: outputFilePath,
        });
    } catch (err) {
        console.error(`${PRODUCT_NAME} extract text error:`, err.message);
        res.status(500).json({ success: false, error: "Error extracting text: " + err.message });
    }
});

router.post(`${ROUTE_BASE}/appendText`, async (req, res) => {
    try {
        const result = await appendTextToKnowledgeFile(req.body);
        if (!result.success) {
            return res.status(result.status || 400).json({ message: result.message });
        }

        await rebuildWarehouseErpAppSiteEmbeddings();
        return res.json({
            message: result.message,
            filePath: result.filePath,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} append error:`, error.message);
        return res.status(500).json({ message: "Failed to append text." });
    }
});

router.post(`${ROUTE_BASE}/faq/bulkAppend`, async (req, res) => {
    try {
        const { items, category = "FAQ" } = req.body;
        const result = await appendFaqItemsToTextFile({ outputFilePath, category, items });

        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.message });
        }

        extractedAllText = result.allText;
        await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });

        return res.json({
            success: true,
            message: "FAQ questions added and embeddings updated successfully.",
            filePath: result.filePath,
            added: result.added,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} FAQ bulk append error:`, error.message);
        return res.status(500).json({ success: false, message: "Failed to bulk append FAQ questions.", error: error.message });
    }
});

router.post(`${ROUTE_BASE}/faq/applyDrafts`, async (req, res) => {
    try {
        const { userEmail, ids, category = "FAQ" } = req.body;
        const result = await applyFaqDraftsForProduct({
            db: req.db,
            product: PRODUCT_NAME,
            userEmail,
            ids,
            category,
            outputFilePath,
            rebuildEmbeddings: allText => rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText }),
        });

        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.message });
        }

        extractedAllText = result.allText;
        return res.json({
            success: true,
            message: "FAQ drafts applied and embeddings updated successfully.",
            filePath: result.filePath,
            added: result.added,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} FAQ draft apply error:`, error.message);
        return res.status(500).json({ success: false, message: "Failed to apply FAQ drafts.", error: error.message });
    }
});

router.post([`${ROUTE_BASE}/chat/gpt`, `${ROUTE_BASE}/chat/gpt/no-store`], async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
    }

    const lastUserMsg = messages.filter(msg => msg.role === "user").pop()?.content || "";
    const detectedLang = detectLanguage(lastUserMsg);

    recordChatApiHit(req, {
        product: PRODUCT_NAME,
        routePath: `${ROUTE_BASE}/chat/gpt`,
        question: lastUserMsg,
        lang: detectedLang,
    });

    try {
        const relevantCompanyInfo = await findRelevantTextForQuestion({
            ...faqEmbeddingConfig,
            allText: extractedAllText,
            question: lastUserMsg,
            detectedLang,
        });
        const relevantLinks = extractFaqUrls(relevantCompanyInfo).slice(0, 5);
        const conciseCompanyContext = createConciseSupportContext({
            productName: PRODUCT_NAME,
            latestUserMessage: lastUserMsg,
            detectedLang,
            relevantText: relevantCompanyInfo,
            relevantLinks,
        }) + `
Language enforcement:
- The latest user message overrides all previous assistant messages and previous conversation language.
- If the detected language hint is "ja", reply only in Japanese.
- If the detected language hint is "zh", reply only in Simplified Chinese.
- Use "Boss" for Japanese and all non-Chinese replies.
Product boundary:
- This endpoint is only for Warehouse ERP App Site.
- Do not answer using any other product knowledge.
`;

        console.log(`${PRODUCT_NAME} selected context chars:`, relevantCompanyInfo.length);

        try {
            const response = await createChatWithRetry({
                model: "gpt-4.1-mini",
                messages: [
                    { role: "system", content: conciseCompanyContext },
                    ...messages,
                ],
                max_completion_tokens: 800,
                temperature: 0.3,
            });

            const rawAnswer = response?.choices?.[0]?.message?.content?.trim() || "";
            let hasAnswer = true;

            if (rawAnswer.includes("__HAS_ANSWER__:false")) {
                hasAnswer = false;
            } else if (rawAnswer.includes("__HAS_ANSWER__:true")) {
                hasAnswer = true;
            }

            let answer = rawAnswer
                .replace("__HAS_ANSWER__:true", "")
                .replace("__HAS_ANSWER__:false", "")
                .trim();
            answer = await rewriteAnswerInDetectedLanguage(answer, detectedLang, lastUserMsg);

            if (!hasAnswer && !isDailyChatMessage(lastUserMsg) && !shouldSkipChatSideEffects(req)) {
                const unknownAnswer = answer || getFallbackMessage(detectedLang);
                await pool.query(
                    "INSERT INTO chatbot_unknown_question (question, lang, product, answer) VALUES (?, ?, ?, ?)",
                    [lastUserMsg, detectedLang, PRODUCT_NAME, unknownAnswer]
                );
            }

            if (!answer) {
                return res.json({
                    answer: getFallbackMessage(detectedLang),
                    lang: detectedLang,
                });
            }

            return res.json({
                answer,
                lang: detectedLang,
            });
        } catch (error) {
            console.error("Error communicating with OpenAI API:", error.response?.data || error.message);
            return res.status(200).json({
                answer: getFallbackMessage(detectedLang),
                lang: detectedLang,
            });
        }
    } catch (error) {
        console.error("Error communicating with OpenAI API:", error.response?.data || error.message);
        return res.status(500).json({ error: "Failed to fetch response from OpenAI API." });
    }
});

router.post(`${ROUTE_BASE}/transcribe`, upload.single("file"), async (req, res) => {
    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "File is required for transcription." });
        }
        if (!category) {
            return res.status(400).json({ message: "Category is required in the request body." });
        }

        const apiKEY = process.env.OPENAI_API_KEY || req.body.api_key;
        if (!apiKEY) {
            return res.status(401).json({ message: "API Key is required." });
        }

        const formData = new FormData();
        formData.append("file", Buffer.from(req.file.buffer), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        formData.append("model", "whisper-1");

        const response = await axios.post(
            "https://api.openai.com/v1/audio/transcriptions",
            formData,
            {
                headers: {
                    Authorization: `Bearer ${apiKEY}`,
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
            }
        );

        const aiResponseText = response.data.text.trim();
        if (!aiResponseText) {
            return res.status(400).json({ message: "No text extracted from audio." });
        }

        const result = await appendTextToKnowledgeFile({ text: aiResponseText, category });
        return res.json({
            success: true,
            message: `Audio transcription added to ${category} section successfully!`,
            filePath: result.filePath,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} transcription error:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.response?.data?.error?.message || "Error processing the audio file.",
        });
    }
});

router.post(`${ROUTE_BASE}/analyzeImage`, upload.single("image"), async (req, res) => {
    let tempDir = null;

    try {
        const { category } = req.body;
        if (!req.file) return res.status(400).json({ message: "Image file is required." });
        if (!category) return res.status(400).json({ message: "Category is required in the request body." });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(401).json({ message: "API Key is missing." });

        tempDir = path.join(__dirname, "../temp", uuid());
        await fs.ensureDir(tempDir);

        const imagePath = path.join(tempDir, "upload.png");
        await fs.writeFile(imagePath, req.file.buffer);
        const imageBuffer = await fs.readFile(imagePath);
        const aiResponseText = await extractImageTextFromBuffer(imageBuffer, apiKey);

        if (!aiResponseText) return res.status(400).json({ message: "No text extracted from image." });

        const result = await appendTextToKnowledgeFile({ text: aiResponseText, category });
        return res.json({
            success: true,
            message: `Image text added to ${category} section successfully!`,
            filePath: result.filePath,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} image OCR error:`, error.message);
        return res.status(500).json({
            success: false,
            message: error.response?.data?.error?.message || "Error analyzing image.",
        });
    } finally {
        if (tempDir && await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    }
});

router.post(`${ROUTE_BASE}/analyzePdf`, upload.single("pdf"), async (req, res) => {
    let tempDir = null;

    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "PDF file is required." });
        }
        if (!category) {
            return res.status(400).json({ message: "Category is required in the request body." });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ message: "API Key is missing." });
        }

        tempDir = path.join(__dirname, "../temp", uuid());
        await fs.ensureDir(tempDir);

        const pdfPath = path.join(tempDir, "upload.pdf");
        await fs.writeFile(pdfPath, req.file.buffer);

        await convert(pdfPath, {
            format: "png",
            out_dir: tempDir,
            out_prefix: "page",
            page: null,
        });

        const imageFiles = (await fs.readdir(tempDir))
            .filter(file => file.endsWith(".png"))
            .map(file => path.join(tempDir, file));

        const allResponses = [];

        for (const imagePath of imageFiles) {
            const imageBuffer = await fs.readFile(imagePath);
            allResponses.push(await extractImageTextFromBuffer(imageBuffer, apiKey));
        }

        const fullText = allResponses.join("\n\n").trim();
        if (!fullText) {
            return res.status(400).json({ message: "No text extracted from PDF." });
        }

        const result = await appendTextToKnowledgeFile({ text: fullText, category });
        return res.json({
            success: true,
            message: `PDF text successfully added to ${category} section!`,
            filePath: result.filePath,
        });
    } catch (error) {
        console.error(`${PRODUCT_NAME} PDF analysis error:`, error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to analyze and store PDF text.",
            error: error.message,
        });
    } finally {
        if (tempDir && await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    }
});

module.exports = router;
