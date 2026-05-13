// //This is the part to require necessary package
// const express = require('express');
// const cors = require('cors');
// const detectRouter = require("./routes/Detect")
// const translatorRouter = require("./routes/Translator")
// const aiChatRouter = require("./routes/Chat")
// const aiAttendanceChatRouter = require("./routes/AttendanceMachineRoutes")
// const aiDotPrinterChatRouter = require("./routes/DotPrinterRoutes")
// const aiThermalPrinterChatRouter = require("./routes/ThermalPrinterRoutes")
// const aiPowerBankChatRouter = require("./routes/PowerBankRoutes")
// const aiFaceAttendanceChatRouter = require("./routes/FaceAttendanceRoutes")

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// app.use("/tht", detectRouter)
// app.use("/tht", translatorRouter)
// app.use("/tht", aiChatRouter)
// app.use("/tht", aiAttendanceChatRouter)
// app.use("/tht", aiDotPrinterChatRouter)
// app.use("/tht", aiThermalPrinterChatRouter)
// app.use("/tht", aiPowerBankChatRouter)
// app.use("/tht", aiFaceAttendanceChatRouter)

// // app.use("/tht",eventProductsRouter)
// // app.use("/tht",QandARouter)
// // app.use("/tht",iconsRouter)


// //check the route 
// app.get('/', (req, res) => {
//   res.send({
//     message: "This is the 1st route for THT Translate,Detect server system"
//   })
// })

// //Check to Listen the port number 
// app.listen(port, () => {
//   console.log(`THT-Space Electrical Company Ltd Sever Running  on port ${port}`);
// })



// const express = require('express');
// const cors = require('cors');
// const dbMiddleware = require('./middleware/dbMiddleware');

// // Import your routes
// const detectRouter = require("./routes/Detect");
// const translatorRouter = require("./routes/Translator");
// const aiChatRouter = require("./routes/Chat");
// const aiAttendanceChatRouter = require("./routes/AttendanceMachineRoutes");
// const aiDotPrinterChatRouter = require("./routes/DotPrinterRoutes");
// const aiThermalPrinterChatRouter = require("./routes/ThermalPrinterRoutes");
// const aiPowerBankChatRouter = require("./routes/PowerBankRoutes");
// const aiFaceAttendanceChatRouter = require("./routes/FaceAttendanceRoutes");
// const chatbotUnknownQuestionsRouter = require("./routes/chatbotUnknownQuestionsRouter");

// const app = express();
// const port = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(dbMiddleware); // Add database middleware

// // Routes
// app.use("/tht", detectRouter);
// app.use("/tht", translatorRouter);
// app.use("/tht", aiChatRouter);
// app.use("/tht", aiAttendanceChatRouter);
// app.use("/tht", aiDotPrinterChatRouter);
// app.use("/tht", aiThermalPrinterChatRouter);
// app.use("/tht", aiPowerBankChatRouter);
// app.use("/tht", aiFaceAttendanceChatRouter);
// app.use("/tht", chatbotUnknownQuestionsRouter);

// // Health check endpoint
// app.get('/health', async (req, res) => {
//   try {
//     await req.db.query('SELECT 1');
//     res.status(200).json({
//       status: 'healthy',
//       database: 'connected',
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: 'unhealthy',
//       database: 'disconnected',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Root route
// app.get('/', (req, res) => {
//   res.json({
//     message: "THT Translate & Detect Server System",
//     status: "running",
//     endpoints: {
//       health: "/health",
//       api: "/tht"
//     }
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('Server Error:', err);
//   res.status(500).json({
//     error: 'Internal Server Error',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     error: 'Not Found',
//     message: `Cannot ${req.method} ${req.url}`
//   });
// });

// // Handle graceful shutdown
// process.on('SIGINT', async () => {
//   console.log('Shutting down gracefully...');
//   const database = require('./config/database');
//   await database.close();
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   console.log('Terminating gracefully...');
//   const database = require('./config/database');
//   await database.close();
//   process.exit(0);
// });

// // Start server
// app.listen(port, () => {
//   console.log(`🚀 THT Server running on port ${port}`);
//   console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
// });




