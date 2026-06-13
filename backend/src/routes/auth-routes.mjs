import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../core/errors.mjs';
import { createToken, verifyToken } from '../core/auth.mjs';
import { requireAuth } from '../middleware/auth.mjs';

function hashRefreshToken(token, secret) {
  return createHash('sha256')
    .update(`${secret}:${token}`)
    .digest('hex');
}

function toUnixSeconds(value) {
  return Math.floor(new Date(value).getTime() / 1000);
}

function toIsoFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function buildAccessTokenPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active !== false,
    type: 'access',
  };
}

function buildRefreshTokenPayload(user, tokenId) {
  return {
    sub: user.id,
    jti: tokenId,
    type: 'refresh',
  };
}

async function pruneRefreshTokens(refreshTokensRepo) {
  if (!refreshTokensRepo?.list || !refreshTokensRepo?.replaceAll) {
    return;
  }
  const rows = await refreshTokensRepo.list();
  const now = Date.now();
  const keep = rows.filter((row) => {
    const expiresAt = new Date(row.expiresAt || 0).getTime();
    if (expiresAt > now) {
      return true;
    }
    if (!row.revokedAt) {
      return false;
    }
    const revokedAt = new Date(row.revokedAt).getTime();
    const days30 = 30 * 24 * 60 * 60 * 1000;
    return revokedAt + days30 > now;
  });
  if (keep.length !== rows.length) {
    await refreshTokensRepo.replaceAll(keep);
  }
}

async function createSession({ user, env, refreshTokensRepo, request, previousRefreshTokenId = null }) {
  const accessToken = createToken(
    buildAccessTokenPayload(user),
    env.jwtSecret,
    env.accessTokenTtlSeconds,
    { issuer: env.tokenIssuer, audience: env.tokenAudience }
  );

  const refreshTokenId = randomUUID();
  const refreshToken = createToken(
    buildRefreshTokenPayload(user, refreshTokenId),
    env.refreshTokenSecret,
    env.refreshTokenTtlSeconds,
    { issuer: env.tokenIssuer, audience: env.tokenAudience }
  );

  const refreshRecord = {
    id: refreshTokenId,
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken, env.refreshTokenSecret),
    issuedAt: new Date().toISOString(),
    expiresAt: toIsoFromNow(env.refreshTokenTtlSeconds),
    revokedAt: null,
    replacedBy: null,
    userAgent: request.headers['user-agent'] || '',
    ip: request.socket?.remoteAddress || '',
  };

  await refreshTokensRepo.create(refreshRecord);

  if (previousRefreshTokenId) {
    const existing = await refreshTokensRepo.getById(previousRefreshTokenId);
    if (existing && !existing.revokedAt) {
      await refreshTokensRepo.update(previousRefreshTokenId, {
        revokedAt: new Date().toISOString(),
        replacedBy: refreshTokenId,
      });
    }
  }

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    expiresIn: env.accessTokenTtlSeconds,
    refreshExpiresIn: env.refreshTokenTtlSeconds,
    expiresAt: toIsoFromNow(env.accessTokenTtlSeconds),
    refreshExpiresAt: toIsoFromNow(env.refreshTokenTtlSeconds),
  };
}

async function resolveValidRefreshSession({ refreshToken, env, refreshTokensRepo }) {
  let payload;
  try {
    payload = verifyToken(refreshToken, env.refreshTokenSecret, {
      expectedType: 'refresh',
      expectedIssuer: env.tokenIssuer,
      expectedAudience: env.tokenAudience,
      clockSkewSeconds: 30,
    });
  } catch (_error) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  if (!payload?.jti || !payload?.sub) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token payload');
  }

  const session = await refreshTokensRepo.getById(payload.jti);
  if (!session) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh session not found');
  }

  if (session.userId !== payload.sub) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token subject mismatch');
  }

  if (session.revokedAt) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh session has been revoked');
  }

  const storedHash = String(session.tokenHash || '');
  const receivedHash = hashRefreshToken(refreshToken, env.refreshTokenSecret);
  if (!storedHash || storedHash !== receivedHash) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token hash mismatch');
  }

  const expiresAt = toUnixSeconds(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token expired');
  }

  return {
    payload,
    session,
  };
}

export function registerAuthRoutes(router, deps) {
  const { usersRepo, refreshTokensRepo, env } = deps;

  router.register('POST', '/api/auth/login', async (context) => {
    const body = await context.getBody();
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email et mot de passe requis');
    }

    const user = (await usersRepo.authenticate(email, password)) ||
      (await usersRepo.authenticateDemo(email, password));
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Identifiants invalides');
    }

    if (user.active === false) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'User account is disabled');
    }

    await pruneRefreshTokens(refreshTokensRepo);
    const session = await createSession({
      user,
      env,
      refreshTokensRepo,
      request: context.request,
    });

    return {
      status: 200,
      data: {
        ...session,
        user,
      },
    };
  });

  router.register('POST', '/api/auth/refresh', async (context) => {
    const body = await context.getBody();
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
    if (!refreshToken) {
      throw new AppError(400, 'VALIDATION_ERROR', 'refreshToken is required');
    }

    await pruneRefreshTokens(refreshTokensRepo);
    const { payload, session } = await resolveValidRefreshSession({
      refreshToken,
      env,
      refreshTokensRepo,
    });

    const user = await usersRepo.getById(payload.sub);
    if (!user || user.active === false) {
      await refreshTokensRepo.update(session.id, {
        revokedAt: new Date().toISOString(),
      });
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session user is not active');
    }

    const nextSession = await createSession({
      user,
      env,
      refreshTokensRepo,
      request: context.request,
      previousRefreshTokenId: session.id,
    });

    return {
      status: 200,
      data: {
        ...nextSession,
        user,
      },
    };
  });

  router.register('POST', '/api/auth/logout', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (refreshToken) {
      try {
        const { session } = await resolveValidRefreshSession({
          refreshToken,
          env,
          refreshTokensRepo,
        });
        await refreshTokensRepo.update(session.id, {
          revokedAt: new Date().toISOString(),
        });
      } catch (_error) {
        // Logout should stay idempotent.
      }
    } else {
      const rows = await refreshTokensRepo.list();
      const nextRows = rows.map((row) =>
        row.userId === context.user.id && !row.revokedAt
          ? { ...row, revokedAt: new Date().toISOString() }
          : row
      );
      await refreshTokensRepo.replaceAll(nextRows);
    }

    return {
      status: 200,
      data: {
        success: true,
      },
    };
  });

  router.register('GET', '/api/auth/me', async (context) => {
    await requireAuth(context);
    return {
      status: 200,
      data: {
        user: context.user,
      },
    };
  });
}
