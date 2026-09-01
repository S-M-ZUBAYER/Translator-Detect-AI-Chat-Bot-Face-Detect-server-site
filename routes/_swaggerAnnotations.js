/**
 * Generates a reusable set of Swagger JSDoc annotation blocks for a product route.
 * Call this function once per product file — the returned string is purely documentation.
 *
 * Usage (at top of each product route file, after imports):
 *   // (no runtime effect – annotations below are read by swagger-jsdoc at startup)
 */

/**
 * @swagger
 * /chatBot/attendanceMachine/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Attendance Machine)
 *     description: Parses an uploaded .docx file and appends its text to the specified category section of the Attendance Machine knowledge base.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *                 description: The .docx file to extract text from
 *               category:
 *                 type: string
 *                 example: "FAQ"
 *                 description: The knowledge-base section to append the text to
 *     responses:
 *       200:
 *         description: Text extracted and saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: No file uploaded or no category specified
 *       500:
 *         description: Server error during extraction
 *
 * /chatBot/attendanceMachine/appendText:
 *   post:
 *     summary: Append raw text to a category section (Attendance Machine)
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Text appended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing text or category
 *       500:
 *         description: Failed to append text
 *
 * /chatBot/attendanceMachine/chat/gpt:
 *   post:
 *     summary: Chat with the Attendance Machine GPT assistant
 *     description: >
 *       Sends the full conversation history to GPT. The model answers using only the
 *       Attendance Machine knowledge base. Unanswerable questions are stored in the DB
 *       and a polite fallback is returned in the user's language.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Messages array is required
 *       500:
 *         description: OpenAI API error
 *
 * /chatBot/attendanceMachine/transcribe:
 *   post:
 *     summary: Transcribe audio and add to Attendance Machine knowledge base
 *     description: Uploads an audio file to OpenAI Whisper, transcribes it, then appends the transcript to the specified category section.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (mp3, wav, m4a, etc.)
 *               category:
 *                 type: string
 *                 example: "Troubleshooting"
 *     responses:
 *       200:
 *         description: Transcription successful and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: File or category missing
 *       401:
 *         description: OpenAI API key missing
 *       500:
 *         description: Transcription failed
 *
 * /chatBot/attendanceMachine/analyzeImage:
 *   post:
 *     summary: OCR an image and add text to Attendance Machine knowledge base
 *     description: Uses GPT-4 Vision to extract all visible text from the uploaded image and stores it under the given category.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (png, jpg, etc.)
 *               category:
 *                 type: string
 *                 example: "Manual"
 *     responses:
 *       200:
 *         description: Image OCR successful and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Image or category missing
 *       500:
 *         description: OCR failed
 *
 * /chatBot/attendanceMachine/analyzePdf:
 *   post:
 *     summary: Extract text from a PDF and add to Attendance Machine knowledge base
 *     description: Converts each PDF page to PNG, runs GPT-4 Vision OCR on each, then appends the full text to the given category section.
 *     tags: [Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to analyze
 *               category:
 *                 type: string
 *                 example: "Specs"
 *     responses:
 *       200:
 *         description: PDF analyzed and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: PDF or category missing
 *       500:
 *         description: PDF analysis failed
 */

