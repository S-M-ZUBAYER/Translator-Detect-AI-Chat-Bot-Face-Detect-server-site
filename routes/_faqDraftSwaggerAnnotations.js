/**
 * @swagger
 * /chatBot/faq-drafts:
 *   post:
 *     summary: Save a pending FAQ question-answer draft
 *     description: Stores a product-specific FAQ question-answer pair for a user. It does not update TXT or embeddings until an applyDrafts endpoint is called.
 *     tags: [Unknown Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFaqDraftRequest'
 *     responses:
 *       201:
 *         description: FAQ draft saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FaqDraft'
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to save FAQ draft
 *
 *   get:
 *     summary: List FAQ drafts
 *     description: Returns FAQ drafts filtered by product, userEmail, and status. Use status=all to include applied drafts.
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *         example: Face Attendance
 *       - in: query
 *         name: userEmail
 *         schema:
 *           type: string
 *         example: agent@example.com
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: pending
 *     responses:
 *       200:
 *         description: FAQ drafts returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FaqDraft'
 *       500:
 *         description: Failed to fetch FAQ drafts
 *
 * /chatBot/faq-drafts/{id}:
 *   put:
 *     summary: Update a pending FAQ draft
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFaqDraftRequest'
 *     responses:
 *       200:
 *         description: FAQ draft updated
 *       400:
 *         description: No fields to update
 *       404:
 *         description: Pending FAQ draft not found
 *       500:
 *         description: Failed to update FAQ draft
 *
 *   delete:
 *     summary: Delete a pending FAQ draft
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: FAQ draft deleted
 *       404:
 *         description: Pending FAQ draft not found
 *       500:
 *         description: Failed to delete FAQ draft
 *
 * /chatBot/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (General)
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/attendanceMachine/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Attendance Machine)
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/manualAttendanceMachine/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Manual Attendance Machine)
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/dotPrinter/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/thermalPrinter/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/powerBank/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/faceAttendance/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 *
 * /chatBot/deviceFaceAttendanceMachine/faq/applyDrafts:
 *   post:
 *     summary: Apply pending FAQ drafts (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyFaqDraftsRequest'
 *     responses:
 *       200:
 *         description: FAQ drafts applied and embeddings updated
 */

module.exports = {};
