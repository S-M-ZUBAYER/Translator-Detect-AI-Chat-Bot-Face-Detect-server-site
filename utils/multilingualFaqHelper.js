const fs = require("fs-extra");
const path = require("path");

const ALLOWED_PRODUCTS = Object.freeze({
    "warehouse erp": "Warehouse ERP",
    "warehouse erp app site": "Warehouse ERP App Site",
    "face attendance": "Face Attendance",
    "face attendance website": "Face Attendance Website",
});

const SUPPORTED_LANGUAGES = Object.freeze({
    EN: { code: "EN", name: "English", aliases: ["EN", "ENG", "ENGLISH"] },
    CN: { code: "CN", name: "Chinese", aliases: ["CN", "ZH", "CHINESE", "CHINA"] },
    PH: { code: "PH", name: "Filipino", aliases: ["PH", "FIL", "TL", "TAGALOG", "FILIPINO", "PHILIPPINE", "PHILIPINE"] },
    VI: { code: "VI", name: "Vietnamese", aliases: ["VI", "VN", "VIE", "VIETNAMESE", "VIENTNAME"] },
    ID: { code: "ID", name: "Indonesian", aliases: ["ID", "IND", "INDONESIAN", "INDONESIA"] },
    MY: { code: "MY", name: "Malay", aliases: ["MY", "MS", "MAY", "MALAY", "MALAYSIA", "MALAYSIAN"] },
    TH: { code: "TH", name: "Thai", aliases: ["TH", "THAI", "THAILAND"] },
    PT: { code: "PT", name: "Portuguese", aliases: ["PT", "POR", "PORTUGUESE", "PORTUGIZE", "PORTUGAL"] },
    JP: { code: "JP", name: "Japanese", aliases: ["JP", "JA", "JAPANESE", "JAPAN"] },
});

const LANGUAGE_ALIAS_TO_CODE = Object.values(SUPPORTED_LANGUAGES).reduce((map, language) => {
    language.aliases.forEach(alias => {
        map[alias.toUpperCase()] = language.code;
    });
    return map;
}, {});

const BASE_DIR = path.join(__dirname, "..", "routes", "Output", "Multilingual FAQ");
const TEXT_FILE_NAME = "extracted_text.txt";
const DOCX_FILE_NAME = "source.docx";
const METADATA_FILE_NAME = "metadata.json";

function normalizeProduct(product) {
    const key = String(product || "").trim().replace(/\s+/g, " ").toLowerCase();
    return ALLOWED_PRODUCTS[key] || null;
}

function normalizeLanguage(value) {
    const key = String(value || "").trim().toUpperCase();
    const code = LANGUAGE_ALIAS_TO_CODE[key];
    return code ? SUPPORTED_LANGUAGES[code] : null;
}

function getRequestedLanguage(queryOrBody = {}) {
    return queryOrBody.lan || queryOrBody.Lan || queryOrBody.lang || queryOrBody.language;
}

function getProductLanguageDir(product, languageCode) {
    return path.join(BASE_DIR, product, languageCode);
}

function getProductLanguagePaths(product, languageCode) {
    const languageDir = getProductLanguageDir(product, languageCode);
    return {
        languageDir,
        textFilePath: path.join(languageDir, TEXT_FILE_NAME),
        docxFilePath: path.join(languageDir, DOCX_FILE_NAME),
        metadataFilePath: path.join(languageDir, METADATA_FILE_NAME),
    };
}

function getPagination(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    return { page, limit };
}

function paginate(items, page, limit) {
    const total = items.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const start = (page - 1) * limit;

    return {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        data: items.slice(start, start + limit),
    };
}

function splitQABlocks(text) {
    if (!text || typeof text !== "string") return [];

    const matches = [...text.matchAll(/(^|\n)(Q-\d+[:.]\s*[\s\S]*?)(?=\nQ-\d+[:.]|$)/g)];
    return matches.map(match => match[2].trim()).filter(Boolean);
}

function parseFaqItems(text) {
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
            return { id, question, answer, variants };
        })
        .filter(Boolean);
}

function filterFaqItems(items, search) {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return items;

    return items.filter(item => {
        const variants = Array.isArray(item.variants) ? item.variants.join(" ") : "";
        return [item.id, item.question, item.answer, variants]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(term));
    });
}

function getSupportedProducts() {
    return [...new Set(Object.values(ALLOWED_PRODUCTS))];
}

function getSupportedLanguages() {
    return Object.values(SUPPORTED_LANGUAGES).map(({ code, name }) => ({ code, name }));
}

async function saveLanguageFaqFile({ product, language, docxBuffer, originalName, extractedText }) {
    const paths = getProductLanguagePaths(product, language.code);
    await fs.ensureDir(paths.languageDir);
    await fs.writeFile(paths.docxFilePath, docxBuffer);
    await fs.writeFile(paths.textFilePath, extractedText, "utf8");

    const items = parseFaqItems(extractedText);
    const metadata = {
        product,
        lan: language.code,
        language: language.name,
        originalName: originalName || null,
        itemCount: items.length,
        uploadedAt: new Date().toISOString(),
    };
    await fs.writeJson(paths.metadataFilePath, metadata, { spaces: 2 });

    return { paths, metadata, items };
}

async function getLanguageFaqItems({ product, language, search }) {
    const paths = getProductLanguagePaths(product, language.code);
    const fileExists = await fs.pathExists(paths.textFilePath);
    if (!fileExists) {
        return { paths, exists: false, items: [] };
    }

    const text = await fs.readFile(paths.textFilePath, "utf8");
    const items = filterFaqItems(parseFaqItems(text), search);
    return { paths, exists: true, items };
}

module.exports = {
    normalizeProduct,
    normalizeLanguage,
    getRequestedLanguage,
    getPagination,
    paginate,
    getSupportedProducts,
    getSupportedLanguages,
    saveLanguageFaqFile,
    getLanguageFaqItems,
};