// const express = require('express');
// const cors = require('cors');
// const swaggerUi = require('swagger-ui-express');
// const swaggerSpec = require('./swagger');
// const dbMiddleware = require('./middleware/dbMiddleware');

// // Import your routes
// const detectRouter = require("./routes/Detect");
// const translatorRouter = require("./routes/Translator");
// const aiChatRouter = require("./routes/Chat");
// const aiAttendanceChatRouter = require("./routes/AttendanceMachineRoutes");
// const aiDotPrinterChatRouter = require("./routes/DotPrinterRoutes");
// const aiThermalPrinterChatRouter = require("./routes/ThermalPrinterRoutes");
// const aiPowerBankChatRouter = require("./routes/PowerBankRoutes");
// const aiFaceAttendanceChatRouter = require("./routes/FaceAttendanceRoutes");
// const chatbotUnknownQuestionsRouter = require("./routes/chatbotUnknownQuestionsRouter");

// const app = express();
// const port = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(dbMiddleware);

// // ─── Swagger UI ────────────────────────────────────────────────────────────────
// app.use(
//   "/api-docs",
//   swaggerUi.serve,
//   swaggerUi.setup(swaggerSpec, {
//     explorer: true,
//     customSiteTitle: "THT Grozziie API Docs",
//     customCss: `
//       .swagger-ui .topbar { background-color: #1a1a2e; }
//       .swagger-ui .topbar .download-url-wrapper { display: none; }
//     `,
//     swaggerOptions: {
//       docExpansion: "list",
//       filter: true,
//       showExtensions: true,
//     },
//   })
// );

// // Serve raw swagger JSON (useful for Postman imports)
// app.get("/api-docs.json", (req, res) => {
//   res.setHeader("Content-Type", "application/json");
//   res.send(swaggerSpec);
// });

// // ─── Routes ────────────────────────────────────────────────────────────────────
// app.use("/tht", detectRouter);
// app.use("/tht", translatorRouter);
// app.use("/tht", aiChatRouter);
// app.use("/tht", aiAttendanceChatRouter);
// app.use("/tht", aiDotPrinterChatRouter);
// app.use("/tht", aiThermalPrinterChatRouter);
// app.use("/tht", aiPowerBankChatRouter);
// app.use("/tht", aiFaceAttendanceChatRouter);
// app.use("/tht", chatbotUnknownQuestionsRouter);

// // ─── Health check ──────────────────────────────────────────────────────────────
// /**
//  * @swagger
//  * /health:
//  *   get:
//  *     summary: Server and database health check
//  *     tags: [Health]
//  *     responses:
//  *       200:
//  *         description: Server is healthy and database is connected
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: string
//  *                   example: healthy
//  *                 database:
//  *                   type: string
//  *                   example: connected
//  *                 timestamp:
//  *                   type: string
//  *                   example: "2024-01-15T10:30:00.000Z"
//  *       500:
//  *         description: Server or database is unhealthy
//  */
// app.get('/health', async (req, res) => {
//   try {
//     await req.db.query('SELECT 1');
//     res.status(200).json({
//       status: 'healthy',
//       database: 'connected',
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: 'unhealthy',
//       database: 'disconnected',
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // ─── Root ──────────────────────────────────────────────────────────────────────
// app.get('/', (req, res) => {
//   res.json({
//     message: "THT Translate & Detect Server System",
//     status: "running",
//     endpoints: {
//       health: "/health",
//       api: "/tht",
//       docs: "/api-docs",
//       docsJson: "/api-docs.json",
//     }
//   });
// });

// // ─── Error handlers ────────────────────────────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error('Server Error:', err);
//   res.status(500).json({
//     error: 'Internal Server Error',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// app.use((req, res) => {
//   res.status(404).json({
//     error: 'Not Found',
//     message: `Cannot ${req.method} ${req.url}`
//   });
// });

// // ─── Graceful shutdown ─────────────────────────────────────────────────────────
// process.on('SIGINT', async () => {
//   console.log('Shutting down gracefully...');
//   const database = require('./config/database');
//   await database.close();
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   console.log('Terminating gracefully...');
//   const database = require('./config/database');
//   await database.close();
//   process.exit(0);
// });

