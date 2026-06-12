import { AppError } from '../core/errors.mjs';
import { requireAuth, requireRole } from '../middleware/auth.mjs';
import { buildDecisionTrace, clampConfidenceScore, shouldAutoCreateOrder } from '../services/confidence-rules.mjs';

const LEARNING_STATUSES = ['proposed', 'reviewed', 'approved', 'rejected', 'pending_review'];
const LEARNING_TYPES = [
  'common_customer_question',
  'pre_purchase_objection',
  'successful_reply_style',
  'human_reply_template',
  'similar_conversation_pattern',
];
const KNOWLEDGE_STATUSES = ['proposed', 'reviewed', 'approved', 'rejected'];
const KNOWLEDGE_TYPES = ['faq', 'objection_handling', 'template', 'escalation_pattern'];

function nowTimeLabel() {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildFallbackReply(contact) {
  return `Bonjour ${contact}, merci pour votre message. Je peux vous aider sur le prix, la disponibilite, la livraison ou la commande.`;
}

function findMatchingRule(messageText, rules = []) {
  const normalizedMessage = normalizeText(messageText);
  return (
    rules.find(
      (rule) =>
        rule.active &&
        isApprovedRule(rule) &&
        normalizeText(rule.contains) &&
        normalizedMessage.includes(normalizeText(rule.contains))
    ) || null
  );
}

function normalizeLearningStatus(value, fallback = 'proposed') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending_review') return 'reviewed';
  return LEARNING_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeLearningType(value, fallback = 'common_customer_question') {
  const normalized = String(value || '').trim().toLowerCase();
  return LEARNING_TYPES.includes(normalized) ? normalized : fallback;
}

function isApprovedRule(rule) {
  const status = String(rule?.status || '').trim().toLowerCase();
  if (!status) return true;
  return status === 'approved';
}

function sanitizeLearningRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  return {
    ...record,
    type: normalizeLearningType(record.type),
    status: normalizeLearningStatus(record.status),
  };
}

function normalizeKnowledgeStatus(value, fallback = 'proposed') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending_review') return 'reviewed';
  return KNOWLEDGE_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeKnowledgeType(value, fallback = 'faq') {
  const normalized = String(value || '').trim().toLowerCase();
  return KNOWLEDGE_TYPES.includes(normalized) ? normalized : fallback;
}

function shouldAnalyzeOnClose(previousStatus, nextStatus) {
  const previous = String(previousStatus || '').trim().toLowerCase();
  const next = String(nextStatus || '').trim().toLowerCase();
  return next === 'closed' && previous !== 'closed';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampConfidence(value, fallback = 0.4) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function normalizeSuggestedAction(value, fallback = 'ask_clarification') {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set([
    'create_order',
    'collect_customer_info',
    'share_product_info',
    'offer_alternative',
    'escalate',
    'ask_clarification',
  ]);
  return allowed.has(normalized) ? normalized : fallback;
}

function buildClarificationReply(language = 'fr') {
  if (language === 'ar') {
    return 'Nnajem naawnek fil prix, disponibility, livraison, wela commande. Chnoua exactement theb?';
  }
  if (language === 'en') {
    return 'I can help with price, availability, delivery, or ordering. What do you need exactly?';
  }
  return 'Je peux vous aider pour le prix, la disponibilite, la livraison ou la commande. Vous voulez quoi exactement ?';
}

function channelToSourceLabel(channel) {
  const normalized = String(channel || '').trim().toLowerCase();
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'instagram') return 'Instagram';
  return 'WhatsApp';
}

function normalizePhoneKey(value) {
  return String(value || '').replace(/\D+/g, '');
}

function createNextAiOrderId(existingOrders = []) {
  let maxValue = 0;
  for (const order of existingOrders) {
    const match = String(order?.id || '').trim().match(/^AI-(\d+)$/i);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > maxValue) {
      maxValue = parsed;
    }
  }
  return `AI-${String(maxValue + 1).padStart(3, '0')}`;
}

function toConfidencePercent(value, fallback = 40) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 1) {
    return Math.max(0, Math.min(100, Math.round(parsed * 100)));
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function findMatchingProductByName(name, products = []) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;
  return (
    products.find((product) => {
      const productName = normalizeText(product?.name || '');
      if (!productName) return false;
      return productName === normalizedName || productName.includes(normalizedName) || normalizedName.includes(productName);
    }) || null
  );
}

function buildOrderDescription(orderData, quantity) {
  const chunks = [];
  const variant = String(orderData?.variant || '').trim();
  const notes = String(orderData?.notes || '').trim();
  if (variant) chunks.push(`Variant: ${variant}`);
  if (quantity > 1) chunks.push(`Quantity: ${quantity}`);
  if (notes) chunks.push(`Notes: ${notes}`);
  return chunks.join(' | ');
}

