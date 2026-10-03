const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { access, mkdtemp, rm } = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const express = require('express');
const { createCodexBridge } = require('../codexBridge');
const { ConversationStore } = require('../codexBridge/conversationStore');
const { TaskQueue } = require('../codexBridge/taskQueue');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function rawRequest({ port, path: requestPath, headers, body = '' }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method: 'POST',
        headers,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

async function poll(url, headers, select, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    const value = select(body);
    if (!['queued', 'processing', 'answering'].includes(value.status)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out polling ${url}`);
}

class FakeHub {
  constructor() {
    this.requests = [];
    this.media = [];
  }

  status() {
    return { agentId: 'primary', connected: true };
  }

  async analyzeMedia(files, metadata) {
    this.media.push({ files, metadata });
    return {
      summary: 'The screenshot shows a printer with a red paper warning.',
      items: [
        {
          fileId: files[0].fileId,
          kind: 'image',
          text: 'Printer display shows paper warning.',
          ocrText: 'LOAD PAPER',
        },
      ],
      warnings: [],
      analysisVersion: 'test-local-media-v1',
    };
  }

  async request(type, payload) {
    this.requests.push({ type, payload });
    if (type === 'ask') {
      return {
        answer: 'Boss, load the paper and close the printer cover.',
        status: 'answered',
        sources: [{ sourceId: 'S1', title: 'Thermal Printer Guide', excerpt: 'Load paper.' }],
        resources: [
          { type: 'image', url: 'https://example.com/load-paper.png', title: 'Load paper' },
          { type: 'video', url: 'https://example.com/load-paper.mp4', title: 'Video guide' },
          { type: 'image', url: 'javascript:alert(1)', title: 'Unsafe' },
          { type: 'link', url: 'https://user:pass@example.com/private', title: 'Credentials' },
          { type: 'image', url: 'https://example.com/load-paper.png', title: 'Duplicate' },
        ],
      };
    }
    return { documents: [] };
  }

  close() {}
}

test('bounded answer queue accepts a 100-customer burst without unbounded concurrency', async () => {
  const queue = new TaskQueue({
    concurrency: 4,
    maxQueued: 250,
    code: 'ANSWER_QUEUE_FULL',
    name: 'Answer queue',
  });
  let active = 0;
  let peak = 0;
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      queue.add(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return index;
      }),
    ),
  );
  assert.equal(results.length, 100);
  assert.equal(new Set(results).size, 100);
  assert.equal(peak, 4);
  assert.deepEqual(queue.status(), {
    active: 0,
    queued: 0,
    concurrency: 4,
    maxQueued: 250,
  });
  queue.close();
});

test('conversation deletion waits for in-flight persistence and cannot resurrect data', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-bridge-store-'));
  const store = new ConversationStore({
    directory,
    ttlMs: 48 * 60 * 60 * 1000,
  });
  try {
    const created = await store.create({
      product: {
        id: 'thermal-printer',
        name: 'Thermal Printer',
        knowledgeVersion: '1',
      },
      locale: 'en',
    });
    const originalPersist = store.persist.bind(store);
    let releasePersist;
    let persistenceStarted;
    const started = new Promise((resolve) => {
      persistenceStarted = resolve;
    });
    const gate = new Promise((resolve) => {
      releasePersist = resolve;
    });
    let delayOnce = true;
    store.persist = async (conversation) => {
      if (delayOnce) {
        delayOnce = false;
        persistenceStarted();
        await gate;
      }
      return originalPersist(conversation);
    };

    const update = store.mutate(created.conversation.id, (conversation) => {
      conversation.locale = 'fr';
    });
    await started;
    const removal = store.remove(created.conversation.id);
    releasePersist();
    await update;
    await removal;

    assert.equal(store.getInternal(created.conversation.id), undefined);
    await assert.rejects(
      access(
        path.join(
          directory,
          'conversations',
          `${created.conversation.id}.json`,
        ),
      ),
      (error) => error.code === 'ENOENT',
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('conversation memory rolls back when durable persistence fails', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-bridge-persist-'));
  const store = new ConversationStore({
    directory,
    ttlMs: 48 * 60 * 60 * 1000,
  });
  try {
    const created = await store.create({
      product: {
        id: 'thermal-printer',
        name: 'Thermal Printer',
        knowledgeVersion: '1',
      },
      locale: 'en',
    });
    const originalPersist = store.persist.bind(store);
    store.persist = async () => {
      throw new Error('simulated disk failure');
    };
    await assert.rejects(
      store.mutate(created.conversation.id, (conversation) => {
        conversation.locale = 'fr';
      }),
      /simulated disk failure/,
    );
    assert.equal(store.getInternal(created.conversation.id).locale, 'en');

    store.persist = originalPersist;
    await store.remove(created.conversation.id);
    store.persist = async () => {
      throw new Error('simulated create failure');
    };
    await assert.rejects(
      store.create({
        product: {
          id: 'thermal-printer',
          name: 'Thermal Printer',
          knowledgeVersion: '1',
        },
        locale: 'en',
      }),
      /simulated create failure/,
    );
    assert.equal(store.conversations.size, 0);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('v1 conversations lock product, analyze media, queue answers, and preserve resources', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-bridge-v1-'));
  const hub = new FakeHub();
  const config = {
    frontendOrigins: ['*'],
    clientApiKey: 'test-client-key-123456789',
    agentSecret: 'test-agent-secret-123456789',
    defaultAgentId: 'primary',
    requestTimeoutMs: 2000,
    maxFileBytes: 1024 * 1024,
    uploadChunkBytes: 16 * 1024,
    heartbeatMs: 5000,
    conversationDirectory: directory,
    conversationTtlMs: 48 * 60 * 60 * 1000,
    answerConcurrency: 2,
    answerQueueLimit: 100,
    mediaConcurrency: 1,
    mediaQueueLimit: 20,
    maxImageBytes: 1024 * 1024,
    maxVideoBytes: 5 * 1024 * 1024,
    maxFrameBytes: 1024 * 1024,
    maxAudioBytes: 1024 * 1024,
    maxMediaAnalysisBytes: 2 * 1024 * 1024,
  };
  const bridge = createCodexBridge({ config, hub });
  const app = express();
  app.use(express.json());
  app.use('/api', bridge.router);
  const server = http.createServer(app);
  await listen(server);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const bridgeHeaders = { 'X-Bridge-Key': config.clientApiKey };

  try {
    const productsResponse = await fetch(`${base}/codex/v1/products`, { headers: bridgeHeaders });
    assert.equal(productsResponse.status, 200);
    const products = (await productsResponse.json()).products;
    assert.equal(products.length, 10);

    const createResponse = await fetch(
      `${base}/codex/v1/products/thermal-printer/conversations`,
      {
        method: 'POST',
        headers: { ...bridgeHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'en' }),
      },
    );
    assert.equal(createResponse.status, 201);
    assert.match(createResponse.headers.get('cache-control') || '', /no-store/);
    const created = await createResponse.json();
    assert.equal(created.conversation.productId, 'thermal-printer');
    assert.ok(created.conversationToken);

    const unauthorized = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}`,
      { headers: bridgeHeaders },
    );
    assert.equal(unauthorized.status, 403);

    const conversationHeaders = {
      ...bridgeHeaders,
      'X-Conversation-Token': created.conversationToken,
    };
    const unboundedUpload = await rawRequest({
      port: server.address().port,
      path: `/api/codex/v1/conversations/${created.conversation.id}/attachments`,
      headers: {
        ...conversationHeaders,
        'Content-Type': 'multipart/form-data; boundary=test-boundary',
        'Transfer-Encoding': 'chunked',
      },
      body: '--test-boundary--\r\n',
    });
    assert.equal(unboundedUpload.status, 411);
    assert.equal(JSON.parse(unboundedUpload.body).error.code, 'CONTENT_LENGTH_REQUIRED');
    const overrideResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages`,
      {
        method: 'POST',
        headers: { ...conversationHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId: randomUUID(),
          text: 'Try another product.',
          attachmentIds: [],
          productId: 'warehouse-erp-web',
        }),
      },
    );
    assert.equal(overrideResponse.status, 400);
    assert.equal((await overrideResponse.json()).error.code, 'UNKNOWN_FIELD');

    const image = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('test-image-bytes'),
    ]);
    const form = new FormData();
    form.append('file', new Blob([image], { type: 'image/png' }), 'warning.png');
    const uploadResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/attachments`,
      { method: 'POST', headers: conversationHeaders, body: form },
    );
    assert.equal(uploadResponse.status, 202);
    const uploaded = (await uploadResponse.json()).attachment;

    const attachment = await poll(
      `${base}/codex/v1/conversations/${created.conversation.id}/attachments/${uploaded.id}`,
      conversationHeaders,
      (body) => body.attachment,
    );
    assert.equal(attachment.status, 'ready');
    assert.match(attachment.summary, /printer/i);
    assert.equal(hub.media[0].metadata.productId, 'thermal-printer');

    const clientMessageId = randomUUID();
    const messageResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages`,
      {
        method: 'POST',
        headers: { ...conversationHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId,
          text: 'How do I fix this warning?',
          attachmentIds: [uploaded.id],
        }),
      },
    );
    assert.equal(messageResponse.status, 202);
    const queuedMessage = (await messageResponse.json()).message;
    const completed = await poll(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages/${queuedMessage.id}`,
      conversationHeaders,
      (body) => body.message,
    );
    assert.equal(completed.status, 'completed');
    assert.equal(completed.result.productId, 'thermal-printer');
    assert.equal(completed.result.resources.length, 2);
    assert.equal(hub.requests[0].payload.productId, 'thermal-printer');
    assert.equal(hub.requests[0].payload.mediaEvidence[0].attachmentId, uploaded.id);

    const duplicateResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages`,
      {
        method: 'POST',
        headers: { ...conversationHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId,
          text: 'How do I fix this warning?',
          attachmentIds: [uploaded.id],
        }),
      },
    );
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).message.id, completed.id);
    assert.equal(hub.requests.length, 1);

    const video = Buffer.concat([
      Buffer.from([0, 0, 0, 16]),
      Buffer.from('ftypisom'),
      Buffer.alloc(4),
    ]);
    const audio = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVE'),
      Buffer.alloc(4),
    ]);
    const videoForm = new FormData();
    videoForm.append('file', new Blob([video], { type: 'video/mp4' }), 'issue.mp4');
    videoForm.append('frames', new Blob([image], { type: 'image/png' }), 'frame.png');
    videoForm.append('audio', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
    videoForm.append('durationMs', '1000');
    videoForm.append('frameTimestamps', JSON.stringify([500]));
    const videoUploadResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/attachments`,
      { method: 'POST', headers: conversationHeaders, body: videoForm },
    );
    assert.equal(videoUploadResponse.status, 202);
    const videoUploaded = (await videoUploadResponse.json()).attachment;
    const videoAttachment = await poll(
      `${base}/codex/v1/conversations/${created.conversation.id}/attachments/${videoUploaded.id}`,
      conversationHeaders,
      (body) => body.attachment,
    );
    assert.equal(videoAttachment.status, 'ready');
    assert.equal(videoAttachment.type, 'video');
    assert.deepEqual(hub.media[1].files.map((file) => file.kind), ['frame', 'audio']);
    assert.equal(hub.media[1].files[0].timestampMs, 500);
    assert.equal(hub.media[1].metadata.productId, 'thermal-printer');

    const videoMessageResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages`,
      {
        method: 'POST',
        headers: { ...conversationHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId: randomUUID(),
          text: 'What happens in this video?',
          attachmentIds: [videoUploaded.id],
        }),
      },
    );
    assert.equal(videoMessageResponse.status, 202);
    const videoMessage = (await videoMessageResponse.json()).message;
    const videoCompleted = await poll(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages/${videoMessage.id}`,
      conversationHeaders,
      (body) => body.message,
    );
    assert.equal(videoCompleted.status, 'completed');
    assert.equal(hub.requests[1].payload.attachments[0].type, 'video');
    assert.equal(hub.requests[1].payload.mediaEvidence[0].attachmentId, videoUploaded.id);

    const followUpResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages`,
      {
        method: 'POST',
        headers: { ...conversationHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientMessageId: randomUUID(),
          text: 'What should I do next?',
        }),
      },
    );
    assert.equal(followUpResponse.status, 202);
    const followUp = (await followUpResponse.json()).message;
    const followUpCompleted = await poll(
      `${base}/codex/v1/conversations/${created.conversation.id}/messages/${followUp.id}`,
      conversationHeaders,
      (body) => body.message,
    );
    assert.equal(followUpCompleted.status, 'completed');
    assert.equal(hub.requests[2].payload.mediaEvidence[0].attachmentId, videoUploaded.id);

    const deleteResponse = await fetch(
      `${base}/codex/v1/conversations/${created.conversation.id}`,
      { method: 'DELETE', headers: conversationHeaders },
    );
    assert.equal(deleteResponse.status, 204);
  } finally {
    bridge.close();
    await closeServer(server);
    await rm(directory, { recursive: true, force: true });
  }
});
