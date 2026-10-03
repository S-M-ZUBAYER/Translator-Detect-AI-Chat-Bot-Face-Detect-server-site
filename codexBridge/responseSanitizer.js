const SAFE_RESOURCE_TYPES = new Set(['image', 'video', 'link']);

function shortText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeResources(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const resources = [];
  for (const item of value) {
    if (!item || typeof item.url !== 'string') continue;
    let url;
    try {
      url = new URL(item.url);
    } catch (_error) {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    resources.push({
      type: SAFE_RESOURCE_TYPES.has(item.type) ? item.type : 'link',
      url: url.href,
      title: shortText(item.title, 300) || 'Related resource',
      ...(typeof item.sourceId === 'string'
        ? { sourceId: item.sourceId.slice(0, 100) }
        : {}),
    });
    if (resources.length === 20) break;
  }
  return resources;
}

function safeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((source, index) => ({
    sourceId: shortText(source?.sourceId, 100) || `S${index + 1}`,
    title:
      shortText(source?.title || source?.filename, 300)
      || 'Product documentation',
    excerpt: shortText(source?.excerpt || source?.content, 2000),
  }));
}

module.exports = { safeResources, safeSources, shortText };
