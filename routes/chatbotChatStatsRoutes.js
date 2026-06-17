const express = require("express");

const router = express.Router();

/**
 * @swagger
 * /chatBot/chat-stats:
 *   get:
 *     summary: Get chatbot question hit counts by date and product
 *     description: Returns total chatbot question/API hits, grouped by date and product category. Use date for one day, or startDate/endDate for a date range. Use product for device/category wise filtering.
 *     tags: [Chat Statistics]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-06-17"
 *         description: Count hits for one date.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-06-01"
 *         description: Start date for range count.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-06-17"
 *         description: End date for range count.
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *           example: "Face Attendance"
 *         description: Product/device category filter.
 *     responses:
 *       200:
 *         description: Chatbot hit statistics returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalHits:
 *                   type: integer
 *                   example: 42
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         example: "2026-06-17"
 *                       product:
 *                         type: string
 *                         example: "Face Attendance"
 *                       totalHits:
 *                         type: integer
 *                         example: 25
 *       500:
 *         description: Failed to fetch chat stats.
 */
router.get("/chatBot/chat-stats", async (req, res) => {
    try {
        const { date, product, startDate, endDate } = req.query;
        const conditions = [];
        const params = [];

        if (date) {
            conditions.push("DATE(created_at) = ?");
            params.push(String(date).trim());
        }

        if (startDate) {
            conditions.push("DATE(created_at) >= ?");
            params.push(String(startDate).trim());
        }

        if (endDate) {
            conditions.push("DATE(created_at) <= ?");
            params.push(String(endDate).trim());
        }

        if (product) {
            conditions.push("product = ?");
            params.push(String(product).trim());
        }

        let query = `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
                product,
                COUNT(*) AS totalHits
            FROM chatbot_chat_api_hit
        `;

        if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;

        query += `
            GROUP BY DATE(created_at), product
            ORDER BY DATE(created_at) DESC, product ASC
        `;

        const [rows] = await req.db.query(query, params);
        const totalHits = rows.reduce((sum, row) => sum + Number(row.totalHits || 0), 0);

        return res.json({
            success: true,
            totalHits,
            count: rows.length,
            filters: {
                date: date || null,
                startDate: startDate || null,
                endDate: endDate || null,
                product: product || null,
            },
            data: rows,
        });
    } catch (error) {
        console.error("Chat stats fetch error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch chat stats.",
            error: error.message,
        });
    }
});

module.exports = router;
