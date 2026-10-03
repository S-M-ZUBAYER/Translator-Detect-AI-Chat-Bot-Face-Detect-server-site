const PRODUCT_DEFINITIONS = Object.freeze([
  ['warehouse-erp-web', 'Warehouse ERP Website'],
  ['warehouse-erp-app', 'Warehouse ERP App'],
  ['face-attendance-web', 'Face Attendance Website'],
  ['face-attendance-app', 'Face Attendance App'],
  ['online-printer-app', 'Online Printer App'],
  ['online-printer-web', 'Online Printer Website'],
  ['thermal-printer', 'Thermal Printer'],
  ['dot-printer', 'Dot Printer'],
  ['device-attendance-machine', 'Device Attendance Machine'],
  ['manual-attendance-machine', 'Manual Attendance Machine'],
]);

const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const LEGACY_PRODUCT_ID = 'warehouse-erp-web';

function parseVersions(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected an object.');
    }
    const versions = {};
    for (const [productId, version] of Object.entries(parsed)) {
      if (
        !PRODUCT_ID_PATTERN.test(productId)
        || typeof version !== 'string'
        || !VERSION_PATTERN.test(version)
      ) {
        throw new Error(`Invalid version mapping for ${productId}.`);
      }
      versions[productId] = version;
    }
    return versions;
  } catch (error) {
    throw new Error(
      `CODEX_PRODUCT_VERSIONS must be a JSON object of product IDs to versions: ${error.message}`,
    );
  }
}

function createProductRegistry(env = process.env) {
  const versions = parseVersions(env.CODEX_PRODUCT_VERSIONS);
  const products = PRODUCT_DEFINITIONS.map(([id, name]) =>
    Object.freeze({
      id,
      name,
      knowledgeVersion: versions[id] || '1',
    }),
  );
  const byId = new Map(products.map((product) => [product.id, product]));
  return {
    list: () => products.map((product) => ({ ...product })),
    get: (productId) => byId.get(productId),
    has: (productId) => byId.has(productId),
  };
}

module.exports = {
  PRODUCT_DEFINITIONS,
  PRODUCT_ID_PATTERN,
  VERSION_PATTERN,
  LEGACY_PRODUCT_ID,
  createProductRegistry,
};
