# THT Grozziie API Server

Express API for translation, language detection, after-sales support chat, FAQ management, face attendance, and a hosted-to-local Codex Bridge. Swagger UI documents the HTTP endpoints.

## What is in this project

| Area | What it does | Base path |
| --- | --- | --- |
| Translation and detection | Translates text and extracts company fields from text | `/tht` |
| After-sales chatbot | General and product-specific chat, document ingestion, audio transcription, image/PDF analysis, FAQs, drafts, unknown questions, and usage statistics | `/tht/chatBot` |
| Face recognition | Employee registration, face matching, cache control, and statistics | `/tht/faceRecognize` |
| Codex Bridge | Relays support requests to a separately running local agent over WebSocket; includes product-scoped conversations and document administration | `/api` |
| API documentation | Swagger UI and generated OpenAPI JSON | `/api-docs`, `/api-docs.json` |

The server uses MySQL for chatbot and face recognition data, OpenAI for the legacy AI endpoints, and local face recognition models in `face-models/`. The Codex Bridge needs a separate local agent connected to `/ws/agent` to answer requests.

## Requirements

- Node.js 22.3+ and npm (the installed `pdf-parse` version also supports Node 20.16–20.x).
- A reachable MySQL database and a user permitted to create or update the tables used by the app.
- An OpenAI API key for translation, legacy chat, transcription, and analysis features.
- A separately deployed Codex Bridge agent for bridge requests. This repository contains the hosted bridge, not the local agent.

Some tables are created or checked on startup, including face recognition, FAQ draft, and chat statistics tables. Other chatbot features expect their existing MySQL tables and data; this repository does not contain a complete database migration or seed script.

## Local setup

1. Install dependencies from the lockfile:

   ```bash
   npm ci
   ```

2. Create a **local, untracked** `.env` in the repository root. Set the variables below with your own values. Do not copy production credentials into documentation, examples, or commits.

   | Variable | Purpose |
   | --- | --- |
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection. `DB_PORT` defaults to `3306` in the active pool. |
   | `OPENAI_API_KEY` | OpenAI access for legacy AI routes. |
   | `PORT` | HTTP listen port; defaults to `5000`. |
   | `OPENAI_TRANSLATE_MODEL` | Optional translation model override. |
   | `UPLOAD_PATH` | Optional employee image upload directory; defaults to `./public/uploads`. |
   | `MODEL_PATH`, `FACE_MATCH_THRESHOLD` | Optional face model directory and match threshold. |

3. Configure the Codex Bridge. Its required `CLIENT_API_KEY` and `AGENT_SHARED_SECRET` must be **different, private values of at least 16 characters each**. Put them in the root `.env`, in the untracked `codexBridge/.env`, or in the process environment. The root/process values take precedence. See [`codexBridge/.env.example`](codexBridge/.env.example) for all available bridge setting names and [`codexBridge/README.md`](codexBridge/README.md) for the bridge protocol. Set `FRONTEND_ORIGINS` to the origins you intend to allow when exposing the bridge.

4. Start the server:

   ```bash
   node index.js
   ```

   The current `package.json` does not define a start script. Its `npm test` script is a placeholder; the bridge tests can be run directly with `node --test tests/codexBridge.test.js tests/codexBridgeV1.test.js`.

5. Open `http://localhost:5000/api-docs` (replace `5000` if you set `PORT`). `GET /` returns server information. `GET /health` checks the database connection; `GET /api/health` checks that the bridge process responds. Swagger JSON is at `/api-docs.json`.

## API map

The route names below are the actual mount points. Use Swagger UI for request bodies, upload fields, and response schemas.

### `/tht` routes

