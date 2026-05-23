/**
 * @swagger
 * /chatBot/faqs:
 *   get:
 *     summary: Get paginated FAQ question-answer list by product
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: query
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *         example: Face Attendance
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: price
 *     responses:
 *       200:
 *         description: Product FAQ list returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 product:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 hasNextPage:
 *                   type: boolean
 *                 hasPrevPage:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FaqListItem'
 *       400:
 *         description: Missing or invalid product
 *       500:
 *         description: Failed to fetch FAQ list
 *
 * /chatBot/unknown-questions-paginated:
 *   get:
 *     summary: Get paginated unknown questions
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *         example: Face Attendance
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *         example: en
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: price
 *     responses:
 *       200:
 *         description: Paginated unknown questions returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 hasNextPage:
 *                   type: boolean
 *                 hasPrevPage:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UnknownQuestion'
 *       500:
 *         description: Failed to fetch paginated questions
 */

module.exports = {};
