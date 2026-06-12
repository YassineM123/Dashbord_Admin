function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAuditLogService({ auditLogsRepo }) {
  async function record(context, action, entityType, entityId, details = {}) {
    if (!auditLogsRepo?.create) {
      return null;
    }

    return auditLogsRepo.create({
      id: createId('aud'),
      action,
      entityType,
      entityId: String(entityId || ''),
      userId: context?.user?.id || 'system',
      userEmail: context?.user?.email || '',
      userRole: context?.user?.role || '',
      timestamp: new Date().toISOString(),
      details,
    });
  }

  return { record };
}
