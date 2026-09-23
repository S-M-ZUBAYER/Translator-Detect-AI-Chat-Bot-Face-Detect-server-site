const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const express = require('express');
const { EventEmitter } = require('node:events');
const { WebSocket } = require('ws');
const { createCodexBridge } = require('../codexBridge');
const { AgentHub } = require('../codexBridge/agentHub');
const {
  createMessagesChatRouter,
} = require('../codexBridge/messagesChatRoute');
const { decodeBinaryFrame } = require('../codexBridge/protocol');

function createInbox(socket) {
  const messages = [];
  const waiters = [];

  socket.on('message', (data, isBinary) => {
    const item = isBinary
      ? { isBinary: true, data: Buffer.from(data) }
      : { isBinary: false, data: JSON.parse(data.toString('utf8')) };
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(item));

    if (waiterIndex >= 0) {
      const [{ resolve, timer }] = waiters.splice(waiterIndex, 1);
      clearTimeout(timer);
      resolve(item);
      return;
    }
    messages.push(item);
  });

  return {
    waitFor(predicate, timeoutMs = 2000) {
      const messageIndex = messages.findIndex(predicate);
      if (messageIndex >= 0) {
        return Promise.resolve(messages.splice(messageIndex, 1)[0]);
      }

      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: null };
        waiter.timer = setTimeout(() => {
          const waiterIndex = waiters.indexOf(waiter);
          if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
          reject(new Error('Timed out waiting for a WebSocket message.'));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    waitForJson(type) {
      return this.waitFor(
        (item) => !item.isBinary && item.data.type === type,
      ).then((item) => item.data);
    },
    waitForBinary() {
      return this.waitFor((item) => item.isBinary).then((item) => item.data);
    },
  };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function connect(url, headers) {
  const socket = new WebSocket(url, { headers });
  const inbox = createInbox(socket);
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, inbox }));
    socket.once('error', reject);
  });
}

class FakeAgentSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = WebSocket.OPEN;
    this.sent = [];
  }

  send(value) {
    this.sent.push(JSON.parse(value));
  }

  ping() {}

  close(code, reason) {
    this.closeRequest = { code, reason };
  }

  terminate() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
}

test('closing a replaced socket cannot reject work sent through the new socket', async () => {
  const config = {
    agentSecret: 'test-agent-secret-123456789',
    defaultAgentId: 'primary',
    requestTimeoutMs: 2000,
    uploadChunkBytes: 16 * 1024,
    heartbeatMs: 5000,
  };
  const hub = new AgentHub(config);
  const oldSocket = new FakeAgentSocket();
  const newSocket = new FakeAgentSocket();
  hub.onConnection(oldSocket, undefined, { agentId: 'primary' });
  hub.onConnection(newSocket, undefined, { agentId: 'primary' });

  const pending = hub.request('ask', { message: 'hello' });
  const ask = newSocket.sent.find((message) => message.type === 'ask');
  assert.ok(ask);

  oldSocket.readyState = WebSocket.CLOSED;
  oldSocket.emit('close');
  hub.handleAgentMessage(newSocket, {
    type: 'ask_result',
    requestId: ask.requestId,
    ok: true,
    data: { answer: 'still connected' },
  });

  assert.deepEqual(await pending, { answer: 'still connected' });
});

test('client cancellation is forwarded to the same agent socket', async () => {
  const config = {
    agentSecret: 'test-agent-secret-123456789',
    defaultAgentId: 'primary',
    requestTimeoutMs: 2000,
    uploadChunkBytes: 16 * 1024,
    heartbeatMs: 5000,
  };
  const hub = new AgentHub(config);
  const socket = new FakeAgentSocket();
  hub.onConnection(socket, undefined, { agentId: 'primary' });
  const controller = new AbortController();
  const pending = hub.request(
    'ask',
    { message: 'hello' },
    {
      signal: controller.signal,
    },
  );
  const ask = socket.sent.find((message) => message.type === 'ask');

  controller.abort();

  await assert.rejects(
    pending,
    (error) => error.code === 'CLIENT_DISCONNECTED',
  );
  assert.ok(
    socket.sent.some(
      (message) =>
        message.type === 'cancel' && message.requestId === ask.requestId,
    ),
  );
});

