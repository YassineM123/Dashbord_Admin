import { buildDecisionTrace, clampConfidenceScore } from './confidence-rules.mjs';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function createLeadId() {
  return `L${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 10)}`;
}

function createNotificationId() {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

function sourceLabelFromChannel(channel) {
  const normalized = String(channel || '').trim().toLowerCase();
  if (normalized === 'facebook') return 'Facebook Inbox';
  if (normalized === 'instagram') return 'Instagram DM';
  return 'WhatsApp';
}

function shouldCreateLeadFromOutcome({ aiReply, analysis }) {
  const signal = aiReply || analysis || {};
  const decision = buildDecisionTrace({
    intent: signal.intent,
    confidence: signal.confidence,
    needsHuman: signal.needs_human,
    orderStatus: signal?.order_data?.status || 'needs_review',
    missingFields: signal?.missing_fields || [],
  });
  return {
    decision,
    shouldCreate: decision.capture_lead && !decision.auto_create_order,
  };
}

function buildLeadPayload({ conversation, channel, aiReply, analysis }) {
  const base = aiReply?.lead_data && typeof aiReply.lead_data === 'object' ? aiReply.lead_data : {};
  const city = String(base.city || aiReply?.order_data?.city || '').trim() || 'Tunis';
  const phone = String(base.phone || aiReply?.order_data?.phone || '').trim();
  const name =
    String(base.name || aiReply?.order_data?.customer_name || conversation?.contact || 'Lead Social').trim() || 'Lead Social';
  const productInterest = String(base.product_interest || aiReply?.order_data?.product || '').trim();
  const confidence = clampConfidenceScore(base.score || aiReply?.confidence || analysis?.confidence, 0.58);

  return {
    id: createLeadId(),
    name,
    category: productInterest ? `Interest: ${productInterest}` : 'Social Commerce',
    phone,
    city,
    source: sourceLabelFromChannel(channel),
    status: 'nouveau',
    email: '',
    address: String(aiReply?.order_data?.address || '').trim(),
    notes: `Auto-captured from social (${Math.round(confidence * 100)}% confidence).`,
  };
}

function createDedupKey(prefix, value) {
  const normalized = normalizeText(value);
  return normalized ? `${prefix}:${normalized}` : '';
}

export function createLeadNotificationIntelligenceService({ leadsRepo, notificationsRepo }) {
  async function ensureLead({ conversation, channel, aiReply, analysis }) {
    if (!leadsRepo?.list || !leadsRepo?.create) {
      return null;
    }
    const payload = buildLeadPayload({
      conversation,
      channel,
      aiReply,
      analysis,
    });

    const leads = await leadsRepo.list();
    const phoneKey = normalizePhone(payload.phone);
    const existing = leads.find((lead) => {
      if (phoneKey && normalizePhone(lead?.phone) === phoneKey) return true;
      const sameName = normalizeText(lead?.name) === normalizeText(payload.name);
      const sameCity = normalizeText(lead?.city) === normalizeText(payload.city);
      return sameName && sameCity;
    });
    if (existing) {
      return existing;
    }
    return leadsRepo.create(payload);
  }

  async function maybeNotify({ type, title, message, dedupeKey, priority = 'medium', link = '', entityType = '', entityId = '' }) {
    if (!notificationsRepo?.list || !notificationsRepo?.create) {
      return null;
    }
    const existing = await notificationsRepo.list();
    const duplicate = existing.find((item) => String(item?.dedupeKey || '') === String(dedupeKey || ''));
    if (duplicate) {
      return null;
    }
    return notificationsRepo.create({
      id: createNotificationId(),
      type,
      title,
      message,
      time: 'A l instant',
      createdAt: new Date().toISOString(),
      read: false,
      priority,
      link,
      entityType,
      entityId,
      dedupeKey: String(dedupeKey || ''),
    });
  }

  async function processSocialOutcome({
    conversation,
    channel,
    incomingMessage,
    aiReply = null,
    analysis = null,
    aiOrder = null,
  }) {
    if (!aiReply && !analysis) {
      return {
        decision: null,
        lead: null,
        notifications: [],
      };
    }

    const leadDecision = shouldCreateLeadFromOutcome({
      aiReply,
      analysis,
    });

    let lead = null;
    if (leadDecision.shouldCreate) {
      try {
        lead = await ensureLead({
          conversation,
          channel,
          aiReply,
          analysis,
        });
      } catch (_error) {
        lead = null;
      }
    }

    const notifications = [];
    const contactName = String(conversation?.contact || 'Client').trim();
    const conversationId = String(conversation?.id || '').trim();

    if (aiReply?.needs_human) {
      const note = await maybeNotify({
        type: 'warning',
        title: `Escalade client: ${contactName}`,
        message: String(aiReply?.human_reason || 'Message sensible a traiter rapidement.').slice(0, 180),
        priority: 'high',
        link: `/admin/agents-social`,
        entityType: 'conversation',
        entityId: conversationId,
        dedupeKey: createDedupKey('escalation', `${conversationId}:${aiReply?.human_reason || incomingMessage}`),
      });
      if (note) notifications.push(note);
    }

    if (aiOrder?.id) {
      const note = await maybeNotify({
        type: 'success',
        title: `AI order cree: ${aiOrder.id}`,
        message: `Conversation ${contactName}: commande detectee avec ${Math.round(clampConfidenceScore(aiReply?.confidence, 0.6) * 100)}% confiance.`,
        priority: 'high',
        link: '/admin/commandes-ai',
        entityType: 'ai_order',
        entityId: aiOrder.id,
        dedupeKey: createDedupKey('ai_order', aiOrder.id),
      });
      if (note) notifications.push(note);
    }

    if (lead && leadDecision.decision?.capture_lead) {
      const note = await maybeNotify({
        type: 'info',
        title: `Nouveau lead social: ${lead.name}`,
        message: `Lead capture depuis ${sourceLabelFromChannel(channel)} (${Math.round((leadDecision.decision?.confidence || 0) * 100)}%).`,
        priority: 'medium',
        link: '/admin/leads',
        entityType: 'lead',
        entityId: lead.id,
        dedupeKey: createDedupKey('lead', `${lead.id}:${lead.name}`),
      });
      if (note) notifications.push(note);
    }

    return {
      decision: leadDecision.decision,
      lead,
      notifications,
    };
  }

  return {
    processSocialOutcome,
  };
}
