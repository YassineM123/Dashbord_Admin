const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_BACKEND_API_BASE_URL = 'https://dashboard-admin.onrender.com/api';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeApiBase() {
  const configured =
    process.env.BACKEND_API_BASE_URL ||
    process.env.BACKEND_URL ||
    DEFAULT_BACKEND_API_BASE_URL;
  const base = trimTrailingSlash(configured);

  if (!base) {
    return '';
  }

  return base.endsWith('/api') ? base : `${base}/api`;
}

function getTimeoutMs() {
  const configured = Number(process.env.BACKEND_API_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_TIMEOUT_MS;
}

function getForwardHeaders(req) {
  const blockedHeaders = new Set([
    'connection',
    'content-length',
    'host',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-proto',
  ]);

  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!blockedHeaders.has(key.toLowerCase()) && typeof value !== 'undefined') {
      headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  return headers;
}

function getRequestBody(req) {
  if (['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())) {
    return undefined;
  }

  if (typeof req.body === 'undefined') {
    return undefined;
  }

  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
    return req.body;
  }

  return JSON.stringify(req.body);
}

function getProxyPath(req) {
  const path = req.query?.path;
  if (Array.isArray(path)) {
    return path.join('/');
  }
  return String(path || '').replace(/^\/+/, '');
}

export default async function handler(req, res) {
  const apiBase = normalizeApiBase();
  if (!apiBase) {
    res.status(500).json({
      message:
        'Backend API URL is not configured. Set BACKEND_API_BASE_URL in Vercel.',
      code: 'BACKEND_API_URL_MISSING',
    });
    return;
  }

  const targetUrl = new URL(`${apiBase}/${getProxyPath(req)}`);

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, item));
    } else if (typeof value !== 'undefined') {
      targetUrl.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: getForwardHeaders(req),
      body: getRequestBody(req),
      signal: controller.signal,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    const bodyText = buffer.toString('utf8', 0, Math.min(buffer.length, 512)).trimStart();
    if (contentType.includes('text/html') || bodyText.toLowerCase().startsWith('<!doctype html')) {
      res.status(502).json({
        message:
          'Configured backend URL is serving an HTML page instead of the backend API. Check BACKEND_API_BASE_URL in Vercel and the Render service deployment.',
        code: 'BACKEND_API_INVALID_UPSTREAM',
      });
      return;
    }

    res.send(buffer);
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({
      message: aborted ? 'Backend API request timed out' : 'Backend API request failed',
      code: aborted ? 'BACKEND_API_TIMEOUT' : 'BACKEND_API_PROXY_ERROR',
    });
  } finally {
    clearTimeout(timeout);
  }
}
