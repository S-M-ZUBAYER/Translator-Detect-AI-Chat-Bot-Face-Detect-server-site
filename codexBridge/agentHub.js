const { createHash, randomUUID, timingSafeEqual } = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');
const { HttpError } = require('./errors');
const { encodeBinaryFrame } = require('./protocol');

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sendJson(socket, value) {
  if (socket.readyState !== WebSocket.OPEN) {
    throw new HttpError(
      503,
      'AGENT_OFFLINE',
      'The local Codex agent is not connected.',
    );
  }
  socket.send(JSON.stringify(value));
}

function sendBinary(socket, value) {
  if (socket.readyState !== WebSocket.OPEN) {
    return Promise.reject(
      new HttpError(503, 'AGENT_OFFLINE', 'The local Codex agent is not connected.'),
    );
  }
  if (socket.send.length < 3) {
    socket.send(value, { binary: true });
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    socket.send(value, { binary: true }, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

class AgentHub {
  constructor(config) {
    this.config = config;
    this.webSocketServer = new WebSocketServer({
      noServer: true,
      // Binary upload chunks are small, while bounded JSON answer/media
      // results may legitimately be larger than a single chunk.
      maxPayload:
        config.agentMaxMessageBytes
        || Math.max(config.uploadChunkBytes + 4096, 2 * 1024 * 1024),
      perMessageDeflate: false,
    });
    this.agents = new Map();
    this.pending = new Map();
    this.heartbeat = null;
    this.server = null;
    this.upgradeHandler = null;
    this.closed = false;

    this.webSocketServer.on('connection', (socket, request, meta) => {
      this.onConnection(socket, request, meta);
    });
  }

  attach(server) {
    if (!server || typeof server.on !== 'function') {
      throw new TypeError('An HTTP/S server is required by the Codex bridge.');
    }
    if (this.server) throw new Error('The Codex bridge is already attached.');

    this.server = server;
    this.upgradeHandler = (request, socket, head) => {
      let url;
      try {
        url = new URL(request.url, 'http://localhost');
      } catch (_error) {
        socket.destroy();
        return;
      }

      if (url.pathname !== '/ws/agent') {
        socket.destroy();
        return;
      }

      const authorization = request.headers.authorization || '';
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '';
      const agentId = String(request.headers['x-agent-id'] || '').trim();

      if (!agentId || !safeEqual(token, this.config.agentSecret)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.webSocketServer.emit('connection', webSocket, request, {
          agentId,
        });
      });
    };

    server.on('upgrade', this.upgradeHandler);
    server.once('close', () => this.close());

    this.heartbeat = setInterval(
      () => this.runHeartbeat(),
      this.config.heartbeatMs,
    );
    this.heartbeat.unref?.();
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.server && this.upgradeHandler) {
      this.server.off('upgrade', this.upgradeHandler);
    }

    for (const socket of this.agents.values()) {
      socket.close(1001, 'Server shutting down');
    }
    this.agents.clear();

    for (const pending of this.pending.values()) {
      pending.reject(
        new HttpError(503, 'SERVER_SHUTDOWN', 'Hosted relay is shutting down.'),
      );
    }

    this.webSocketServer.close();
  }

  status(agentId = this.config.defaultAgentId) {
    const socket = this.agents.get(agentId);
    return {
      agentId,
      connected: socket?.readyState === WebSocket.OPEN,
      connectedAt: socket?.connectedAt || null,
      lastSeenAt: socket?.lastSeenAt || null,
    };
  }

  onConnection(socket, _request, { agentId }) {
    const previous = this.agents.get(agentId);
    if (previous && previous !== socket) {
      previous.close(4001, 'Replaced by a newer agent connection');
    }

    socket.agentId = agentId;
    socket.connectedAt = new Date().toISOString();
    socket.lastSeenAt = socket.connectedAt;
    socket.isAlive = true;
    this.agents.set(agentId, socket);
    console.log(`Local Codex agent connected: ${agentId}`);

    socket.on('pong', () => {
      socket.isAlive = true;
      socket.lastSeenAt = new Date().toISOString();
    });

    socket.on('message', (data, isBinary) => {
      if (isBinary) return;

      try {
        const message = JSON.parse(data.toString('utf8'));
        socket.isAlive = true;
        socket.lastSeenAt = new Date().toISOString();
        this.handleAgentMessage(socket, message);
      } catch (error) {
        console.warn(
          `Invalid message from Codex agent ${agentId}: ${error.message}`,
        );
      }
    });

    socket.on('close', (code, reason) => {
      if (this.agents.get(agentId) === socket) this.agents.delete(agentId);
      this.rejectSocketPending(
        socket,
        new HttpError(
          503,
          'AGENT_DISCONNECTED',
          'The local Codex agent disconnected before completing the request.',
        ),
      );
      console.log(
        `Local Codex agent disconnected: ${agentId} (${code || 'unknown'}): ${reason?.toString() || 'no reason'}`,
      );
    });

    socket.on('error', (error) => {
      console.warn(`Codex agent ${agentId} socket error: ${error.message}`);
    });

    sendJson(socket, {
      type: 'host_hello',
      protocolVersion: 1,
      serverTime: new Date().toISOString(),
    });
  }

  handleAgentMessage(socket, message) {
    if (message?.type === 'agent_hello' || message?.type === 'agent_pong') {
      socket.isAlive = true;
      return;
    }

    const requestId = message?.requestId;
    if (!requestId) return;

    const pending = this.pending.get(requestId);
    if (!pending || pending.socket !== socket) return;

    if (
      message.type === 'upload_ready'
      || message.type === 'analyze_media_ready'
    ) {
      pending.onReady?.();
      return;
    }

    if (!message.type?.endsWith('_result') && message.type !== 'error') return;

    if (message.type === 'error' || message.ok === false) {
      const status = Number.isInteger(message.status) ? message.status : 502;
      pending.reject(
        new HttpError(
          status,
          message.error?.code || 'AGENT_ERROR',
          message.error?.message || 'The local agent reported an error.',
        ),
      );
      return;
    }

    pending.resolve(message.data);
  }

  rejectSocketPending(socket, error) {
    for (const pending of this.pending.values()) {
      if (pending.socket !== socket) continue;
      pending.reject(error);
    }
  }

  runHeartbeat() {
    for (const [agentId, socket] of this.agents) {
      if (!socket.isAlive) {
        console.warn(`Terminating unresponsive Codex agent: ${agentId}`);
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      try {
        socket.ping();
        sendJson(socket, {
          type: 'host_ping',
          serverTime: new Date().toISOString(),
        });
      } catch (error) {
        console.warn(
          `Codex agent ${agentId} heartbeat error: ${error.message}`,
        );
        socket.terminate();
      }
    }
  }

  cancel(socket, requestId) {
    if (socket?.readyState !== WebSocket.OPEN) return;
    try {
      sendJson(socket, { type: 'cancel', requestId });
    } catch (_error) {
      // The socket close handler rejects any remaining work for this socket.
    }
  }

  getSocket(agentId) {
    const socket = this.agents.get(agentId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new HttpError(
        503,
        'AGENT_OFFLINE',
        'The local Codex agent is not connected. Start the local server and check its WSS settings.',
      );
    }
    return socket;
  }

  request(
    type,
    payload = {},
    {
      agentId = this.config.defaultAgentId,
      timeoutMs = this.config.requestTimeoutMs,
      signal,
    } = {},
  ) {
    const socket = this.getSocket(agentId);
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      let timer;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (this.pending.get(requestId) === pending)
          this.pending.delete(requestId);
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onAbort = () => {
        this.cancel(socket, requestId);
        finish(
          reject,
          new HttpError(
            499,
            'CLIENT_DISCONNECTED',
            'The client disconnected before the request completed.',
          ),
        );
      };
      const pending = {
        agentId,
        socket,
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error),
      };
      timer = setTimeout(() => {
        console.warn(
          `Codex agent request timed out: ${type} ${requestId} after ${timeoutMs} ms.`,
        );
        this.cancel(socket, requestId);
        pending.reject(
          new HttpError(
            504,
            'AGENT_TIMEOUT',
            `The local agent did not finish ${type} within the allowed time.`,
          ),
        );
      }, timeoutMs);
      timer.unref?.();

      this.pending.set(requestId, pending);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();

      try {
        sendJson(socket, { type, requestId, ...payload });
      } catch (error) {
        pending.reject(error);
      }
    });
  }

  upload(
    buffer,
    filename,
    replaceId,
    {
      agentId = this.config.defaultAgentId,
      signal,
      productId,
      knowledgeVersion,
    } = {},
  ) {
    const socket = this.getSocket(agentId);
    const requestId = randomUUID();
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const chunkBytes = this.config.uploadChunkBytes;
    const chunks = Math.ceil(buffer.length / chunkBytes);

    return new Promise((resolve, reject) => {
      let sent = false;
      let timer;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (this.pending.get(requestId) === pending)
          this.pending.delete(requestId);
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onAbort = () => {
        this.cancel(socket, requestId);
        finish(
          reject,
          new HttpError(
            499,
            'CLIENT_DISCONNECTED',
            'The client disconnected before the upload completed.',
          ),
        );
      };
      const pending = {
        agentId,
        socket,
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error),
      };
      timer = setTimeout(() => {
        console.warn(
          `Codex agent upload timed out: ${requestId} after ${this.config.requestTimeoutMs} ms.`,
        );
        this.cancel(socket, requestId);
        pending.reject(
          new HttpError(
            504,
            'AGENT_TIMEOUT',
            'The local agent did not finish the upload within the allowed time.',
          ),
        );
      }, this.config.requestTimeoutMs);
      timer.unref?.();

      const sendChunks = () => {
        if (sent) return;
        sent = true;

        try {
          for (let index = 0; index < chunks; index += 1) {
            const start = index * chunkBytes;
            const payload = buffer.subarray(
              start,
              Math.min(buffer.length, start + chunkBytes),
            );
            socket.send(
              encodeBinaryFrame(
                { type: 'upload_chunk', requestId, index },
                payload,
              ),
              { binary: true },
            );
          }

          sendJson(socket, {
            type: 'upload_complete',
            requestId,
            chunks,
            size: buffer.length,
            sha256,
          });
        } catch (error) {
          pending.reject(error);
        }
      };

      pending.onReady = sendChunks;
      this.pending.set(requestId, pending);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();

      try {
        sendJson(socket, {
          type: 'upload_start',
          requestId,
          filename,
          size: buffer.length,
          sha256,
          chunks,
          ...(productId ? { productId } : {}),
          ...(knowledgeVersion ? { knowledgeVersion } : {}),
          ...(replaceId ? { replaceId } : {}),
        });
      } catch (error) {
        pending.reject(error);
      }
    });
  }

  analyzeMedia(
    files,
    metadata,
    { agentId = this.config.defaultAgentId, signal } = {},
  ) {
    const socket = this.getSocket(agentId);
    const requestId = randomUUID();
    const chunkBytes = this.config.uploadChunkBytes;
    const normalizedFiles = files.map((file) => {
      if (!Buffer.isBuffer(file.buffer) || !file.buffer.length) {
        throw new TypeError('Every media analysis file must contain bytes.');
      }
      return {
        fileId: file.fileId || randomUUID(),
        kind: file.kind,
        name: file.name,
        mime: file.mime || file.mimeType,
        timestampMs: file.timestampMs,
        buffer: file.buffer,
        size: file.buffer.length,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        chunks: Math.ceil(file.buffer.length / chunkBytes),
      };
    });

    return new Promise((resolve, reject) => {
      let sent = false;
      let timer;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (this.pending.get(requestId) === pending) {
          this.pending.delete(requestId);
        }
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onAbort = () => {
        this.cancel(socket, requestId);
        finish(
          reject,
          new HttpError(
            499,
            'MEDIA_ANALYSIS_CANCELLED',
            'Media analysis was cancelled.',
          ),
        );
      };
      const pending = {
        agentId,
        socket,
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error),
      };

      timer = setTimeout(() => {
        this.cancel(socket, requestId);
        pending.reject(
          new HttpError(
            504,
            'MEDIA_ANALYSIS_TIMEOUT',
            'The local agent did not finish media analysis in time.',
          ),
        );
      }, this.config.requestTimeoutMs);
      timer.unref?.();

      const sendFiles = async () => {
        if (sent) return;
        sent = true;
        try {
          for (const file of normalizedFiles) {
            for (let index = 0; index < file.chunks; index += 1) {
              const start = index * chunkBytes;
              await sendBinary(
                socket,
                encodeBinaryFrame(
                  {
                    type: 'media_chunk',
                    requestId,
                    fileId: file.fileId,
                    index,
                  },
                  file.buffer.subarray(
                    start,
                    Math.min(file.size, start + chunkBytes),
                  ),
                ),
              );
            }
          }
          sendJson(socket, { type: 'analyze_media_complete', requestId });
        } catch (error) {
          pending.reject(error);
        }
      };

      pending.onReady = () => void sendFiles().catch(pending.reject);
      this.pending.set(requestId, pending);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();

      try {
        sendJson(socket, {
          type: 'analyze_media_start',
          requestId,
          ...metadata,
          files: normalizedFiles.map(({ buffer, ...file }) => file),
        });
      } catch (error) {
        pending.reject(error);
      }
    });
  }
}

module.exports = { AgentHub };
