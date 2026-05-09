const express = require('express');
const router = express.Router();
const { upload, handleMulterError } = require('../middleware/upload');
const employeeController = require('../controllers/employeeController');
const recognitionController = require('../controllers/recognitionController');

// Apply multer error handling to all routes in this router
router.use(handleMulterError);

// ─── Employee Routes ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /faceRecognize/employees:
 *   post:
 *     summary: Register a new employee with face image
 *     tags: [Employees]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [employee_id, name, image]
 *             properties:
 *               employee_id: { type: string, example: "EMP001" }
 *               name:        { type: string, example: "John Doe" }
 *               email:       { type: string, example: "john@company.com" }
 *               department:  { type: string, example: "Engineering" }
 *               image:       { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Employee registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:    { $ref: "#/components/schemas/Employee" }
 *       400:
 *         description: Validation error or duplicate face
 *       500:
 *         description: Server error
 */
router.post('/employees', upload.single('image'), employeeController.addEmployee);

/**
 * @swagger
 * /faceRecognize/employees/force:
 *   post:
 *     summary: Force-register employee (bypass duplicate face check)
 *     tags: [Employees]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [employee_id, name, image]
 *             properties:
 *               employee_id: { type: string, example: "EMP002" }
 *               name:        { type: string, example: "Jane Doe" }
 *               email:       { type: string, example: "jane@company.com" }
 *               department:  { type: string, example: "HR" }
 *               image:       { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Employee force-registered
 *       400:
 *         description: Missing fields or face detection failed
 *       500:
 *         description: Server error
 */
router.post('/employees/force', upload.single('image'), employeeController.forceAddEmployee);

/**
 * @swagger
 * /faceRecognize/employees:
 *   get:
 *     summary: Get all employees (paginated)
 *     tags: [Employees]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Employee list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmployeeListResponse"
 *       500:
 *         description: Database error
 */
router.get('/employees', employeeController.getAllEmployees);

/**
 * @swagger
 * /faceRecognize/employees/search:
 *   get:
 *     summary: Search employees
 *     tags: [Employees]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *         example: "john"
 *     responses:
 *       200:
 *         description: Matching employees
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { type: array, items: { $ref: "#/components/schemas/Employee" } }
 *       400:
 *         description: Query too short
 *       500:
 *         description: Database error
 */
router.get('/employees/search', employeeController.searchEmployees);

/**
 * @swagger
 * /faceRecognize/employees/{id}:
 *   get:
 *     summary: Get employee by database ID
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Employee found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: "#/components/schemas/Employee" }
 *       404:
 *         description: Not found
 *       500:
 *         description: Database error
 */
router.get('/employees/:id', employeeController.getEmployeeById);

/**
 * @swagger
 * /faceRecognize/employees/{id}:
 *   put:
 *     summary: Update employee info
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UpdateEmployeeRequest"
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:    { $ref: "#/components/schemas/Employee" }
 *       404:
 *         description: Not found
 *       500:
 *         description: Database error
 */
router.put('/employees/:id', employeeController.updateEmployee);

/**
 * @swagger
 * /faceRecognize/employees/{id}:
 *   delete:
 *     summary: Delete employee and all face data
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       404:
 *         description: Not found
 *       500:
 *         description: Database error
 */
router.delete('/employees/:id', employeeController.deleteEmployee);

/**
 * @swagger
 * /faceRecognize/employees/{employee_id}/faces:
 *   post:
 *     summary: Add additional face image for an employee
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: employee_id
 *         required: true
 *         schema: { type: string }
 *         example: "EMP001"
 *         description: Business employee ID (not the DB auto-increment id)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Additional face registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:    { type: boolean }
 *                 message:    { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     employee_id: { type: string }
 *                     image_path:  { type: string }
 *       400:
 *         description: No image or face detection failed
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.post('/employees/:employee_id/faces', upload.single('image'), employeeController.addEmployeeFace);

/**
 * @swagger
 * /faceRecognize/statistics:
 *   get:
 *     summary: Get employee and recognition statistics
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Statistics data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmployeeStatistics"
 *       500:
 *         description: Database error
 */
router.get('/statistics', employeeController.getStatistics);

// ─── Face Recognition Routes ───────────────────────────────────────────────────

/**
 * @swagger
 * /faceRecognize/recognize:
 *   post:
 *     summary: Recognize a single employee from a face photo
 *     description: Extracts a face descriptor and matches against all registered employees. Returns best match with confidence.
 *     tags: [Face Recognition]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Face photo to identify (max 10 MB)
 *     responses:
 *       200:
 *         description: Recognition result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RecognitionResult"
 *       400:
 *         description: No image provided
 *       500:
 *         description: Recognition engine error
 */
router.post('/recognize', upload.single('image'), recognitionController.recognizeEmployee);

/**
 * @swagger
 * /faceRecognize/recognize/multiple:
 *   post:
 *     summary: Recognize all faces in a group photo
 *     description: Detects every face in the image and matches each against registered employees.
 *     tags: [Face Recognition]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Group photo
 *     responses:
 *       200:
 *         description: Multi-face recognition result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/MultipleRecognitionResult"
 *       400:
 *         description: No image provided
 *       500:
 *         description: Recognition engine error
 */
router.post('/recognize/multiple', upload.single('image'), recognitionController.recognizeMultipleEmployees);

/**
 * @swagger
 * /faceRecognize/recognize/batch:
 *   post:
 *     summary: Batch recognize up to 20 face images
 *     description: Accepts up to 20 images, processes in parallel batches of 5. Field name must be `images`.
 *     tags: [Face Recognition]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: "Face photos (max 20)"
 *     responses:
 *       200:
 *         description: Batch results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BatchRecognitionResponse"
 *       400:
 *         description: No images or more than 20 submitted
 *       500:
 *         description: Batch processing failed
 */
router.post('/recognize/batch', upload.array('images', 20), recognitionController.batchRecognize);

// ─── Cache Management Routes ───────────────────────────────────────────────────

/**
 * @swagger
 * /faceRecognize/cache/status:
 *   get:
 *     summary: Get face-matcher cache status
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache status and system readiness
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CacheStatusResponse"
 *       500:
 *         description: Error reading cache
 */
router.get('/cache/status', recognitionController.getCacheStatus);

/**
 * @swagger
 * /faceRecognize/cache/refresh:
 *   post:
 *     summary: Force-refresh face-matcher cache from DB
 *     description: Clears and rebuilds the in-memory FaceMatcher. Use after direct DB changes.
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache refreshed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "Cache refreshed successfully" }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     employeesLoaded:         { type: integer }
 *                     faceMatcherReady:        { type: boolean }
 *                     labeledDescriptorsCount: { type: integer }
 *                     cacheAge:                { type: integer }
 *       500:
 *         description: Refresh failed
 */
router.post('/cache/refresh', recognitionController.refreshCache);

module.exports = router;