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
    uploadChunkBytes: integer(
      env,
      'UPLOAD_CHUNK_BYTES',
      64 * 1024,
      16 * 1024,
      512 * 1024,
    ),
    heartbeatMs: integer(env, 'WS_HEARTBEAT_MS', 20000, 5000, 120000),
  };
}

module.exports = { loadConfig };
