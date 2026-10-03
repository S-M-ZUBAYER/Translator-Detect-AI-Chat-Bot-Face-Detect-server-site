class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function asyncHandler(handler) {
  return function handleAsyncRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message },
      requestId: req.id,
    });
  }

  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'The uploaded file exceeds the configured size limit.',
      },
      requestId: req.id,
    });
  }

  if (error?.name === 'MulterError') {
    return res.status(400).json({
      error: {
        code: 'INVALID_MULTIPART_UPLOAD',
        message: 'The multipart upload has unexpected or excessive fields.',
      },
      requestId: req.id,
    });
  }

  console.error({
    requestId: req.id,
    message: error?.message,
    stack: error?.stack,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred.',
    },
    requestId: req.id,
  });
}

module.exports = { HttpError, asyncHandler, errorMiddleware };
