function normalizeOrigin(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function isLocalOrigin(origin) {
  if (!origin) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

function toAllowedOrigins(configuredOrigin) {
  if (Array.isArray(configuredOrigin)) {
    return configuredOrigin.map(normalizeOrigin).filter(Boolean);
  }
  const configured = normalizeOrigin(configuredOrigin);
  return configured ? configured.split(',').map(normalizeOrigin).filter(Boolean) : [];
}

function resolveCorsOrigin(configuredOrigin, requestOrigin) {
  const allowedOrigins = toAllowedOrigins(configuredOrigin);
  const configured = allowedOrigins[0] || '';
  const requested = normalizeOrigin(requestOrigin);

  if (allowedOrigins.length === 0 && requested) {
    return requested;
  }
  if (!requested) {
    return configured || '*';
  }
  if (allowedOrigins.includes(requested)) {
    return requested;
  }

  // In local development, Vite may move from 5173 to 5174+ if the first port is busy.
  if (allowedOrigins.some(isLocalOrigin) && isLocalOrigin(requested)) {
    return requested;
  }

  return configured || '*';
}

export function setCorsHeaders(response, origin, requestOrigin) {
  response.setHeader('Access-Control-Allow-Origin', resolveCorsOrigin(origin, requestOrigin));
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
}

export function sendSuccess(response, status, data, meta, origin, requestOrigin) {
  setCorsHeaders(response, origin, requestOrigin);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(meta ? { data, meta } : { data }));
}

export function sendError(response, status, code, message, origin, requestOrigin) {
  setCorsHeaders(response, origin, requestOrigin);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ message, code }));
}
