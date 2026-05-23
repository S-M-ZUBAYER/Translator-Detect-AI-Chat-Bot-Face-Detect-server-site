const express = require("express");
const {
    PRODUCT_FAQ_FILES,
    getFaqItemsForProduct,
    getPagination,
    paginate,
} = require("../utils/faqListHelper");

const router = express.Router();

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function serializeVariants(variants) {
    if (!Array.isArray(variants)) return null;
    const cleaned = variants.map(item => String(item || "").trim()).filter(Boolean);
    return cleaned.length ? JSON.stringify(cleaned) : null;
}

router.get("/chatBot/faqs", async (req, res) => {
    try {
        const product = String(req.query.product || "").trim();
        const search = String(req.query.search || "").trim().toLowerCase();
        const { page, limit } = getPagination(req.query);

        if (!product) {
            return res.status(400).json({
                success: false,
                message: "product query parameter is required.",
                products: Object.keys(PRODUCT_FAQ_FILES),
            });
        }

        const result = getFaqItemsForProduct(product);
        if (!result.found) {
            return res.status(400).json({
                success: false,
                message: "Invalid product.",
                products: Object.keys(PRODUCT_FAQ_FILES),
            });
        }

        const items = search
            ? result.items.filter(item =>
                item.id.toLowerCase().includes(search) ||
                item.question.toLowerCase().includes(search) ||
                item.answer.toLowerCase().includes(search)
            )
            : result.items;
        const pagination = paginate(items, page, limit);

        return res.json({
            success: true,
            product,
            filePath: result.filePath,
            ...pagination,
        });
    } catch (error) {
        console.error("FAQ list error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch FAQ list.", error: error.message });
    }
});

router.post("/chatBot/faq-drafts", async (req, res) => {
    try {
        const { product, userEmail, question, answer, variants } = req.body;
        const email = normalizeEmail(userEmail);
        const cleanProduct = String(product || "").trim();
        const cleanQuestion = String(question || "").trim();
        const cleanAnswer = String(answer || "").trim();

        if (!cleanProduct || !email || !cleanQuestion || !cleanAnswer) {
            return res.status(400).json({
                success: false,
                message: "product, userEmail, question, and answer are required.",
            });
        }

        const [result] = await req.db.query(
            `
            INSERT INTO chatbot_faq_draft (product, user_email, question, answer, variants)
            VALUES (?, ?, ?, ?, ?)
            `,
            [cleanProduct, email, cleanQuestion, cleanAnswer, serializeVariants(variants)]
        );

        return res.status(201).json({
            success: true,
            message: "FAQ draft saved successfully.",
            data: {
                id: result.insertId,
                product: cleanProduct,
                userEmail: email,
                question: cleanQuestion,
                answer: cleanAnswer,
                variants: Array.isArray(variants) ? variants : [],
                status: "pending",
            },
        });
    } catch (error) {
        console.error("FAQ draft save error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to save FAQ draft.", error: error.message });
    }
});

router.get("/chatBot/faq-drafts", async (req, res) => {
    try {
        const { product, userEmail, status = "pending" } = req.query;
        const email = normalizeEmail(userEmail);
        const conditions = [];
        const params = [];

        if (product) {
            conditions.push("product = ?");
            params.push(String(product).trim());
        }

        if (email) {
            conditions.push("user_email = ?");
            params.push(email);
        }

        if (status && status !== "all") {
            conditions.push("status = ?");
            params.push(String(status).trim());
        }

        let query = `
            SELECT id, product, user_email AS userEmail, question, answer, variants, status, q_id AS qId,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
                   DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
                   DATE_FORMAT(applied_at, '%Y-%m-%d %H:%i:%s') AS appliedAt
            FROM chatbot_faq_draft
        `;

        if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
        query += " ORDER BY created_at DESC, id DESC";

        const [rows] = await req.db.query(query, params);
        const data = rows.map(row => ({
            ...row,
            variants: row.variants ? JSON.parse(row.variants) : [],
        }));

        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error("FAQ draft list error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch FAQ drafts.", error: error.message });
    }
});

router.put("/chatBot/faq-drafts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { product, userEmail, question, answer, variants } = req.body;
        const fields = [];
        const values = [];

        if (product !== undefined) { fields.push("product = ?"); values.push(String(product).trim()); }
        if (userEmail !== undefined) { fields.push("user_email = ?"); values.push(normalizeEmail(userEmail)); }
        if (question !== undefined) { fields.push("question = ?"); values.push(String(question).trim()); }
        if (answer !== undefined) { fields.push("answer = ?"); values.push(String(answer).trim()); }
        if (variants !== undefined) { fields.push("variants = ?"); values.push(serializeVariants(variants)); }

        if (!fields.length) {
            return res.status(400).json({ success: false, message: "No fields to update." });
        }

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        const [result] = await req.db.query(
            `UPDATE chatbot_faq_draft SET ${fields.join(", ")} WHERE id = ? AND status = 'pending'`,
            values
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Pending FAQ draft not found." });
        }

        return res.json({ success: true, message: "FAQ draft updated successfully." });
    } catch (error) {
        console.error("FAQ draft update error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to update FAQ draft.", error: error.message });
    }
});

router.delete("/chatBot/faq-drafts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await req.db.query(
            "DELETE FROM chatbot_faq_draft WHERE id = ? AND status = 'pending'",
            [id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Pending FAQ draft not found." });
        }

        return res.json({ success: true, message: "FAQ draft deleted successfully." });
    } catch (error) {
        console.error("FAQ draft delete error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to delete FAQ draft.", error: error.message });
    }
});

module.exports = router;