function buildSocialFallbackPayload({ contact, preferredLanguage, analysis }) {
  const language = String(analysis?.language || preferredLanguage || 'fr').trim().toLowerCase() || 'fr';
  const languageVariant = String(analysis?.language_variant || 'standard').trim().toLowerCase() || 'standard';
  const intent = String(analysis?.intent || 'unknown').trim().toLowerCase() || 'unknown';
  const confidence = clampConfidence(analysis?.confidence, 0.4);
  const needsHuman = Boolean(analysis?.needs_human) || confidence < 0.5 || intent === 'unknown';
  const reason = String(analysis?.reason || '').trim();
  return {
    language,
    language_variant: languageVariant,
    intent,
    sentiment: String(analysis?.sentiment || 'neutral').trim().toLowerCase() || 'neutral',
    confidence,
    reply: buildFallbackReply(contact),
    cta: '',
    needs_human: needsHuman,
    human_reason: needsHuman ? reason || 'Social AI service is not initialized.' : '',
    suggested_action: needsHuman ? 'escalate' : 'ask_clarification',
    missing_fields: [],
    ready_to_create_order: false,
    order_data: null,
  };
}

function normalizeWorkflowPayload({ aiReply, analysis, preferredLanguage, contact }) {
  const fallbackPayload = buildSocialFallbackPayload({
    contact,
    preferredLanguage,
    analysis,
  });
  const source = aiReply && typeof aiReply === 'object' ? aiReply : fallbackPayload;
  const language = String(source.language || fallbackPayload.language).trim().toLowerCase() || fallbackPayload.language;
  const languageVariant = String(source.language_variant || source.languageVariant || fallbackPayload.language_variant || 'standard')
    .trim()
    .toLowerCase();
  const intent = String(source.intent || analysis?.intent || fallbackPayload.intent).trim().toLowerCase() || 'unknown';
  const confidence = clampConfidence(source.confidence, analysis?.confidence ?? fallbackPayload.confidence);
  const needsHumanByIntent = intent === 'complaint' || intent === 'support';
  const needsHuman = Boolean(source.needs_human) || Boolean(analysis?.needs_human) || needsHumanByIntent || confidence < 0.5;
  const suggestedActionFallback = needsHuman ? 'escalate' : intent === 'order' ? 'collect_customer_info' : 'ask_clarification';
  const suggestedAction = needsHuman
    ? 'escalate'
    : normalizeSuggestedAction(source.suggested_action, suggestedActionFallback);
  const replyText = String(source.reply || '').trim() || (confidence < 0.5 ? buildClarificationReply(language) : buildFallbackReply(contact));
  const humanReason = needsHuman
    ? String(source.human_reason || analysis?.reason || 'High-risk message flagged for human follow-up.').trim()
    : '';
  const missingFields = Array.isArray(source.missing_fields) ? source.missing_fields : [];

  return {
    ...fallbackPayload,
    ...(source || {}),
    language,
    language_variant: languageVariant,
    intent,
    confidence,
    reply: replyText,
    needs_human: needsHuman,
    human_reason: humanReason,
    suggested_action: suggestedAction,
    missing_fields: missingFields,
    ready_to_create_order: Boolean(source.ready_to_create_order) && !needsHuman,
    order_data: source.order_data && typeof source.order_data === 'object' ? source.order_data : null,
  };
}

async function runSocialWorkflow({
  socialAgentService,
  message,
  channel,
  contact,
  tone,
  preferredLanguage,
  rules = [],
  matchedRule = null,
  history = [],
}) {
  const cleanMessage = String(message || '').trim();
  const safeHistory = Array.isArray(history) ? history : [];
  let analysis = null;
  let aiReply = null;

  if (socialAgentService?.analyzeCustomerMessage && cleanMessage) {
    try {
      analysis = await socialAgentService.analyzeCustomerMessage({
        message: cleanMessage,
        preferredLanguage,
      });
    } catch (_error) {
      analysis = null;
    }
  }

  if (socialAgentService?.replyToCustomer && cleanMessage) {
    try {
      aiReply = await socialAgentService.replyToCustomer({
        message: cleanMessage,
        channel,
        contact,
        tone,
        preferredLanguage,
        rules,
        matchedRule,
        history: safeHistory,
      });
    } catch (_error) {
      aiReply = null;
    }
  }

  const normalizedReply = normalizeWorkflowPayload({
    aiReply,
    analysis,
    preferredLanguage,
    contact,
  });

  if ((normalizedReply.intent === 'order' || normalizedReply.ready_to_create_order) && !normalizedReply.order_data) {
    if (socialAgentService?.extractOrderInformation) {
      try {
        const extractionResult = await socialAgentService.extractOrderInformation({
          conversationHistory: safeHistory.length ? safeHistory : [{ sender: 'contact', text: cleanMessage }],
        });
        if (extractionResult && typeof extractionResult === 'object') {
          normalizedReply.order_data = extractionResult;
        }
      } catch (_error) {
        normalizedReply.order_data = null;
      }
    }
  }

  if (normalizedReply.ready_to_create_order && normalizedReply.order_data?.status === 'not_confirmed') {
    normalizedReply.ready_to_create_order = false;
    if (normalizedReply.suggested_action === 'create_order') {
      normalizedReply.suggested_action = 'collect_customer_info';
    }
  }

  return {
    analysis,
    aiReply: normalizedReply,
  };
}

