# Codex Bridge

This isolated module was adapted from `D:\Codex Chatting Project\Hosted_Server`
for the existing CommonJS/Express 4 application. It does not modify existing
route implementations.

## Flow

1. A frontend calls the hosted REST API with `X-Bridge-Key`.
2. The hosted server correlates the operation with a UUID `requestId`.
3. The command is forwarded over `/ws/agent` to the outbound-connected local
   Codex agent.
4. The local agent returns the matching result.
5. The original HTTP request receives the result.

## Endpoints

- `GET /api/health` (public process health)
- `GET /api/status`
- `GET /api/documents`
- `POST /api/documents` (`multipart/form-data`, field `file`)
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/chat`
- `POST /api/codex/chat/gpt` (messages-style chat response with `answer` and `lang`)
- `ws://HOST/ws/agent` locally or `wss://HOST/ws/agent` behind HTTPS

All REST endpoints except `/api/health` require:

```text
X-Bridge-Key: <CLIENT_API_KEY>
```

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

The HTTPS reverse proxy must support WebSocket Upgrade requests. A multi-process
or multi-instance deployment needs sticky routing or a shared broker because
agent sockets and pending requests are held in this Node process.

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
