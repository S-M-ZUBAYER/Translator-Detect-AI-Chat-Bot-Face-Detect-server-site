const { createHash, randomUUID } = require('crypto');
const { createReadStream, mkdirSync } = require('fs');
const {
  open,
  readFile,
  rename,
  rm,
} = require('fs/promises');
const path = require('path');
const { Router } = require('express');
const multer = require('multer');
const { HttpError, asyncHandler } = require('./errors');
const {
  safeResources,
  safeSources,
  shortText,
} = require('./responseSanitizer');

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const MAX_VIDEO_DURATION_MS = 5 * 60 * 1000;
const MAX_VIDEO_FRAMES = 50;
const MAX_MESSAGE_ATTACHMENTS = 5;
const SAFE_ASYNC_ERROR_CODES = new Set(['MEDIA_NOT_UNDERSTOOD']);

function parseInteger(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, 'INVALID_MEDIA_METADATA', `${name} is invalid.`);
  }
  return parsed;
}

function parseFrameTimestamps(value, count, durationMs) {
  if (!count) return [];
  let parsed;
  try {
    parsed = value ? JSON.parse(value) : [];
  } catch (_error) {
    throw new HttpError(
      400,
      'INVALID_MEDIA_METADATA',
      'frameTimestamps must be a JSON array.',
    );
  }
  if (
    !Array.isArray(parsed)
    || parsed.length !== count
    || parsed.some(
      (timestamp) =>
        !Number.isSafeInteger(timestamp)
        || timestamp < 0
        || (durationMs !== undefined && timestamp > durationMs),
    )
  ) {
    throw new HttpError(
      400,
      'INVALID_MEDIA_METADATA',
      'Provide one valid millisecond timestamp for every video frame.',
    );
  }
  return parsed;
}

function bearerToken(req) {
  const authorization = req.get('Authorization') || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  return (req.get('X-Conversation-Token') || '').trim();
}

async function readSignature(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function sniffImage(signature) {
  if (
    signature.length >= 8
    && signature.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) return { mimeType: 'image/png', extension: '.png' };
  if (
    signature.length >= 3
    && signature[0] === 0xff
    && signature[1] === 0xd8
    && signature[2] === 0xff
  ) return { mimeType: 'image/jpeg', extension: '.jpg' };
  if (
    signature.length >= 12
    && signature.subarray(0, 4).toString('ascii') === 'RIFF'
    && signature.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return { mimeType: 'image/webp', extension: '.webp' };
  return null;
}

function sniffVideo(signature) {
  if (
    signature.length >= 12
    && signature.subarray(4, 8).toString('ascii') === 'ftyp'
  ) {
    const brand = signature.subarray(8, 12).toString('ascii');
    if (
      !['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif', 'avis', 'M4A ']
        .includes(brand)
    ) return { mimeType: 'video/mp4', extension: '.mp4' };
  }
  if (
    signature.length >= 4
    && signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) return { mimeType: 'video/webm', extension: '.webm' };
  return null;
}

function sniffWav(signature) {
  if (
    signature.length >= 12
    && signature.subarray(0, 4).toString('ascii') === 'RIFF'
    && signature.subarray(8, 12).toString('ascii') === 'WAVE'
  ) return { mimeType: 'audio/wav', extension: '.wav' };
  return null;
}

function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function safeFilename(value) {
  return path.basename(String(value || 'media')).replace(/[\u0000-\u001f]/gu, '').slice(0, 200) || 'media';
}

async function removeFiles(files) {
  await Promise.all(
    files.filter(Boolean).map((file) =>
      rm(typeof file === 'string' ? file : file.path, { force: true }).catch(() => {}),
    ),
  );
}

async function moveValidated(file, directory, descriptor, maxBytes) {
  if (!file || file.size < 1 || file.size > maxBytes) {
    throw new HttpError(413, 'FILE_TOO_LARGE', `${descriptor} exceeds its size limit.`);
  }
  const signature = await readSignature(file.path);
  const detected = descriptor === 'image'
    ? sniffImage(signature)
    : descriptor === 'video'
      ? sniffVideo(signature)
      : sniffWav(signature);
  if (!detected) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA',
      `${descriptor} content is not a supported file type.`,
    );
  }
  const storedName = `${randomUUID()}${detected.extension}`;
  const target = path.join(directory, storedName);
  await rename(file.path, target);
  return {
    path: target,
    storedName,
    originalName: safeFilename(file.originalname),
    mimeType: detected.mimeType,
    sizeBytes: file.size,
    sha256: await fileHash(target),
  };
}

