import { AppError } from '../core/errors.mjs';
import { callAiText, canAttemptAi } from './ai-provider-service.mjs';
import { extractJsonObject, normalizeStringArray } from './ai-json-utils.mjs';
import { buildPromptTemplate } from './prompt-registry.mjs';

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const ORDER_OUTCOMES = new Set(['ordered', 'interested_no_order', 'complaint', 'support_request', 'unknown']);
const KNOWLEDGE_TYPES = new Set(['faq', 'objection_handling', 'template', 'escalation_pattern']);
const FAQ_CATEGORIES = new Set(['price', 'delivery', 'stock', 'payment', 'product_details', 'returns', 'ordering']);
const RISK_FACT_PATTERN =
  /(?:price|prix|soum|stock|disponible|delivery fee|frais livraison|refund|rembourse|policy|legal|terms|condition|discount|promo)/i;
const RUDE_PATTERN =
  /(?:stupid|idiot|shut up|hate you|ta gueule|ferme ta bouche|nul|debile|scam|arnaqueur)/i;
const QUESTION_PATTERN = /(?:\?|prix|price|delivery|livraison|stock|disponible|payment|paiement|returns|retour|chnowa|qdach|ch7al)/i;
const OBJECTION_MAP = [
  { type: 'price too high', pattern: /(?:too expensive|trop cher|cher|ghali|expensive)/i },
  { type: 'wants reassurance', pattern: /(?:not sure|pas sur|hesitant|hesite|mottamen|reassure|rassure)/i },
  { type: 'delivery concern', pattern: /(?:delivery|livraison|shipping|tawsil)/i },
  { type: 'trust issue', pattern: /(?:trust|confiance|arnaque|scam|safe\?|fiable)/i },
  { type: 'wants more details', pattern: /(?:details|detail|spec|caracteristique|couleur|taille|size|color)/i },
  { type: 'comparing with another product', pattern: /(?:better than|compare|comparer|vs|versus|autre produit)/i },
  { type: 'payment concern', pattern: /(?:payment|paiement|cod|cash|carte|bank transfer|virement)/i },
  { type: 'delay concern', pattern: /(?:late|retard|delay|quand arrive|when arrive|time)/i },
  { type: 'size/color uncertainty', pattern: /(?:size|taille|color|couleur|variant|modele)/i },
  { type: 'just browsing', pattern: /(?:just browsing|just looking|plus tard|not now|pas maintenant|b3d)/i },
];

function asLine(value, maxLength = 260) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampConfidence(value, fallback = 0.6) {
  const parsed = toNumber(value, fallback);
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return Math.round(parsed * 100) / 100;
}

function normalizeSentiment(value, fallback = 'neutral') {
  const normalized = String(value || '').trim().toLowerCase();
  return SENTIMENTS.has(normalized) ? normalized : fallback;
}

function normalizeOutcome(value, fallback = 'unknown') {
  const normalized = String(value || '').trim().toLowerCase();
  return ORDER_OUTCOMES.has(normalized) ? normalized : fallback;
}

function normalizeKnowledgeType(value, fallback = 'faq') {
  const normalized = String(value || '').trim().toLowerCase();
  return KNOWLEDGE_TYPES.has(normalized) ? normalized : fallback;
}

function normalizeFaqCategory(value, fallback = 'product_details') {
  const normalized = String(value || '').trim().toLowerCase();
  return FAQ_CATEGORIES.has(normalized) ? normalized : fallback;
}

function detectLanguage(text, preferredLanguage = 'fr') {
  const raw = String(text || '');
  if (/[\u0600-\u06FF]/.test(raw)) return 'ar';
  const normalized = raw.toLowerCase();
  if (/(bonjour|livraison|prix|produit|commande)/.test(normalized)) return 'fr';
  if (/(hello|price|delivery|order|product)/.test(normalized)) return 'en';
  return String(preferredLanguage || 'fr').trim().toLowerCase() || 'fr';
}

