function getRequestIp(req) {
    return (
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null
    );
}

function shouldSkipChatSideEffects(req) {
    return req.path.endsWith("/chat/gpt/no-store");
}

async function recordChatApiHit(req, { product, routePath, question, lang }) {
    try {
        if (shouldSkipChatSideEffects(req)) return;
        if (!req.db || typeof req.db.query !== "function") return;

        await req.db.query(
            `
            INSERT INTO chatbot_chat_api_hit
                (product, route_path, question, lang, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                String(product || "").trim(),
                String(routePath || req.originalUrl || "").trim(),
                String(question || "").trim().slice(0, 5000) || null,
                String(lang || "").trim() || null,
                getRequestIp(req),
                String(req.headers["user-agent"] || "").slice(0, 500) || null,
            ]
        );
    } catch (error) {
        console.warn("Chat API hit tracking failed:", error.message);
    }
}

module.exports = { recordChatApiHit, shouldSkipChatSideEffects };