function normalizeAnalysis(attachment, result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const observations = [];
  const ocr = [];
  const transcript = [];

  for (const item of items.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const text = shortText(item.text || item.caption, 2000);
    const timestampMs = Number.isSafeInteger(item.timestampMs) && item.timestampMs >= 0
      ? item.timestampMs
      : undefined;
    if (text && item.kind !== 'audio') {
      observations.push({ text, ...(timestampMs === undefined ? {} : { timestampMs }) });
    }
    const ocrText = shortText(item.ocrText || item.ocr, 4000);
    if (ocrText) ocr.push(ocrText);
    if (item.kind === 'audio' && text) transcript.push(text);
  }

  const directObservations = Array.isArray(result?.observations)
    ? result.observations
        .filter((item) => item && typeof item.text === 'string')
        .slice(0, 50)
        .map((item) => ({
          text: shortText(item.text, 2000),
          ...(Number.isSafeInteger(item.timestampMs) && item.timestampMs >= 0
            ? { timestampMs: item.timestampMs }
            : {}),
        }))
    : [];
  const summary = shortText(result?.summary, 8000);
  const ocrText = shortText(result?.ocrText, 12000) || ocr.join('\n').slice(0, 12000);
  const transcriptText = typeof result?.transcript === 'string'
    ? shortText(result.transcript, 20000)
    : transcript.join('\n').slice(0, 20000);
  const allObservations = directObservations.length
    ? directObservations
    : observations;

  if (!summary && !ocrText && !transcriptText && !allObservations.length) {
    throw new HttpError(
      422,
      'MEDIA_NOT_UNDERSTOOD',
      'The local analyzer could not understand this media. Add a written description or upload a clearer file.',
    );
  }

  return {
    attachmentId: attachment.id,
    type: attachment.type,
    ...(summary ? { summary } : {}),
    ...(ocrText ? { ocrText } : {}),
    ...(transcriptText ? { transcript: transcriptText } : {}),
    observations: allObservations,
    analysisVersion: shortText(result?.analysisVersion, 100) || 'local-media-v1',
  };
}

function responseObservedMedia(attachments, value) {
  const analyzed = new Map(
    (Array.isArray(value) ? value : [])
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.attachmentId === 'string',
      )
      .map((item) => [item.attachmentId, item]),
  );
  return attachments.flatMap((attachment) => {
    const updated = analyzed.get(attachment.id);
    const fallback =
      attachment.evidence?.analysisVersion === 'codex-vision-staged-v1'
        ? undefined
        : attachment.evidence;
    const evidence = updated || fallback;
    if (!evidence) return [];
    const observations = Array.isArray(evidence.observations)
      ? evidence.observations
          .filter((item) => item && typeof item.text === 'string')
          .slice(0, 50)
          .map((item) => ({
            text: shortText(item.text, 2000),
            ...(Number.isSafeInteger(item.timestampMs) &&
            item.timestampMs >= 0
              ? { timestampMs: item.timestampMs }
              : {}),
          }))
      : [];
    const summary = shortText(evidence.summary, 8000);
    const ocrText = shortText(evidence.ocrText, 12000);
    const transcript = shortText(evidence.transcript, 20000);
    const analysisVersion = shortText(evidence.analysisVersion, 100);
    if (!summary && !ocrText && !transcript && !observations.length) return [];
    return [{
      attachmentId: attachment.id,
      type: attachment.type,
      ...(summary ? { summary } : {}),
      ...(ocrText ? { ocrText } : {}),
      ...(transcript ? { transcript } : {}),
      ...(observations.length ? { observations } : {}),
      ...(analysisVersion ? { analysisVersion } : {}),
    }];
  });
}

