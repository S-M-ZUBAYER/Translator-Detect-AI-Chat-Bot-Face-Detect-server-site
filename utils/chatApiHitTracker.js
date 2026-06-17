function shouldSkipChatSideEffects(req) {
    return req.path.endsWith("/chat/gpt/no-store");
}

async function recordChatApiHit(req, { product }) {
    try {
        if (shouldSkipChatSideEffects(req)) return;
        if (!req.db || typeof req.db.query !== "function") return;

        await req.db.query(
            `
            INSERT INTO chatbot_chat_daily_count (hit_date, product, total_hits)
            VALUES (CURRENT_DATE, ?, 1)
            ON DUPLICATE KEY UPDATE
                total_hits = total_hits + 1,
                updated_at = CURRENT_TIMESTAMP
            `,
            [String(product || "").trim()]
        );
    } catch (error) {
        console.warn("Chat API hit tracking failed:", error.message);
    }
}

module.exports = { recordChatApiHit, shouldSkipChatSideEffects };
