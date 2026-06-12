export function registerHealthRoutes(router) {
  router.register('GET', '/api/health', async () => {
    return {
      status: 200,
      data: {
        ok: true,
        service: 'admin-dashboard-backend',
        timestamp: new Date().toISOString(),
      },
    };
  });
}
