const fs = require("fs-extra");
const path = require("path");

const PRODUCT_FAQ_FILES = {
    "General Chat": path.join(__dirname, "..", "routes", "Output", "extracted_text.txt"),
    "Attendance Machine": path.join(__dirname, "..", "routes", "Output", "Attendance Machine", "extracted_text.txt"),
    "Manual Attendance Machine": path.join(__dirname, "..", "routes", "Output", "Manual Attendance Machine", "extracted_text.txt"),
    "Dot Printer": path.join(__dirname, "..", "routes", "Output", "Dot Printer", "extracted_text.txt"),
    "Thermal Printer": path.join(__dirname, "..", "routes", "Output", "Thermal Printer", "extracted_text.txt"),
    "Power Bank": path.join(__dirname, "..", "routes", "Output", "Power Bank", "extracted_text.txt"),
    "Face Attendance": path.join(__dirname, "..", "routes", "Output", "Face Attendance", "extracted_text.txt"),
    "Warehouse ERP": path.join(__dirname, "..", "routes", "Output", "Warehouse ERP", "extracted_text.txt"),
    "Warehouse ERP App Site": path.join(__dirname, "..", "routes", "Output", "Warehouse ERP App Site", "extracted_text.txt"),
    "Face Attendance Website": path.join(__dirname, "..", "routes", "Output", "Face Attendance Website", "extracted_text.txt"),
    "Device Face Attendance Machine": path.join(__dirname, "..", "routes", "Output", "Device Face Attendance Machine", "extracted_text.txt"),
};

function getPagination(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
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

function getFaqItemsForProduct(product) {
    const filePath = PRODUCT_FAQ_FILES[product];
    if (!filePath) return { found: false, filePath: null, items: [] };
    if (!fs.existsSync(filePath)) return { found: true, filePath, items: [] };

    const text = fs.readFileSync(filePath, "utf8");
    return { found: true, filePath, items: parseFaqItems(text) };
}

module.exports = {
    PRODUCT_FAQ_FILES,
    getFaqItemsForProduct,
    getPagination,
    paginate,
};
