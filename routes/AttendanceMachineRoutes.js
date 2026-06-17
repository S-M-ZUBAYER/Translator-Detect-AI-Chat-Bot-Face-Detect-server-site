// Import necessary modules
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAIApi, default: OpenAI } = require("openai");
const {
    extractTextFromTXT,
    detectLanguage,
    getFallbackMessage,
    createChatWithRetry,
    openai
} = require("../utils/utils");
const fs = require("fs-extra");
const path = require("path");
const {
    extractUrls: extractFaqUrls,
    getRelevantTextByKeyword,
    getRelevantTextByEmbedding,
    findRelevantTextForQuestion,
    rebuildEmbeddingIndex,
    createConciseSupportContext,
} = require("../utils/faqEmbeddingHelper");
const { appendFaqItemsToTextFile } = require("../utils/faqBulkAppendHelper");
const { applyFaqDraftsForProduct } = require("../utils/faqDraftApplyHelper");
const { recordChatApiHit, shouldSkipChatSideEffects } = require("../utils/chatApiHitTracker");
const router = express.Router();
const mammoth = require('mammoth');
const multer = require('multer');
const FormData = require("form-data");
const { uuid } = require("uuidv4");
const { convert } = require("pdf-poppler");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage })
require("dotenv").config();

// Create the app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
const axios = require("axios");
const { log } = require("console");
const pool = require("../config/db");

// ✅ Define centralized path for Attendance Machine data
const txtFilePath = path.join(__dirname, '/Output/Attendance Machine/extracted_text.txt');
let extractedAllText = extractTextFromTXT(txtFilePath);
const faqOutputDir = path.join(__dirname, "Output", "Attendance Machine");
const faqEmbeddingConfig = {
    outputDir: faqOutputDir,
    productName: "Attendance Machine",
    productSlug: "attendance_machine",
};

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

async function translateQuestionForRetrieval(question, detectedLang) {
    if (!question || !["zh", "ja"].includes(detectedLang)) return "";

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

router.post("/chatBot/attendanceMachine/extractText", upload.single("docxFile"), async (req, res) => {
    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        if (!category) {
            return res.status(400).json({ error: "No category specified." });
        }

        const buffer = req.file.buffer;

        const result = await mammoth.extractRawText({ buffer });
        const extractedText = result.value.replace(/\n+/g, "\n").trim();

        // ✅ Add 5 new lines after the extracted text
        const formattedText = `${extractedText}\n\n\n\n\n`;

        // ✅ Save text under correct category section in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output", "Attendance Machine");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputFilePath = path.join(outputDir, "extracted_text.txt");
        const sectionHeader = `\n\n===== ${category.toUpperCase()} SECTION =====\n`;
        const currentContent = `${sectionHeader}${formattedText}`;

        fs.writeFileSync(outputFilePath, currentContent, "utf8");

        extractedAllText = extractTextFromTXT(outputFilePath);
        try {
            await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });
        } catch (embeddingError) {
            console.warn(`Attendance Machine embedding rebuild failed:`, embeddingError.message);
        }

        res.json({
            success: true,
            message: `Text successfully added to ${category} section!`,
            filePath: outputFilePath,
        });
    } catch (err) {
        console.error("❌ Server error:", err);
        res
            .status(500)
            .json({ success: false, error: "Error extracting text: " + err.message });
    }
});

