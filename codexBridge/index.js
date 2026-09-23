const { AgentHub } = require('./agentHub');
const { loadConfig } = require('./config');
const { createApiRouter } = require('./routes');

function createCodexBridge(options = {}) {
  const config = options.config || loadConfig();
  const hub = options.hub || new AgentHub(config);

  return {
    config,
    hub,
    router: createApiRouter({ hub, config }),
    attach(server) {
      hub.attach(server);
    },
    close() {
      hub.close();
    },
  };
}

module.exports = { createCodexBridge };
