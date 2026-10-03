/**
 * @swagger
 * /api/codex/v1/status:
 *   servers:
 *     - url: /
 *   get:
 *     summary: Read local-agent and bounded-queue status
 *     tags: [Codex Bridge v1]
 *     security: [{ BridgeApiKey: [] }]
 *     responses:
 *       200: { description: Agent connectivity and answer/media queue capacity }
 *
 * /api/codex/v1/conversations/{conversationId}:
 *   servers:
 *     - url: /
 *   get:
 *     summary: Read a product-locked conversation, attachments, and messages
 *     tags: [Codex Bridge v1]
 *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Current conversation state }
 *       403: { description: Invalid conversation token }
 *       410: { description: Conversation expired }
 *   delete:
 *     summary: Delete a conversation and its private uploaded media
 *     tags: [Codex Bridge v1]
 *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Conversation and media deleted }
 *
 * /api/codex/v1/conversations/{conversationId}/attachments/{attachmentId}:
 *   servers:
 *     - url: /
 *   get:
 *     summary: Poll image or video-frame staging and analysis status
 *     tags: [Codex Bridge v1]
 *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Attachment status is queued, processing, ready, or failed; an authorized local agent may send images or extracted video frames to OpenAI }
 *
 * /api/codex/v1/conversations/{conversationId}/messages/{messageId}:
 *   servers:
 *     - url: /
 *   get:
 *     summary: Poll a queued answer
 *     tags: [Codex Bridge v1]
 *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Message status and completed answer with sources, multiple resources, and reusable analyzed-media context for follow-up questions
 */

// Documentation-only module loaded by swagger-jsdoc.