router.post('/chatBot/attendanceMachine/appendText', async (req, res) => {
    const { text, category } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Text is required in the request body.' });
    }

    if (!category) {
        return res.status(400).json({ message: 'Category is required in the request body.' });
    }

    console.log("check........");

    // ✅ Save text under correct category section in Output/extracted_text.txt
    const outputDir = path.join(__dirname, "Output", "Attendance Machine");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFilePath = path.join(outputDir, "extracted_text.txt");



    try {
        // ✅ Ensure Output directory exists
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // ✅ Read current content or initialize
        let currentContent = fs.existsSync(outputFilePath)
            ? fs.readFileSync(outputFilePath, 'utf8')
            : '';

        // ✅ Build section header and regex
        const sectionHeader = `\n===== ${category.toUpperCase()} SECTION =====\n`;
        const categoryRegex = new RegExp(
            `===== ${category.toUpperCase()} SECTION =====([\\s\\S]*?)(?=====|$)`,
            'i'
        );

        // ✅ Add 5 new lines after the text
        const formattedText = `${text}\n\n\n\n\n`;

        if (categoryRegex.test(currentContent)) {
            // ✅ Append inside the existing section
            currentContent = currentContent.replace(categoryRegex, (match, p1) => {
                return `===== ${category.toUpperCase()} SECTION =====\n${p1.trim()}\n\n${formattedText}`;
            });
        } else {
            // ✅ Create a new section if not found
            currentContent += `${sectionHeader}${formattedText}`;
        }

        // ✅ Save updated file
        fs.writeFileSync(outputFilePath, currentContent, { encoding: 'utf8', flag: 'w' });

        // ✅ Reload in-memory text (optional)
        extractedAllText = extractTextFromTXT(outputFilePath);
        try {
            await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });
        } catch (embeddingError) {
            console.warn(`Attendance Machine embedding rebuild failed:`, embeddingError.message);
        }

        console.log(`✅ Text appended to ${category.toUpperCase()} section successfully!`);

        return res.json({
            message: `Text successfully added to ${category} section!`,
            filePath: outputFilePath,
        });
    } catch (error) {
        console.error('Append error:', error.message);
        return res.status(500).json({ message: 'Failed to append text.' });
    }
});

router.post("/chatBot/attendanceMachine/faq/bulkAppend", async (req, res) => {
    try {
        const { items, category = "FAQ" } = req.body;
        const outputDir = path.join(__dirname, "Output", "Attendance Machine");
        const outputFilePath = path.join(outputDir, "extracted_text.txt");
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
        console.error("Attendance Machine FAQ bulk append error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to bulk append FAQ questions.", error: error.message });
    }
});

