const path = require('path');
const { AgentHub } = require('./agentHub');
const { loadConfig } = require('./config');
const { ConversationStore } = require('./conversationStore');
const { createProductRegistry } = require('./productRegistry');
const { createApiRouter } = require('./routes');
const { TaskQueue } = require('./taskQueue');

function createCodexBridge(options = {}) {
  const suppliedConfig = options.config || loadConfig();
  const config = {
    conversationDirectory: path.join(__dirname, '.data'),
    conversationTtlMs: 48 * 60 * 60 * 1000,
    answerConcurrency: 4,
    answerQueueLimit: 250,
    mediaConcurrency: 2,
    mediaQueueLimit: 100,
    maxImageBytes: 10 * 1024 * 1024,
    maxVideoBytes: 250 * 1024 * 1024,
    maxFrameBytes: 4 * 1024 * 1024,
    maxAudioBytes: 16 * 1024 * 1024,
    maxMediaAnalysisBytes: 50 * 1024 * 1024,
    ...suppliedConfig,
  };
  const hub = options.hub || new AgentHub(config);
  const registry = options.registry || createProductRegistry();
  const store = options.store || new ConversationStore({
    directory: config.conversationDirectory || `${__dirname}/.data`,
    ttlMs: config.conversationTtlMs || 48 * 60 * 60 * 1000,
  });
  const answerQueue = options.answerQueue || new TaskQueue({
    concurrency: config.answerConcurrency || 4,
    maxQueued: config.answerQueueLimit || 250,
    code: 'ANSWER_QUEUE_FULL',
    name: 'Answer queue',
  });
  const mediaQueue = options.mediaQueue || new TaskQueue({
    concurrency: config.mediaConcurrency || 2,
    maxQueued: config.mediaQueueLimit || 100,
    code: 'MEDIA_QUEUE_FULL',
    name: 'Media analysis queue',
  });

  return {
    config,
    hub,
    registry,
    store,
    answerQueue,
    mediaQueue,
    router: createApiRouter({
      hub,
      config,
      registry,
      store,
      answerQueue,
      mediaQueue,
    }),
    attach(server) {
      hub.attach(server);
    },
    close() {
      answerQueue.close();
      mediaQueue.close();
      store.close();
      hub.close();
    },
  };
}

module.exports = { createCodexBridge };