function publicMessage(message) {
  return JSON.parse(JSON.stringify(message));
}

function messageError(error, fallback) {
  if (
    error instanceof HttpError
    && SAFE_ASYNC_ERROR_CODES.has(error.code)
  ) {
    return { code: error.code, message: error.message };
  }
  return fallback;
}

function attachmentMetadata(attachment) {
  return {
    attachmentId: attachment.id,
    type: attachment.type,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    ...(attachment.durationMs === undefined ? {} : { durationMs: attachment.durationMs }),
    sha256: attachment.sha256,
  };
}

function createConversationRouter({
  hub,
  config,
  registry,
  store,
  answerQueue,
  mediaQueue,
}) {
  const router = Router();
  const temporaryDirectory = path.join(config.conversationDirectory, 'tmp');
  const maxMediaMultipartBytes =
    config.maxVideoBytes
    + (config.maxMediaAnalysisBytes
      ?? MAX_VIDEO_FRAMES * config.maxFrameBytes + config.maxAudioBytes)
    + 1024 * 1024;
  mkdirSync(temporaryDirectory, { recursive: true });
  const receiveMedia = multer({
    storage: multer.diskStorage({
      destination: temporaryDirectory,
      filename: (_req, _file, callback) => callback(null, randomUUID()),
    }),
    limits: {
      fileSize: config.maxVideoBytes,
      files: MAX_VIDEO_FRAMES + 2,
      fields: 4,
      parts: MAX_VIDEO_FRAMES + 7,
    },
  }).fields([
    { name: 'file', maxCount: 1 },
    { name: 'frames', maxCount: MAX_VIDEO_FRAMES },
    { name: 'audio', maxCount: 1 },
  ]);

  const mediaMiddleware = (req, res, next) => {
    receiveMedia(req, res, (error) => {
      if (!error) return next();
      const files = Object.values(req.files || {}).flat();
      void removeFiles(files);
      return next(error);
    });
  };

  const boundedMediaLength = (req, _res, next) => {
    const rawLength = req.get('content-length');
    const contentLength = Number(rawLength);
    if (
      !rawLength
      || !Number.isSafeInteger(contentLength)
      || contentLength < 1
    ) {
      return next(
        new HttpError(
          411,
          'CONTENT_LENGTH_REQUIRED',
          'Media uploads require a valid Content-Length header.',
        ),
      );
    }
    if (contentLength > maxMediaMultipartBytes) {
      return next(
        new HttpError(
          413,
          'MEDIA_UPLOAD_TOO_LARGE',
          'The complete media upload exceeds its request-size limit.',
        ),
      );
    }
    return next();
  };

  const privateResponse = (_req, res, next) => {
    res.set('Cache-Control', 'no-store, private');
    res.vary('X-Bridge-Key');
    res.vary('X-Conversation-Token');
    res.vary('Authorization');
    next();
  };

  const authorize = async (req, _res, next) => {
    try {
      req.conversation = await store.authorize(
        req.params.conversationId,
        bearerToken(req),
      );
      next();
    } catch (error) {
      next(error);
    }
  };

  const failAttachment = async (conversationId, attachmentId, error) => {
    console.error({
      operation: 'codex_bridge_media_analysis',
      conversationId,
      attachmentId,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    try {
      await store.updateAttachment(conversationId, attachmentId, {
        status: 'failed',
        error: messageError(error, {
          code: 'MEDIA_ANALYSIS_FAILED',
          message: 'Media analysis could not be completed. Please try again.',
        }),
      });
    } catch (_ignored) {
      // The conversation may have been deleted while work was in progress.
    }
  };

  const enqueueMediaAnalysis = (conversationId, attachmentId) => {
    const pending = mediaQueue.add(async () => {
      await store.updateAttachment(conversationId, attachmentId, {
        status: 'processing',
        error: undefined,
      });
      const conversation = store.getInternal(conversationId);
      if (!conversation) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      const attachment = store.attachment(conversation, attachmentId);
      const analysisFiles = [];
      if (attachment.type === 'image') {
        analysisFiles.push({
          fileId: randomUUID(),
          kind: 'image',
          name: attachment.storage.original.originalName,
          mimeType: attachment.storage.original.mimeType,
          buffer: await readFile(attachment.storage.original.path),
        });
      } else {
        for (const frame of attachment.storage.frames) {
          analysisFiles.push({
            fileId: randomUUID(),
            kind: 'frame',
            name: frame.originalName,
            mimeType: frame.mimeType,
            timestampMs: frame.timestampMs,
            buffer: await readFile(frame.path),
          });
        }
        if (attachment.storage.audio) {
          analysisFiles.push({
            fileId: randomUUID(),
            kind: 'audio',
            name: attachment.storage.audio.originalName,
            mimeType: attachment.storage.audio.mimeType,
            buffer: await readFile(attachment.storage.audio.path),
          });
        }
      }
      const result = await hub.analyzeMedia(analysisFiles, {
        productId: conversation.productId,
        knowledgeVersion: conversation.knowledgeVersion,
        attachmentId,
      });
      const evidence = normalizeAnalysis(attachment, result);
      const analysisWarnings = Array.isArray(result?.warnings)
        ? result.warnings
            .map((item) =>
              typeof item === 'string' ? item : shortText(item?.message, 500),
            )
            .filter(Boolean)
            .slice(0, 10)
        : [];
      if (attachment.type === 'video' && !attachment.storage.audio) {
        analysisWarnings.unshift(
          'Video audio was unavailable; analysis used the extracted frames.',
        );
      }
      await store.updateAttachment(conversationId, attachmentId, {
        status: 'ready',
        evidence,
        summary: evidence.summary || evidence.observations[0]?.text || '',
        warnings: analysisWarnings.slice(0, 10),
        error: undefined,
      });
    });
    pending.catch((error) => failAttachment(conversationId, attachmentId, error));
  };

  const failMessage = async (conversationId, messageId, error) => {
    console.error({
      operation: 'codex_bridge_answer',
      conversationId,
      messageId,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    try {
      await store.updateMessage(conversationId, messageId, {
        status: 'failed',
        error: messageError(error, {
          code: 'ANSWER_FAILED',
          message: 'The answer could not be completed. Please try again.',
        }),
      });
    } catch (_ignored) {
      // The conversation may have expired or been deleted.
    }
  };

  const enqueueAnswer = (conversationId, messageId) => {
    const pending = answerQueue.add(async () => {
      await store.updateMessage(conversationId, messageId, {
        status: 'answering',
        error: undefined,
      });
      const conversation = store.getInternal(conversationId);
      if (!conversation) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      const message = store.message(conversation, messageId);
      const directAttachments = message.attachmentIds.map((id) =>
        store.attachment(conversation, id));
      const attachments = directAttachments.length
        ? directAttachments
        : store.recentMediaAttachments(conversation, messageId);
      const data = await hub.request('ask', {
        message: message.text,
        productId: conversation.productId,
        knowledgeVersion: conversation.knowledgeVersion,
        history: store.history(conversation, messageId),
        useDocuments: true,
        attachments: attachments.map(attachmentMetadata),
        mediaEvidence: attachments.map((attachment) => attachment.evidence),
      });
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new HttpError(502, 'INVALID_AGENT_RESPONSE', 'The local agent returned no answer.');
      }
      const observedMedia = responseObservedMedia(
        attachments,
        data.observedMedia,
      );
      for (const observed of observedMedia) {
        if (
          !observed.analysisVersion
          || observed.analysisVersion === 'codex-vision-staged-v1'
        ) continue;
        await store.updateAttachment(conversationId, observed.attachmentId, {
          evidence: observed,
          summary: observed.summary || observed.observations?.[0]?.text || '',
        });
      }
      await store.updateMessage(conversationId, messageId, {
        status: 'completed',
        error: undefined,
        result: {
          answer: data.answer.trim(),
          status: typeof data.status === 'string' ? data.status : 'answered',
          productId: conversation.productId,
          knowledgeVersion: conversation.knowledgeVersion,
          sources: safeSources(data.sources),
          resources: safeResources(data.resources),
          observedMedia,
          cached: Boolean(data.cached),
        },
      });
    });
    pending.catch((error) => failMessage(conversationId, messageId, error));
  };

  /**
   * @swagger
   * tags:
   *   - name: Codex Bridge v1
   *     description: Product-isolated, asynchronous customer support conversations
   * /api/codex/v1/products:
   *   servers:
   *     - url: /
   *   get:
   *     summary: List supported support products and knowledge versions
   *     tags: [Codex Bridge v1]
   *     security: [{ BridgeApiKey: [] }]
   *     responses:
   *       200: { description: Product list }
   */
  router.get('/products', (_req, res) => {
    res.json({ products: registry.list() });
  });

  router.get('/status', (_req, res) => {
    res.json({
      agent: hub.status(),
      queues: { answers: answerQueue.status(), media: mediaQueue.status() },
    });
  });

  /**
   * @swagger
   * /api/codex/v1/products/{productId}/conversations:
   *   servers:
   *     - url: /
   *   post:
   *     summary: Create a 48-hour product-locked conversation
   *     tags: [Codex Bridge v1]
   *     security: [{ BridgeApiKey: [] }]
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: false
   *             properties:
   *               locale: { type: string, example: en }
   *     responses:
   *       201: { description: Conversation and private conversation token }
   *       404: { description: Unsupported product }
   */
  router.post(
    '/products/:productId/conversations',
    privateResponse,
    asyncHandler(async (req, res) => {
      if (
        req.body
        && Object.keys(req.body).some((key) => key !== 'locale')
      ) {
        throw new HttpError(
          400,
          'UNKNOWN_FIELD',
          'Conversation creation accepts only locale; the path selects the product.',
        );
      }
      const product = registry.get(req.params.productId);
      if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      const locale = typeof req.body?.locale === 'string' ? req.body.locale.trim() : 'en';
      if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u.test(locale)) {
        throw new HttpError(400, 'INVALID_LOCALE', 'locale is invalid.');
      }
      const created = await store.create({ product, locale });
      res.status(201).json({
        conversation: created.conversation,
        conversationToken: created.token,
      });
    }),
  );

  router.use('/conversations/:conversationId', privateResponse);

  router.get(
    '/conversations/:conversationId',
    authorize,
    asyncHandler(async (req, res) => {
      res.json({
        conversation: store.publicConversation(req.conversation),
        messages: store.publicMessages(req.conversation),
      });
    }),
  );

  router.delete(
    '/conversations/:conversationId',
    authorize,
    asyncHandler(async (req, res) => {
      await store.remove(req.conversation.id);
      res.status(204).end();
    }),
  );

  /**
   * @swagger
   * /api/codex/v1/conversations/{conversationId}/attachments:
   *   servers:
   *     - url: /
   *   post:
   *     summary: Upload an image, or a video with frames for authorized Codex visual analysis
   *     tags: [Codex Bridge v1]
   *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file]
   *             properties:
   *               file: { type: string, format: binary }
   *               frames: { type: array, maxItems: 50, items: { type: string, format: binary } }
   *               audio: { type: string, format: binary }
   *               durationMs: { type: integer, maximum: 300000 }
   *               frameTimestamps: { type: string, description: JSON array of millisecond timestamps }
   *     responses:
   *       202: { description: Media accepted for local staging and analysis; enabled local agents may send images or extracted video frames to OpenAI }
   *       411: { description: Content-Length is required for bounded uploads }
   *       413: { description: Media upload exceeds a configured size limit }
   */
  router.post(
    '/conversations/:conversationId/attachments',
    authorize,
    boundedMediaLength,
    mediaMiddleware,
    asyncHandler(async (req, res) => {
      const uploaded = Object.values(req.files || {}).flat();
      const moved = [];
      try {
        const originalFile = req.files?.file?.[0];
        if (!originalFile) throw new HttpError(400, 'FILE_REQUIRED', 'Upload one image or video using the file field.');
        const signature = await readSignature(originalFile.path);
        const detectedImage = sniffImage(signature);
        const detectedVideo = sniffVideo(signature);
        if (!detectedImage && !detectedVideo) {
          throw new HttpError(415, 'UNSUPPORTED_MEDIA', 'Only JPEG, PNG, WebP, MP4, or WebM media is supported.');
        }
        const type = detectedImage ? 'image' : 'video';
        const frames = req.files?.frames || [];
        const audio = req.files?.audio?.[0];
        if (type === 'image' && (frames.length || audio)) {
          throw new HttpError(400, 'INVALID_MEDIA_PARTS', 'Image uploads cannot include video frames or audio.');
        }
        if (type === 'video' && (!frames.length || frames.length > MAX_VIDEO_FRAMES)) {
          throw new HttpError(400, 'VIDEO_FRAMES_REQUIRED', `Video uploads require 1-${MAX_VIDEO_FRAMES} extracted frames.`);
        }
        const analysisBytes = type === 'image'
          ? originalFile.size
          : frames.reduce((total, frame) => total + frame.size, 0)
            + (audio?.size || 0);
        if (analysisBytes > config.maxMediaAnalysisBytes) {
          throw new HttpError(
            413,
            'MEDIA_ANALYSIS_TOO_LARGE',
            'The extracted frames and audio exceed the media-analysis limit.',
          );
        }
        const durationMs = type === 'video'
          ? parseInteger(req.body?.durationMs, 'durationMs', { min: 1, max: MAX_VIDEO_DURATION_MS })
          : undefined;
        if (type === 'video' && durationMs === undefined) {
          throw new HttpError(400, 'INVALID_MEDIA_METADATA', 'durationMs is required for video.');
        }
        const timestamps = parseFrameTimestamps(req.body?.frameTimestamps, frames.length, durationMs);
        const mediaDirectory = await store.mediaPath(req.conversation.id);
        const original = await moveValidated(
          originalFile,
          mediaDirectory,
          type,
          type === 'image' ? config.maxImageBytes : config.maxVideoBytes,
        );
        moved.push(original.path);
        const storedFrames = [];
        for (let index = 0; index < frames.length; index += 1) {
          const frame = await moveValidated(frames[index], mediaDirectory, 'image', config.maxFrameBytes);
          frame.timestampMs = timestamps[index];
          storedFrames.push(frame);
          moved.push(frame.path);
        }
        const storedAudio = audio
          ? await moveValidated(audio, mediaDirectory, 'audio', config.maxAudioBytes)
          : undefined;
        if (storedAudio) moved.push(storedAudio.path);
        const now = new Date().toISOString();
        const attachment = {
          id: randomUUID(),
          type,
          filename: original.originalName,
          mimeType: original.mimeType,
          sizeBytes: original.sizeBytes,
          sha256: original.sha256,
          ...(durationMs === undefined ? {} : { durationMs }),
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          storage: { original, frames: storedFrames, audio: storedAudio },
        };
        await store.addAttachment(req.conversation.id, attachment);
        try {
          enqueueMediaAnalysis(req.conversation.id, attachment.id);
        } catch (error) {
          await store.discardAttachment(req.conversation.id, attachment.id);
          throw error;
        }
        res.status(202).json({ attachment: store.publicAttachment(attachment) });
      } catch (error) {
        await removeFiles([...uploaded, ...moved]);
        throw error;
      }
    }),
  );

  router.get(
    '/conversations/:conversationId/attachments/:attachmentId',
    authorize,
    asyncHandler(async (req, res) => {
      const attachment = store.attachment(req.conversation, req.params.attachmentId);
      res.json({ attachment: store.publicAttachment(attachment) });
    }),
  );

  /**
   * @swagger
   * /api/codex/v1/conversations/{conversationId}/messages:
   *   servers:
   *     - url: /
   *   post:
   *     summary: Queue a product-scoped support question
   *     tags: [Codex Bridge v1]
   *     security: [{ BridgeApiKey: [], ConversationToken: [] }]
   *     parameters:
   *       - in: path
   *         name: conversationId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: false
   *             required: [clientMessageId]
   *             anyOf:
   *               - required: [text]
   *                 properties:
   *                   text: { type: string, minLength: 1 }
   *               - required: [attachmentIds]
   *                 properties:
   *                   attachmentIds: { type: array, minItems: 1 }
   *             properties:
   *               clientMessageId: { type: string, format: uuid }
   *               text: { type: string, maxLength: 10000 }
   *               attachmentIds:
   *                 type: array
   *                 maxItems: 5
   *                 uniqueItems: true
   *                 items: { type: string, format: uuid }
   *     responses:
   *       202: { description: Question queued; poll the returned message URL. A text-only follow-up can reuse the most recently analyzed media in the same conversation. }
   */
  router.post(
    '/conversations/:conversationId/messages',
    authorize,
    asyncHandler(async (req, res) => {
      if (
        !req.body
        || typeof req.body !== 'object'
        || Array.isArray(req.body)
        || Object.keys(req.body).some(
          (key) => !['clientMessageId', 'text', 'attachmentIds'].includes(key),
        )
      ) {
        throw new HttpError(
          400,
          'UNKNOWN_FIELD',
          'Messages accept only clientMessageId, text, and attachmentIds.',
        );
      }
      const clientMessageId = req.body?.clientMessageId;
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const attachmentIds = req.body?.attachmentIds ?? [];
      if (!UUID_PATTERN.test(clientMessageId || '')) {
        throw new HttpError(400, 'INVALID_CLIENT_MESSAGE_ID', 'clientMessageId must be a UUID.');
      }
      if (text.length > 10000) throw new HttpError(400, 'MESSAGE_TOO_LONG', 'text must be at most 10000 characters.');
      if (
        !Array.isArray(attachmentIds)
        || attachmentIds.length > MAX_MESSAGE_ATTACHMENTS
        || attachmentIds.some((id) => !UUID_PATTERN.test(id))
        || new Set(attachmentIds).size !== attachmentIds.length
      ) {
        throw new HttpError(400, 'INVALID_ATTACHMENT_IDS', `attachmentIds must contain at most ${MAX_MESSAGE_ATTACHMENTS} unique UUIDs.`);
      }
      if (!text && !attachmentIds.length) throw new HttpError(400, 'INVALID_MESSAGE', 'Provide text or analyzed media.');
      const selected = attachmentIds.map((id) => store.attachment(req.conversation, id));
      if (selected.some((attachment) => attachment.type === 'video') && selected.length !== 1) {
        throw new HttpError(400, 'INVALID_ATTACHMENT_COMBINATION', 'Send either one video or up to five images in a message.');
      }
      const created = await store.createMessage(req.conversation.id, {
        clientMessageId,
        text,
        attachmentIds,
      });
      if (created.created) {
        try {
          enqueueAnswer(req.conversation.id, created.message.id);
        } catch (error) {
          await store.discardMessage(req.conversation.id, created.message.id);
          throw error;
        }
      }
      res.status(created.message.status === 'completed' ? 200 : 202).json({
        message: publicMessage(created.message),
      });
    }),
  );

  router.get(
    '/conversations/:conversationId/messages/:messageId',
    authorize,
    asyncHandler(async (req, res) => {
      const message = store.message(req.conversation, req.params.messageId);
      res.json({ message: publicMessage(message) });
    }),
  );

  return router;
}

module.exports = {
  createConversationRouter,
  normalizeAnalysis,
  sniffImage,
  sniffVideo,
  sniffWav,
};
