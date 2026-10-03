# Codex Bridge

This module adds a hosted Codex Bridge to the existing CommonJS/Express 4
application. It does not modify existing route implementations.

## Flow

1. The frontend reads the ten-product registry and creates a conversation for
   exactly one product.
2. The hosted bridge returns a private conversation token and stores the
   conversation, message jobs, and uploaded media for 48 hours.
3. Text questions enter a bounded answer queue. Images and browser-extracted
   video frames/audio enter a separate bounded media queue.
4. The bridge streams media to the outbound-connected local agent over
   `/ws/agent`. When the local deployment enables its authorized Codex Vision
   option, original images and extracted video frames are sent from that local
   agent to OpenAI for question-aware visual analysis. Original video files and
   audio are not sent to OpenAI.
5. The local agent retrieves only the locked product and knowledge version and
   returns an answer plus structured sources and resources.
6. The frontend polls asynchronous attachment and message status endpoints.

## Endpoints

- `GET /api/health` (public process health)
- `GET /api/status`
- `GET /api/documents`
- `POST /api/documents` (`multipart/form-data`, field `file`)
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/chat`
- `POST /api/codex/chat/gpt` (messages-style chat response with `answer` and `lang`)
- `GET /api/codex/v1/products`
- `GET /api/codex/v1/status`
- `POST /api/codex/v1/products/:productId/conversations`
- `GET|DELETE /api/codex/v1/conversations/:conversationId`
- `POST /api/codex/v1/conversations/:conversationId/attachments`
- `GET /api/codex/v1/conversations/:conversationId/attachments/:attachmentId`
- `POST /api/codex/v1/conversations/:conversationId/messages`
- `GET /api/codex/v1/conversations/:conversationId/messages/:messageId`
- `ws://HOST/ws/agent` locally or `wss://HOST/ws/agent` behind HTTPS

All REST endpoints except `/api/health` require:

```text
X-Bridge-Key: <CLIENT_API_KEY>
```

Every conversation endpoint after creation also requires the returned token:

```text
X-Conversation-Token: <conversationToken>
```

Normal customer chat never accepts a document ID or product override. The
product and active knowledge version are locked when the conversation is
created. The legacy document administration endpoints accept `productId` so
multiple DOCX files can be managed inside the correct product collection.

Image messages support up to five attachments. A video message supports one
video of at most five minutes; the browser supplies up to 50 representative
frames and optional mono WAV audio. Uploaded originals remain private in
`CODEX_CONVERSATION_DIRECTORY` and are removed with the conversation or after
the inactivity TTL. The local Codex Vision path uses original still images or
sampled video frames only, retains its temporary copy for at most 30 minutes by
default, and removes that copy immediately after the question is processed.
The bounded observations are then retained inside that private conversation,
so a text-only follow-up can refer to the most recently analyzed image or video
without uploading it again.

The local Node agent connects with these WebSocket upgrade headers:

```text
Authorization: Bearer <AGENT_SHARED_SECRET>
X-Agent-Id: primary
```

Chat request example:

```json
{
  "message": "What does the document say?",
  "history": [
    { "role": "user", "content": "Earlier question" },
    { "role": "assistant", "content": "Earlier answer" }
  ],
  "useDocuments": true,
  "documentIds": []
}
```

Messages-compatible chat request example:

```json
{
  "messages": [
    { "role": "user", "content": "How can I create a purchase order?" },
    { "role": "assistant", "content": "Boss, open the Purchase module." },
    { "role": "user", "content": "What information do I enter next?" }
  ]
}
```

Development values are stored in `codexBridge/.env`, which is ignored by Git.
Replace both secrets before production deployment. Root/process environment
variables with the same names take priority.

`CLIENT_API_KEY` is a compatibility gate, not customer identity or admin
authorization, and a key placed in a browser build is visible to every user.
Before public production use, put the bridge behind login/JWT or OIDC, use a
separate server-side admin authorization policy for document CRUD, and enforce
per-customer rate limits and storage/conversation quotas. Conversation tokens
isolate individual v1 conversations but do not replace customer authentication.

Important v1 settings are:

- `CODEX_PRODUCT_VERSIONS`: JSON map of product IDs to active versions.
- `CODEX_CONVERSATION_TTL_HOURS`: defaults to 48.
- `CODEX_ANSWER_CONCURRENCY` / `CODEX_ANSWER_QUEUE_LIMIT`: defaults to 4/250.
- `CODEX_MEDIA_CONCURRENCY` / `CODEX_MEDIA_QUEUE_LIMIT`: defaults to 2/100.
- `AGENT_MAX_MESSAGE_BYTES`: defaults to 2 MiB and bounds inbound WSS JSON
  results without restricting the smaller binary upload chunks.
- `CODEX_MAX_IMAGE_BYTES`, `CODEX_MAX_VIDEO_BYTES`, `CODEX_MAX_FRAME_BYTES`,
  `CODEX_MAX_AUDIO_BYTES`, and `CODEX_MAX_MEDIA_ANALYSIS_BYTES`: independent
  upload and local-analysis limits.

The HTTPS reverse proxy must support WebSocket Upgrade requests. A multi-process
or multi-instance deployment needs sticky routing or a shared broker because
agent sockets and pending requests are held in this Node process.

These queues intentionally provide backpressure for one hosted Node process and
one local worker. Before horizontal scaling, move conversation jobs and queue
state to a shared broker/database.

## Production IIS requirements

The bridge keeps chat requests open while the local machine performs retrieval,
Codex generation, and evidence verification. Keep the IIS connection timeout
longer than `AGENT_REQUEST_TIMEOUT_MS`. The included defaults use 15 minutes in
IIS and 10 minutes in the bridge.

After deployment, run this once in an elevated PowerShell window on the hosted
server, using the actual IIS site and application-pool names:

```powershell
.\codexBridge\configure-iis.ps1 -SiteName "Your site" -AppPoolName "Your app pool"
```

The script enables IIS WebSockets, sends IIS WebSocket pings every 20 seconds,
sets the site connection timeout to 15 minutes, and prevents the application
pool from shutting down only because it is idle. The bridge also sends JSON
keepalives so intermediaries that ignore WebSocket control frames still see
traffic.

Do not configure more than one IIS/iisnode process for this bridge unless agent
connections and pending requests are moved to a shared broker. Inspect the IIS
`sc-status`, `sc-substatus`, and `sc-win32-status` fields if a 503 remains.
