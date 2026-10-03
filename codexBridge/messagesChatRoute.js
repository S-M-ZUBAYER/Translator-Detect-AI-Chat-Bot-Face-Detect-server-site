const { randomUUID, timingSafeEqual } = require('crypto');
const { Router } = require('express');
const { detectLanguage } = require('./detectLanguage');
const { HttpError, asyncHandler, errorMiddleware } = require('./errors');
const { safeResources, safeSources } = require('./responseSanitizer');
const {
  createProductRegistry,
  LEGACY_PRODUCT_ID,
} = require('./productRegistry');
const { relayForClient } = require('./routes');

const MAX_MESSAGES = 21;
const MAX_HISTORY_CONTENT = 8000;
const MAX_QUESTION_CONTENT = 10000;

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function normalizeMessages(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'INVALID_MESSAGES', 'Messages array is required.');
  }
  if (value.length > MAX_MESSAGES) {
    throw new HttpError(
      400,
      'INVALID_MESSAGES',
      `Messages cannot contain more than ${MAX_MESSAGES} items.`,
    );
  }

  const messages = value.map((message, index) => {
    const isCurrentQuestion = index === value.length - 1;
    const maxLength = isCurrentQuestion
      ? MAX_QUESTION_CONTENT
      : MAX_HISTORY_CONTENT;

    if (
      !message ||
      typeof message !== 'object' ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > maxLength
    ) {
      throw new HttpError(
        400,
        'INVALID_MESSAGES',
        `messages[${index}] must contain role user/assistant and non-empty content up to ${maxLength} characters.`,
      );
    }

    return {
      role: message.role,
      content: message.content.trim(),
    };
  });

  if (messages[messages.length - 1].role !== 'user') {
    throw new HttpError(
      400,
      'INVALID_MESSAGES',
      'The last message must have role user because it is the current question.',
    );
  }

  if (
    messages
      .slice(0, -1)
      .reduce((total, message) => total + message.content.length, 0) > 24000
  ) {
    throw new HttpError(
      400,
      'HISTORY_TOO_LONG',
      'Conversation history cannot exceed 24000 characters.',
    );
  }

  return messages;
}

function createOriginGuard(frontendOrigins) {
  return function guardOrigin(req, res, next) {
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

function createMessagesChatRouter({
  hub,
  config,
  registry = createProductRegistry(),
}) {
  const router = Router();

  router.post(
    '/codex/chat/gpt',
    (req, res, next) => {
      req.id = randomUUID();
      res.setHeader('X-Request-Id', req.id);
      next();
    },
    createOriginGuard(config.frontendOrigins),
    (req, _res, next) => {
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
    },
    asyncHandler(async (req, res) => {
      const messages = normalizeMessages(req.body?.messages);
      const question = messages[messages.length - 1].content;
      const history = messages.slice(0, -1);
      const lang = detectLanguage(question);
      const productId = typeof req.body?.productId === 'string'
        ? req.body.productId.trim()
        : LEGACY_PRODUCT_ID;
      const product = registry.get(productId);
      if (!product) {
        throw new HttpError(400, 'INVALID_PRODUCT', 'productId is not supported.');
      }

      const data = await relayForClient(req, res, (signal) =>
        hub.request(
          'ask',
          {
            message: question,
            history,
            useDocuments: true,
            productId: product.id,
            knowledgeVersion: product.knowledgeVersion,
          },
          { signal },
        ),
      );

      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new HttpError(
          502,
          'INVALID_AGENT_RESPONSE',
          'The local Codex agent returned no answer.',
        );
      }

      res.json({
        answer: data.answer.trim(),
        lang,
        ...(Array.isArray(data.sources)
          ? { sources: safeSources(data.sources) }
          : {}),
        ...(Array.isArray(data.resources)
          ? { resources: safeResources(data.resources) }
          : {}),
        ...(typeof data.status === 'string' ? { status: data.status } : {}),
      });
    }),
  );

  // This router owns only the new endpoint, including its error response.
  router.use(errorMiddleware);
  return router;
}

module.exports = { createMessagesChatRouter, normalizeMessages };
