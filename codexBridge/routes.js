const { randomUUID, timingSafeEqual } = require('crypto');
const { Router } = require('express');
const multer = require('multer');
const { createConversationRouter } = require('./conversationRoutes');
const { HttpError, asyncHandler, errorMiddleware } = require('./errors');
const { safeResources, safeSources } = require('./responseSanitizer');
const { LEGACY_PRODUCT_ID } = require('./productRegistry');

const DOCUMENT_ID_PATTERN = /^[a-f0-9-]{36}$/;

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function validateHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history) || history.length > 20) {
    throw new HttpError(
      400,
      'INVALID_HISTORY',
      'history must be an array with at most 20 messages.',
    );
  }

  const normalized = history.map((turn) => {
    if (
      !turn ||
      !['user', 'assistant'].includes(turn.role) ||
      typeof turn.content !== 'string' ||
      !turn.content.trim() ||
      turn.content.length > 8000
    ) {
      throw new HttpError(
        400,
        'INVALID_HISTORY',
        'Each history item must contain role user/assistant and non-empty content up to 8000 characters.',
      );
    }

    return {
      role: turn.role,
      content: turn.content.trim(),
    };
  });
  if (
    normalized.reduce((total, turn) => total + turn.content.length, 0) > 24000
  ) {
    throw new HttpError(
      400,
      'HISTORY_TOO_LONG',
      'history must contain at most 24000 characters in total.',
    );
  }
  return normalized;
}

function validateDocumentIds(value) {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((id) => typeof id !== 'string' || !DOCUMENT_ID_PATTERN.test(id))
  ) {
    throw new HttpError(
      400,
      'INVALID_DOCUMENT_IDS',
      'documentIds must be an array of valid document IDs.',
    );
  }
  return [...new Set(value)];
}

function resolveProduct(registry, value, requestedVersion) {
  const productId = typeof value === 'string' && value.trim()
    ? value.trim()
    : LEGACY_PRODUCT_ID;
  const product = registry.get(productId);
  if (!product) {
    throw new HttpError(400, 'INVALID_PRODUCT', 'productId is not supported.');
  }
  if (
    requestedVersion !== undefined
    && String(requestedVersion).trim() !== product.knowledgeVersion
  ) {
    throw new HttpError(
      409,
      'KNOWLEDGE_VERSION_MISMATCH',
      'The requested knowledge version is not active for this product.',
    );
  }
  return product;
}

function createOriginGuard(frontendOrigins) {
  return function guardBridgeOrigin(req, res, next) {
    const origin = req.get('Origin');
    if (!origin || frontendOrigins.includes('*')) return next();
    if (!frontendOrigins.includes(origin)) {
      return next(
        new HttpError(
          403,
          'CORS_DENIED',
          'This frontend origin is not allowed.',
        ),
      );
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    return next();
  };
}

async function relayForClient(req, res, operation) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => {
    if (!res.writableEnded) abort();
  };
  req.once('aborted', abort);
  res.once('close', close);
  try {
    return await operation(controller.signal);
  } finally {
    req.off('aborted', abort);
    res.off('close', close);
  }
}

