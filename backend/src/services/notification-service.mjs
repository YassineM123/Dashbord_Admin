function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createNotificationService({ notificationsRepo }) {
  function normalizePriority(value) {
    return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
  }

  function normalizeNotification(notification) {
    return {
      ...notification,
      id: String(notification.id || createId('n')),
      type: ['info', 'warning', 'success', 'error'].includes(notification.type) ? notification.type : 'info',
      title: String(notification.title || ''),
      message: String(notification.message || ''),
      time: notification.time || notification.createdAt || new Date().toISOString(),
      createdAt: notification.createdAt || notification.time || new Date().toISOString(),
      read: Boolean(notification.read),
      priority: normalizePriority(notification.priority),
      link: String(notification.link || notification.href || ''),
      entityType: String(notification.entityType || ''),
      entityId: String(notification.entityId || ''),
      dedupeKey: String(notification.dedupeKey || ''),
    };
  }

  async function notify({ type = 'info', title, message, priority = 'medium', link = '', entityType = '', entityId = '', dedupeKey = '' }) {
    if (!notificationsRepo?.create || !title || !message) {
      return null;
    }

    if (dedupeKey && notificationsRepo?.list) {
      const existing = await notificationsRepo.list();
      const duplicate = existing.find((item) => String(item.dedupeKey || '') === String(dedupeKey));
      if (duplicate) return normalizeNotification(duplicate);
    }

    return notificationsRepo.create(normalizeNotification({
      id: createId('n'),
      type,
      title,
      message,
      priority,
      link,
      entityType,
      entityId,
      dedupeKey,
      time: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      read: false,
    }));
  }

  return { notify, normalizeNotification };
}
