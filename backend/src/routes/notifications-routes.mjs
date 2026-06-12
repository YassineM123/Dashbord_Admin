import { AppError } from '../core/errors.mjs';
import { requireAuth } from '../middleware/auth.mjs';

export function registerNotificationsRoutes(router, deps) {
  const { notificationsRepo, notificationService } = deps;

  router.register('GET', '/api/notifications', async (context) => {
    await requireAuth(context);
    const notifications = (await notificationsRepo.list())
      .map((entry) => notificationService.normalizeNotification(entry))
      .sort((left, right) => String(right.createdAt || right.time).localeCompare(String(left.createdAt || left.time)));
    return {
      status: 200,
      data: notifications,
      meta: {
        total: notifications.length,
        unread: notifications.filter((entry) => !entry.read).length,
      },
    };
  });

  router.register('PATCH', '/api/notifications/:id/read', async (context) => {
    await requireAuth(context);
    const updated = notificationService.normalizeNotification(await notificationsRepo.update(context.params.id, { read: true }));
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    }
    return {
      status: 200,
      data: updated,
    };
  });

  router.register('POST', '/api/notifications/mark-all-read', async (context) => {
    await requireAuth(context);
    const rows = await notificationsRepo.list();
    const next = rows.map((entry) => notificationService.normalizeNotification({ ...entry, read: true }));
    await notificationsRepo.replaceAll(next);
    return {
      status: 200,
      data: {
        updatedCount: next.length,
      },
    };
  });

  router.register('POST', '/api/notifications', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    if (!body.title || !body.message) {
      throw new AppError(400, 'VALIDATION_ERROR', 'title and message are required');
    }
    const created = await notificationService.notify({
      type: body.type || 'info',
      title: body.title,
      message: body.message,
      priority: body.priority || 'medium',
      link: body.link || '',
      entityType: body.entityType || '',
      entityId: body.entityId || '',
      dedupeKey: body.dedupeKey || '',
    });
    return {
      status: 201,
      data: created,
    };
  });

  router.register('DELETE', '/api/notifications/:id', async (context) => {
    await requireAuth(context);
    const deleted = await notificationsRepo.remove(context.params.id);
    return {
      status: 200,
      data: notificationService.normalizeNotification(deleted),
    };
  });
}
