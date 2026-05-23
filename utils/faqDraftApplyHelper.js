const path = require("path");
const { appendFaqItemsToTextFile } = require("./faqBulkAppendHelper");

function parseVariants(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeIdList(ids) {
    if (!Array.isArray(ids)) return [];

    return ids
        .map(id => parseInt(id, 10))
        .filter(id => Number.isInteger(id) && id > 0);
}

async function applyFaqDraftsForProduct({
    db,
    product,
    userEmail,
    ids,
    category = "FAQ",
    outputFilePath,
    rebuildEmbeddings,
}) {
    const email = String(userEmail || "").trim().toLowerCase();
    const draftIds = normalizeIdList(ids);

    if (!email) {
        return { success: false, status: 400, message: "userEmail is required." };
    }

    let query = `
        SELECT id, question, answer, variants
        FROM chatbot_faq_draft
        WHERE product = ?
          AND user_email = ?
          AND status = 'pending'
    `;
    const params = [product, email];

    if (draftIds.length) {
        query += ` AND id IN (${draftIds.map(() => "?").join(",")})`;
        params.push(...draftIds);
    }

    query += " ORDER BY created_at ASC, id ASC";

    const [drafts] = await db.query(query, params);
    if (!drafts.length) {
        return { success: false, status: 404, message: "No pending FAQ drafts found." };
    }

    const items = drafts.map(draft => ({
        question: draft.question,
        answer: draft.answer,
        variants: parseVariants(draft.variants),
    }));

    const appendResult = await appendFaqItemsToTextFile({
        outputFilePath,
        category,
        items,
    });

    if (!appendResult.success) return appendResult;

    await rebuildEmbeddings(appendResult.allText);

    for (let index = 0; index < drafts.length; index++) {
        await db.query(
            `
            UPDATE chatbot_faq_draft
            SET status = 'applied',
                q_id = ?,
                applied_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [appendResult.added[index].id, drafts[index].id]
        );
    }

    return {
        success: true,
        filePath: path.normalize(outputFilePath),
        allText: appendResult.allText,
        added: appendResult.added.map((item, index) => ({
            ...item,
            draftId: drafts[index].id,
        })),
    };
}

module.exports = {
    applyFaqDraftsForProduct,
};
