import { AppError } from '../core/errors.mjs';
import { requireAuth, requireRole } from '../middleware/auth.mjs';

const LOCKED_CURRENCY = 'TND';

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function registerSettingsRoutes(router, deps) {
  const { settingsRepo, usersRepo } = deps;

  router.register('GET', '/api/settings', async (context) => {
    await requireAuth(context);
    const settings = await settingsRepo.getAll();
    return {
      status: 200,
      data: settings,
    };
  });

  router.register('PATCH', '/api/settings', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    if (!body || typeof body !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid settings payload');
    }
    const current = await settingsRepo.getAll();
    const merged = {
      ...current,
      ...body,
      store: { ...current.store, ...(body.store || {}) },
      payments: { ...current.payments, ...(body.payments || {}), currency: LOCKED_CURRENCY },
      notifications: { ...current.notifications, ...(body.notifications || {}) },
      security: { ...current.security, ...(body.security || {}) },
      agents: { ...current.agents, ...(body.agents || {}) },
      agentRules: Array.isArray(body.agentRules) ? body.agentRules : current.agentRules,
    };
    const updated = await settingsRepo.replaceAll(merged);
    return { status: 200, data: updated };
  });

  router.register('GET', '/api/admin-users', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const users = await usersRepo.listAdminUsers();
    return {
      status: 200,
      data: users,
      meta: { total: users.length },
    };
  });

  router.register('POST', '/api/admin-users', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    if (!body.email || !body.password || !body.name || !body.role) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name, email, password and role are required');
    }

    if (await usersRepo.existsByEmail(body.email)) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists');
    }

    const created = await usersRepo.create({
      id: createId('usr'),
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      active: body.active !== false,
    });
    return {
      status: 201,
      data: created,
    };
  });

  router.register('PATCH', '/api/admin-users/:id', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    if (body.email && (await usersRepo.existsByEmail(body.email, context.params.id))) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists');
    }
    const updated = await usersRepo.update(context.params.id, body);
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    return {
      status: 200,
      data: updated,
    };
  });

  router.register('DELETE', '/api/admin-users/:id', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const deleted = await usersRepo.remove(context.params.id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    return {
      status: 200,
      data: deleted,
    };
  });
}
