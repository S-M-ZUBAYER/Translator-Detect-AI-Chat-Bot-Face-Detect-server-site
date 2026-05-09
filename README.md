# THT Translator, Detection and AI Chat Server

Node.js and Express backend for translation, language detection, AI chat, document processing, product-specific chatbot flows, Swagger API documentation, and face attendance recognition.

## Features

- REST API built with Express
- Swagger UI documentation at `/api-docs`
- Raw OpenAPI JSON at `/api-docs.json`
- Text language detection and translation endpoints
- AI chat endpoints for general chat and product-specific flows
- Document, image, audio, and PDF analysis endpoints
- Face attendance employee and recognition APIs
- MySQL database integration
- File upload support through Multer

## Tech Stack

- Node.js
- Express
- MySQL / mysql2
- OpenAI API
- Swagger UI / swagger-jsdoc
- TensorFlow.js and face-api.js
- Multer, Sharp, Mammoth, pdf-parse, pdf-poppler

## Project Structure

```text
config/        Database connection configuration
controllers/   Face attendance controllers
middleware/    Database and upload middleware
models/        Employee and face descriptor models
routes/        API route modules and Swagger annotations
services/      MySQL and face recognition services
utils/         Shared helper functions
face-models/   Local face recognition model files
public/        Public static assets
index.js       Application entry point
swagger.js     Swagger/OpenAPI setup
```

## Requirements

- Node.js 18 or newer
- MySQL server
- OpenAI API key
- Face recognition model files in `face-models/`

## Environment Variables

Create a local `.env` file in the project root. Do not commit the real `.env` file to GitHub.

```env
PORT=5000
NODE_ENV=development

OPENAI_API_KEY=your_openai_api_key
OPENAI_TRANSLATE_MODEL=gpt-4o-mini

DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

DB_CONNECTION_LIMIT=10
DB_CONNECT_TIMEOUT=10000
DB_ACQUIRE_TIMEOUT=10000

UPLOAD_PATH=./public/uploads
MODEL_PATH=./face-models
FACE_MATCH_THRESHOLD=0.6
JWT_SECRET=replace_with_a_strong_secret
```

## Installation

```bash
npm install
```

## Run Locally

```bash
node index.js
```

The server runs on the port defined by `PORT`, or `5000` by default.

Useful URLs:

- `GET /` - API status
- `GET /api-docs` - Swagger UI
- `GET /api-docs.json` - OpenAPI JSON
- API routes are mounted under `/tht`

## Main API Areas

- `/tht/detect`
- `/tht/translate`
- `/tht/chatBot/...`
- `/tht/chatBot/attendanceMachine/...`
- `/tht/chatBot/manualAttendanceMachine/...`
- `/tht/chatBot/dotPrinter/...`
- `/tht/chatBot/thermalPrinter/...`
- `/tht/chatBot/powerBank/...`
- `/tht/chatBot/faceAttendance/...`
- `/tht/faceRecognize/...`

For full request and response details, run the server and open `/api-docs`.

## GitHub Safety Notes

Before pushing this project to GitHub, make sure these are not committed:

- `.env` or any file containing real API keys, database passwords, JWT secrets, or server credentials
- `node_modules/`
- `public/uploads/`, `uploads/`, and `temp/`
- Generated extraction output under `routes/Output/`
- Local backup archives such as `.zip`, `.rar`, or `.7z`
- Any real customer, employee, image, audio, PDF, or attendance data

If a secret was already committed, remove it from git history and rotate the secret immediately.

## Deployment Notes

- Configure environment variables in the hosting platform instead of uploading `.env`
- Use a production MySQL user with only the permissions required by the app
- Keep uploaded files outside the repository
- Review CORS settings before exposing the API publicly
- Keep Swagger enabled only where it is appropriate for your environment

## License

ISC