test('Codex bridge relays REST chat and DOCX operations without affecting existing routes', async () => {
  const config = {
    frontendOrigins: ['*'],
    clientApiKey: 'test-client-key-123456789',
    agentSecret: 'test-agent-secret-123456789',
    defaultAgentId: 'primary',
    requestTimeoutMs: 2000,
    maxFileBytes: 1024 * 1024,
    uploadChunkBytes: 16 * 1024,
    heartbeatMs: 5000,
  };
  const bridge = createCodexBridge({ config });
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.get('/existing', (_req, res) => res.json({ existing: true }));
  app.use('/api', createMessagesChatRouter({ hub: bridge.hub, config }));
  app.use('/api', bridge.router);
  app.use((_req, res) => res.status(404).json({ existingNotFound: true }));

  const server = http.createServer(app);
  bridge.attach(server);
  await listen(server);

  const address = server.address();
  const httpBase = `http://127.0.0.1:${address.port}`;
  const webSocketUrl = `ws://127.0.0.1:${address.port}/ws/agent`;
  const bridgeHeaders = { 'X-Bridge-Key': config.clientApiKey };
  let agent;

  try {
    const existingBefore = await fetch(`${httpBase}/existing`);
    assert.equal(existingBefore.status, 200);
    assert.deepEqual(await existingBefore.json(), { existing: true });

    const health = await fetch(`${httpBase}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const unauthorized = await fetch(`${httpBase}/api/status`);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).error.code, 'UNAUTHORIZED');

    await new Promise((resolve, reject) => {
      const badSocket = new WebSocket(webSocketUrl, {
        headers: {
          Authorization: 'Bearer incorrect-secret',
          'X-Agent-Id': 'primary',
        },
      });
      badSocket.once('unexpected-response', (_request, response) => {
        try {
          assert.equal(response.statusCode, 401);
          response.resume();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      badSocket.once('open', () =>
        reject(new Error('Invalid agent unexpectedly connected.')),
      );
      badSocket.once('error', () => {});
    });

    agent = await connect(webSocketUrl, {
      Authorization: `Bearer ${config.agentSecret}`,
      'X-Agent-Id': 'primary',
    });
    const hostHello = await agent.inbox.waitForJson('host_hello');
    assert.equal(hostHello.protocolVersion, 1);

    const status = await fetch(`${httpBase}/api/status`, {
      headers: bridgeHeaders,
    });
    const statusBody = await status.json();
    assert.equal(status.status, 200);
    assert.equal(statusBody.agent.connected, true);
    assert.equal(statusBody.agent.agentId, 'primary');

    const unauthorizedMessagesChat = await fetch(
      `${httpBase}/api/codex/chat/gpt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Unauthorized question' }],
        }),
      },
    );
    assert.equal(unauthorizedMessagesChat.status, 401);

    const invalidMessagesChat = await fetch(`${httpBase}/api/codex/chat/gpt`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'assistant',
            content: 'The final message is not a question.',
          },
        ],
      }),
    });
    assert.equal(invalidMessagesChat.status, 400);
    assert.equal(
      (await invalidMessagesChat.json()).error.code,
      'INVALID_MESSAGES',
    );

    const messagesChatPromise = fetch(`${httpBase}/api/codex/chat/gpt`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'How can I create a purchase order?' },
          {
            role: 'assistant',
            content:
              'Boss, open the Purchase module and select Purchase Order.',
          },
          {
            role: 'user',
            content: 'What information do I need to enter next?',
          },
        ],
      }),
    });

    const messagesAsk = await agent.inbox.waitForJson('ask');
    assert.equal(
      messagesAsk.message,
      'What information do I need to enter next?',
    );
    assert.deepEqual(messagesAsk.history, [
      { role: 'user', content: 'How can I create a purchase order?' },
      {
        role: 'assistant',
        content: 'Boss, open the Purchase module and select Purchase Order.',
      },
    ]);
    assert.equal(messagesAsk.useDocuments, true);
    agent.socket.send(
      JSON.stringify({
        type: 'ask_result',
        requestId: messagesAsk.requestId,
        ok: true,
        data: {
          answer:
            'Boss, select the supplier, products, quantities, and prices, then save the purchase order.',
        },
      }),
    );

    const messagesChatResponse = await messagesChatPromise;
    assert.equal(messagesChatResponse.status, 200);
    assert.deepEqual(await messagesChatResponse.json(), {
      answer:
        'Boss, select the supplier, products, quantities, and prices, then save the purchase order.',
      lang: 'en',
    });

    const chatPromise = fetch(`${httpBase}/api/chat`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What does the document say?',
        history: [
          { role: 'user', content: 'Earlier question' },
          { role: 'assistant', content: 'Earlier answer' },
        ],
        useDocuments: true,
        documentIds: [],
      }),
    });

    const ask = await agent.inbox.waitForJson('ask');
    assert.equal(ask.message, 'What does the document say?');
    assert.equal(ask.history.length, 2);
    assert.deepEqual(ask.documentIds, []);
    agent.socket.send(
      JSON.stringify({
        type: 'ask_result',
        requestId: ask.requestId,
        ok: true,
        data: { answer: 'The document says the test passed.' },
      }),
    );

    const chatResponse = await chatPromise;
    const chatBody = await chatResponse.json();
    assert.equal(chatResponse.status, 200);
    assert.equal(chatBody.answer, 'The document says the test passed.');
    assert.match(chatBody.requestId, /^[a-f0-9-]{36}$/);

    const docxBytes = Buffer.from('PK\u0003\u0004test-docx-content', 'utf8');
    const form = new FormData();
    form.append(
      'file',
      new Blob([docxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      'Store Manual.docx',
    );
    const uploadPromise = fetch(`${httpBase}/api/documents`, {
      method: 'POST',
      headers: bridgeHeaders,
      body: form,
    });

    const uploadStart = await agent.inbox.waitForJson('upload_start');
    assert.equal(uploadStart.filename, 'Store Manual.docx');
    assert.equal(uploadStart.size, docxBytes.length);
    agent.socket.send(
      JSON.stringify({
        type: 'upload_ready',
        requestId: uploadStart.requestId,
      }),
    );

    const binaryFrame = decodeBinaryFrame(await agent.inbox.waitForBinary());
    assert.equal(binaryFrame.header.type, 'upload_chunk');
    assert.equal(binaryFrame.header.requestId, uploadStart.requestId);
    assert.deepEqual(binaryFrame.payload, docxBytes);

    const uploadComplete = await agent.inbox.waitForJson('upload_complete');
    assert.equal(uploadComplete.requestId, uploadStart.requestId);
    assert.equal(uploadComplete.chunks, 1);
    agent.socket.send(
      JSON.stringify({
        type: 'upload_result',
        requestId: uploadStart.requestId,
        ok: true,
        data: {
          id: '12345678-1234-1234-1234-123456789abc',
          filename: 'Store Manual.docx',
        },
      }),
    );

    const uploadResponse = await uploadPromise;
    const uploadBody = await uploadResponse.json();
    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadBody.filename, 'Store Manual.docx');

    const listPromise = fetch(`${httpBase}/api/documents`, {
      headers: bridgeHeaders,
    });
    const listFiles = await agent.inbox.waitForJson('list_files');
    agent.socket.send(
      JSON.stringify({
        type: 'list_files_result',
        requestId: listFiles.requestId,
        ok: true,
        data: {
          documents: [{ id: uploadBody.id, filename: uploadBody.filename }],
        },
      }),
    );
    const listResponse = await listPromise;
    assert.equal(listResponse.status, 200);
    assert.equal(
      (await listResponse.json()).documents[0].filename,
      'Store Manual.docx',
    );

    const replacementBytes = Buffer.from(
      'PK\u0003\u0004replacement-docx',
      'utf8',
    );
    const replacementForm = new FormData();
    replacementForm.append(
      'file',
      new Blob([replacementBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      'Replacement.docx',
    );
    const replacePromise = fetch(`${httpBase}/api/documents/${uploadBody.id}`, {
      method: 'PUT',
      headers: bridgeHeaders,
      body: replacementForm,
    });
    const replaceStart = await agent.inbox.waitForJson('upload_start');
    assert.equal(replaceStart.replaceId, uploadBody.id);
    agent.socket.send(
      JSON.stringify({
        type: 'upload_ready',
        requestId: replaceStart.requestId,
      }),
    );
    const replacementFrame = decodeBinaryFrame(
      await agent.inbox.waitForBinary(),
    );
    assert.deepEqual(replacementFrame.payload, replacementBytes);
    await agent.inbox.waitForJson('upload_complete');
    agent.socket.send(
      JSON.stringify({
        type: 'upload_result',
        requestId: replaceStart.requestId,
        ok: true,
        data: { id: uploadBody.id, filename: 'Replacement.docx' },
      }),
    );
    const replaceResponse = await replacePromise;
    assert.equal(replaceResponse.status, 200);
    assert.equal((await replaceResponse.json()).filename, 'Replacement.docx');

    const deletePromise = fetch(`${httpBase}/api/documents/${uploadBody.id}`, {
      method: 'DELETE',
      headers: bridgeHeaders,
    });
    const deleteFile = await agent.inbox.waitForJson('delete_file');
    assert.equal(deleteFile.fileId, uploadBody.id);
    agent.socket.send(
      JSON.stringify({
        type: 'delete_file_result',
        requestId: deleteFile.requestId,
        ok: true,
        data: {},
      }),
    );
    const deleteResponse = await deletePromise;
    assert.equal(deleteResponse.status, 204);

    const interruptedChatPromise = fetch(`${httpBase}/api/chat`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Disconnect during this request.' }),
    });
    await agent.inbox.waitForJson('ask');
    const agentClosed = new Promise((resolve) =>
      agent.socket.once('close', resolve),
    );
    agent.socket.terminate();
    await agentClosed;
    const interruptedResponse = await interruptedChatPromise;
    assert.equal(interruptedResponse.status, 503);
    assert.equal(
      (await interruptedResponse.json()).error.code,
      'AGENT_DISCONNECTED',
    );

    const offlineStatus = await fetch(`${httpBase}/api/status`, {
      headers: bridgeHeaders,
    });
    assert.equal((await offlineStatus.json()).agent.connected, false);

    const offlineMessagesChat = await fetch(`${httpBase}/api/codex/chat/gpt`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Can you answer while offline?' }],
      }),
    });
    assert.equal(offlineMessagesChat.status, 503);
    assert.equal(
      (await offlineMessagesChat.json()).error.code,
      'AGENT_OFFLINE',
    );

    const existingAfter = await fetch(`${httpBase}/existing`);
    assert.equal(existingAfter.status, 200);
    assert.deepEqual(await existingAfter.json(), { existing: true });
  } finally {
    agent?.socket.terminate();
    bridge.close();
    await closeServer(server);
  }
});
