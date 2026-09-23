/**
 * @swagger
 * components:
 *   schemas:
 *     CodexMessagesChatMessage:
 *       type: object
 *       required: [role, content]
 *       properties:
 *         role:
 *           type: string
 *           enum: [user, assistant]
 *           example: user
 *         content:
 *           type: string
 *           example: How can I create a purchase order?
 *
 *     CodexMessagesChatRequest:
 *       type: object
 *       required: [messages]
 *       properties:
 *         messages:
 *           type: array
 *           minItems: 1
 *           maxItems: 21
 *           description: Complete conversation. The last item must be the current user question.
 *           items:
 *             $ref: '#/components/schemas/CodexMessagesChatMessage'
 *           example:
 *             - role: user
 *               content: How can I create a purchase order?
 *             - role: assistant
 *               content: Boss, open the Purchase module and select Purchase Order.
 *             - role: user
 *               content: What information do I need to enter next?
 *
 *     CodexMessagesChatResponse:
 *       type: object
 *       required: [answer, lang]
 *       properties:
 *         answer:
 *           type: string
 *           example: Boss, select the supplier, add the required products, enter quantities and prices, and then save the purchase order.
 *         lang:
 *           type: string
 *           example: en
 *
 * /api/codex/chat/gpt:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   post:
 *     summary: Chat with the local Codex agent using conversation messages
 *     operationId: postCodexMessagesChat
 *     tags: [Codex Bridge REST]
 *     description: |
 *       Accepts the same messages-style conversation used by the existing
 *       product chat APIs. Earlier messages are forwarded as history and the
 *       final user message is sent as the current question through `/ws/agent`.
 *     security:
 *       - BridgeApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CodexMessagesChatRequest'
 *     responses:
 *       '200':
 *         description: Local Codex answer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexMessagesChatResponse'
 *       '400':
 *         description: Invalid or missing messages
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '401':
 *         description: Missing or invalid bridge API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '502':
 *         description: Local agent returned an invalid response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '503':
 *         description: Local Codex agent is offline or disconnected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '504':
 *         description: Local Codex agent did not answer before the timeout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 */

// Documentation only. Runtime implementation is isolated in
// codexBridge/messagesChatRoute.js.
