import { AppError } from '../core/errors.mjs';
import { verifyToken } from '../core/auth.mjs';
import { isRoleAllowed, normalizeRole } from '../core/roles.mjs';

export function extractBearerToken(request) {
  const auth = request.headers.authorization;
  if (!auth) {
    return null;
  }
  const [scheme, token] = auth.split(' ');
  if (String(scheme || '').toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

export async function requireAuth(context) {
  if (context.user) {
    return context.user;
  }

  const token = extractBearerToken(context.request);
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  let payload;
  try {
    payload = verifyToken(token, context.env.jwtSecret, {
      expectedType: 'access',
      expectedIssuer: context.env.tokenIssuer,
      expectedAudience: context.env.tokenAudience,
      clockSkewSeconds: 30,
    });
  } catch (_error) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const role = normalizeRole(payload.role);
  if (!role) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid role in token');
  }

  context.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role,
    active: payload.active !== false,
    tokenId: payload.jti || null,
    tokenExpiresAt: payload.exp,
  };
  return context.user;
}

export function requireRole(context, allowedRoles) {
  if (!context.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  if (!isRoleAllowed(context.user.role, allowedRoles)) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}