async function createAiOrderEntryIfReady({
  aiOrdersRepo,
  productsRepo,
  conversation,
  channel,
  contact,
  aiReply,
}) {
  if (!aiOrdersRepo?.create || !aiOrdersRepo?.list) {
    return null;
  }
  if (!aiReply?.ready_to_create_order || !aiReply?.order_data || typeof aiReply.order_data !== 'object') {
    return null;
  }

  const orderData = aiReply.order_data;
  const productName = String(orderData.product || '').trim();
  const phone = String(orderData.phone || '').trim();
  const address = String(orderData.address || orderData.city || '').trim();
  const missingFields = Array.isArray(aiReply?.missing_fields) ? aiReply.missing_fields : [];
  const confidenceScore = clampConfidenceScore(aiReply?.confidence ?? orderData?.confidence, 0.4);
  const canAutoCreate = shouldAutoCreateOrder({
    confidence: confidenceScore,
    orderStatus: orderData?.status,
    missingFields,
  });
  if (!canAutoCreate) {
    return null;
  }
  if (!productName || !phone || !address) {
    return null;
  }

  const existingOrders = await aiOrdersRepo.list();
  const normalizedProduct = normalizeText(productName);
  const normalizedPhone = normalizePhoneKey(phone);
  const conversationId = String(conversation?.id || '').trim();
  const duplicate = existingOrders.find((row) => {
    const sameConversation = String(row?.conversationId || '').trim() === conversationId;
    const sameProduct = normalizeText(row?.product || '') === normalizedProduct;
    const samePhone = normalizePhoneKey(row?.customerPhone || '') === normalizedPhone;
    const activeStatus = String(row?.status || '').toLowerCase() !== 'annule';
    return sameConversation && sameProduct && samePhone && activeStatus;
  });
  if (duplicate) {
    return duplicate;
  }

  const products = productsRepo?.list ? await productsRepo.list() : [];
  const matchedProduct = findMatchingProductByName(productName, products);
  const quantity = Math.max(1, parseInt(String(orderData.quantity || 1), 10) || 1);
  const unitPrice = toNumber(matchedProduct?.price, 0);
  const amount = Math.round(unitPrice * quantity * 100) / 100;
  const customerName = String(orderData.customer_name || contact || conversation?.contact || 'Customer').trim();
  const customerAddress = address;
  const customerPhone = phone;
  const confidence = toConfidencePercent(aiReply.confidence ?? orderData.confidence, 40);

  const createdRecord = {
    id: createNextAiOrderId(existingOrders),
    source: channelToSourceLabel(channel || conversation?.channel || 'whatsapp'),
    customer: customerName || 'Customer',
    customerPhone,
    customerAddress,
    product: productName,
    productDescription: buildOrderDescription(orderData, quantity),
    status: 'brouillon',
    amount: Number.isFinite(amount) ? amount : 0,
    date: new Date().toISOString(),
    confidence,
    conversationId,
    extractionStatus: String(orderData.status || '').trim() || 'needs_review',
    decisionTrace: buildDecisionTrace({
      intent: aiReply?.intent || 'order',
      confidence: confidenceScore,
      needsHuman: aiReply?.needs_human,
      orderStatus: orderData?.status,
      missingFields,
    }),
  };

  return aiOrdersRepo.create(createdRecord);
}

