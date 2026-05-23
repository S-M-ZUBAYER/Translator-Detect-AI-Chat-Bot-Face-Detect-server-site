// Import necessary modules
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAIApi, default: OpenAI } = require("openai");
const fs = require("fs-extra");
const path = require("path");
const {
    extractUrls: extractFaqUrls,
    getRelevantTextByEmbedding,
    findRelevantTextForQuestion,
    rebuildEmbeddingIndex,
    createConciseSupportContext,
} = require("../utils/faqEmbeddingHelper");
const { appendFaqItemsToTextFile } = require("../utils/faqBulkAppendHelper");
const { applyFaqDraftsForProduct } = require("../utils/faqDraftApplyHelper");
const router = express.Router();
const mammoth = require('mammoth');
const multer = require('multer');
const FormData = require("form-data");
const stream = require("stream");
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

// OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const txtFilePath = path.join(__dirname, '/Output/extracted_text.txt');
let extractedAllText = extractTextFromTXT(txtFilePath);
const faqOutputDir = path.join(__dirname, "Output");
const faqEmbeddingConfig = {
    outputDir: faqOutputDir,
    productName: "General Chat",
    productSlug: "general_chat",
};

function isDailyChatMessage(message) {
    const text = (message || "").toLowerCase().trim();
    if (!text) return false;

    return /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's your day|what are you doing|what's your name|who are you|are you a robot|thank you|thanks|good answer|you are good|you're good|you are smart|you're smart|i like you|do you like me)\b/i.test(text);
}

function extractTextFromTXT(filePath) {
    try {
        // Read the text file content
        const text = fs.readFileSync(filePath, 'utf8');

        // Return the extracted text
        return text;
    } catch (err) {
        console.error("Error reading the file:", err.message);
        return null; // Return null if there is an error
    }
}

// 🔹 Detect user language
function detectLanguage(textToDetect) {
    if (!textToDetect || typeof textToDetect !== "string") return "en";

    textToDetect = textToDetect.trim();

    if (/[\u4e00-\u9fff]/.test(textToDetect)) return "zh"; // Chinese
    if (/[\u0E00-\u0E7F]/.test(textToDetect)) return "th"; // Thai
    if (/[\u3040-\u30ff]/.test(textToDetect)) return "ja"; // Japanese
    if (/[\uac00-\ud7af]/.test(textToDetect)) return "ko"; // Korean
    if (/[\u0600-\u06FF]/.test(textToDetect)) return "ar"; // Arabic
    if (/[\u0900-\u097F]/.test(textToDetect)) return "hi"; // Hindi
    if (/[\u0980-\u09FF]/.test(textToDetect)) return "bn"; // Bengali
    if (/[\u0750-\u077F\u0600-\u06FF]/.test(textToDetect)) return "ur"; // Urdu
    if (/[\u0400-\u04FF]/.test(textToDetect)) return "ru"; // Russian
    if (/[\u0100-\u017F\u1EA0-\u1EFF]/.test(textToDetect)) return "vi"; // Vietnamese
    if (/[\uA900-\uA92F]/.test(textToDetect)) return "my"; // Burmese (Myanmar)
    if (/[\u0D80-\u0DFF]/.test(textToDetect)) return "si"; // Sinhala (Sri Lanka)
    if (/[\u0C80-\u0CFF]/.test(textToDetect)) return "kn"; // Kannada (India)
    if (/[\u0A80-\u0AFF]/.test(textToDetect)) return "gu"; // Gujarati (India)
    if (/[\u0B80-\u0BFF]/.test(textToDetect)) return "ta"; // Tamil (India, Singapore)
    if (/[\u0D00-\u0D7F]/.test(textToDetect)) return "ml"; // Malayalam (India)
    if (/[\u1B80-\u1BBF]/.test(textToDetect)) return "id"; // Indonesian / Malay
    if (/[\u1700-\u171F]/.test(textToDetect)) return "tl"; // Filipino / Tagalog
    if (/[a-zA-Z]/.test(textToDetect)) return "en"; // English (Latin alphabet fallback)

    return "en"; // Default to English
}

// 🔹 Polished multilingual fallback message generator
function getFallbackMessage(lang) {
    switch (lang) {
        case "zh":
            return "抱歉亲，系统暂时出现问题，请稍后再试。感谢您的理解与耐心。";
        case "th":
            return "ขออภัยครับบอส ขณะนี้ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง ขอบคุณครับ";
        case "bn":
            return "দুঃখিত বস, সিস্টেমে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন। ধন্যবাদ।";
        case "ar":
            return "عذرًا يا بوس، هناك خلل مؤقت في النظام. يُرجى المحاولة مرة أخرى لاحقًا. شكرًا لتفهمك.";
        case "ja":
            return "申し訳ありません、ボス。現在システムに一時的な問題が発生しています。しばらくしてから再度お試しください。";
        case "ko":
            return "죄송합니다, 보스. 현재 시스템에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        case "vi":
            return "Xin lỗi sếp, hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau. Cảm ơn bạn đã thông cảm.";
        case "id":
            return "Maaf bos, sistem sedang mengalami gangguan sementara. Silakan coba lagi nanti. Terima kasih atas pengertiannya.";
        case "tl":
            return "Pasensya na boss, pansamantalang may problema ang sistema. Pakiulit na lang po mamaya. Salamat sa iyong pag-unawa.";
        case "ru":
            return "Извините, босс. Произошла временная ошибка системы. Пожалуйста, попробуйте позже. Спасибо за понимание.";
        case "hi":
            return "माफ़ कीजिए बॉस, सिस्टम में अस्थायी समस्या है। कृपया बाद में फिर से प्रयास करें। धन्यवाद।";
        default:
            return "Sorry boss, there’s a temporary system issue. Please try again later. Thank you for your patience.";
    }
}