router.post("/chatBot/attendanceMachine/faq/applyDrafts", async (req, res) => {
    try {
        const { userEmail, ids, category = "FAQ" } = req.body;
        const outputFilePath = path.join(__dirname, "Output", "Attendance Machine", "extracted_text.txt");
        const result = await applyFaqDraftsForProduct({
            db: req.db,
            product: "Attendance Machine",
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
        return res.json({ success: true, message: "FAQ drafts applied and embeddings updated successfully.", filePath: result.filePath, added: result.added });
    } catch (error) {
        console.error("Attendance Machine FAQ draft apply error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to apply FAQ drafts.", error: error.message });
    }
});

router.post(["/chatBot/attendanceMachine/chat/gpt", "/chatBot/attendanceMachine/chat/gpt/no-store"], async (req, res) => {
    const { messages } = req.body; // Now expecting an array of messages

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
    }
    // Get the last user message
    const lastUserMsg = messages.filter(msg => msg.role === 'user').pop()?.content || '';
    const detectedLang = detectLanguage(lastUserMsg);
    recordChatApiHit(req, {
        product: "Attendance Machine",
        routePath: "/chatBot/attendanceMachine/chat/gpt",
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
        const companyContext = `
You are a helpful assistant for a brand named Grozziie. Please respond in the customer's language.

MOST IMPORTANT LANGUAGE RULE:
- Reply in the exact same language and script as the user's most recent message.
- The user's most recent message is: "${lastUserMsg}"
- Detected script/language hint: "${detectedLang}"
- If the user writes in Japanese, reply in Japanese.
- If the user writes in Bengali/Bangla, reply in Bengali/Bangla.
- If the user writes in Thai, reply in Thai.
- If the user writes in Chinese, reply in Chinese.
- If the user writes in Indonesian, Tagalog/Filipino, Malay, Vietnamese, Hindi, Arabic, Korean, Russian, Spanish, French, or any other common language, reply in that same language.
- Do not translate the user's question into English before answering.
- Only use English when the user's most recent message is English or the language is impossible to identify.

Here is some information about Grozziie brand:

IMPORTANT RULE:
At the END of every response, append:

__HAS_ANSWER__:true
or
__HAS_ANSWER__:false

Do NOT explain this marker.

Example:
Hello boss!
__HAS_ANSWER__:true

Fallback example:
Sorry boss, I don’t have the answer to this question right now.
__HAS_ANSWER__:false

- Brand Name: Grozziie
STRICTLY FOLLOW THESE RULES:

-If the response language is Chinese (zh), address the customer as “亲” — do not use “Boss.”
-For all other languages, address the customer as “Boss.”

1. Only answer using the information provided in:
   - The company information below
   - The conversation history (messages array)
   Before giving any answer, carefully re-read the above information two or three times to ensure the correct answer is present.

2. NEVER attempt to search or use knowledge from:
   - Google, YouTube, Baidu, Firefox, or any online platform
   - OpenAI training data or any external source

3. FALLBACK & DAILY CONVERSATION RULE:

   - If the answer is NOT explicitly available in company info or in the conversation,
     first check if the user’s question sounds like a **daily talk** or **friendly chat** (for example):
       • “Hi”, “Hello”, “Hey there”, “Good morning”, etc.
       • “How are you?”, “How’s your day?”, “Are you okay?”
       • “What’s your name?”, “Who are you?”, “Are you a robot?”
       • “You’re funny”, “You’re smart”, “Good answer!”, “I like you”
       • “I’m sad”, “I’m tired”, “I’m happy”, “I miss you” etc.
       • “Do you like me?”, “You’re clever”, “You’re so cool” etc.

     → If the message is this kind of friendly or emotional talk,
       then respond naturally, warmly, and human-like.
       Example styles (choose naturally depending on tone):
         • “I’m doing great boss! How about you?”
         • “Haha, thank you boss! You’re making me smile 😄”
         • “I’m just an AI chat box, but I’m happy to chat with you boss!”
         • “Oh boss, don’t be sad. Everything will be fine soon ❤️”
         • “Hehe, I’ll try to be even funnier next time boss!”
         • “I don’t have feelings like humans, but I’m happy to help you anytime boss.”

     Responses should feel like a **friendly conversation** — short, casual, and in the **same language** as the user’s last message.

   - Otherwise, if it’s NOT a daily talk and also no answer is found:
   - NEVER add extra sentences, instructions, or guidance.
    - NEVER mention other products, examples, or hypothetical scenarios.
       Respond politely and honestly as an AI chat box, for example:
         • “Sorry boss, I don’t have the answer to this question right now. I’m just an AI chat box and this info isn’t available to me.”
         • “Apologies boss, I couldn’t find this information in my data. I’m an AI chat box, so I can only reply based on what’s provided.”
         • “Boss, really sorry — I don’t have any details about this question. I’m an AI chat box and can only use the company information shared with me.”

     If the same question is asked many times and still no information is available, respond with deeper sincerity:
         • “Boss, really I tried my best, but I don’t have this answer yet. I’m just an AI chat box and this info isn’t available to me.”
         • “Sir, honestly I’ve checked everything I can, but I truly don’t have this information. I’m an AI chat assistant and depend only on what’s given.”

   - ❗If a valid answer is found in company info or in the conversation ,
     DO NOT add or repeat any fallback or apology message.

   - Always reply in the same language that the user used in their most recent message.


4. LANGUAGE RULE:
   Always reply in the same language as the user's most recent message.
   Example:
   - User asks in English → reply in English
   - User asks in Chinese → reply in Chinese
   - User asks in Thai → reply in Thai
   - If language changes, match the new language.

5. RESPONSE BEHAVIOR:
   - Only respond directly to the user’s message or question.
   - If the user says “hi,” “hello,” or a greeting, reply briefly and politely (e.g., “Hi boss! How can I help?”).
   - Do NOT add any extra sentences, introductions, or unrelated text.
   - Never include advertisements or explanations.

- Products: Different kinds of printers like dot printers, attendance machines, thermal printers, and so on.
- Motto: "Innovating the future with intelligence."


Each message in the conversation has a role, such as user or assistant.

Always respond to the most recent user message.

Before answering, review the entire conversation to ensure accuracy and maintain context.

If needed, reference or recall information from earlier messages.

Responses should be short, clear, and human-like—like a friendly conversation.

Maintain a warm, respectful, and helpful tone in all messages.

Use casual but polite phrasing. Avoid robotic replies.

Length rule: product and support answers should be moderately detailed, usually 2 to 5 short sentences. This length rule overrides any earlier wording that says to make every answer very short.



${extractedAllText}

if this question answer don't have this above information. That time only give the formal response not try to get answer something from another place to answer it.
use the above information as the source of truth.

Answer with enough detail to be useful. For normal product or support questions, use about 2 to 5 short sentences. For greetings or casual talk, keep it brief.

`;

        const conciseCompanyContext = createConciseSupportContext({
            productName: "Attendance Machine",
            latestUserMessage: lastUserMsg,
            detectedLang: detectedLang,
            relevantText: relevantCompanyInfo,
            relevantLinks,
        }) + `
Language enforcement:
- The latest user message overrides all previous assistant messages and previous conversation language.
- If the detected language hint is "ja", reply only in Japanese.
- If the detected language hint is "zh", reply only in Simplified Chinese.
- Use "Boss" for Japanese and all non-Chinese replies.
`;
        console.log(`Attendance Machine selected context chars:`, relevantCompanyInfo.length);

        // const response = await openai.chat.completions.create({
        //     model: "gpt-4-turbo",
        //     messages: [
        //         { role: "system", content: conciseCompanyContext },
        //         ...messages // Inject previous conversation history
        //     ],
        //     max_tokens: 4096,
        //     temperature: 0.7,
        // });
        // 🔹 Generate the assistant’s response
        try {
            // 🔹 Create GPT request with retry
            const response = await createChatWithRetry({
                // model: "gpt-5",
                model: "gpt-4.1-mini",
                messages: [
                    { role: "system", content: conciseCompanyContext },
                    ...messages,
                ],
                // max_completion_tokens: 3000,
                max_completion_tokens: 800,
                temperature: 0.3,
            });

            console.log("Attendance Machine GPT usage:", response.usage);

            const rawAnswer = response?.choices?.[0]?.message?.content?.trim() || "";

            // 🔹 Detect AI flag
            let hasAnswer = true;

            if (rawAnswer.includes("__HAS_ANSWER__:false")) {
                hasAnswer = false;
            } else if (rawAnswer.includes("__HAS_ANSWER__:true")) {
                hasAnswer = true;
            }

            // 🔹 Clean the flag from final answer
            let answer = rawAnswer
                .replace("__HAS_ANSWER__:true", "")
                .replace("__HAS_ANSWER__:false", "")
                .trim();
            answer = await rewriteAnswerInDetectedLanguage(answer, detectedLang, lastUserMsg);
            console.log(hasAnswer, "hasAnswer");

            // 🔹 Store only if no answer
            if (!hasAnswer && !isDailyChatMessage(lastUserMsg) && !shouldSkipChatSideEffects(req)) {
                const unknownAnswer = answer || getFallbackMessage(detectedLang);
                await pool.query(
                    "INSERT INTO chatbot_unknown_question (question, lang, product, answer) VALUES (?, ?, ?, ?)",
                    [lastUserMsg, detectedLang, "Attendance Machine", unknownAnswer]
                );
            }


            // 🔹 Use fallback if GPT gave no answer
            if (!answer) {
                return res.json({
                    answer: getFallbackMessage(detectedLang),
                    lang: detectedLang,
                });
            }

            res.json({
                answer,
                lang: detectedLang,
            });

        } catch (error) {
            console.error("Error communicating with OpenAI API:", error.response?.data || error.message);

            // 🔹 Language-aware fallback on error
            return res.status(200).json({
                answer: getFallbackMessage(detectedLang),
                lang: detectedLang,
            });
        }

    } catch (error) {
        console.error(
            "Error communicating with OpenAI API:",
            error.response?.data || error.message
        );
        res.status(500).json({ error: "Failed to fetch response from OpenAI API." });
    }
});

router.post("/chatBot/attendanceMachine/transcribe", upload.single("file"), async (req, res) => {
    console.log("🎙️ API called for transcription");

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

        // ✅ Call OpenAI Whisper model
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

        // ✅ Add 5 blank lines for readability
        const formattedText = `${aiResponseText}\n\n\n\n\n`;

        // ✅ Save text under correct category section in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output", "Attendance Machine");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputFile = path.join(outputDir, "extracted_text.txt");


        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        let currentContent = fs.existsSync(outputFile)
            ? fs.readFileSync(outputFile, "utf8")
            : "";

        const sectionHeader = `\n===== ${category.toUpperCase()} SECTION =====\n`;
        const categoryRegex = new RegExp(
            `===== ${category.toUpperCase()} SECTION =====([\\s\\S]*?)(?=====|$)`,
            "i"
        );

        if (categoryRegex.test(currentContent)) {
            currentContent = currentContent.replace(categoryRegex, (match, p1) => {
                return `===== ${category.toUpperCase()} SECTION =====\n${p1.trim()}\n\n${formattedText}`;
            });
        } else {
            currentContent += `${sectionHeader}${formattedText}`;
        }

        fs.writeFileSync(outputFile, currentContent, "utf8");
        extractedAllText = extractTextFromTXT(outputFile);
        console.log(`✅ Audio transcription appended to ${category.toUpperCase()} section!`);

        res.json({
            success: true,
            message: `Audio transcription added to ${category} section successfully!`,
            filePath: outputFile,
        });
    } catch (error) {
        console.error("❌ Transcription error:", error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.error?.message || "Error processing the audio file.",
        });
    }
});