export function registerAgentsRoutes(router, deps) {
  const {
    conversationsRepo,
    settingsRepo,
    productsRepo,
    aiOrdersRepo,
    learningRepo,
    conversationAnalysesRepo,
    learnedKnowledgeRepo,
    replyTemplatesRepo,
    dashboardAssistantService,
    socialAgentService,
    conversationAnalyzerService,
    learningMemoryService,
    leadNotificationIntelligenceService,
  } = deps;

  router.register('GET', '/api/agents/channels', async (context) => {
    await requireAuth(context);
    const conversations = await conversationsRepo.list();
    const channels = ['facebook', 'instagram', 'whatsapp'].map((channel) => {
      const rows = conversations.filter((item) => item.channel === channel);
      return {
        channel,
        total: rows.length,
        unread: rows.reduce((sum, item) => sum + Number(item.unread || 0), 0),
      };
    });
    return { status: 200, data: channels };
  });

  router.register('GET', '/api/agents/conversations', async (context) => {
    await requireAuth(context);
    const channel = String(context.query.channel || '');
    const conversations = await conversationsRepo.list();
    const filtered = channel ? conversations.filter((item) => item.channel === channel) : conversations;
    const lightRows = filtered.map((item) => ({
      id: item.id,
      channel: item.channel,
      contact: item.contact,
      lastMessage: item.lastMessage,
      timestamp: item.timestamp,
      unread: item.unread,
      avatar: item.avatar,
      status: String(item.status || 'open'),
    }));
    return {
      status: 200,
      data: lightRows,
      meta: { total: lightRows.length },
    };
  });

  router.register('GET', '/api/agents/conversations/:id/messages', async (context) => {
    await requireAuth(context);
    const conversation = await conversationsRepo.getById(context.params.id);
    if (!conversation) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }
    return {
      status: 200,
      data: conversation.messages || [],
    };
  });

  router.register('PATCH', '/api/agents/conversations/:id', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const conversation = await conversationsRepo.getById(context.params.id);
    if (!conversation) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }

    const patch = {};
    if (body.unread !== undefined) {
      patch.unread = Math.max(0, Number(body.unread || 0));
    }
    if (body.lastMessage !== undefined) {
      patch.lastMessage = String(body.lastMessage || '');
    }
    if (body.timestamp !== undefined) {
      patch.timestamp = String(body.timestamp || nowTimeLabel());
    }
    if (body.status !== undefined) {
      patch.status = String(body.status || 'open').trim().toLowerCase() || 'open';
    }

    const updated = await conversationsRepo.update(conversation.id, patch);
    let analysisResult = null;
    if (shouldAnalyzeOnClose(conversation.status, updated.status) && conversationAnalyzerService?.analyzeConversation) {
      try {
        analysisResult = await conversationAnalyzerService.analyzeConversation({
          conversation: updated,
          preferredLanguage: body.language || 'fr',
        });
        if (learningMemoryService?.ingestFromAnalysis) {
          await learningMemoryService.ingestFromAnalysis({
            conversation: updated,
            analysis: analysisResult,
          });
        }
      } catch (_error) {
        analysisResult = null;
      }
    }
    return {
      status: 200,
      data: {
        ...updated,
        analysis: analysisResult,
      },
    };
  });

  router.register('POST', '/api/agents/conversations/:id/messages', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const text = String(body.text || '').trim();
    const sender = body.sender === 'contact' ? 'contact' : 'user';
    if (!text) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Message text is required');
    }

    const conversation = await conversationsRepo.getById(context.params.id);
    if (!conversation) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }

    const settings = await settingsRepo.getAll();
    const matchedRule = sender === 'contact' ? findMatchingRule(text, settings.agentRules || []) : null;
    const message = {
      id: createId('msg'),
      sender,
      text,
      timestamp: nowTimeLabel(),
      ...(sender === 'user' ? { status: 'sent' } : {}),
    };

    const updatedMessages = [...(conversation.messages || []), message];
    let nextLastMessage = text;
    let nextTimestamp = nowTimeLabel();
    let workflowIntelligence = null;

    if (sender === 'contact' && matchedRule) {
      await settingsRepo.updateRule(matchedRule.id, {
        triggers: Number(matchedRule.triggers || 0) + 1,
      });
    }

    if (sender === 'contact' && settings.agents?.autoReplyEnabled) {
      const workflow = await runSocialWorkflow({
        socialAgentService,
        message: text,
        channel: conversation.channel,
        contact: conversation.contact,
        tone: settings.agents?.tone || 'professionnel',
        preferredLanguage: settings.agents?.language || 'fr',
        rules: settings.agentRules || [],
        matchedRule,
        history: updatedMessages,
      });
      const aiReply = workflow.aiReply;
      const incomingAiMeta = {
        source: 'incoming_contact_message',
        intent: aiReply?.intent || workflow.analysis?.intent || 'unknown',
        confidence: clampConfidence(aiReply?.confidence, workflow.analysis?.confidence ?? 0.4),
        needs_human: Boolean(aiReply?.needs_human) || Boolean(workflow.analysis?.needs_human),
        suggested_action: aiReply?.suggested_action || (aiReply?.needs_human ? 'escalate' : 'ask_clarification'),
        human_reason: aiReply?.human_reason || workflow.analysis?.reason || '',
        analysis: workflow.analysis || null,
        matched_rule: matchedRule
          ? {
              id: matchedRule.id,
              contains: matchedRule.contains,
              action: matchedRule.action,
            }
          : null,
      };
      if (updatedMessages.length > 0) {
        updatedMessages[updatedMessages.length - 1] = {
          ...updatedMessages[updatedMessages.length - 1],
          aiMeta: incomingAiMeta,
        };
      }

      const shouldIgnoreAutoReply = aiReply?.is_spam === true && aiReply?.action === 'ignore';
      if (!shouldIgnoreAutoReply) {
        const autoReplyText =
          typeof aiReply?.reply === 'string' ? aiReply.reply : buildFallbackReply(conversation.contact);

        let createdAiOrder = null;
        try {
          createdAiOrder = await createAiOrderEntryIfReady({
            aiOrdersRepo,
            productsRepo,
            conversation,
            channel: conversation.channel,
            contact: conversation.contact,
            aiReply,
          });
        } catch (_error) {
          createdAiOrder = null;
        }
        if (leadNotificationIntelligenceService?.processSocialOutcome) {
          try {
            workflowIntelligence = await leadNotificationIntelligenceService.processSocialOutcome({
              conversation,
              channel: conversation.channel,
              incomingMessage: text,
              aiReply,
              analysis: workflow.analysis,
              aiOrder: createdAiOrder,
            });
          } catch (_error) {
            workflowIntelligence = null;
          }
        }

        const aiMeta = {
          ...(aiReply && typeof aiReply === 'object' ? aiReply : {}),
          intent: aiReply?.intent || workflow.analysis?.intent || 'unknown',
          confidence: clampConfidence(aiReply?.confidence, workflow.analysis?.confidence ?? 0.4),
          action: aiReply?.suggested_action || (aiReply?.needs_human ? 'escalate' : 'ask_clarification'),
          matched_rule: matchedRule
            ? {
                id: matchedRule.id,
                contains: matchedRule.contains,
                action: matchedRule.action,
              }
            : null,
          analysis: workflow.analysis || null,
          ai_order_id: createdAiOrder?.id || null,
          decision: workflowIntelligence?.decision || null,
          lead_id: workflowIntelligence?.lead?.id || null,
          notification_ids: Array.isArray(workflowIntelligence?.notifications)
            ? workflowIntelligence.notifications.map((item) => item?.id).filter(Boolean)
            : [],
        };

        updatedMessages.push({
          id: createId('msg'),
          sender: 'user',
          text: autoReplyText,
          timestamp: nowTimeLabel(),
          status: 'sent',
          aiMeta,
        });
        nextLastMessage = autoReplyText;
        nextTimestamp = nowTimeLabel();
      }
    }
    if (sender === 'contact' && !settings.agents?.autoReplyEnabled) {
      let analysis = null;
      if (socialAgentService?.analyzeCustomerMessage) {
        try {
          analysis = await socialAgentService.analyzeCustomerMessage({
            message: text,
            preferredLanguage: settings.agents?.language || 'fr',
          });
        } catch (_error) {
          analysis = null;
        }
      }
      if (leadNotificationIntelligenceService?.processSocialOutcome) {
        try {
          await leadNotificationIntelligenceService.processSocialOutcome({
            conversation,
            channel: conversation.channel,
            incomingMessage: text,
            aiReply: null,
            analysis,
            aiOrder: null,
          });
        } catch (_error) {
          // Intelligence side-effects must never block message updates.
        }
      }
    }

    const nextConversation = {
      ...conversation,
      messages: updatedMessages,
      lastMessage: nextLastMessage,
      timestamp: nextTimestamp,
      status: sender === 'contact' ? 'open' : String(conversation.status || 'open'),
      unread: sender === 'contact' ? Number(conversation.unread || 0) + 1 : conversation.unread || 0,
      lastAiMeta:
        sender === 'contact'
          ? (updatedMessages[updatedMessages.length - 1]?.aiMeta ?? null)
          : conversation.lastAiMeta || null,
    };
    await conversationsRepo.update(conversation.id, nextConversation);

    return {
      status: 201,
      data: message,
    };
  });

  router.register('GET', '/api/agents/settings', async (context) => {
    await requireAuth(context);
    const settings = await settingsRepo.getAll();
    return {
      status: 200,
      data: settings.agents || { autoReplyEnabled: true, tone: 'professionnel', language: 'fr' },
    };
  });

  router.register('PATCH', '/api/agents/settings', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const updated = await settingsRepo.patchSection('agents', body);
    return { status: 200, data: updated };
  });

  router.register('GET', '/api/agents/rules', async (context) => {
    await requireAuth(context);
    const rules = await settingsRepo.listRules();
    const normalized = rules.map((rule) => ({
      ...rule,
      status: normalizeLearningStatus(rule?.status, 'approved'),
      source: String(rule?.source || 'manual'),
    }));
    return {
      status: 200,
      data: normalized,
      meta: { total: normalized.length },
    };
  });

  router.register('POST', '/api/agents/rules', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    if (!body.contains || !body.action) {
      throw new AppError(400, 'VALIDATION_ERROR', 'contains and action are required');
    }
    const created = await settingsRepo.createRule({
      id: createId('rule'),
      contains: body.contains,
      action: body.action,
      active: body.active !== false,
      triggers: Number(body.triggers || 0),
      source: 'manual',
      status: 'approved',
    });
    return { status: 201, data: created };
  });

  router.register('PATCH', '/api/agents/rules/:id', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const patch = {
      ...body,
    };
    if (body?.status !== undefined) {
      patch.status = normalizeLearningStatus(body.status, 'approved');
    }
    const updated = await settingsRepo.updateRule(context.params.id, patch);
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    }
    return { status: 200, data: updated };
  });

  router.register('DELETE', '/api/agents/rules/:id', async (context) => {
    await requireAuth(context);
    const deleted = await settingsRepo.deleteRule(context.params.id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Rule not found');
    }
    return { status: 200, data: deleted };
  });

  router.register('GET', '/api/agents/learning-rules', async (context) => {
    await requireAuth(context);
    const rawStatus = String(context.query.status || '').trim().toLowerCase();
    const rawType = String(context.query.type || '').trim().toLowerCase();
    const statusFilter = rawStatus && LEARNING_STATUSES.includes(rawStatus) ? rawStatus : '';
    const typeFilter = rawType && LEARNING_TYPES.includes(rawType) ? rawType : '';
    const rows = learningRepo?.list ? await learningRepo.list() : [];
    const normalized = rows.map(sanitizeLearningRecord).filter(Boolean);
    const filtered = normalized
      .filter((row) => (statusFilter ? row.status === statusFilter : true))
      .filter((row) => (typeFilter ? row.type === typeFilter : true))
      .sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
      });

    const counts = LEARNING_STATUSES.reduce((acc, status) => {
      acc[status] = normalized.filter((row) => row.status === status).length;
      return acc;
    }, {});

    return {
      status: 200,
      data: filtered,
      meta: {
        total: filtered.length,
        counts,
      },
    };
  });

  router.register('PATCH', '/api/agents/learning-rules/:id/status', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    const nextStatus = normalizeLearningStatus(body?.status, '');
    if (!nextStatus || !LEARNING_STATUSES.includes(nextStatus)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'status must be proposed, reviewed, approved, rejected (legacy pending_review also accepted)'
      );
    }
    if (!learningRepo?.getById || !learningRepo?.update) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Learning repository is not configured');
    }
    const existing = await learningRepo.getById(context.params.id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Learning rule not found');
    }
    const timestamp = new Date().toISOString();
    const patch = {
      status: nextStatus,
      updated_at: timestamp,
      reviewed_at: timestamp,
      reviewed_by: context.user?.id || '',
      review_note: String(body?.review_note || '').trim(),
      ...(nextStatus === 'approved' ? { approved_at: timestamp } : {}),
    };
    const updated = await learningRepo.update(context.params.id, patch);
    return {
      status: 200,
      data: sanitizeLearningRecord(updated),
    };
  });

  router.register('POST', '/api/agents/conversations/:id/analyze', async (context) => {
    await requireAuth(context);
    const conversation = await conversationsRepo.getById(context.params.id);
    if (!conversation) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }
    if (!conversationAnalyzerService?.analyzeConversation) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Conversation analyzer service is not initialized');
    }
    const body = await context.getBody();
    const analysis = await conversationAnalyzerService.analyzeConversation({
      conversation,
      preferredLanguage: body?.language || 'fr',
    });
    let memoryResult = null;
    if (learningMemoryService?.ingestFromAnalysis) {
      memoryResult = await learningMemoryService.ingestFromAnalysis({
        conversation,
        analysis,
      });
    }
    const updatedConversation = await conversationsRepo.update(conversation.id, {
      status: 'closed',
      analyzed_at: new Date().toISOString(),
      analysis_summary: {
        intent: analysis.customer_intent,
        sentiment: analysis.customer_sentiment,
        outcome: analysis.order_outcome,
      },
    });
    return {
      status: 200,
      data: {
        conversation: updatedConversation,
        analysis,
        memory: memoryResult,
      },
    };
  });

  router.register('GET', '/api/agents/conversation-analyses', async (context) => {
    await requireAuth(context);
    const rows = conversationAnalysesRepo?.list ? await conversationAnalysesRepo.list() : [];
    const conversationId = String(context.query.conversation_id || '').trim();
    const filtered = conversationId
      ? rows.filter((row) => String(row?.conversation_id || '') === conversationId)
      : rows;
    const ordered = filtered.sort((left, right) =>
      String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''))
    );
    return {
      status: 200,
      data: ordered,
      meta: {
        total: ordered.length,
      },
    };
  });

  router.register('GET', '/api/agents/learned-knowledge', async (context) => {
    await requireAuth(context);
    const status = normalizeKnowledgeStatus(String(context.query.status || '').trim(), '');
    const type = normalizeKnowledgeType(String(context.query.type || '').trim(), '');
    if (learningMemoryService?.listKnowledge) {
      const rows = await learningMemoryService.listKnowledge({
        status,
        type,
      });
      return {
        status: 200,
        data: rows,
        meta: {
          total: rows.length,
        },
      };
    }
    const rows = learnedKnowledgeRepo?.list ? await learnedKnowledgeRepo.list() : [];
    return {
      status: 200,
      data: rows,
      meta: { total: rows.length },
    };
  });

  router.register('PATCH', '/api/agents/learned-knowledge/:id/status', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    const status = normalizeKnowledgeStatus(body?.status, '');
    if (!status || !KNOWLEDGE_STATUSES.includes(status)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'status must be proposed, reviewed, approved, or rejected');
    }
    if (!learningMemoryService?.updateKnowledgeStatus) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Learning memory service is not initialized');
    }
    const updated = await learningMemoryService.updateKnowledgeStatus({
      id: context.params.id,
      status,
      reviewedBy: context.user?.id || '',
      reason: body?.reason || '',
      editedAnswer: body?.edited_answer || '',
    });
    return {
      status: 200,
      data: updated,
    };
  });

  router.register('GET', '/api/agents/reply-templates', async (context) => {
    await requireAuth(context);
    const status = normalizeKnowledgeStatus(String(context.query.status || '').trim(), '');
    if (learningMemoryService?.listTemplates) {
      const rows = await learningMemoryService.listTemplates({
        status,
      });
      return {
        status: 200,
        data: rows,
        meta: {
          total: rows.length,
        },
      };
    }
    const rows = replyTemplatesRepo?.list ? await replyTemplatesRepo.list() : [];
    return {
      status: 200,
      data: rows,
      meta: { total: rows.length },
    };
  });

  router.register('PATCH', '/api/agents/reply-templates/:id/status', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    const body = await context.getBody();
    const status = normalizeKnowledgeStatus(body?.status, '');
    if (!status || !KNOWLEDGE_STATUSES.includes(status)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'status must be proposed, reviewed, approved, or rejected');
    }
    if (!learningMemoryService?.updateTemplateStatus) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Learning memory service is not initialized');
    }
    const updated = await learningMemoryService.updateTemplateStatus({
      id: context.params.id,
      status,
      reviewedBy: context.user?.id || '',
      reason: body?.reason || '',
      editedTemplate: body?.edited_template || '',
    });
    return {
      status: 200,
      data: updated,
    };
  });

  router.register('POST', '/api/agents/learned-knowledge/:id/review-suggestion', async (context) => {
    await requireAuth(context);
    requireRole(context, ['Executive']);
    if (!learningMemoryService?.suggestAdminReview) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Learning memory service is not initialized');
    }
    const row = learnedKnowledgeRepo?.getById ? await learnedKnowledgeRepo.getById(context.params.id) : null;
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Knowledge item not found');
    }
    const suggestion = await learningMemoryService.suggestAdminReview({
      item: row,
    });
    return {
      status: 200,
      data: suggestion,
    };
  });

  router.register('POST', '/api/agents/suggestions', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const conversation = await conversationsRepo.getById(body.conversationId);
    if (!conversation) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }
    const settings = await settingsRepo.getAll();
    const latestMessage = (conversation.messages || []).slice(-1)[0];
    const latestText = latestMessage?.sender === 'contact' ? latestMessage.text : conversation.lastMessage || '';
    const matchedRule = findMatchingRule(latestText, settings.agentRules || []);
    const messageForSuggestion = String(latestText || conversation.lastMessage || '').trim();
    const workflow = messageForSuggestion
      ? await runSocialWorkflow({
          socialAgentService,
          message: messageForSuggestion,
          channel: conversation.channel,
          contact: conversation.contact,
          tone: settings.agents?.tone || 'professionnel',
          preferredLanguage: settings.agents?.language || 'fr',
          rules: settings.agentRules || [],
          matchedRule,
          history: conversation.messages || [],
        })
      : { analysis: null, aiReply: null };
    const aiReply = workflow.aiReply;
    const shouldIgnoreSuggestion = aiReply?.is_spam === true && aiReply?.action === 'ignore';
    const text = shouldIgnoreSuggestion
      ? ''
      : typeof aiReply?.reply === 'string'
      ? aiReply.reply
      : buildFallbackReply(conversation.contact);

    return {
      status: 200,
      data: {
        conversationId: conversation.id,
        text,
        analysis: aiReply
          ? {
              ...aiReply,
              matched_rule: matchedRule
                ? {
                    id: matchedRule.id,
                    contains: matchedRule.contains,
                    action: matchedRule.action,
                  }
                : null,
              analysis: workflow.analysis || null,
            }
          : null,
      },
    };
  });

  router.register('POST', '/api/agents/social-reply', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const message = String(body.message || '').trim();
    if (!message) {
      throw new AppError(400, 'VALIDATION_ERROR', 'message is required');
    }

    const settings = await settingsRepo.getAll();
    let conversation = null;
    if (body.conversationId) {
      conversation = await conversationsRepo.getById(body.conversationId);
    }

    const matchedRule = findMatchingRule(message, settings.agentRules || []);
    let result = null;

    if (socialAgentService?.replyToCustomer) {
      const workflow = await runSocialWorkflow({
        socialAgentService,
        message,
        channel: conversation?.channel || body.channel || 'whatsapp',
        contact: conversation?.contact || body.contact || 'Customer',
        tone: body.tone || settings.agents?.tone || 'professionnel',
        preferredLanguage: body.language || settings.agents?.language || 'fr',
        rules: settings.agentRules || [],
        matchedRule,
        history: conversation?.messages || body.history || [],
      });
      result = {
        ...(workflow.aiReply || {}),
        matched_rule: matchedRule
          ? {
              id: matchedRule.id,
              contains: matchedRule.contains,
              action: matchedRule.action,
            }
          : null,
        analysis: workflow.analysis || null,
      };
    } else {
      result = {
        language: settings.agents?.language || 'fr',
        language_variant: 'standard',
        intent: 'unknown',
        sentiment: 'neutral',
        confidence: 0.4,
        reply: buildFallbackReply(conversation?.contact || body.contact || 'Customer'),
        cta: '',
        needs_human: true,
        human_reason: 'Social AI service is not initialized.',
        suggested_action: 'escalate',
        missing_fields: [],
        ready_to_create_order: false,
      };
    }

    return {
      status: 200,
      data: result,
    };
  });

  router.register('POST', '/api/agents/social-analyze', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const message = String(body.message || '').trim();
    if (!message) {
      throw new AppError(400, 'VALIDATION_ERROR', 'message is required');
    }

    const settings = await settingsRepo.getAll();
    const preferredLanguage = body.language || settings.agents?.language || 'fr';

    if (!socialAgentService?.analyzeCustomerMessage) {
      return {
        status: 200,
        data: {
          language: preferredLanguage,
          language_variant: 'standard',
          intent: 'unknown',
          sentiment: 'neutral',
          confidence: 0.4,
          needs_human: true,
          reason: 'Social analyzer service is not initialized.',
        },
      };
    }

    const result = await socialAgentService.analyzeCustomerMessage({
      message,
      preferredLanguage,
    });

    return {
      status: 200,
      data: result,
    };
  });

  router.register('POST', '/api/agents/extract-order', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();

    let conversationHistory = body.conversation_history || body.conversationHistory || '';

    if (!conversationHistory && body.conversationId) {
      const conversation = await conversationsRepo.getById(body.conversationId);
      if (!conversation) {
        throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      }
      conversationHistory = conversation.messages || [];
    }

    if (!conversationHistory || (typeof conversationHistory === 'string' && !String(conversationHistory).trim())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'conversation_history is required');
    }

    if (!socialAgentService?.extractOrderInformation) {
      return {
        status: 200,
        data: {
          status: 'not_confirmed',
          customer_name: '',
          phone: '',
          product: '',
          variant: '',
          quantity: 1,
          address: '',
          city: '',
          notes: '',
          confidence: 0.3,
          missing_fields: ['product', 'full_name', 'phone', 'address'],
          follow_up_question: 'Pour continuer, envoyez seulement: produit, nom complet, telephone, adresse / ville.',
        },
      };
    }

    const result = await socialAgentService.extractOrderInformation({
      conversationHistory,
    });

    return {
      status: 200,
      data: result,
    };
  });

  router.register('POST', '/api/agents/dashboard-assistant', async (context) => {
    await requireAuth(context);
    const body = await context.getBody();
    const result = await dashboardAssistantService.reply({
      message: body.message,
      history: body.history,
      mode: body.mode,
      user: context.user,
    });
    return {
      status: 200,
      data: result,
    };
  });
}