function conversationToText(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages
    .map((msg) => {
      const sender = msg?.sender === 'user' ? 'agent' : 'customer';
      const text = asLine(msg?.text || msg?.content || '', 500);
      return text ? `${sender}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function getCustomerMessages(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages
    .filter((msg) => msg?.sender === 'contact')
    .map((msg) => asLine(msg?.text || msg?.content || '', 400))
    .filter(Boolean);
}

function getAgentMessages(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages
    .filter((msg) => msg?.sender === 'user')
    .map((msg) => ({
      text: asLine(msg?.text || msg?.content || '', 400),
      aiMeta: msg?.aiMeta || null,
    }))
    .filter((msg) => msg.text);
}

function detectIntentFromText(text) {
  const normalized = String(text || '').toLowerCase();
  if (/(order|commande|nheb|n7eb|je veux|buy)/.test(normalized)) return 'order';
  if (/(price|prix|combien|qdach|ch7al)/.test(normalized)) return 'price';
  if (/(delivery|livraison|shipping|tawsil)/.test(normalized)) return 'delivery';
  if (/(stock|available|disponible|mawjoud)/.test(normalized)) return 'stock';
  if (/(payment|paiement|cod|cash|carte)/.test(normalized)) return 'payment';
  if (/(complaint|problem|probleme|late|retard|refund|rembourse)/.test(normalized)) return 'complaint';
  if (/(support|help|aide|sav)/.test(normalized)) return 'support';
  if (/(hello|bonjour|salam|hi)/.test(normalized)) return 'greeting';
  return 'unknown';
}

function detectOutcome({ customerMessages, agentMessages }) {
  const joinedCustomer = customerMessages.join(' ').toLowerCase();
  if (/(complaint|problem|probleme|late|retard|refund|rembourse|angry|colere)/.test(joinedCustomer)) {
    return 'complaint';
  }
  if (/(support|help|aide|sav)/.test(joinedCustomer)) {
    return 'support_request';
  }
  const hasOrderSignals = /(order|commande|nheb|buy|je veux)/.test(joinedCustomer);
  const hasRegisteredSignal = agentMessages.some((msg) =>
    /(request registered|demande est enregistree|طلبك تسجل|ready_to_create_order|ai_order_id)/i.test(
      `${msg.text} ${JSON.stringify(msg.aiMeta || {})}`
    )
  );
  if (hasOrderSignals && hasRegisteredSignal) {
    return 'ordered';
  }
  if (hasOrderSignals) {
    return 'interested_no_order';
  }
  return 'unknown';
}

function detectSentiment(customerMessages) {
  const joined = customerMessages.join(' ').toLowerCase();
  if (/(great|merci|thanks|excellent|parfait|bravo|يعطيك الصحة)/.test(joined)) return 'positive';
  if (/(angry|mad|terrible|bad|scam|arnaque|colere|z3fane|خايب)/.test(joined)) return 'negative';
  return 'neutral';
}

function extractObjections(customerMessages) {
  const objections = [];
  for (const message of customerMessages) {
    for (const rule of OBJECTION_MAP) {
      if (!rule.pattern.test(message)) continue;
      objections.push(`${rule.type}: ${asLine(message, 180)}`);
    }
  }
  return normalizeStringArray(objections, 8);
}

function extractQuestions(customerMessages) {
  const questions = customerMessages.filter((line) => QUESTION_PATTERN.test(line));
  return normalizeStringArray(questions.map((line) => asLine(line, 180)), 8);
}

function extractUsefulReplies(agentMessages) {
  const useful = agentMessages
    .map((msg) => msg.text)
    .filter((text) => text && text.length <= 220 && !RUDE_PATTERN.test(text))
    .filter((text) => !/\{\{.+\}\}/.test(text))
    .filter((text) => !/(guaranteed|100% sure|instant refund)/i.test(text));
  return normalizeStringArray(useful, 6);
}

function extractBadReplies(agentMessages) {
  const bad = agentMessages
    .map((msg) => msg.text)
    .filter((text) => RUDE_PATTERN.test(text) || text.length > 320 || /\{\{.+\}\}/.test(text));
  return normalizeStringArray(bad, 6);
}

function extractRiskFacts(conversationText) {
  const lines = String(conversationText || '')
    .split('\n')
    .map((line) => asLine(line, 220))
    .filter(Boolean);
  return normalizeStringArray(lines.filter((line) => RISK_FACT_PATTERN.test(line)), 8);
}

function buildFallbackProposedKnowledge({
  questions,
  objections,
  usefulReplies,
  orderOutcome,
}) {
  const proposed = [];
  for (const question of questions.slice(0, 3)) {
    proposed.push({
      type: 'faq',
      question_or_pattern: question,
      suggested_answer: '',
      confidence: 0.68,
    });
  }
  for (const objection of objections.slice(0, 3)) {
    proposed.push({
      type: 'objection_handling',
      question_or_pattern: objection,
      suggested_answer: '',
      confidence: 0.66,
    });
  }
  for (const reply of usefulReplies.slice(0, 2)) {
    proposed.push({
      type: 'template',
      question_or_pattern: 'Reusable short sales-safe reply pattern',
      suggested_answer: reply,
      confidence: orderOutcome === 'ordered' ? 0.82 : 0.6,
    });
  }
  if (orderOutcome === 'complaint' || orderOutcome === 'support_request') {
    proposed.push({
      type: 'escalation_pattern',
      question_or_pattern: 'Sensitive customer issue should be escalated to human.',
      suggested_answer: 'Escalate politely and confirm human follow-up quickly.',
      confidence: 0.85,
    });
  }
  return proposed.slice(0, 8);
}

function fallbackAnalyzeConversation({ conversation, preferredLanguage = 'fr' }) {
  const conversationText = conversationToText(conversation);
  const customerMessages = getCustomerMessages(conversation);
  const agentMessages = getAgentMessages(conversation);
  const mainQuestions = extractQuestions(customerMessages);
  const mainObjections = extractObjections(customerMessages);
  const usefulReplies = extractUsefulReplies(agentMessages);
  const badReplies = extractBadReplies(agentMessages);
  const orderOutcome = detectOutcome({ customerMessages, agentMessages });
  const proposedKnowledge = buildFallbackProposedKnowledge({
    questions: mainQuestions,
    objections: mainObjections,
    usefulReplies,
    orderOutcome,
  });

  const dominantIntent = detectIntentFromText(customerMessages.join(' '));

  return {
    language: detectLanguage(conversationText, preferredLanguage),
    customer_intent: dominantIntent,
    customer_sentiment: detectSentiment(customerMessages),
    order_outcome: orderOutcome,
    main_questions: mainQuestions,
    main_objections: mainObjections,
    useful_agent_replies: usefulReplies,
    bad_agent_replies: badReplies,
    facts_mentioned_requiring_verification: extractRiskFacts(conversationText),
    proposed_knowledge: proposedKnowledge,
  };
}

function sanitizeAnalyzerPayload(payload, fallbackPayload) {
  if (!payload || typeof payload !== 'object') {
    return fallbackPayload;
  }
  const proposed = Array.isArray(payload.proposed_knowledge) ? payload.proposed_knowledge : [];

  return {
    language: detectLanguage(payload.language || fallbackPayload.language, fallbackPayload.language),
    customer_intent: asLine(payload.customer_intent || fallbackPayload.customer_intent || 'unknown', 80) || 'unknown',
    customer_sentiment: normalizeSentiment(payload.customer_sentiment, fallbackPayload.customer_sentiment),
    order_outcome: normalizeOutcome(payload.order_outcome, fallbackPayload.order_outcome),
    main_questions: normalizeStringArray(payload.main_questions, 10),
    main_objections: normalizeStringArray(payload.main_objections, 10),
    useful_agent_replies: normalizeStringArray(payload.useful_agent_replies, 10),
    bad_agent_replies: normalizeStringArray(payload.bad_agent_replies, 10),
    facts_mentioned_requiring_verification: normalizeStringArray(payload.facts_mentioned_requiring_verification, 10),
    proposed_knowledge: proposed
      .map((entry) => ({
        type: normalizeKnowledgeType(entry?.type),
        question_or_pattern: asLine(entry?.question_or_pattern || '', 220),
        suggested_answer: asLine(entry?.suggested_answer || '', 220),
        confidence: clampConfidence(entry?.confidence, 0.6),
      }))
      .filter((entry) => entry.question_or_pattern),
  };
}

function fallbackWinningReplies({ analysis }) {
  const rows = (analysis?.useful_agent_replies || []).slice(0, 5).map((reply) => ({
    customer_situation: asLine(analysis?.customer_intent || 'general customer question', 120),
    recommended_reply: reply,
    why_it_worked: 'Clear, short, polite, and moves to next step.',
  }));
  return {
    winning_reply_patterns: rows,
  };
}

function sanitizeWinningReplies(payload, fallbackPayload) {
  if (!payload || typeof payload !== 'object') {
    return fallbackPayload;
  }
  const rows = Array.isArray(payload.winning_reply_patterns) ? payload.winning_reply_patterns : [];
  const normalized = rows
    .map((row) => ({
      customer_situation: asLine(row?.customer_situation || '', 160),
      recommended_reply: asLine(row?.recommended_reply || '', 220),
      why_it_worked: asLine(row?.why_it_worked || '', 180),
    }))
    .filter((row) => row.customer_situation && row.recommended_reply && row.why_it_worked);
  return {
    winning_reply_patterns: normalized.length ? normalized : fallbackPayload.winning_reply_patterns,
  };
}

function fallbackObjectionLearning({ analysis }) {
  const rows = (analysis?.main_objections || []).slice(0, 6).map((objection) => ({
    type: asLine(objection.split(':')[0] || 'wants reassurance', 80),
    customer_words: asLine(objection, 180),
    recommended_response: '',
    needs_human_review: true,
  }));
  return {
    objections: rows,
  };
}

function sanitizeObjections(payload, fallbackPayload) {
  if (!payload || typeof payload !== 'object') {
    return fallbackPayload;
  }
  const rows = Array.isArray(payload.objections) ? payload.objections : [];
  const normalized = rows
    .map((row) => ({
      type: asLine(row?.type || '', 80),
      customer_words: asLine(row?.customer_words || '', 180),
      recommended_response: asLine(row?.recommended_response || '', 220),
      needs_human_review: Boolean(row?.needs_human_review),
    }))
    .filter((row) => row.type && row.customer_words);
  return {
    objections: normalized.length ? normalized : fallbackPayload.objections,
  };
}

function fallbackFaqLearning({ analysis }) {
  const rows = (analysis?.main_questions || []).slice(0, 6).map((question) => ({
    question,
    suggested_answer: '',
    must_be_verified: true,
    category: normalizeFaqCategory(detectIntentFromText(question), 'product_details'),
  }));
  return {
    faq_candidates: rows,
  };
}

function sanitizeFaq(payload, fallbackPayload) {
  if (!payload || typeof payload !== 'object') {
    return fallbackPayload;
  }
  const rows = Array.isArray(payload.faq_candidates) ? payload.faq_candidates : [];
  const normalized = rows
    .map((row) => ({
      question: asLine(row?.question || '', 180),
      suggested_answer: asLine(row?.suggested_answer || '', 220),
      must_be_verified: typeof row?.must_be_verified === 'boolean' ? row.must_be_verified : true,
      category: normalizeFaqCategory(row?.category, 'product_details'),
    }))
    .filter((row) => row.question);
  return {
    faq_candidates: normalized.length ? normalized : fallbackPayload.faq_candidates,
  };
}

async function callAnalyzerAi({ env, preferredLanguage = 'fr', conversationText = '' }) {
  const prompt = buildPromptTemplate('conversation.analyzer.main', {
    preferredLanguage,
    conversationText,
  });
  const result = await callAiText({
    env,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    temperature: 0.1,
  });
  return extractJsonObject(result.text);
}

async function callWinningRepliesAi({ env, conversationText = '' }) {
  const prompt = buildPromptTemplate('conversation.analyzer.winning-replies', {
    conversationText,
  });
  const result = await callAiText({
    env,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    temperature: 0.1,
  });
  return extractJsonObject(result.text);
}

async function callObjectionsAi({ env, conversationText = '' }) {
  const prompt = buildPromptTemplate('conversation.analyzer.objections', {
    conversationText,
  });
  const result = await callAiText({
    env,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    temperature: 0.1,
  });
  return extractJsonObject(result.text);
}

async function callFaqAi({ env, conversationText = '' }) {
  const prompt = buildPromptTemplate('conversation.analyzer.faq', {
    conversationText,
  });
  const result = await callAiText({
    env,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    temperature: 0.1,
  });
  return extractJsonObject(result.text);
}

export function createConversationAnalyzerService({ env }) {
  async function analyzeConversation({ conversation, preferredLanguage = 'fr' }) {
    if (!conversation || typeof conversation !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'conversation is required');
    }
    const conversationText = conversationToText(conversation);
    if (!conversationText) {
      throw new AppError(400, 'VALIDATION_ERROR', 'conversation must include messages');
    }

    const fallback = fallbackAnalyzeConversation({
      conversation,
      preferredLanguage,
    });

    let analysis = fallback;
    if (canAttemptAi(env)) {
      try {
        const aiPayload = await callAnalyzerAi({
          env,
          preferredLanguage,
          conversationText,
        });
        analysis = sanitizeAnalyzerPayload(aiPayload, fallback);
      } catch (_error) {
        analysis = fallback;
      }
    }

    const fallbackWinning = fallbackWinningReplies({ analysis });
    const fallbackObjections = fallbackObjectionLearning({ analysis });
    const fallbackFaq = fallbackFaqLearning({ analysis });

    let winning = fallbackWinning;
    let objections = fallbackObjections;
    let faq = fallbackFaq;

    if (canAttemptAi(env)) {
      try {
        const winningAi = await callWinningRepliesAi({ env, conversationText });
        winning = sanitizeWinningReplies(winningAi, fallbackWinning);
      } catch (_error) {
        winning = fallbackWinning;
      }
      try {
        const objectionsAi = await callObjectionsAi({ env, conversationText });
        objections = sanitizeObjections(objectionsAi, fallbackObjections);
      } catch (_error) {
        objections = fallbackObjections;
      }
      try {
        const faqAi = await callFaqAi({ env, conversationText });
        faq = sanitizeFaq(faqAi, fallbackFaq);
      } catch (_error) {
        faq = fallbackFaq;
      }
    }

    return {
      ...analysis,
      winning_reply_patterns: winning.winning_reply_patterns,
      objections: objections.objections,
      faq_candidates: faq.faq_candidates,
      analyzed_at: new Date().toISOString(),
    };
  }

  return {
    analyzeConversation,
  };
}