// app.listen(port, () => {
//   console.log(`🚀 THT Server running on port ${port}`);
//   console.log(`📚 Swagger docs available at http://localhost:${port}/api-docs`);
//   console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
// });


const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// ── Core Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Chatbot DB Middleware (injects req.db for /tht routes) ────────────────────
const dbMiddleware = require('./middleware/dbMiddleware');
app.use(dbMiddleware);

// ── Static uploads (employee face images) ─────────────────────────────────────
const uploadPath = process.env.UPLOAD_PATH || './public/uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadPath)));

// ── Face Recognition: ensure MySQL tables exist ───────────────────────────────
const MySQLService = require('./services/mysqlService');
MySQLService.ensureTables().catch(console.error);

// ── Swagger UI ─────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'THT Grozziie API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; } .swagger-ui .topbar .download-url-wrapper { display: none; }',
  swaggerOptions: { docExpansion: 'list', filter: true, showExtensions: true, tagsSorter: 'alpha' },
}));

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── After-Sales Chatbot Routes  →  /tht/... ───────────────────────────────────
app.use('/tht', require('./routes/Detect'));
app.use('/tht', require('./routes/Translator'));
app.use('/tht', require('./routes/Chat'));
app.use('/tht', require('./routes/AttendanceMachineRoutes'));
app.use('/tht', require('./routes/ManualAttendanceMachineRoutes'));
app.use('/tht', require('./routes/DotPrinterRoutes'));
app.use('/tht', require('./routes/ThermalPrinterRoutes'));
app.use('/tht', require('./routes/PowerBankRoutes'));
app.use('/tht', require('./routes/FaceAttendanceRoutes'));
app.use('/tht', require('./routes/DeviceFaceAttendanceMachineRoutes'));
app.use('/tht', require('./routes/chatbotUnknownQuestionsRouter'));

// ── Face Recognition Routes  →  /api/... ─────────────────────────────────────
const { handleMulterError } = require('./middleware/upload');
app.use('/tht/faceRecognize', require('./routes/api'));

// ── Health Check ───────────────────────────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Unified server & database health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: healthy }
 *                 services:
 *                   type: object
 *                   properties:
 *                     chatbot_db:  { type: string, example: connected }
 *                     face_rec_db: { type: string, example: connected }
 *                     uploads:     { type: string, example: available }
 *                 timestamp: { type: string, example: "2024-01-15T10:30:00.000Z" }
 *       500:
 *         description: One or more services unhealthy
 */
app.get('/health', async (req, res) => {
  try {
    await req.db.query('SELECT 1');
    const facePool = require('./config/database');
    const conn = await facePool.getConnection();
    conn.release();
    res.status(200).json({
      status: 'healthy',
      services: { chatbot_db: 'connected', face_rec_db: 'connected', uploads: 'available' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() });
  }
});

// ── Root ───────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'THT Grozziie — After-Sales Chatbot & Face Recognition Server',
    version: '2.0.0',
    docs: `http://localhost:${port}/api-docs`,
    services: { chatbot: '/tht', faceRec: '/api', health: '/health', docsJson: '/api-docs.json' },
  });
});

// ── Error handlers ─────────────────────────────────────────────────────────────
app.use(handleMulterError);
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error', timestamp: new Date().toISOString() });
});
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found', requested: req.originalUrl });
});

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║      THT Grozziie — Unified API Server  v2.0.0          ║
╠══════════════════════════════════════════════════════════╣
║  📚 Docs   : http://localhost:${port}/api-docs           ║
║  💚 Health : http://localhost:${port}/health             ║
╠══════════════════════════════════════════════════════════╣
║  🤖 CHATBOT API   →  /tht                               ║
║  👤 FACE REC API  →  /api                               ║
║    POST  /api/employees          Register               ║
║    POST  /api/employees/force    Force register         ║
║    GET   /api/employees          List                   ║
║    POST  /api/recognize          Identify face          ║
║    POST  /api/recognize/batch    Batch identify         ║
║    GET   /api/statistics         Stats                  ║
╚══════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
