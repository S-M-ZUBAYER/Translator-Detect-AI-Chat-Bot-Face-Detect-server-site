/**
 * @swagger
 * components:
 *   schemas:
 *     CodexBridgeError:
 *       type: object
 *       required: [code, message]
 *       properties:
 *         code:
 *           type: string
 *           example: AGENT_OFFLINE
 *         message:
 *           type: string
 *           example: The local Codex agent is not connected.
 *
 *     CodexBridgeErrorResponse:
 *       type: object
 *       required: [error, requestId]
 *       properties:
 *         error:
 *           $ref: '#/components/schemas/CodexBridgeError'
 *         requestId:
 *           type: string
 *           format: uuid
 *
 *     CodexBridgeDocument:
 *       type: object
 *       required: [id, filename]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 12345678-1234-1234-1234-123456789abc
 *         filename:
 *           type: string
 *           example: Store Manual.docx
 *         productId:
 *           type: string
 *           example: thermal-printer
 *         knowledgeVersion:
 *           type: string
 *           example: '1'
 *         size:
 *           type: integer
 *           example: 245760
 *         characters:
 *           type: integer
 *           example: 18450
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CodexBridgeDocumentListResponse:
 *       type: object
 *       required: [documents, requestId]
 *       properties:
 *         documents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CodexBridgeDocument'
 *         requestId:
 *           type: string
 *           format: uuid
 *
 *     CodexBridgeDocumentResponse:
 *       type: object
 *       required: [document, requestId]
 *       properties:
 *         document:
 *           $ref: '#/components/schemas/CodexBridgeDocument'
 *         requestId:
 *           type: string
 *           format: uuid
 *
 *     CodexBridgeHistoryMessage:
 *       type: object
 *       required: [role, content]
 *       properties:
 *         role:
 *           type: string
 *           enum: [user, assistant]
 *           example: user
 *         content:
 *           type: string
 *           maxLength: 8000
 *           example: What did I ask previously?
 *
 *     CodexBridgeChatRequest:
 *       type: object
 *       required: [message]
 *       properties:
 *         message:
 *           type: string
 *           maxLength: 10000
 *           example: What does the uploaded document say about delivery?
 *         history:
 *           type: array
 *           maxItems: 20
 *           items:
 *             $ref: '#/components/schemas/CodexBridgeHistoryMessage'
 *         useDocuments:
 *           type: boolean
 *           example: true
 *         documentIds:
 *           type: array
 *           maxItems: 50
 *           items:
 *             type: string
 *             format: uuid
 *           example: [12345678-1234-1234-1234-123456789abc]
 *         productId:
 *           type: string
 *           example: thermal-printer
 *           description: Product collection selected by the hosted registry.
 *         knowledgeVersion:
 *           type: string
 *           example: '1'
 *           description: Must match the product's active hosted knowledge version.
 *
 *     CodexBridgeSource:
 *       type: object
 *       additionalProperties: true
 *       properties:
 *         filename:
 *           type: string
 *           example: Store Manual.docx
 *         title:
 *           type: string
 *           example: Delivery policy
 *         content:
 *           type: string
 *           example: Express delivery normally takes one to two working days.
 *
 *     CodexBridgeChatResponse:
 *       type: object
 *       required: [answer, requestId]
 *       properties:
 *         answer:
 *           type: string
 *           example: Express delivery normally takes one to two working days.
 *         sources:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CodexBridgeSource'
 *         resources:
 *           type: array
 *           items:
 *             type: object
 *             additionalProperties: true
 *         status:
 *           type: string
 *           example: completed
 *         requestId:
 *           type: string
 *           format: uuid
 *
 * /api/health:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   get:
 *     summary: Check the hosted Codex bridge process
 *     operationId: getCodexBridgeHealth
 *     tags: [Codex Bridge REST]
 *     description: Public process check. It does not indicate that the local Codex agent is connected.
 *     responses:
 *       '200':
 *         description: Hosted bridge process is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, requestId]
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok]
 *                 requestId:
 *                   type: string
 *                   format: uuid
 *
 * /api/status:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   get:
 *     summary: Get local Codex agent connection status
 *     operationId: getCodexBridgeStatus
 *     tags: [Codex Bridge REST]
 *     security:
 *       - BridgeApiKey: []
 *     responses:
 *       '200':
 *         description: Current hosted and local-agent status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [hosted, agent, requestId]
 *               properties:
 *                 hosted:
 *                   type: boolean
 *                   example: true
 *                 agent:
 *                   type: object
 *                   required: [agentId, connected]
 *                   properties:
 *                     agentId:
 *                       type: string
 *                       example: primary
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     connectedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                 requestId:
 *                   type: string
 *                   format: uuid
 *       '401':
 *         description: Missing or invalid bridge API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *
 * /api/documents:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   get:
 *     summary: List DOCX files stored by the local Codex agent
 *     operationId: listCodexBridgeDocuments
 *     tags: [Codex Bridge REST]
 *     security:
 *       - BridgeApiKey: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, example: thermal-printer }
 *       - in: query
 *         name: knowledgeVersion
 *         schema: { type: string, example: '1' }
 *     responses:
 *       '200':
 *         description: Local document list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeDocumentListResponse'
 *       '401':
 *         description: Missing or invalid bridge API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '503':
 *         description: Local Codex agent is offline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *   post:
 *     summary: Upload a DOCX to the local Codex agent
 *     operationId: uploadCodexBridgeDocument
 *     tags: [Codex Bridge REST]
 *     security:
 *       - BridgeApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: DOCX file, limited by MAX_DOCX_BYTES (5 MB by default).
 *               productId:
 *                 type: string
 *                 example: thermal-printer
 *               knowledgeVersion:
 *                 type: string
 *                 example: '1'
 *     responses:
 *       '201':
 *         description: Document transferred to and indexed by the local agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeDocumentResponse'
 *       '400':
 *         description: File was not provided
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
 *       '413':
 *         description: DOCX exceeds the configured limit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '415':
 *         description: File is not a DOCX
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '503':
 *         description: Local Codex agent is offline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '504':
 *         description: Local agent operation timed out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *
 * /api/documents/{id}:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       description: Local document UUID
 *       schema:
 *         type: string
 *         format: uuid
 *   put:
 *     summary: Replace a local DOCX while preserving its document ID
 *     operationId: replaceCodexBridgeDocument
 *     tags: [Codex Bridge REST]
 *     security:
 *       - BridgeApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               productId:
 *                 type: string
 *                 example: thermal-printer
 *               knowledgeVersion:
 *                 type: string
 *                 example: '1'
 *     responses:
 *       '200':
 *         description: Document replaced and re-indexed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeDocumentResponse'
 *       '400':
 *         description: Invalid document ID or missing file
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
 *       '503':
 *         description: Local Codex agent is offline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '504':
 *         description: Local agent operation timed out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *   delete:
 *     summary: Delete a DOCX from the local Codex agent
 *     operationId: deleteCodexBridgeDocument
 *     tags: [Codex Bridge REST]
 *     security:
 *       - BridgeApiKey: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, example: thermal-printer }
 *       - in: query
 *         name: knowledgeVersion
 *         schema: { type: string, example: '1' }
 *     responses:
 *       '204':
 *         description: Document deleted
 *       '400':
 *         description: Invalid document ID
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
 *       '503':
 *         description: Local Codex agent is offline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '504':
 *         description: Local agent operation timed out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *
 * /api/chat:
 *   servers:
 *     - url: /
 *       description: Unified server root
 *   post:
 *     summary: Ask the local Codex agent a question
 *     operationId: askCodexBridge
 *     tags: [Codex Bridge REST]
 *     description: |
 *       Sends the question, optional recent conversation history, and optional
 *       local document IDs to the outbound-connected local Codex agent. The HTTP
 *       request remains open until the agent replies or the configured timeout
 *       is reached.
 *     security:
 *       - BridgeApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CodexBridgeChatRequest'
 *     responses:
 *       '200':
 *         description: Local Codex response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeChatResponse'
 *       '400':
 *         description: Invalid message, history, document mode, or document IDs
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
 *       '503':
 *         description: Local Codex agent is offline or disconnected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 *       '504':
 *         description: Local agent did not answer before the timeout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodexBridgeErrorResponse'
 */

// Swagger documentation only. Runtime handlers live under codexBridge/.
