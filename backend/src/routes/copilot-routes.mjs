import { requireAuth } from '../middleware/auth.mjs';

export function registerCopilotRoutes(router, deps) {
  const { copilotService } = deps;

  router.register('POST', '/api/copilot/analyze', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const result = await copilotService.analyzeStandard({
      role: body.role || context.user.role,
      datePreset: body.datePreset || '30j',
      question: body.question || '',
    });
    return {
      status: 200,
      data: result,
    };
  });

  router.register('POST', '/api/copilot/advanced/analyze', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const result = await copilotService.analyzeAdvanced({
      role: body.role || context.user.role,
      datePreset: body.datePreset || '30j',
      question: body.question || '',
      showSystemPrompt: Boolean(body.showSystemPrompt),
    });
    return {
      status: 200,
      data: result,
    };
  });
}
