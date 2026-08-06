const mock = require('./mock');
const anthropic = require('./anthropic');

const PROVIDERS = { mock, anthropic };

/**
 * Resolve the configured AI provider.
 *
 * Read per-call rather than cached at import time so flipping AI_PROVIDER in
 * server/.env and restarting is all it takes to switch, and so a missing API key
 * surfaces as a 503 on the request that needed it rather than a boot crash.
 */
function getProvider() {
  const name = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`,
    );
  }
  return provider;
}

module.exports = { getProvider };
