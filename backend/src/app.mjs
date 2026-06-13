import { dirname, join } from 'node:path';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseJsonBody } from './core/body.mjs';
import { isAppError } from './core/errors.mjs';
import { JsonStore } from './core/json-store.mjs';
import { createRouter } from './core/router.mjs';
import { sendError, sendSuccess, setCorsHeaders } from './core/response.mjs';
import { requireAuth } from './middleware/auth.mjs';
import { createInvoiceRepository } from './repositories/invoice-repo.mjs';
import { createArrayRepository } from './repositories/resource-repo.mjs';
import { createSettingsRepository } from './repositories/settings-repo.mjs';
import { createUsersRepository } from './repositories/users-repo.mjs';
import { registerAgentsRoutes } from './routes/agents-routes.mjs';
import { registerAuthRoutes } from './routes/auth-routes.mjs';
import { registerCopilotRoutes } from './routes/copilot-routes.mjs';
import { registerEcommerceRoutes } from './routes/ecommerce-routes.mjs';
import { registerEntityRoutes } from './routes/entity-routes.mjs';
import { registerHealthRoutes } from './routes/health-routes.mjs';
import { registerLeadsRoutes } from './routes/leads-routes.mjs';
import { registerNotificationsRoutes } from './routes/notifications-routes.mjs';
import { registerSearchRoutes } from './routes/search-routes.mjs';
import { registerSettingsRoutes } from './routes/settings-routes.mjs';
import { createCopilotService } from './services/copilot-service.mjs';
import { createConversationAnalyzerService } from './services/conversation-analyzer-service.mjs';
import { createDashboardAssistantService } from './services/dashboard-assistant-service.mjs';
import { createAuditLogService } from './services/audit-log-service.mjs';
import { createAccountingService } from './services/accounting-service.mjs';
import { createDeliveryNoteService } from './services/delivery-note-service.mjs';
import { createEcommerceService } from './services/ecommerce-service.mjs';
import { createInvoiceService } from './services/invoice-service.mjs';
import { createIntegrationSettingsService } from './services/integration-settings-service.mjs';
import { createLeadNotificationIntelligenceService } from './services/lead-notification-intelligence-service.mjs';
import { createLearningMemoryService } from './services/learning-memory-service.mjs';
import { createNotificationService } from './services/notification-service.mjs';
import { createPdfGenerationService } from './services/pdf-generation-service.mjs';
import { createScrapeService } from './services/scrape-service.mjs';
import { createSocialAgentService } from './services/social-agent-service.mjs';

const PUBLIC_API_ROUTES = new Set([
  'GET /api/health',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
]);

const RENDER_RUNTIME_DATA_DIR = '/opt/render/project/src/backend/runtime-data';

function toQueryObject(searchParams) {
  const out = {};
  for (const [key, value] of searchParams.entries()) {
    out[key] = value;
  }
  return out;
}

function isPublicApiRoute(method, pathPattern) {
  return PUBLIC_API_ROUTES.has(`${String(method || 'GET').toUpperCase()} ${pathPattern}`);
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch (_error) {
    return false;
  }
}

async function seedDataDirIfNeeded(sourceDir, targetDir) {
  if (sourceDir === targetDir) {
    return;
  }

  try {
    await mkdir(targetDir, { recursive: true });
  } catch (error) {
    if (error?.code === 'EACCES') {
      throw new Error(
        [
          `DATA_DIR is not writable: ${targetDir}.`,
          'On Render, attach a persistent disk at this path or set DATA_DIR to a writable app directory such as /opt/render/project/src/backend/runtime-data.',
        ].join(' ')
      );
    }
    throw error;
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const targetPath = join(targetDir, entry.name);
        if (!(await fileExists(targetPath))) {
          await copyFile(join(sourceDir, entry.name), targetPath);
        }
      })
  );
}

async function resolveDataDir(seedDataDir, preferredDataDir) {
  try {
    await seedDataDirIfNeeded(seedDataDir, preferredDataDir);
    return preferredDataDir;
  } catch (error) {
    const isLegacyRenderDataDir =
      preferredDataDir === '/var/data' && error?.message?.includes('/var/data');
    if (!isLegacyRenderDataDir) {
      throw error;
    }

    console.warn(
      [
        'DATA_DIR=/var/data is not writable in this Render service.',
        `Falling back to ${RENDER_RUNTIME_DATA_DIR}.`,
        'For persistent production data, mount the Render disk at the fallback path and update DATA_DIR to match.',
      ].join(' ')
    );
    await seedDataDirIfNeeded(seedDataDir, RENDER_RUNTIME_DATA_DIR);
    return RENDER_RUNTIME_DATA_DIR;
  }
}

