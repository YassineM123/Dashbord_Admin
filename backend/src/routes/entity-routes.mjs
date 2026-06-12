import { AppError } from '../core/errors.mjs';
import { requireAuth, requireRole } from '../middleware/auth.mjs';

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function registerCrud(router, basePath, repo, prefix, hooks = {}) {
  router.register('GET', basePath, async (context) => {
    await requireAuth(context);
    const rows = await repo.list();
    return {
      status: 200,
      data: rows,
      meta: { total: rows.length },
    };
  });

  router.register('GET', `${basePath}/:id`, async (context) => {
    await requireAuth(context);
    const item = await repo.getById(context.params.id);
    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    }
    return {
      status: 200,
      data: item,
    };
  });

  router.register('POST', basePath, async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    const item = await repo.create({
      ...body,
      id: body.id || createId(prefix),
    });
    if (hooks.onCreate) {
      await hooks.onCreate(context, item);
    }
    return {
      status: 201,
      data: item,
    };
  });

  router.register('PATCH', `${basePath}/:id`, async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    const updated = await repo.update(context.params.id, body);
    return {
      status: 200,
      data: updated,
    };
  });

  router.register('DELETE', `${basePath}/:id`, async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const deleted = await repo.remove(context.params.id);
    return {
      status: 200,
      data: deleted,
    };
  });
}

export function registerEntityRoutes(router, deps) {
  registerCrud(router, '/api/ai-orders', deps.aiOrdersRepo, 'aio', {
    onCreate: async (_context, item) => {
      await deps.notificationService.notify({
        type: 'success',
        priority: 'high',
        title: 'AI detected potential order',
        message: `${item.customer || 'Customer'} may want ${item.product || 'a product'} (${item.confidence || 0}% confidence).`,
        link: `/admin/commandes-ai`,
        entityType: 'ai_order',
        entityId: item.id,
      });
    },
  });
}