/**
 * @swagger
 * /chatBot/manualAttendanceMachine/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Manual Attendance Machine)
 *     description: Parses an uploaded .docx file and appends its text to the specified category section of the Manual Attendance Machine knowledge base.
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *                 description: The .docx file to extract text from
 *               category:
 *                 type: string
 *                 example: "FAQ"
 *                 description: The knowledge-base section to append the text to
 *     responses:
 *       200:
 *         description: Text extracted and saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: No file uploaded or no category specified
 *       500:
 *         description: Server error during extraction
 *
 * /chatBot/manualAttendanceMachine/appendText:
 *   post:
 *     summary: Append raw text to a category section (Manual Attendance Machine)
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Text appended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing text or category
 *       500:
 *         description: Failed to append text
 *
 * /chatBot/manualAttendanceMachine/chat/gpt:
 *   post:
 *     summary: Chat with the Manual Attendance Machine GPT assistant
 *     description: >
 *       Sends the full conversation history to GPT. The model answers using only the
 *       Manual Attendance Machine knowledge base. Unanswerable questions are stored in the DB
 *       and a polite fallback is returned in the user's language.
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: GPT response returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Messages array is required
 *       500:
 *         description: OpenAI API error
 *
 * /chatBot/manualAttendanceMachine/transcribe:
 *   post:
 *     summary: Transcribe audio and add to Manual Attendance Machine knowledge base
 *     description: Uploads an audio file to OpenAI Whisper, transcribes it, then appends the transcript to the specified category section.
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (mp3, wav, m4a, etc.)
 *               category:
 *                 type: string
 *                 example: "Troubleshooting"
 *     responses:
 *       200:
 *         description: Transcription successful and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: File or category missing
 *       401:
 *         description: OpenAI API key missing
 *       500:
 *         description: Transcription failed
 *
 * /chatBot/manualAttendanceMachine/analyzeImage:
 *   post:
 *     summary: OCR an image and add text to Manual Attendance Machine knowledge base
 *     description: Uses GPT-4 Vision to extract all visible text from the uploaded image and stores it under the given category.
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (png, jpg, etc.)
 *               category:
 *                 type: string
 *                 example: "Manual"
 *     responses:
 *       200:
 *         description: Image OCR successful and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Image or category missing
 *       500:
 *         description: OCR failed
 *
 * /chatBot/manualAttendanceMachine/analyzePdf:
 *   post:
 *     summary: Extract text from a PDF and add to Manual Attendance Machine knowledge base
 *     description: Converts each PDF page to PNG, runs GPT-4 Vision OCR on each, then appends the full text to the given category section.
 *     tags: [Manual Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to analyze
 *               category:
 *                 type: string
 *                 example: "Specs"
 *     responses:
 *       200:
 *         description: PDF analyzed and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: PDF or category missing
 *       500:
 *         description: PDF analysis failed
 */

