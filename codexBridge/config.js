const path = require('path');
const dotenv = require('dotenv');

// Keep bridge settings separate while still allowing root/process environment
// variables to override them in production.
dotenv.config({ path: path.join(__dirname, '.env') });

function integer(env, name, fallback, min, max) {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function loadConfig(env = process.env) {
  const clientApiKey = env.CLIENT_API_KEY?.trim();
  if (!clientApiKey || clientApiKey.length < 16) {
    throw new Error(
      'CLIENT_API_KEY is required and must be at least 16 characters.',
    );
  }

  const agentSecret = env.AGENT_SHARED_SECRET?.trim();
  if (!agentSecret || agentSecret.length < 16) {
    throw new Error(
      'AGENT_SHARED_SECRET is required and must be at least 16 characters.',
    );
  }

  const uploadChunkBytes = integer(
    env,
    'UPLOAD_CHUNK_BYTES',
    64 * 1024,
    16 * 1024,
    512 * 1024,
  );
  const agentMaxMessageBytes = integer(
    env,
    'AGENT_MAX_MESSAGE_BYTES',
    2 * 1024 * 1024,
    64 * 1024,
    16 * 1024 * 1024,
  );
  if (agentMaxMessageBytes < uploadChunkBytes + 4096) {
    throw new Error(
      'AGENT_MAX_MESSAGE_BYTES must be at least UPLOAD_CHUNK_BYTES + 4096.',
    );
  }

  return {
    frontendOrigins: (env.FRONTEND_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    clientApiKey,
    agentSecret,
    defaultAgentId: env.DEFAULT_AGENT_ID?.trim() || 'primary',
    requestTimeoutMs: integer(
      env,
      'AGENT_REQUEST_TIMEOUT_MS',
      600000,
      5000,
      900000,
    ),
    maxFileBytes: integer(
      env,
      'MAX_DOCX_BYTES',
      5 * 1024 * 1024,
      1024,
      25 * 1024 * 1024,
    ),
    uploadChunkBytes,
    agentMaxMessageBytes,
    heartbeatMs: integer(env, 'WS_HEARTBEAT_MS', 20000, 5000, 120000),
    conversationDirectory: path.resolve(
      env.CODEX_CONVERSATION_DIRECTORY?.trim()
        || path.join(__dirname, '.data'),
    ),
    conversationTtlMs: integer(
      env,
      'CODEX_CONVERSATION_TTL_HOURS',
      48,
      1,
      24 * 30,
    ) * 60 * 60 * 1000,
    answerConcurrency: integer(
      env,
      'CODEX_ANSWER_CONCURRENCY',
      4,
      1,
      32,
    ),
    answerQueueLimit: integer(
      env,
      'CODEX_ANSWER_QUEUE_LIMIT',
      250,
      10,
      5000,
    ),
    mediaConcurrency: integer(
      env,
      'CODEX_MEDIA_CONCURRENCY',
      2,
      1,
      16,
    ),
    mediaQueueLimit: integer(
      env,
      'CODEX_MEDIA_QUEUE_LIMIT',
      100,
      5,
      1000,
    ),
    maxImageBytes: integer(
      env,
      'CODEX_MAX_IMAGE_BYTES',
      10 * 1024 * 1024,
      1024,
      25 * 1024 * 1024,
    ),
    maxVideoBytes: integer(
      env,
      'CODEX_MAX_VIDEO_BYTES',
      250 * 1024 * 1024,
      1024 * 1024,
      500 * 1024 * 1024,
    ),
    maxFrameBytes: integer(
      env,
      'CODEX_MAX_FRAME_BYTES',
      4 * 1024 * 1024,
      1024,
      10 * 1024 * 1024,
    ),
    maxAudioBytes: integer(
      env,
      'CODEX_MAX_AUDIO_BYTES',
      16 * 1024 * 1024,
      1024,
      100 * 1024 * 1024,
    ),
    maxMediaAnalysisBytes: integer(
      env,
      'CODEX_MAX_MEDIA_ANALYSIS_BYTES',
      50 * 1024 * 1024,
      1024,
      250 * 1024 * 1024,
    ),
  };
}

module.exports = { loadConfig };
