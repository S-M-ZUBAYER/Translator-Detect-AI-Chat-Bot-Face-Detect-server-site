const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "THT Grozziie — After-Sales Chatbot + Face Recognition API",
            version: "2.0.0",
            description:
                "Unified API for Grozziie's after-sales chatbot system (text extraction, GPT chat, audio transcription, image OCR, PDF analysis) and Employee Face Recognition (register, identify, manage employees by face).",
            contact: {
                name: "THT Space Electrical Company Ltd",
            },
        },
        servers: [
            { url: "/tht", description: "After-Sales Chatbot API" },
            { url: "/api", description: "Face Recognition API" },
        ],
        tags: [
            // ── After-Sales ──────────────────────────────────────────────
            { name: "Health", description: "Server & database health checks" },
            { name: "Detect", description: "Company field extraction from raw text" },
            { name: "Translate", description: "Text translation via GPT" },
            { name: "Chat (General)", description: "General after-sales chatbot" },
            { name: "Attendance Machine", description: "Attendance Machine chatbot" },
            { name: "Dot Printer", description: "Dot Printer chatbot" },
            { name: "Thermal Printer", description: "Thermal Printer chatbot" },
            { name: "Power Bank", description: "Power Bank chatbot" },
            { name: "Face Attendance", description: "Face Attendance chatbot" },
            { name: "Device Face Attendance Machine", description: "Device Face Attendance Machine chatbot" },
            { name: "Unknown Questions", description: "Unanswered chatbot questions CRUD" },
            // ── Face Recognition ─────────────────────────────────────────
            { name: "Employees", description: "Employee management — register, update, delete" },
            { name: "Face Recognition", description: "Identify employees by face image" },
            { name: "Cache Management", description: "Face-matcher cache control" },
            { name: "Statistics", description: "Employee & recognition statistics" },
        ],
        components: {
            schemas: {
                // ── Chatbot shared ────────────────────────────────────────────
                ChatMessage: {
                    type: "object",
                    required: ["role", "content"],
                    properties: {
                        role: { type: "string", enum: ["user", "assistant", "system"], example: "user" },
                        content: { type: "string", example: "How do I reset my device?" },
                    },
                },
                ChatRequest: {
                    type: "object",
                    required: ["messages"],
                    properties: {
                        messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } },
                    },
                },
                ChatResponse: {
                    type: "object",
                    properties: {
                        answer: { type: "string", example: "Boss, press the reset button for 5 seconds." },
                        lang: { type: "string", example: "en" },
                    },
                },
                AppendTextRequest: {
                    type: "object",
                    required: ["text", "category"],
                    properties: {
                        text: { type: "string", example: "Product manual content here..." },
                        category: { type: "string", example: "FAQ" },
                    },
                },
                BulkFaqItem: {
                    type: "object",
                    required: ["question", "answer"],
                    properties: {
                        question: { type: "string", example: "How do I reset the device?" },
                        answer: { type: "string", example: "Press and hold the reset button for 5 seconds." },
                        variants: {
                            type: "array",
                            items: { type: "string" },
                            example: ["How can I restart the device?", "How to factory reset?"],
                        },
                    },
                },
                BulkFaqAppendRequest: {
                    type: "object",
                    required: ["items"],
                    properties: {
                        category: { type: "string", example: "FAQ" },
                        items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/BulkFaqItem" },
                        },
                    },
                },
                BulkFaqAppendResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "FAQ questions added and embeddings updated successfully." },
                        filePath: { type: "string", example: "/routes/Output/Attendance Machine/extracted_text.txt" },
                        added: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string", example: "Q-46" },
                                    question: { type: "string", example: "How do I reset the device?" },
                                },
                            },
                        },
                    },
                },
                FaqDraft: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        product: { type: "string", example: "Face Attendance" },
                        userEmail: { type: "string", example: "agent@example.com" },
                        question: { type: "string", example: "How much is this device?" },
                        answer: { type: "string", example: "Please contact the seller for price details." },
                        variants: {
                            type: "array",
                            items: { type: "string" },
                            example: ["What is the price?", "How much does it cost?"],
                        },
                        status: { type: "string", example: "pending" },
                        qId: { type: "string", example: "Q-46" },
                        createdAt: { type: "string", example: "2026-05-21 10:30:00" },
                        updatedAt: { type: "string", example: "2026-05-21 10:30:00" },
                        appliedAt: { type: "string", example: "2026-05-21 10:35:00" },
                    },
                },
                FaqListItem: {
                    type: "object",
                    properties: {
                        id: { type: "string", example: "Q-46" },
                        question: { type: "string", example: "How do I reset the device?" },
                        answer: { type: "string", example: "Press and hold the reset button for 5 seconds." },
                        variants: {
                            type: "array",
                            items: { type: "string" },
                        },
                    },
                },
                CreateFaqDraftRequest: {
                    type: "object",
                    required: ["product", "userEmail", "question", "answer"],
                    properties: {
                        product: { type: "string", example: "Face Attendance" },
                        userEmail: { type: "string", example: "agent@example.com" },
                        question: { type: "string", example: "How much is this device?" },
                        answer: { type: "string", example: "Please contact the seller for price details." },
                        variants: {
                            type: "array",
                            items: { type: "string" },
                            example: ["What is the price?", "How much does it cost?"],
                        },
                    },
                },
                ApplyFaqDraftsRequest: {
                    type: "object",
                    required: ["userEmail"],
                    properties: {
                        userEmail: { type: "string", example: "agent@example.com" },
                        category: { type: "string", example: "FAQ" },
                        ids: {
                            type: "array",
                            items: { type: "integer" },
                            example: [1, 2, 3],
                            description: "Optional. If omitted, all pending drafts for this user and product are applied.",
                        },
                    },
                },
                FileOperationResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Text successfully added to FAQ section!" },
                        filePath: { type: "string", example: "/routes/Output/Attendance Machine/extracted_text.txt" },
                    },
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        error: { type: "string", example: "No file uploaded." },
                        message: { type: "string" },
                    },
                },
                // ── Unknown Questions ─────────────────────────────────────────
                UnknownQuestion: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        question: { type: "string", example: "What is the warranty period?" },
                        lang: { type: "string", example: "en" },
                        product: { type: "string", example: "Thermal Printer" },
                        answer: { type: "string", example: "Sorry boss, I don't have the answer to this question right now." },
                        created_at: { type: "string", example: "2024-01-15 10:30:00" },
                    },
                },
                CreateUnknownQuestion: {
                    type: "object",
                    required: ["question"],
                    properties: {
                        question: { type: "string", example: "What is the warranty period?" },
                        lang: { type: "string", example: "en" },
                        product: { type: "string", example: "Thermal Printer" },
                        answer: { type: "string", example: "Sorry boss, I don't have the answer to this question right now." },
                    },
                },
                StatsResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "object",
                            properties: {
                                overview: {
                                    type: "object",
                                    properties: {
                                        total_questions: { type: "integer" },
                                        unique_languages: { type: "integer" },
                                        unique_products: { type: "integer" },
                                        oldest_date: { type: "string" },
                                        newest_date: { type: "string" },
                                    },
                                },
                                languageDistribution: {
                                    type: "array",
                                    items: { type: "object", properties: { lang: { type: "string" }, count: { type: "integer" } } },
                                },
                                productDistribution: {
                                    type: "array",
                                    items: { type: "object", properties: { product: { type: "string" }, count: { type: "integer" } } },
                                },
                            },
                        },
                    },
                },
                // ── Face Recognition ──────────────────────────────────────────
                Employee: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        employee_id: { type: "string", example: "EMP001" },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@company.com" },
                        department: { type: "string", example: "Engineering" },
                        image_path: { type: "string", example: "employee-1700000000000-123456789.jpg" },
                        face_descriptor: {
                            type: "array",
                            items: { type: "number" },
                            description: "128-dimensional face descriptor vector",
                            example: [0.123, -0.456, 0.789],
                        },
                        created_at: { type: "string", example: "2024-01-15T10:30:00.000Z" },
                        updated_at: { type: "string", example: "2024-01-15T10:30:00.000Z" },
                    },
                },
                CreateEmployeeRequest: {
                    type: "object",
                    required: ["employee_id", "name"],
                    properties: {
                        employee_id: { type: "string", example: "EMP001" },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@company.com" },
                        department: { type: "string", example: "Engineering" },
                    },
                },
                UpdateEmployeeRequest: {
                    type: "object",
                    properties: {
                        name: { type: "string", example: "John Doe Updated" },
                        email: { type: "string", example: "john.new@company.com" },
                        department: { type: "string", example: "HR" },
                    },
                },
                EmployeeListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "array", items: { $ref: "#/components/schemas/Employee" } },
                        pagination: {
                            type: "object",
                            properties: {
                                page: { type: "integer", example: 1 },
                                limit: { type: "integer", example: 50 },
                                total: { type: "integer", example: 120 },
                                pages: { type: "integer", example: 3 },
                            },
                        },
                    },
                },
                RecognitionResult: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        match: {
                            type: "object",
                            properties: {
                                employeeId: { type: "string", example: "EMP001" },
                                distance: { type: "number", example: 0.32 },
                                confidence: { type: "number", example: 0.68 },
                            },
                        },
                        employee: {
                            type: "object",
                            properties: {
                                employee_id: { type: "string", example: "EMP001" },
                                name: { type: "string", example: "John Doe" },
                                email: { type: "string", example: "john@company.com" },
                                department: { type: "string", example: "Engineering" },
                            },
                        },
                        timing: {
                            type: "object",
                            properties: {
                                total_ms: { type: "integer", example: 1200 },
                                extraction_ms: { type: "integer", example: 900 },
                                matching_ms: { type: "integer", example: 300 },
                            },
                        },
                    },
                },
                MultipleRecognitionResult: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        total_faces: { type: "integer", example: 3 },
                        recognized: { type: "integer", example: 2 },
                        unknown: { type: "integer", example: 1 },
                        matches: {
                            type: "array",
                            items: { $ref: "#/components/schemas/RecognitionResult" },
                        },
                        unknown_faces: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    confidence: { type: "number", example: 0.22 },
                                    box: {
                                        type: "object",
                                        properties: {
                                            x: { type: "number" },
                                            y: { type: "number" },
                                            width: { type: "number" },
                                            height: { type: "number" },
                                        },
                                    },
                                },
                            },
                        },
                        processingTime: { type: "integer", example: 2400 },
                    },
                },
                BatchRecognitionResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        summary: {
                            type: "object",
                            properties: {
                                total: { type: "integer", example: 5 },
                                successful: { type: "integer", example: 4 },
                                failed: { type: "integer", example: 1 },
                                processingTime: { type: "integer", example: 5200 },
                                avgTimePerImage: { type: "integer", example: 1040 },
                            },
                        },
                        results: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    filename: { type: "string", example: "photo1.jpg" },
                                    success: { type: "boolean", example: true },
                                    employee: { $ref: "#/components/schemas/Employee" },
                                    confidence: { type: "number", example: 0.72 },
                                    error: { type: "string", example: "No face detected" },
                                },
                            },
                        },
                    },
                },
                CacheStatusResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        cache: {
                            type: "object",
                            properties: {
                                employeesLoaded: { type: "integer", example: 25 },
                                faceMatcherReady: { type: "boolean", example: true },
                                labeledDescriptorsCount: { type: "integer", example: 25 },
                                cacheAge: { type: "integer", description: "Age in milliseconds", example: 30000 },
                            },
                        },
                        system: {
                            type: "object",
                            properties: {
                                modelsLoaded: { type: "boolean", example: true },
                                ready: { type: "boolean", example: true },
                            },
                        },
                    },
                },
                EmployeeStatistics: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        data: {
                            type: "object",
                            properties: {
                                totalEmployees: { type: "integer", example: 50 },
                                employeesWithFaces: { type: "integer", example: 48 },
                                totalRecognitions: { type: "integer", example: 1200 },
                                todayRecognitions: { type: "integer", example: 35 },
                            },
                        },
                    },
                },
            },
        },
    },
    apis: [
        "./routes/*.js",
        "./index.js",
        "./routes/_swaggerAnnotations.js",
        "./routes/_faceSwaggerAnnotations.js",
    ],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
