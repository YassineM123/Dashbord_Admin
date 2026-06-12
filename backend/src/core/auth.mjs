import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function base64UrlToBuffer(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Buffer.from(padded, 'base64');
}

function signValue(value, secret) {
  return base64UrlEncode(createHmac('sha256', secret).update(value).digest());
}

export function createToken(payload, secret, expiresInSeconds = 60 * 60 * 24, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.audience ? { aud: options.audience } : {}),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = signValue(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token, secret, options = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_error) {
    throw new Error('Malformed token payload');
  }

  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') {
    throw new Error('Unsupported token header');
  }

  const expectedSignature = signValue(`${encodedHeader}.${encodedPayload}`, secret);
  const receivedSignatureBuffer = base64UrlToBuffer(receivedSignature);
  const expectedSignatureBuffer = base64UrlToBuffer(expectedSignature);

  if (
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error('Invalid token signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const clockSkew = Number.isFinite(options.clockSkewSeconds)
    ? Number(options.clockSkewSeconds)
    : 0;

  if (!payload.exp || Number(payload.exp) <= now - clockSkew) {
    throw new Error('Token expired');
  }

  if (payload.nbf && Number(payload.nbf) > now + clockSkew) {
    throw new Error('Token not active yet');
  }

  if (options.expectedIssuer && payload.iss !== options.expectedIssuer) {
    throw new Error('Invalid token issuer');
  }

  if (options.expectedAudience && payload.aud !== options.expectedAudience) {
    throw new Error('Invalid token audience');
  }

  if (options.expectedType) {
    const payloadType = payload.type || payload.tokenType || 'access';
    if (payloadType !== options.expectedType) {
      throw new Error('Invalid token type');
    }
  }

  return payload;
}

export function hashPassword(password, salt) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${hash}`;
}

export function verifyPassword(password, passwordHash, salt) {
  if (!passwordHash || !passwordHash.startsWith('scrypt:')) {
    return false;
  }

  const stored = Buffer.from(passwordHash.replace('scrypt:', ''), 'hex');
  const computed = scryptSync(password, salt, 64);
  if (stored.length !== computed.length) {
    return false;
  }
  return timingSafeEqual(stored, computed);
}