export async function createApp(env) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const seedDataDir = join(currentDir, 'data');
  const dataDir = await resolveDataDir(seedDataDir, env.dataDir || seedDataDir);
  const store = new JsonStore(dataDir);

  const usersRepo = createUsersRepository(store, env);
  await usersRepo.ensureHashes();
  await usersRepo.ensureBootstrapAdmin();

  const deps = {
    env,
    store,
    usersRepo,
    ordersRepo: createArrayRepository(store, 'orders'),
    productsRepo: createArrayRepository(store, 'products'),
    customersRepo: createArrayRepository(store, 'customers'),
    aiOrdersRepo: createArrayRepository(store, 'ai-orders'),
    leadsRepo: createArrayRepository(store, 'leads'),
    jobsRepo: createArrayRepository(store, 'scrape-jobs'),
    conversationsRepo: createArrayRepository(store, 'conversations'),
    conversationAnalysesRepo: createArrayRepository(store, 'conversation-analyses'),
    deliveriesRepo: createArrayRepository(store, 'deliveries'),
    stockMovementsRepo: createArrayRepository(store, 'stock-movements'),
    invoicesRepo: createInvoiceRepository(store),
    deliveryNotesRepo: createArrayRepository(store, 'delivery-notes'),
    expensesRepo: createArrayRepository(store, 'expenses'),
    marketingCampaignsRepo: createArrayRepository(store, 'marketing-campaigns'),
    marketingTemplatesRepo: createArrayRepository(store, 'marketing-templates'),
    adCampaignsRepo: createArrayRepository(store, 'ad-campaigns'),
    salesChannelsRepo: createArrayRepository(store, 'sales-channels'),
    syncJobsRepo: createArrayRepository(store, 'sync-jobs'),
    auditLogsRepo: createArrayRepository(store, 'audit-logs'),
    learnedKnowledgeRepo: createArrayRepository(store, 'learned-knowledge'),
    replyTemplatesRepo: createArrayRepository(store, 'reply-templates'),
    notificationsRepo: createArrayRepository(store, 'notifications'),
    learningRepo: createArrayRepository(store, 'agent-learning'),
    refreshTokensRepo: createArrayRepository(store, 'refresh-tokens'),
    settingsRepo: createSettingsRepository(store),
  };

  deps.auditLogService = createAuditLogService({
    auditLogsRepo: deps.auditLogsRepo,
  });
  deps.notificationService = createNotificationService({
    notificationsRepo: deps.notificationsRepo,
  });
  deps.pdfGenerationService = createPdfGenerationService();

  deps.scrapeService = createScrapeService({
    jobsRepo: deps.jobsRepo,
    leadsRepo: deps.leadsRepo,
  });
  deps.copilotService = createCopilotService({ env });
  deps.dashboardAssistantService = createDashboardAssistantService({
    env,
    dataAccess: {
      ordersRepo: deps.ordersRepo,
      productsRepo: deps.productsRepo,
      customersRepo: deps.customersRepo,
      aiOrdersRepo: deps.aiOrdersRepo,
      leadsRepo: deps.leadsRepo,
      conversationsRepo: deps.conversationsRepo,
      settingsRepo: deps.settingsRepo,
    },
  });
  deps.conversationAnalyzerService = createConversationAnalyzerService({
    env,
  });
  deps.learningMemoryService = createLearningMemoryService({
    env,
    dataAccess: {
      conversationAnalysesRepo: deps.conversationAnalysesRepo,
      learnedKnowledgeRepo: deps.learnedKnowledgeRepo,
      replyTemplatesRepo: deps.replyTemplatesRepo,
    },
  });
  deps.socialAgentService = createSocialAgentService({
    env,
    dataAccess: {
      productsRepo: deps.productsRepo,
      settingsRepo: deps.settingsRepo,
      conversationsRepo: deps.conversationsRepo,
      learningRepo: deps.learningRepo,
      learnedKnowledgeRepo: deps.learnedKnowledgeRepo,
      replyTemplatesRepo: deps.replyTemplatesRepo,
    },
  });
  deps.leadNotificationIntelligenceService = createLeadNotificationIntelligenceService({
    leadsRepo: deps.leadsRepo,
    notificationsRepo: deps.notificationsRepo,
  });
  deps.ecommerceService = createEcommerceService(deps);
  deps.invoiceService = createInvoiceService(deps);
  deps.deliveryNoteService = createDeliveryNoteService(deps);
  deps.accountingService = createAccountingService(deps);
  deps.integrationSettingsService = createIntegrationSettingsService(deps);

  const router = createRouter();
  registerHealthRoutes(router);
  registerAuthRoutes(router, deps);
  registerEcommerceRoutes(router, deps);
  registerEntityRoutes(router, deps);
  registerLeadsRoutes(router, deps);
  registerAgentsRoutes(router, deps);
  registerCopilotRoutes(router, deps);
  registerSettingsRoutes(router, deps);
  registerSearchRoutes(router, deps);
  registerNotificationsRoutes(router, deps);

  const handle = async (request, response) => {
    const requestOrigin = request.headers.origin;

    if ((request.method || 'GET').toUpperCase() === 'OPTIONS') {
      setCorsHeaders(response, env.corsOrigins, requestOrigin);
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const matched = router.match(request.method || 'GET', url.pathname);

    if (!matched) {
      sendError(response, 404, 'NOT_FOUND', 'Route not found', env.corsOrigins, requestOrigin);
      return;
    }

    let parsedBody = null;
    const context = {
      request,
      response,
      env,
      params: matched.params,
      query: toQueryObject(url.searchParams),
      user: null,
      getBody: async () => {
        if (parsedBody === null) {
          parsedBody = await parseJsonBody(request);
        }
        return parsedBody;
      },
    };

    try {
      const isApiCall = url.pathname.startsWith('/api/');
      if (isApiCall && !isPublicApiRoute(matched.method, matched.pathPattern)) {
        await requireAuth(context);
      }

      const result = await matched.handler(context);
      sendSuccess(
        response,
        result?.status || 200,
        result?.data ?? null,
        result?.meta,
        env.corsOrigins,
        requestOrigin
      );
    } catch (error) {
      if (isAppError(error)) {
        sendError(response, error.status, error.code, error.message, env.corsOrigins, requestOrigin);
        return;
      }
      sendError(
        response,
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Internal server error',
        env.corsOrigins,
        requestOrigin
      );
    }
  };

  return {
    handle,
    deps,
  };
}