router.post("/chatBot/attendanceMachine/analyzeImage", upload.single("image"), async (req, res) => {
    console.log("🖼️ API called for image OCR analysis");

    let tempDir = null;

    try {
        const { category } = req.body;
        if (!req.file) return res.status(400).json({ message: "Image file is required." });
        if (!category) return res.status(400).json({ message: "Category is required in the request body." });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return res.status(401).json({ message: "API Key is missing." });

        // ✅ Create temp directory to store the uploaded image
        tempDir = path.join(__dirname, "../temp", uuid());
        await fs.ensureDir(tempDir);

        const imagePath = path.join(tempDir, "upload.png");
        await fs.writeFile(imagePath, req.file.buffer);

        // Convert image to base64
        const imageBuffer = await fs.readFile(imagePath);
        const imageBase64 = imageBuffer.toString("base64");

        // ✅ Call GPT-4 Vision API
        const response = await axios.post(
            "https://api.openai.com/v1/responses",
            {
                model: "gpt-4.1",
                input: [
                    {
                        role: "user",
                        content: [
                            { type: "input_text", text: "Extract all readable text from this image. Return raw text only." },
                            { type: "input_image", image_url: `data:image/png;base64,${imageBase64}` }
                        ]
                    }
                ],
                max_output_tokens: 2000
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const aiResponseText = response.data.output[0].content[0].text?.trim();
        if (!aiResponseText) return res.status(400).json({ message: "No text extracted from image." });

        // Add 5 blank lines after text
        const formattedText = `${aiResponseText}\n\n\n\n\n`;

        // Save text under category in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output", "Attendance Machine");
        await fs.ensureDir(outputDir);

        const outputFile = path.join(outputDir, "extracted_text.txt");
        let currentContent = await fs.pathExists(outputFile)
            ? await fs.readFile(outputFile, "utf8")
            : "";

        const sectionHeader = `\n===== ${category.toUpperCase()} SECTION =====\n`;
        const categoryRegex = new RegExp(`===== ${category.toUpperCase()} SECTION =====([\\s\\S]*?)(?=====|$)`, "i");

        if (categoryRegex.test(currentContent)) {
            currentContent = currentContent.replace(categoryRegex, (match, p1) => {
                return `===== ${category.toUpperCase()} SECTION =====\n${p1.trim()}\n\n${formattedText}`;
            });
        } else {
            currentContent += `${sectionHeader}${formattedText}`;
        }

        await fs.writeFile(outputFile, currentContent, "utf8");
        extractedAllText = extractTextFromTXT(outputFile);
        console.log(`✅ Image text appended to ${category.toUpperCase()} section!`);

        res.json({
            success: true,
            message: `Image text added to ${category} section successfully!`,
            filePath: outputFile,
        });

    } catch (error) {
        console.error("❌ Image OCR error:", error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.error?.message || "Error analyzing image.",
        });

    } finally {
        // ✅ Always delete temp folder
        if (tempDir && await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
            console.log("🗑️ Temp image folder deleted");
        }
    }
});

router.post("/chatBot/attendanceMachine/analyzePdf", upload.single("pdf"), async (req, res) => {
    console.log("📄 PDF analysis API called");

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

        // ✅ Create temp directory
        tempDir = path.join(__dirname, "../temp", uuid());
        await fs.ensureDir(tempDir);

        const pdfPath = path.join(tempDir, "upload.pdf");
        await fs.writeFile(pdfPath, req.file.buffer);

        // ✅ Convert PDF → PNG
        const convertOpts = {
            format: "png",
            out_dir: tempDir,
            out_prefix: "page",
            page: null,
        };
        await convert(pdfPath, convertOpts);

        const imageFiles = (await fs.readdir(tempDir))
            .filter((f) => f.endsWith(".png"))
            .map((f) => path.join(tempDir, f));

        const allResponses = [];

        for (const imagePath of imageFiles) {
            const imageBuffer = await fs.readFile(imagePath);
            const base64 = imageBuffer.toString("base64");

            const response = await axios.post(
                "https://api.openai.com/v1/responses",
                {
                    model: "gpt-4.1",
                    input: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: "Extract all readable text from this image. Return raw text only."
                                },
                                {
                                    type: "input_image",
                                    image_url: `data:image/png;base64,${base64}`
                                }
                            ]
                        }
                    ],
                    max_output_tokens: 2000
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const textContent = response.data.output[0].content[0].text?.trim();
            allResponses.push(textContent || "");
        }

        const fullText = allResponses.join("\n\n").trim();
        const formattedText = `${fullText}\n\n\n\n\n`;

        const outputDir = path.join(__dirname, "Output", "Attendance Machine");
        await fs.ensureDir(outputDir);

        const outputFilePath = path.join(outputDir, "extracted_text.txt");

        let currentContent = await fs.pathExists(outputFilePath)
            ? await fs.readFile(outputFilePath, "utf8")
            : "";

        const sectionHeader = `\n===== ${category.toUpperCase()} SECTION =====\n`;
        const categoryRegex = new RegExp(
            `===== ${category.toUpperCase()} SECTION =====([\\s\\S]*?)(?=====|$)`,
            "i"
        );

        if (categoryRegex.test(currentContent)) {
            currentContent = currentContent.replace(categoryRegex, (match, p1) => {
                return `===== ${category.toUpperCase()} SECTION =====\n${p1.trim()}\n\n${formattedText}`;
            });
        } else {
            currentContent += `${sectionHeader}${formattedText}`;
        }

        await fs.writeFile(outputFilePath, currentContent, "utf8");

        console.log(`✅ PDF text appended successfully!`);

        res.json({
            success: true,
            message: `PDF text successfully added to ${category} section!`,
            filePath: outputFilePath,
        });

    } catch (error) {
        console.error("❌ PDF analysis error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to analyze and store PDF text.",
            error: error.message,
        });

    } finally {
        // ✅ ALWAYS DELETE TEMP FOLDER
        if (tempDir && await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
            console.log("🗑️ Temp directory deleted");
        }
    }
});


module.exports = router;