function createApiRouter({
  hub,
  config,
  registry,
  store,
  answerQueue,
  mediaQueue,
}) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxFileBytes,
      files: 1,
      fields: 2,
      parts: 4,
    },
    fileFilter: (_req, file, callback) => {
      if (!file.originalname.toLowerCase().endsWith('.docx')) {
        return callback(
          new HttpError(
            415,
            'UNSUPPORTED_FILE',
            'Only .docx files are supported.',
          ),
        );
      }
      return callback(null, true);
    },
  }).single('file');

  const receiveDocx = (req, res, next) => {
    upload(req, res, (error) => (error ? next(error) : next()));
  };

  router.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  router.use(createOriginGuard(config.frontendOrigins));

  // Health stays public so hosting infrastructure can check the process.
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', requestId: req.id });
  });

  router.use((req, _res, next) => {
    if (!safeEqual(req.get('X-Bridge-Key'), config.clientApiKey)) {
      return next(
        new HttpError(
          401,
          'UNAUTHORIZED',
          'Missing or invalid bridge API key.',
        ),
      );
    }
    return next();
  });

  router.get('/status', (req, res) => {
    res.json({
      hosted: true,
      agent: hub.status(),
      requestId: req.id,
    });
  });

  router.use(
    '/codex/v1',
    createConversationRouter({
      hub,
      config,
      registry,
      store,
      answerQueue,
      mediaQueue,
    }),
  );

  router.get(
    '/documents',
    asyncHandler(async (req, res) => {
      const product = resolveProduct(
        registry,
        req.query.productId,
        req.query.knowledgeVersion,
      );
      const data = await relayForClient(req, res, (signal) =>
        hub.request(
          'list_files',
          {
            productId: product.id,
            knowledgeVersion: product.knowledgeVersion,
          },
          { signal },
        ),
      );
      res.json({ ...data, requestId: req.id });
    }),
  );

  router.post(
    '/documents',
    receiveDocx,
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new HttpError(
          400,
          'FILE_REQUIRED',
          'Upload one DOCX using the file field.',
        );
      }
      const product = resolveProduct(
        registry,
        req.body?.productId,
        req.body?.knowledgeVersion,
      );

      const data = await relayForClient(req, res, (signal) =>
        hub.upload(req.file.buffer, req.file.originalname, undefined, {
          signal,
          productId: product.id,
          knowledgeVersion: product.knowledgeVersion,
        }),
      );
      res.status(201).json({ ...data, requestId: req.id });
    }),
  );

  router.put(
    '/documents/:id',
    receiveDocx,
    asyncHandler(async (req, res) => {
      if (!DOCUMENT_ID_PATTERN.test(req.params.id)) {
        throw new HttpError(400, 'INVALID_DOCUMENT_ID', 'Invalid document ID.');
      }
      if (!req.file) {
        throw new HttpError(
          400,
          'FILE_REQUIRED',
          'Upload one DOCX using the file field.',
        );
      }
      const product = resolveProduct(
        registry,
        req.body?.productId,
        req.body?.knowledgeVersion,
      );

      const data = await relayForClient(req, res, (signal) =>
        hub.upload(req.file.buffer, req.file.originalname, req.params.id, {
          signal,
          productId: product.id,
          knowledgeVersion: product.knowledgeVersion,
        }),
      );
      res.json({ ...data, requestId: req.id });
    }),
  );

  router.delete(
    '/documents/:id',
    asyncHandler(async (req, res) => {
      if (!DOCUMENT_ID_PATTERN.test(req.params.id)) {
        throw new HttpError(400, 'INVALID_DOCUMENT_ID', 'Invalid document ID.');
      }
      const product = resolveProduct(
        registry,
        req.query.productId,
        req.query.knowledgeVersion,
      );

      await relayForClient(req, res, (signal) =>
        hub.request(
          'delete_file',
          {
            fileId: req.params.id,
            productId: product.id,
            knowledgeVersion: product.knowledgeVersion,
          },
          { signal },
        ),
      );
      res.status(204).end();
    }),
  );

  router.post(
    '/chat',
    asyncHandler(async (req, res) => {
      const body = req.body;
      if (
        !body ||
        typeof body.message !== 'string' ||
        !body.message.trim() ||
        body.message.length > 10000
      ) {
        throw new HttpError(
          400,
          'INVALID_MESSAGE',
          'Provide a non-empty message up to 10000 characters.',
        );
      }
      if (
        body.useDocuments !== undefined &&
        typeof body.useDocuments !== 'boolean'
      ) {
        throw new HttpError(
          400,
          'INVALID_DOCUMENT_MODE',
          'useDocuments must be true or false.',
        );
      }
      const product = resolveProduct(
        registry,
        body.productId,
        body.knowledgeVersion,
      );

      const data = await relayForClient(req, res, (signal) =>
        hub.request(
          'ask',
          {
            message: body.message.trim(),
            useDocuments: body.useDocuments,
            history: validateHistory(body.history),
            documentIds: validateDocumentIds(body.documentIds),
            productId: product.id,
            knowledgeVersion: product.knowledgeVersion,
          },
          { signal },
        ),
      );
      const { sources, resources, ...answer } = data || {};
      res.json({
        ...answer,
        sources: safeSources(sources),
        resources: safeResources(resources),
        requestId: req.id,
      });
    }),
  );

  // Keep bridge error formatting local so existing APIs retain their responses.
  router.use(errorMiddleware);

  return router;
}

module.exports = {
  createApiRouter,
  validateDocumentIds,
  validateHistory,
  relayForClient,
};
