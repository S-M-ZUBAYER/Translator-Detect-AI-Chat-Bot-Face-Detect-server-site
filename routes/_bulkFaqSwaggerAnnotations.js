/**
 * @swagger
 * /chatBot/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (General)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/attendanceMachine/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Attendance Machine)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/manualAttendanceMachine/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Manual Attendance Machine)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/dotPrinter/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Dot Printer)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/thermalPrinter/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Thermal Printer)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/powerBank/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Power Bank)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/faceAttendance/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Face Attendance)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 *
 * /chatBot/deviceFaceAttendanceMachine/faq/bulkAppend:
 *   post:
 *     summary: Bulk append FAQ question-answer pairs (Device Face Attendance Machine)
 *     description: Appends multiple FAQ question-answer pairs, automatically assigns Q numbers, and rebuilds embeddings.
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFaqAppendRequest'
 *     responses:
 *       200:
 *         description: FAQ questions added and embeddings updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkFaqAppendResponse'
 *       400:
 *         description: At least one valid question and answer is required
 *       500:
 *         description: Failed to bulk append FAQ questions
 */

module.exports = {};
