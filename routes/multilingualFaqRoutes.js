const express = require("express");
const mammoth = require("mammoth");
const multer = require("multer");
const {
    normalizeProduct,
    normalizeLanguage,
    getRequestedLanguage,
    getPagination,
    paginate,
    getSupportedProducts,
    getSupportedLanguages,
    saveLanguageFaqFile,
    getLanguageFaqItems,
} = require("../utils/multilingualFaqHelper");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadFields = upload.fields([
    { name: "docxFile", maxCount: 1 },
    { name: "file", maxCount: 1 },
]);

function getUploadedDocx(req) {
    return req.files?.docxFile?.[0] || req.files?.file?.[0] || null;
}

function validationPayload(message) {
    return {
        success: false,
        message,
        products: getSupportedProducts(),
        languages: getSupportedLanguages(),
    };
}

/**
 * @swagger
 * /chatBot/faqs/language/upload:
 *   post:
 *     summary: Upload a multilingual FAQ DOCX file
 *     description: Stores a language-specific FAQ DOCX and extracted text for Help Center listing only. This endpoint does not rebuild embeddings and does not change existing chatbot FAQ APIs.
 *     tags: [Multilingual FAQs]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [product, lan, docxFile]
 *             properties:
 *               product:
 *                 type: string
 *                 enum: [Warehouse ERP, Warehouse ERP App Site, Face Attendance, Face Attendance Website]
 *                 example: Warehouse ERP
 *               lan:
 *                 type: string
 *                 description: Language code. Aliases are accepted, for example CN/zh, PH/FIL, MY/MS, JP/JA.
 *                 enum: [EN, CN, PH, VI, ID, MY, TH, PT, JP]
 *                 example: CN
 *               docxFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Multilingual FAQ file uploaded and parsed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Multilingual FAQ file uploaded successfully.
 *                 product:
 *                   type: string
 *                   example: Warehouse ERP
 *                 lan:
 *                   type: string
 *                   example: CN
 *                 language:
 *                   type: string
 *                   example: Chinese
 *                 itemCount:
 *                   type: integer
 *                   example: 844
 *                 filePath:
 *                   type: string
 *                 docxPath:
 *                   type: string
 *       400:
 *         description: Missing or invalid product, language, or file
 *       500:
 *         description: Failed to upload multilingual FAQ file
 */
router.post("/chatBot/faqs/language/upload", uploadFields, async (req, res) => {
    try {
        const product = normalizeProduct(req.body.product);
        const language = normalizeLanguage(getRequestedLanguage(req.body));
        const file = getUploadedDocx(req);

        if (!product) return res.status(400).json(validationPayload("Invalid or missing product."));
        if (!language) return res.status(400).json(validationPayload("Invalid or missing language."));
        if (!file) return res.status(400).json(validationPayload("DOCX file is required. Use field name docxFile or file."));

        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const extractedText = String(result.value || "").replace(/\n+/g, "\n").trim();
        if (!extractedText) {
            return res.status(400).json(validationPayload("No text could be extracted from the DOCX file."));
        }

        const saved = await saveLanguageFaqFile({
            product,
            language,
            docxBuffer: file.buffer,
            originalName: file.originalname,
            extractedText,
        });

        return res.json({
            success: true,
            message: "Multilingual FAQ file uploaded successfully.",
            product,
            lan: language.code,
            language: language.name,
            itemCount: saved.items.length,
            filePath: saved.paths.textFilePath,
            docxPath: saved.paths.docxFilePath,
            metadata: saved.metadata,
        });
    } catch (error) {
        console.error("Multilingual FAQ upload error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to upload multilingual FAQ file.", error: error.message });
    }
});

/**
 * @swagger
 * /chatBot/faqs/language:
 *   get:
 *     summary: Get paginated multilingual FAQ list
 *     description: Returns a language-specific FAQ list for Help Center. Existing /chatBot/faqs behavior is unchanged.
 *     tags: [Multilingual FAQs]
 *     parameters:
 *       - in: query
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Warehouse ERP, Warehouse ERP App Site, Face Attendance, Face Attendance Website]
 *         example: Warehouse ERP
 *       - in: query
 *         name: lan
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EN, CN, PH, VI, ID, MY, TH, PT, JP]
 *         example: CN
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         example: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: dashboard
 *     responses:
 *       200:
 *         description: Multilingual FAQ list returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 product:
 *                   type: string
 *                   example: Warehouse ERP
 *                 lan:
 *                   type: string
 *                   example: CN
 *                 language:
 *                   type: string
 *                   example: Chinese
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
 *         description: Missing or invalid product or language
 *       500:
 *         description: Failed to fetch multilingual FAQ list
 */
router.get("/chatBot/faqs/language", async (req, res) => {
    try {
        const product = normalizeProduct(req.query.product);
        const language = normalizeLanguage(getRequestedLanguage(req.query));
        const search = String(req.query.search || "").trim();
        const { page, limit } = getPagination(req.query);

        if (!product) return res.status(400).json(validationPayload("Invalid or missing product."));
        if (!language) return res.status(400).json(validationPayload("Invalid or missing language."));

        const result = await getLanguageFaqItems({ product, language, search });
        const pagination = paginate(result.items, page, limit);

        return res.json({
            success: true,
            product,
            lan: language.code,
            language: language.name,
            filePath: result.paths.textFilePath,
            uploaded: result.exists,
            message: result.exists ? undefined : "No multilingual FAQ file uploaded for this product and language yet.",
            ...pagination,
        });
    } catch (error) {
        console.error("Multilingual FAQ list error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch multilingual FAQ list.", error: error.message });
    }
});

module.exports = router;