// ─── Dot Printer ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /chatBot/dotPrinter/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 example: "FAQ"
 *     responses:
 *       200:
 *         description: Text extracted and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: File or category missing
 *       500:
 *         description: Extraction failed
 *
 * /chatBot/dotPrinter/appendText:
 *   post:
 *     summary: Append raw text (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Append failed
 *
 * /chatBot/dotPrinter/chat/gpt:
 *   post:
 *     summary: Chat with the Dot Printer GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/dotPrinter/transcribe:
 *   post:
 *     summary: Transcribe audio (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transcribed and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Transcription error
 *
 * /chatBot/dotPrinter/analyzeImage:
 *   post:
 *     summary: OCR an image (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: OCR saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing image or category
 *       500:
 *         description: OCR error
 *
 * /chatBot/dotPrinter/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Dot Printer)
 *     tags: [Dot Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF analyzed and saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing PDF or category
 *       500:
 *         description: PDF analysis error
 */

// ─── Thermal Printer ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /chatBot/thermalPrinter/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 example: "FAQ"
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Extraction error
 *
 * /chatBot/thermalPrinter/appendText:
 *   post:
 *     summary: Append raw text (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/thermalPrinter/chat/gpt:
 *   post:
 *     summary: Chat with the Thermal Printer GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/thermalPrinter/transcribe:
 *   post:
 *     summary: Transcribe audio (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/thermalPrinter/analyzeImage:
 *   post:
 *     summary: OCR an image (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: OCR saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/thermalPrinter/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Thermal Printer)
 *     tags: [Thermal Printer]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// ─── Power Bank ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /chatBot/powerBank/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/powerBank/appendText:
 *   post:
 *     summary: Append raw text (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/powerBank/chat/gpt:
 *   post:
 *     summary: Chat with the Power Bank GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/powerBank/transcribe:
 *   post:
 *     summary: Transcribe audio (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/powerBank/analyzeImage:
 *   post:
 *     summary: OCR an image (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/powerBank/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Power Bank)
 *     tags: [Power Bank]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// ─── Face Attendance ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /chatBot/faceAttendance/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendance/appendText:
 *   post:
 *     summary: Append raw text (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendance/chat/gpt:
 *   post:
 *     summary: Chat with the Face Attendance GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/faceAttendance/transcribe:
 *   post:
 *     summary: Transcribe audio (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendance/analyzeImage:
 *   post:
 *     summary: OCR an image (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendance/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Face Attendance)
 *     tags: [Face Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// Warehouse ERP

/**
 * @swagger
 * /chatBot/warehouseErp/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Warehouse ERP)
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErp/appendText:
 *   post:
 *     summary: Append raw text (Warehouse ERP)
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErp/chat/gpt:
 *   post:
 *     summary: Chat with the Warehouse ERP GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/warehouseErp/transcribe:
 *   post:
 *     summary: Transcribe audio (Warehouse ERP)
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErp/analyzeImage:
 *   post:
 *     summary: OCR an image (Warehouse ERP)
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErp/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Warehouse ERP)
 *     tags: [Warehouse ERP]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// Warehouse ERP App Site

/**
 * @swagger
 * /chatBot/warehouseErpAppSite/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Warehouse ERP App Site)
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErpAppSite/appendText:
 *   post:
 *     summary: Append raw text (Warehouse ERP App Site)
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErpAppSite/chat/gpt:
 *   post:
 *     summary: Chat with the Warehouse ERP App Site GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/warehouseErpAppSite/transcribe:
 *   post:
 *     summary: Transcribe audio (Warehouse ERP App Site)
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErpAppSite/analyzeImage:
 *   post:
 *     summary: OCR an image (Warehouse ERP App Site)
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/warehouseErpAppSite/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Warehouse ERP App Site)
 *     tags: [Warehouse ERP App Site]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// Face Attendance Website

/**
 * @swagger
 * /chatBot/faceAttendanceWebsite/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Face Attendance Website)
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendanceWebsite/appendText:
 *   post:
 *     summary: Append raw text (Face Attendance Website)
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendanceWebsite/chat/gpt:
 *   post:
 *     summary: Chat with the Face Attendance Website GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/faceAttendanceWebsite/transcribe:
 *   post:
 *     summary: Transcribe audio (Face Attendance Website)
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendanceWebsite/analyzeImage:
 *   post:
 *     summary: OCR an image (Face Attendance Website)
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/faceAttendanceWebsite/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Face Attendance Website)
 *     tags: [Face Attendance Website]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

// ??? Device Face Attendance Machine ?????????????????????????????????????

/**
 * @swagger
 * /chatBot/deviceFaceAttendanceMachine/extractText:
 *   post:
 *     summary: Extract text from a DOCX file (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/deviceFaceAttendanceMachine/appendText:
 *   post:
 *     summary: Append raw text (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/deviceFaceAttendanceMachine/chat/gpt:
 *   post:
 *     summary: Chat with the Device Face Attendance Machine GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/deviceFaceAttendanceMachine/transcribe:
 *   post:
 *     summary: Transcribe audio (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/deviceFaceAttendanceMachine/analyzeImage:
 *   post:
 *     summary: OCR an image (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/deviceFaceAttendanceMachine/analyzePdf:
 *   post:
 *     summary: Analyze a PDF (Device Face Attendance Machine)
 *     tags: [Device Face Attendance Machine]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */


// ─── General (Chat.js) ────────────────────────────────────────────────────────

/**
 * @swagger
 * /chatBot/extract-text:
 *   post:
 *     summary: Extract text from a DOCX file (General)
 *     description: Extracts text from an uploaded .docx and stores it in the general knowledge base.
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docxFile, category]
 *             properties:
 *               docxFile:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing file or category
 *       500:
 *         description: Error
 *
 * /chatBot/append-text:
 *   post:
 *     summary: Append raw text (General)
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppendTextRequest'
 *     responses:
 *       200:
 *         description: Appended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/chat/gpt:
 *   post:
 *     summary: Chat with the General GPT assistant
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
 *       400:
 *         description: Messages required
 *       500:
 *         description: OpenAI error
 *
 * /chatBot/transcribe:
 *   post:
 *     summary: Transcribe audio (General)
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, category]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/analyze-image:
 *   post:
 *     summary: OCR an image (General)
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, category]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 *
 * /chatBot/analyze-pdf:
 *   post:
 *     summary: Analyze a PDF (General)
 *     tags: [Chat (General)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, category]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileOperationResponse'
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Error
 */

module.exports = {}; // intentionally empty — file exists for JSDoc annotations only