// 🔹 Retry wrapper for OpenAI
async function createChatWithRetry(params, retries = 2) {
    try {
        return await openai.chat.completions.create(params);
    } catch (error) {
        if (retries > 0) {
            console.warn("Retrying OpenAI API due to error:", error.message);
            await new Promise(res => setTimeout(res, 1000));
            return createChatWithRetry(params, retries - 1);
        }
        throw error;
    }
}

router.post("/chatBot/extract-text", upload.single("docxFile"), async (req, res) => {
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

        const outputDir = path.join(__dirname, "Output");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputFilePath = path.join(outputDir, "extracted_text.txt");
        const sectionHeader = `\n\n===== ${category.toUpperCase()} SECTION =====\n`;
        const currentContent = `${sectionHeader}${formattedText}`;

        fs.writeFileSync(outputFilePath, currentContent, "utf8");

        extractedAllText = extractTextFromTXT(outputFilePath);
        try {
            await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });
        } catch (embeddingError) {
            console.warn(`General Chat embedding rebuild failed:`, embeddingError.message);
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

router.post('/chatBot/append-text', async (req, res) => {
    const { text, category } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Text is required in the request body.' });
    }

    if (!category) {
        return res.status(400).json({ message: 'Category is required in the request body.' });
    }


    const outputDir = path.join(__dirname, "Output");
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
            console.warn(`General Chat embedding rebuild failed:`, embeddingError.message);
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

router.post("/chatBot/faq/bulkAppend", async (req, res) => {
    try {
        const { items, category = "FAQ" } = req.body;
        const outputDir = path.join(__dirname, "Output");
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
        console.error("General Chat FAQ bulk append error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to bulk append FAQ questions.", error: error.message });
    }
});

router.post("/chatBot/faq/applyDrafts", async (req, res) => {
    try {
        const { userEmail, ids, category = "FAQ" } = req.body;
        const outputFilePath = path.join(__dirname, "Output", "extracted_text.txt");
        const result = await applyFaqDraftsForProduct({
            db: req.db,
            product: "General Chat",
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
        console.error("General Chat FAQ draft apply error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to apply FAQ drafts.", error: error.message });
    }
});

router.post("/chatBot/chat/gpt", async (req, res) => {
    const { messages } = req.body; // Now expecting an array of messages

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
    }

    try {
        const lastUserMsg = [...messages].reverse().find(message => message.role === "user")?.content || "";
        const userLang = detectLanguage(lastUserMsg);
        const relevantCompanyInfo = await findRelevantTextForQuestion({
            ...faqEmbeddingConfig,
            allText: extractedAllText,
            question: lastUserMsg,
            detectedLang: userLang,
        });
        const relevantLinks = extractFaqUrls(relevantCompanyInfo).slice(0, 5);
        const companyContext = `
You are a helpful assistant for a brand named Grozziie.

MOST IMPORTANT LANGUAGE RULE:
- Reply in the exact same language and script as the user's most recent message.
- The user's most recent message is: "${lastUserMsg}"
- Detected script/language hint: "${userLang}"
- If the user writes in Japanese, reply in Japanese.
- If the user writes in Bengali/Bangla, reply in Bengali/Bangla.
- If the user writes in Thai, reply in Thai.
- If the user writes in Chinese, reply in Chinese.
- If the user writes in Indonesian, Tagalog/Filipino, Malay, Vietnamese, Hindi, Arabic, Korean, Russian, Spanish, French, or any other common language, reply in that same language.
- Do not translate the user's question into English before answering.
- Only use English when the user's most recent message is English or the language is impossible to identify.

Here is some information about Grozziie brand:
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
            productName: "General Chat",
            latestUserMessage: lastUserMsg,
            detectedLang: userLang,
            relevantText: relevantCompanyInfo,
            relevantLinks,
        });
        console.log(`General Chat selected context chars:`, relevantCompanyInfo.length);

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

            const answer = response?.choices?.[0]?.message?.content?.trim();
            const hasAnswer = !answer?.includes("__HAS_ANSWER__:false");

            if (!hasAnswer && !isDailyChatMessage(lastUserMsg)) {
                const unknownAnswer = (answer || getFallbackMessage(userLang))
                    .replace("__HAS_ANSWER__:true", "")
                    .replace("__HAS_ANSWER__:false", "")
                    .trim();
                await pool.query(
                    "INSERT INTO chatbot_unknown_question (question, lang, product, answer) VALUES (?, ?, ?, ?)",
                    [lastUserMsg, userLang, "General Chat", unknownAnswer]
                );
            }

            // 🔹 Use fallback if GPT gave no answer
            if (!answer) {
                return res.json({
                    answer: getFallbackMessage(userLang),
                    lang: userLang,
                });
            }

            res.json({
                answer,
                lang: detectLanguage(answer || lastUserMsg),
            });

        } catch (error) {
            console.error("Error communicating with OpenAI API:", error.response?.data || error.message);

            // 🔹 Language-aware fallback on error
            return res.status(200).json({
                answer: getFallbackMessage(userLang),
                lang: userLang,
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

router.post("/chatBot/transcribe", upload.single("file"), async (req, res) => {
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

        // ✅ Save under category in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output");
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

router.post("/chatBot/analyze-image", upload.single("image"), async (req, res) => {
    console.log("🖼️ API called for image OCR analysis");

    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "Image file is required." });
        }
        if (!category) {
            return res.status(400).json({ message: "Category is required in the request body." });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ message: "API Key is missing." });
        }

        const imageBase64 = req.file.buffer.toString("base64");

        // ✅ Call GPT-4-Turbo Vision API
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a professional OCR system. Extract ONLY visible text from the image, preserving exact line breaks and spacing. Return raw text only.",
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all readable text from this image." },
                            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
                        ],
                    },
                ],
                max_tokens: 2000,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const aiResponseText = response.data.choices[0].message.content?.trim();
        if (!aiResponseText) {
            return res.status(400).json({ message: "No text extracted from image." });
        }

        // ✅ Add 5 blank lines after
        const formattedText = `${aiResponseText}\n\n\n\n\n`;

        // ✅ Save text under category in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output");
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
    }
});

router.post("/chatBot/analyze-pdf", upload.single("pdf"), async (req, res) => {
    console.log("📄 PDF analysis API called");

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

        // ✅ Temporary storage for uploaded PDF
        const tempDir = path.join(__dirname, "../temp", uuid());
        await fs.ensureDir(tempDir);

        const pdfPath = path.join(tempDir, "upload.pdf");
        await fs.writeFile(pdfPath, req.file.buffer);

        // ✅ Convert PDF pages to PNGs
        const convertOpts = {
            format: "png",
            out_dir: tempDir,
            out_prefix: "page",
            page: null,
        };
        await convert(pdfPath, convertOpts);

        // ✅ Gather all image pages
        const imageFiles = (await fs.readdir(tempDir))
            .filter((f) => f.endsWith(".png"))
            .map((f) => path.join(tempDir, f));

        const allResponses = [];

        for (const imagePath of imageFiles) {
            const imageBuffer = await fs.readFile(imagePath);
            const base64 = imageBuffer.toString("base64");

            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4-turbo",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Extract all visible text from the given image, preserving structure and order.",
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Extract all readable text from this image accurately.",
                                },
                                {
                                    type: "image_url",
                                    image_url: { url: `data:image/png;base64,${base64}` },
                                },
                            ],
                        },
                    ],
                    max_tokens: 2000,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const textContent = response.data.choices[0].message.content || "";
            allResponses.push(textContent.trim());
        }

        // ✅ Cleanup temp files
        await fs.remove(tempDir);

        const fullText = allResponses.join("\n\n").trim();

        // ✅ Add 5 blank lines after text
        const formattedText = `${fullText}\n\n\n\n\n`;

        // ✅ Save text under correct category section in Output/extracted_text.txt
        const outputDir = path.join(__dirname, "Output");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputFilePath = path.join(outputDir, "extracted_text.txt");

        // Ensure Output folder exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        let currentContent = fs.existsSync(outputFilePath)
            ? fs.readFileSync(outputFilePath, "utf8")
            : "";

        const sectionHeader = `\n===== ${category.toUpperCase()} SECTION =====\n`;
        const categoryRegex = new RegExp(
            `===== ${category.toUpperCase()} SECTION =====([\\s\\S]*?)(?=====|$)`,
            "i"
        );

        if (categoryRegex.test(currentContent)) {
            // ✅ Append text to existing section
            currentContent = currentContent.replace(categoryRegex, (match, p1) => {
                return `===== ${category.toUpperCase()} SECTION =====\n${p1.trim()}\n\n${formattedText}`;
            });
        } else {
            // ✅ Create new section
            currentContent += `${sectionHeader}${formattedText}`;
        }

        fs.writeFileSync(outputFilePath, currentContent, "utf8");
        extractedAllText = extractTextFromTXT(outputFilePath);
        try {
            await rebuildEmbeddingIndex({ ...faqEmbeddingConfig, allText: extractedAllText });
        } catch (embeddingError) {
            console.warn(`General Chat embedding rebuild failed:`, embeddingError.message);
        }

        console.log(`✅ PDF text appended to ${category.toUpperCase()} section successfully!`);

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
    }
});


module.exports = router;
