/**
 * @swagger
 * /chatBot/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the General GPT assistant without storing unknown questions or counting hits
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/attendanceMachine/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Attendance Machine GPT assistant without storing unknown questions or counting hits
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/manualAttendanceMachine/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Manual Attendance Machine GPT assistant without storing unknown questions or counting hits
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/dotPrinter/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Dot Printer GPT assistant without storing unknown questions or counting hits
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/thermalPrinter/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Thermal Printer GPT assistant without storing unknown questions or counting hits
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/powerBank/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Power Bank GPT assistant without storing unknown questions or counting hits
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/faceAttendance/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Face Attendance GPT assistant without storing unknown questions or counting hits
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/warehouseErp/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Warehouse ERP GPT assistant without storing unknown questions or counting hits
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/warehouseErpAppSite/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Warehouse ERP App Site GPT assistant without storing unknown questions or counting hits
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/faceAttendanceWebsite/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Face Attendance Website GPT assistant without storing unknown questions or counting hits
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *
 * /chatBot/deviceFaceAttendanceMachine/chat/gpt/no-store:
 *   post:
 *     summary: Chat with the Device Face Attendance Machine GPT assistant without storing unknown questions or counting hits
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 */

module.exports = {};
