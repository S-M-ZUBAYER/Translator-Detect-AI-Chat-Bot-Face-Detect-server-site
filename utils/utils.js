// utils.js
const fs = require("fs");
const { OpenAI } = require("openai");

// 🔹 Initialize OpenAI instance
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    const normalizedText = textToDetect.toLowerCase();
    const countLanguageTerms = (terms) => terms.reduce((count, term) => (
        new RegExp(`\\b${term}\\b`, "i").test(normalizedText) ? count + 1 : count
    ), 0);

    if (/[\u3040-\u30ff]/.test(textToDetect)) return "ja"; // Japanese Kana; check before Chinese because Japanese often uses Kanji
    if (/[\u4e00-\u9fff]/.test(textToDetect)) return "zh"; // Chinese
    if (/[\u0E00-\u0E7F]/.test(textToDetect)) return "th"; // Thai
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
    const filipinoScore = countLanguageTerms(["ano", "paano", "saan", "kailan", "bakit", "magkano", "maaari", "pwede", "puwede", "ito", "iyon", "ako", "ikaw", "natin", "ng", "mga", "ang", "ko", "mo"]);
    const portugueseScore = countLanguageTerms(["como", "onde", "quando", "porque", "qual", "quais", "posso", "pode", "configurar", "definir", "regra", "regras", "atraso", "saída", "saida", "chegada", "funcionário", "funcionario"]);
    if (portugueseScore >= 1 || /[ãõçáéíóúâêôà]/i.test(textToDetect)) return "pt"; // Portuguese
    if (filipinoScore >= 2 || /\b(paano|saan|kailan|bakit|magkano|puwede|pwede)\b/.test(normalizedText)) return "tl"; // Filipino / Tagalog in Latin script
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

// 🔹 Export everything
module.exports = {
    extractTextFromTXT,
    detectLanguage,
    getFallbackMessage,
    createChatWithRetry,
    openai, // optionally export OpenAI instance if needed elsewhere
};