- `POST /tht/detect` and `POST /tht/translate`; translation also has `POST /tht/sync-trans-reading-time`.
- General chat: `/tht/chatBot/chat/gpt` and `/tht/chatBot/chat/gpt/no-store`, with document, transcription, image, and PDF endpoints under `/tht/chatBot`.
- Product chat bases: `/tht/chatBot/attendanceMachine`, `/manualAttendanceMachine`, `/dotPrinter`, `/thermalPrinter`, `/powerBank`, `/faceAttendance`, `/warehouseErp`, `/warehouseErpAppSite`, `/faceAttendanceWebsite`, and `/deviceFaceAttendanceMachine` (each suffix follows `/tht/chatBot`). These include chat, FAQ, and media routes.
- Shared FAQ and operations endpoints include `/tht/chatBot/faqs`, `/tht/chatBot/faqs/language`, `/tht/chatBot/faq-drafts`, `/tht/chatBot/unknown-questions`, and `/tht/chatBot/chat-stats`.
- Face recognition endpoints are under `/tht/faceRecognize`, including `/employees`, `/recognize`, `/cache/status`, and `/statistics`.

### `/api` Codex Bridge

- `GET /api/health` checks the bridge process. `GET /api/status` reports agent connection status.
- `POST /api/chat` and `POST /api/codex/chat/gpt` provide synchronous chat interfaces.
- `/api/documents` manages DOCX knowledge documents through the connected agent.
- `/api/codex/v1/products` lists supported products. `/api/codex/v1/products/:productId/conversations` creates a product-locked conversation; `/api/codex/v1/conversations/:conversationId` contains its messages and attachments.
- The local agent connects to `/ws/agent` over WebSocket (or secure WebSocket behind HTTPS).

Except for `/api/health`, bridge HTTP requests require the `X-Bridge-Key` header. Conversation operations after creation also require `X-Conversation-Token`. The WebSocket agent uses its own shared secret. These values are credentials: never place them in a public example, browser bundle, screenshot, or Git commit. The bridge key is a compatibility gate, not user authentication; add user authentication and separate document administration authorization before public use. See the [bridge guide](codexBridge/README.md) for the full request flow and deployment constraints.

## Project layout

```text
index.js          Express entry point and route mounts
swagger.js        OpenAPI generation
routes/           Translation, chatbot, FAQ, face, and Swagger route definitions
codexBridge/      Hosted bridge, conversation store, queues, WebSocket protocol
config/           MySQL connection pools
controllers/      Employee and recognition handlers
services/         MySQL and face recognition services
middleware/       Database and upload middleware
models/           Employee and face descriptor models
utils/            Chatbot and FAQ helpers
face-models/      Face recognition model assets
tests/            Codex Bridge tests
web.config        IIS/iisnode configuration
vercel.json       Vercel routing configuration
```

## Deployment notes

- Keep runtime secrets in your hosting environment or ignored `.env` files. Restrict CORS/origins and protect the legacy chatbot, FAQ management, face, and upload routes with authentication appropriate to your deployment.
- The bridge holds agent sockets, request state, and queues in one Node process. Multiple processes or instances need sticky routing or a shared broker. A reverse proxy must support WebSocket upgrades and allow requests to remain open longer than `AGENT_REQUEST_TIMEOUT_MS`.
- `web.config` and [`codexBridge/configure-iis.ps1`](codexBridge/configure-iis.ps1) cover the IIS setup. The script changes IIS settings and requires administrator access; review it and provide your own site and app pool names.
- Store uploaded images and bridge conversation data outside public Git history. The default bridge conversation directory is ignored by `codexBridge/.gitignore` once that file is added to the repository.

## Before publishing to GitHub

The root `.gitignore` excludes `.env`, `node_modules/`, uploads, generated output, server logs, and backup archives. Check the staged files before each push:

```bash
git status --short
git diff --cached --name-only
```

Do not stage credential files, server logs, uploaded/customer/employee data, database exports, or generated conversations. Ignore rules do not remove files that were already tracked. If a real secret was ever committed, remove it from history and rotate it.

## License

ISC (as declared in `package.json`).
