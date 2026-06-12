import { AppError } from '../core/errors.mjs';
import { callAiText, canAttemptAi } from './ai-provider-service.mjs';
import { extractJsonObject } from './ai-json-utils.mjs';
import { buildPromptTemplate } from './prompt-registry.mjs';

const SUPPORTED_LANGUAGES = ['fr', 'ar', 'en'];
const SUPPORTED_INTENTS = [
  'order',
  'product_question',
  'price_question',
  'availability',
  'delivery',
  'complaint',
  'support',
  'lead',
  'spam',
  'unknown',
];
const SUPPORTED_SENTIMENTS = ['positive', 'neutral', 'negative'];
const SUPPORTED_ACTIONS = [
  'create_order',
  'collect_customer_info',
  'share_product_info',
  'offer_alternative',
  'escalate',
  'ask_clarification',
];
const ORDER_REQUIRED_FIELDS = ['product', 'quantity', 'full_name', 'phone', 'address'];
const ORDER_EXTRACTION_STATUSES = ['confirmed', 'not_confirmed', 'needs_review'];
const MAX_RECOMMENDED_PRODUCTS = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const TUNISIA_CITIES = [
  'tunis',
  'sfax',
  'sousse',
  'ariana',
  'ben arous',
  'manouba',
  'nabeul',
  'monastir',
  'mahdia',
  'kairouan',
  'bizerte',
  'gabes',
  'medenine',
  'kasserine',
  'gafsa',
  'tozeur',
  'kebili',
  'beja',
  'jendouba',
  'kef',
  'siliana',
  'zaghouan',
  'tataouine',
  'sidi bouzid',
];
const FIXED_RULE_INTENTS = new Set(['price_question', 'availability', 'order', 'delivery', 'complaint']);
const DIALECT_LATIN_PATTERN =
  /\b(nheb|n7eb|fama|fi tounes|qdach|ch7al|chnowa|barsha|aleh|3lech|najem|mawjoud|tawsil|sahbi|brabi|aya|tawa|mouch|mesh)\b/;
const DIALECT_ARABIC_PATTERN = /(?:\u0634\u0646\u0648|\u0642\u062f\u0627\u0634|\u0646\u062d\u0628|\u0646\u062c\u0645|\u0639\u0633\u0644\u0627\u0645\u0629|\u0628\u0631\u0634\u0627|\u0645\u0648\u062c\u0648\u062f|\u062a\u0648\u0635\u064a\u0644|\u062a\u0648\u0629|\u0645\u0648\u0634)/u;
const FRENCH_HINT_PATTERN =
  /(bonjour|bonsoir|salut|prix|livraison|disponible|commande|produit|taille|couleur|svp|s il vous plait|merci)/;
const ENGLISH_HINT_PATTERN = /(hello|hi|price|delivery|available|order|product|thank you|thanks)/;
const REFUND_SIGNAL_PATTERN =
  /(?:refund|refunded|remboursement|rembourser|retour|retourner|money back|chargeback|\u0627\u0633\u062a\u0631\u062c\u0627\u0639|\u0631\u062c\u0648\u0639)/;
const ANGRY_SIGNAL_PATTERN =
  /(?:angry|furious|upset|mad|not happy|very bad|bad service|terrible|scam|arnaque|nul|mauvais|colere|en colere|pas content|\u063a\u0627\u0636\u0628|\u0632\u0639\u0641\u0627\u0646|\u062e\u0627\u064a\u0628)/;
const COMPLAINT_RISK_PATTERN =
  /(?:late delivery|retard|wrong product|mauvais produit|never arrived|didnt arrive|probleme commande|support nul|sav nul|problem|probleme|issue|\u0645\u0634\u0643\u0644|\u0634\u0643\u0627\u064a\u0629)/;
const SHORT_REPLIES = {
  fr: {
    greeting: 'Bonsoir. Bienvenue, comment je peux vous aider ?',
    price: 'Le prix est {{price}}. Vous voulez que je vous aide a passer la commande ?',
    availability: 'Oui, disponible actuellement. Vous voulez commander ?',
    delivery: 'Livraison sur toute la Tunisie. Le delai exact est confirme selon votre ville.',
    order:
      'Parfait. Pour enregistrer votre demande, envoyez: nom et prenom, telephone, produit (couleur/taille si disponible), quantite, ville et adresse.',
    complaint: 'Desole pour la gene. Je transfere votre demande a notre equipe tout de suite.',
  },
  ar: {
    greeting: 'عسلامة، مرحبا بيك. كيفاش نعاونك؟',
    price: 'السوم متاعو {{price}}. تحب نعاونك تسجل الطلب؟',
    availability: 'اي نعم، متوفر حاليا. تحب نبدأولك الطلب؟',
    delivery: 'نوصلو لجميع الولايات في تونس. مدة التوصيل تتأكد حسب الولاية.',
    order:
      'باهي. باش نسجلو طلبك ابعثلي: الاسم واللقب، رقم الهاتف، المنتج (اللون/المقاس إذا موجود)، الكمية، الولاية والعنوان.',
    complaint: 'نعتذر على الإزعاج. باش نحول طلبك للفريق متاعنا ويرجعولك في أقرب وقت.',
  },
  en: {
    greeting: 'Hi. Welcome, how can I help you?',
    price: 'The price is {{price}}. Want me to help you place the order?',
    availability: 'Yes, currently available. Would you like to order?',
    delivery: 'Delivery is available across Tunisia. Exact timing is confirmed based on your city.',
    order:
      'Great. To register your request, please send: full name, phone, product (color/size if any), quantity, city and address.',
    complaint: 'Sorry for the inconvenience. I am transferring your request to our team now.',
  },
};
const LEARNING_TYPES = [
  'common_customer_question',
  'pre_purchase_objection',
  'successful_reply_style',
  'human_reply_template',
  'similar_conversation_pattern',
];
const LEARNING_STATUSES = ['proposed', 'pending_review', 'approved'];
const MAX_LEARNING_CONTEXT_ITEMS = 3;
const MAX_SIMILAR_CONVERSATIONS = 2;
const BUSINESS_SENSITIVE_FACT_PATTERN =
  /(?:\bprice\b|\bprix\b|\bsoum\b|\bdiscount\b|\bpromo\b|\bdelivery fee\b|\bfrais livraison\b|\brefund\b|\brembourse\b|\breturn policy\b|\blegal\b|\bterms\b|\bpolicy\b|\bstock\b|\bin stock\b|\bout of stock\b|\bshipping\b)/;
const TOXIC_OR_RUDE_PATTERN =
  /(?:stupid|idiot|shut up|scammer|arnaqueur|nul|debile|hate you|you are useless|ferme ta bouche|ta gueule|mauvais service de merde)/;
const OBJECTION_PATTERN =
  /(?:too expensive|cher|trop cher|expensive|pas sur|not sure|hesitant|hesite|later|plus tard|not now|pas maintenant|need to think|najem nchouf baad|mouch tawa)/;
const QUESTION_PATTERN =
  /(?:\?|how|what|why|when|combien|prix|disponible|availability|livraison|delivery|chnowa|qdach|ch7al|\u0634\u0646\u0648|\u0642\u062f\u0627\u0634)/;
const SIMILARITY_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'for',
  'is',
  'are',
  'of',
  'de',
  'la',
  'le',
  'les',
  'des',
  'du',
  'et',
  'ou',
  'dans',
  'sur',
  'avec',
  'pour',
  'fi',
  'fel',
  'fil',
  'w',
  'oua',
  'ya',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function asSingleLine(value, maxLength = 280) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isLearningStatus(value) {
  return LEARNING_STATUSES.includes(String(value || '').trim().toLowerCase());
}

function normalizeLearningStatus(value, fallback = 'proposed') {
  const normalized = String(value || '').trim().toLowerCase();
  return isLearningStatus(normalized) ? normalized : fallback;
}

function isLearningType(value) {
  return LEARNING_TYPES.includes(String(value || '').trim().toLowerCase());
}

function normalizeLearningType(value, fallback = 'common_customer_question') {
  const normalized = String(value || '').trim().toLowerCase();
  return isLearningType(normalized) ? normalized : fallback;
}

function isToxicOrLowQuality(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  if (normalized.length < 8) return true;
  if (TOXIC_OR_RUDE_PATTERN.test(normalized)) return true;
  if (/(\?|!|\.|,){4,}/.test(normalized)) return true;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  if (tokenCount >= 5 && new Set(normalized.split(/\s+/).filter(Boolean)).size <= 2) {
    return true;
  }
  return false;
}

function containsSensitiveBusinessFacts(text) {
  const normalized = normalizeText(text);
  return BUSINESS_SENSITIVE_FACT_PATTERN.test(normalized);
}

async function safeList(resourceRepo) {
  if (!resourceRepo || typeof resourceRepo.list !== 'function') {
    return [];
  }
  try {
    const rows = await resourceRepo.list();
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function tokenizeForSimilarity(text) {
  const normalized = normalizeText(text);
  return normalized
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !SIMILARITY_STOP_WORDS.has(token));
}

function scoreTokenOverlap(leftText, rightText) {
  const leftTokens = tokenizeForSimilarity(leftText);
  const rightTokens = tokenizeForSimilarity(rightText);
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token));
  return overlap.length;
}

function findNearestReplyAfter(messages = [], startIndex = -1) {
  for (let index = startIndex + 1; index < messages.length; index += 1) {
    const row = messages[index];
    if (row?.sender !== 'user') continue;
    const text = asSingleLine(row?.text || row?.content || '', 320);
    if (!text || isToxicOrLowQuality(text)) continue;
    return text;
  }
  return '';
}

function selectSimilarConversationPatterns({ customerMessage, conversations = [], maxItems = MAX_SIMILAR_CONVERSATIONS }) {
  const ranked = [];
  for (const conversation of conversations) {
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    let bestScore = 0;
    let bestCustomerText = '';
    let bestReplyText = '';

    for (let index = 0; index < messages.length; index += 1) {
      const row = messages[index];
      if (row?.sender !== 'contact') continue;
      const customerText = asSingleLine(row?.text || row?.content || '', 320);
      if (!customerText || isToxicOrLowQuality(customerText)) continue;

      const score = scoreTokenOverlap(customerMessage, customerText);
      if (score < 2 || score < bestScore) continue;

      const nextReply = findNearestReplyAfter(messages, index);
      if (!nextReply || containsSensitiveBusinessFacts(nextReply)) continue;

      bestScore = score;
      bestCustomerText = customerText;
      bestReplyText = nextReply;
    }

    if (bestScore > 0 && bestCustomerText && bestReplyText) {
      ranked.push({
        score: bestScore,
        customer_example: bestCustomerText,
        reply_example: bestReplyText,
      });
    }
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((row) => ({
      customer_example: row.customer_example,
      reply_example: row.reply_example,
      note: 'Reuse tone and structure only, not facts.',
    }));
}

function buildApprovedLearningContext({
  approvedLearningRows = [],
  approvedTemplateRows = [],
  similarConversations = [],
  language = 'fr',
}) {
  const sameLanguage = approvedLearningRows.filter(
    (row) => !row?.language || String(row.language).toLowerCase() === String(language).toLowerCase()
  );
  const rows = sameLanguage.length ? sameLanguage : approvedLearningRows;
  const templateRowsByLanguage = approvedTemplateRows.filter(
    (row) => !row?.language || String(row.language).toLowerCase() === String(language).toLowerCase()
  );
  const templateRows = templateRowsByLanguage.length ? templateRowsByLanguage : approvedTemplateRows;

  const pick = (type) =>
    rows
      .filter((row) => row.type === type)
      .slice(0, MAX_LEARNING_CONTEXT_ITEMS)
      .map((row) => ({
        summary: asSingleLine(row.summary || row.pattern || '', 220),
        template: asSingleLine(row.template || '', 220),
      }))
      .filter((row) => row.summary || row.template);

  return {
    common_questions: [...pick('common_customer_question'), ...pick('faq')].slice(0, MAX_LEARNING_CONTEXT_ITEMS),
    objections: [...pick('pre_purchase_objection'), ...pick('objection_handling')].slice(0, MAX_LEARNING_CONTEXT_ITEMS),
    successful_styles: [...pick('successful_reply_style'), ...pick('template')].slice(0, MAX_LEARNING_CONTEXT_ITEMS),
    human_templates: [
      ...pick('human_reply_template'),
      ...templateRows.slice(0, MAX_LEARNING_CONTEXT_ITEMS).map((row) => ({
        summary: asSingleLine(row.situation || row.rationale || '', 220),
        template: asSingleLine(row.template || '', 220),
      })),
    ].slice(0, MAX_LEARNING_CONTEXT_ITEMS),
    similar_conversations: similarConversations.slice(0, MAX_SIMILAR_CONVERSATIONS),
  };
}

function learningFingerprint(entry) {
  return [
    normalizeLearningType(entry?.type),
    String(entry?.language || '').trim().toLowerCase(),
    normalizeText(entry?.pattern || entry?.summary || entry?.template || ''),
  ].join('::');
}

function buildLearningProposal({
  type,
  language,
  pattern,
  summary = '',
  template = '',
  customerExample = '',
  replyExample = '',
  metadata = {},
}) {
  const normalizedType = normalizeLearningType(type);
  const cleanedPattern = asSingleLine(pattern, 220);
  const cleanedSummary = asSingleLine(summary || pattern, 220);
  const cleanedTemplate = asSingleLine(template, 220);
  const cleanedCustomerExample = asSingleLine(customerExample, 220);
  const cleanedReplyExample = asSingleLine(replyExample, 220);

  if (!cleanedPattern || isToxicOrLowQuality(cleanedPattern)) {
    return null;
  }

  if (
    ['successful_reply_style', 'human_reply_template', 'similar_conversation_pattern'].includes(normalizedType) &&
    (containsSensitiveBusinessFacts(cleanedTemplate) ||
      containsSensitiveBusinessFacts(cleanedReplyExample) ||
      containsSensitiveBusinessFacts(cleanedSummary))
  ) {
    return null;
  }

  if (isToxicOrLowQuality(cleanedSummary)) {
    return null;
  }

  const timestamp = new Date().toISOString();
  return {
    id: createId('learn'),
    type: normalizedType,
    language: normalizePreferredLanguage(language),
    pattern: cleanedPattern,
    summary: cleanedSummary,
    template: cleanedTemplate,
    customer_example: cleanedCustomerExample,
    reply_example: cleanedReplyExample,
    status: 'proposed',
    evidence_count: 1,
    source: 'conversation_learning',
    scope: 'style_only',
    business_truth: false,
    metadata: {
      ...metadata,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function extractHumanTemplateCandidates(history = [], language = 'fr') {
  if (!Array.isArray(history)) {
    return [];
  }

  const templates = [];
  for (const row of history) {
    if (row?.sender !== 'user') continue;
    if (row?.aiMeta) continue;
    const text = asSingleLine(row?.text || row?.content || '', 220);
    if (!text || isToxicOrLowQuality(text) || containsSensitiveBusinessFacts(text)) continue;
    templates.push(
      buildLearningProposal({
        type: 'human_reply_template',
        language,
        pattern: text,
        summary: 'Human agent template that keeps the discussion clear and polite.',
        template: text,
        replyExample: text,
      })
    );
  }

  return templates.filter(Boolean).slice(-MAX_LEARNING_CONTEXT_ITEMS);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
}

function extractJson(text) {
  return extractJsonObject(text);
}

function normalizePreferredLanguage(preferredLanguage = 'fr') {
  const normalized = String(preferredLanguage || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'fr';
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function detectLanguageProfile(message, preferredLanguage = 'fr') {
  const text = String(message || '').trim();
  const normalizedPreferred = normalizePreferredLanguage(preferredLanguage);
  if (!text) {
    return {
      language: normalizedPreferred,
      language_variant: 'standard',
    };
  }
  const lowered = text.toLowerCase();
  const hasArabicScript = /[\u0600-\u06FF]/.test(text);
  const isTunisianDialect = DIALECT_LATIN_PATTERN.test(lowered) || DIALECT_ARABIC_PATTERN.test(text);
  if (hasArabicScript || isTunisianDialect) {
    return {
      language: 'ar',
      language_variant: isTunisianDialect ? 'tunisian_dialect' : 'standard',
    };
  }
  if (FRENCH_HINT_PATTERN.test(lowered)) {
    return {
      language: 'fr',
      language_variant: 'standard',
    };
  }
  if (ENGLISH_HINT_PATTERN.test(lowered)) {
    return {
      language: 'en',
      language_variant: 'standard',
    };
  }
  return {
    language: normalizedPreferred,
    language_variant: 'standard',
  };
}

function detectLanguage(message, preferredLanguage = 'fr') {
  return detectLanguageProfile(message, preferredLanguage).language;
}

function hasRefundSignals(normalizedMessage) {
  return REFUND_SIGNAL_PATTERN.test(normalizedMessage);
}

function hasAngrySignals(normalizedMessage) {
  return ANGRY_SIGNAL_PATTERN.test(normalizedMessage);
}

function hasComplaintRiskSignals(normalizedMessage) {
  return hasRefundSignals(normalizedMessage) || hasAngrySignals(normalizedMessage) || COMPLAINT_RISK_PATTERN.test(normalizedMessage);
}

function deriveEscalationReason({ intent, sentiment, confidence, normalizedMessage }) {
  if (hasRefundSignals(normalizedMessage)) {
    return 'Refund issue detected; human follow-up is required.';
  }
  if (hasAngrySignals(normalizedMessage)) {
    return 'Angry customer message detected; escalate to human.';
  }
  if (intent === 'complaint') {
    return 'Complaint detected with negative risk; escalation to human is required.';
  }
  if (intent === 'support') {
    return 'Support request detected; human follow-up is required.';
  }
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    return 'Low confidence classification; human review is required.';
  }
  if (sentiment === 'negative' && COMPLAINT_RISK_PATTERN.test(normalizedMessage)) {
    return 'Negative-risk message detected; human follow-up is required.';
  }
  return '';
}

function shouldEscalateToHuman(input) {
  return Boolean(deriveEscalationReason(input));
}

function normalizeIntent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_INTENTS.includes(normalized) ? normalized : 'unknown';
}

function normalizeSentiment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_SENTIMENTS.includes(normalized) ? normalized : 'neutral';
}

function normalizeAction(value, fallback = 'ask_clarification') {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_ACTIONS.includes(normalized) ? normalized : fallback;
}

function clampConfidence(value, fallback = 0.5) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return round(parsed, 2);
}

function normalizeOrderExtractionStatus(value, fallback = 'needs_review') {
  const normalized = String(value || '').trim().toLowerCase();
  return ORDER_EXTRACTION_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeOrderQuantity(value, fallback = 1) {
  const parsed = parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function historyToText(conversationHistory) {
  if (typeof conversationHistory === 'string') {
    return conversationHistory.trim();
  }
  if (Array.isArray(conversationHistory)) {
    return conversationHistory
      .map((row) => {
        const sender = String(row?.sender || row?.role || '').trim();
        const text = String(row?.text || row?.content || '').trim();
        if (!text) return '';
        return sender ? `${sender}: ${text}` : text;
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (conversationHistory && typeof conversationHistory === 'object' && Array.isArray(conversationHistory.messages)) {
    return historyToText(conversationHistory.messages);
  }
  return '';
}

function inferActionFromIntent(intent) {
  switch (intent) {
    case 'order':
      return 'create_order';
    case 'price_question':
    case 'product_question':
    case 'availability':
    case 'delivery':
      return 'share_product_info';
    case 'lead':
      return 'collect_customer_info';
    case 'complaint':
    case 'support':
      return 'escalate';
    case 'spam':
      return 'ask_clarification';
    default:
      return 'ask_clarification';
  }
}

function looksLikeSpam(normalizedMessage) {
  if (/^(https?:\/\/\S+|www\.\S+)$/i.test(normalizedMessage)) {
    return true;
  }
  const compact = normalizedMessage.replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ').trim();
  const tokens = compact.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4 && new Set(tokens).size <= 2) {
    return true;
  }
  return /(https?:\/\/|www\.|bit\.ly|t\.me|crypto|forex|casino|loan|adult|xxx|earn money|quick profit|boost followers|seo service|marketing agency)/.test(
    normalizedMessage
  );
}

function detectIntentByFixedRules(normalizedMessage) {
  if (hasComplaintRiskSignals(normalizedMessage)) {
    return 'complaint';
  }
  if (/(prix|combien|price|cost|qdach|qadeh|qadech|9adeh|9adech|9dach|ch7al|soum|\u0642\u062f\u0627\u0634|\u0627\u0644\u0633\u0648\u0645)/.test(normalizedMessage)) {
    return 'price_question';
  }
  if (/(disponible|availability|available|fama|mawjoud|moujoud|\u0645\u0648\u062c\u0648\u062f|\u0645\u062a\u0648\u0641\u0631)/.test(normalizedMessage)) {
    return 'availability';
  }
  if (/(livraison|delivery|shipping|tawsil|\u062a\u0648\u0635\u064a\u0644)/.test(normalizedMessage)) {
    return 'delivery';
  }
  if (/(je veux|nheb|order|commande|\u0646\u062d\u0628|\u0646\u0637\u0644\u0628|confirm)/.test(normalizedMessage)) {
    return 'order';
  }
  return null;
}

function detectIntentByRules(normalizedMessage) {
  if (looksLikeSpam(normalizedMessage)) return 'spam';
  const fixedRuleIntent = detectIntentByFixedRules(normalizedMessage);
  if (fixedRuleIntent) return fixedRuleIntent;
  if (hasComplaintRiskSignals(normalizedMessage)) {
    return 'complaint';
  }
  if (/(support|aide|help|assist|sav|service client|apres vente|problem|issue|panne|probleme)/.test(normalizedMessage)) {
    return 'support';
  }
  if (/(buy|order|commande|commander|achat|nheb|nheb nechri|je veux|i want|reserve|reserver|reservation|purchase|\u0646\u062d\u0628|\u0646\u0637\u0644\u0628)/.test(normalizedMessage)) {
    return 'order';
  }
  if (/(price|prix|cost|combien|tarif|how much|qdach|qadeh|qadech|9adeh|9adech|9dach|ch7al|soum|\u0642\u062f\u0627\u0634|\u0627\u0644\u0633\u0639\u0631)/.test(normalizedMessage)) {
    return 'price_question';
  }
  if (/(available|availability|disponible|stock|rupture|existe|fama|mawjoud|moujoud|\u0645\u0648\u062c\u0648\u062f|\u0645\u062a\u0648\u0641\u0631)/.test(normalizedMessage)) {
    return 'availability';
  }
  if (/(delivery|shipping|livraison|expedition|dhl|aramex|to tunisia|tunisia|tunisie|fi tounes|\u062a\u0648\u0635\u064a\u0644|\u0634\u062d\u0646)/.test(normalizedMessage)) {
    return 'delivery';
  }
  if (/(product|produit|details|spec|taille|color|couleur|materiau|photo|dimension|\u0642\u064a\u0627\u0633|\u0644\u0648\u0646)/.test(normalizedMessage)) {
    return 'product_question';
  }
  if (/(later|not now|plus tard|pas maintenant|just looking|juste regarder|\u0628\u0639\u062f|\u0645\u0648\u0634 \u062a\u0648\u0629)/.test(normalizedMessage)) {
    return 'lead';
  }
  return 'unknown';
}

function detectSentimentFromIntent(intent, normalizedMessage) {
  if (intent === 'complaint' || hasComplaintRiskSignals(normalizedMessage) || hasAngrySignals(normalizedMessage)) {
    return 'negative';
  }
  if (/(thanks|thank you|merci|great|parfait|awesome|\u0645\u0634\u0643\u0648\u0631|\u064a\u0639\u0637\u064a\u0643 \u0627\u0644\u0635\u062d\u0629)/.test(normalizedMessage)) {
    return 'positive';
  }
  return 'neutral';
}

function isGreetingMessage(normalizedMessage) {
  return /^(bonjour|bonsoir|salut|hello|hi|hey|\u0645\u0631\u062d\u0628\u0627|\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645|salam|slm)\b/.test(
    normalizedMessage
  );
}

function getReplyLibrary(language) {
  return SHORT_REPLIES[language] || SHORT_REPLIES.fr;
}

function detectOrderReadiness(intent, normalizedMessage) {
  if (intent !== 'order') {
    return false;
  }
  if (/^(nheb|je veux|i want|commande|order|reserve|reserver|reservation)\s*$/.test(normalizedMessage)) {
    return false;
  }

  const hasOrderDetails =
    /(produit|product|article|modele|model|taille|color|couleur|sku|ref|quantite|quantity|qte|piece|pcs|adresse|address|phone|tel|numero|\b\d+\b)/.test(
      normalizedMessage
    );
  const tokenCount = normalizedMessage.split(/\s+/).filter(Boolean).length;
  return hasOrderDetails || tokenCount >= 4;
}

function fallbackAnalysisReason({ intent, readyToOrder, needsHuman }) {
  if (intent === 'order') {
    if (readyToOrder) {
      return needsHuman
        ? 'Order intent detected and customer appears ready to convert, but human follow-up is required.'
        : 'Order intent detected and customer appears ready to convert into an order.';
    }
    return needsHuman
      ? 'Order intent detected but missing order details; human follow-up is recommended.'
      : 'Order intent detected but missing product or customer details to convert now.';
  }

  if (intent === 'complaint') {
    return 'Complaint detected with negative risk; escalation to human is required.';
  }
  if (intent === 'support') {
    return 'Support request detected; human follow-up is recommended.';
  }
  if (intent === 'spam') {
    return 'Spam-like or unrelated marketing content detected.';
  }
  if (intent === 'unknown') {
    return 'Intent is unclear; clarification or human review is recommended.';
  }
  return needsHuman
    ? 'Customer request detected but requires human review due to low confidence.'
    : 'Customer intent detected clearly and can be handled automatically.';
}

function cleanCta(value, fallback = '') {
  const cta = String(value || '').trim();
  if (!cta) return fallback;
  return cta.slice(0, 180);
}

function normalizeConversationHistory(history = [], limit = 10) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .slice(-limit)
    .map((turn) => {
      const role =
        turn?.sender === 'user' || turn?.role === 'assistant'
          ? 'assistant'
          : 'customer';
      const content = String(turn?.text || turn?.content || '').trim().slice(0, 320);
      if (!content) return null;
      return `${role}: ${content}`;
    })
    .filter(Boolean);
}

function fallbackCta(language, intent, suggestedAction) {
  if (intent === 'complaint' || intent === 'support') {
    if (language === 'ar') return 'تنجم تبعث رقم الطلب ولا رقم الهاتف باش نتثبتولك بسرعة.';
    if (language === 'en') return 'Please share your order number or phone for quick follow-up.';
    return 'Partagez votre numero de commande ou telephone pour un suivi rapide.';
  }

  if (suggestedAction === 'create_order') {
    if (language === 'ar')
      return 'طلبك تسجل و بش يتم التأكيد عليك. ابعث الاسم واللقب، رقم الهاتف، المنتج، الكمية، الولاية والعنوان.';
    if (language === 'en')
      return 'Your request is registered and our team will confirm shortly. Share full name, phone, product, quantity, city, and address.';
    return 'Votre demande est enregistree et notre equipe va vous confirmer rapidement. Envoyez nom complet, telephone, produit, quantite, ville et adresse.';
  }
  if (suggestedAction === 'offer_alternative') {
    if (language === 'ar') return 'نجم نقترح عليك بديل قريب في نفس الميزانية إذا تحب.';
    if (language === 'en') return 'Would you like a close alternative in the same budget?';
    return 'Vous voulez une alternative proche dans le meme budget ?';
  }
  if (suggestedAction === 'collect_customer_info') {
    if (language === 'ar') return 'ابعتلي المنتج اللي تحب عليه باش نكملك خطوة بخطوة.';
    if (language === 'en') return 'Share the product name and I will guide you step by step.';
    return 'Envoyez le produit qui vous interesse et je vous guide etape par etape.';
  }
  if (suggestedAction === 'share_product_info') {
    if (language === 'ar') return 'تحب نكملك التفاصيل ونسجلو الطلب توة؟';
    if (language === 'en') return 'Would you like me to continue with details and register your request now?';
    return 'Vous voulez que je continue avec les details et enregistrer votre demande maintenant ?';
  }
  if (language === 'ar') return 'تحب نعاونك بالخطوة الجاية؟';
  if (language === 'en') return 'Would you like to proceed with one quick next step?';
  return 'Vous voulez avancer avec une etape rapide ?';
}

function asNonEmpty(value) {
  const text = String(value || '').trim();
  return text || '';
}

function normalizeMissingFields(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = input
    .map((item) => String(item || '').trim().toLowerCase())
    .map((field) => (field === 'full name' ? 'full_name' : field))
    .map((field) => (field === 'address_city' ? 'address' : field))
    .filter((field) => ORDER_REQUIRED_FIELDS.includes(field));
  return [...new Set(normalized)];
}

function detectQuantity(message) {
  const text = String(message || '');
  const direct =
    text.match(/\b(?:qty|qte|quantite|quantity)\s*[:\-]?\s*(\d{1,3})\b/i) ||
    text.match(/\b(\d{1,3})\s*(?:x|pcs?|pieces?|pieces|unites?|units?)\b/i);
  if (direct) return direct[1];
  return '';
}

function detectPhone(message) {
  const text = String(message || '');
  const match = text.match(/(?:\+216[\s-]?)?\b(\d{8})\b/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function detectAddress(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  if (
    /\b(rue|street|avenue|av\.|bloc|immeuble|cite|quartier|ville|city|tunis|sfax|sousse|ariana|monastir|nabeul)\b/i.test(
      text
    )
  ) {
    return text.slice(0, 120);
  }
  return '';
}

function buildLeadCapturePayload({ message, intent, confidence, language }) {
  const normalizedIntent = normalizeIntent(intent);
  if (!['lead', 'order', 'product_question', 'price_question', 'availability'].includes(normalizedIntent)) {
    return null;
  }
  const phone = detectPhone(message);
  const name = extractCustomerNameFromText(message);
  const city = extractCityFromText(message);
  const product = extractProductFromText(message);
  const score = clampConfidence(confidence, 0.52);
  const qualification = score >= 0.78 ? 'hot' : score >= 0.62 ? 'warm' : 'cold';
  return {
    score,
    qualification,
    language: normalizePreferredLanguage(language),
    name,
    phone,
    city,
    product_interest: product,
  };
}

function computeMissingOrderFields({
  product = '',
  quantity = 1,
  customerName = '',
  phone = '',
  address = '',
  city = '',
}) {
  const normalized = {
    product: asNonEmpty(product),
    quantity: normalizeOrderQuantity(quantity, 1) > 0 ? String(normalizeOrderQuantity(quantity, 1)) : '',
    full_name: asNonEmpty(customerName),
    phone: asNonEmpty(phone),
    address: asNonEmpty(address || city),
  };
  return ORDER_REQUIRED_FIELDS.filter((field) => !asNonEmpty(normalized[field]));
}

function buildOrderFollowUpQuestion({ language, missingFields = [] }) {
  if (!Array.isArray(missingFields) || missingFields.length === 0) {
    return '';
  }
  const labels = missingFields.map((field) => toOrderFieldLabel(field, language)).join(', ');
  if (language === 'ar') {
    return `باش نكمل تسجيل الطلب، ابعثلي فقط: ${labels}.`;
  }
  if (language === 'en') {
    return `To continue, please share only: ${labels}.`;
  }
  return `Pour continuer, envoyez seulement: ${labels}.`;
}

function extractCityFromText(message) {
  const normalized = normalizeText(message);
  if (!normalized) return '';
  for (const city of TUNISIA_CITIES) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)) {
      return city
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
  }
  return '';
}

function extractCustomerNameFromText(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  const patterns = [
    /\b(?:my name is|i am|je m'appelle|je suis|ismi|ana)\s+([A-Za-z][A-Za-z\s'-]{2,40})/i,
    /\bname\s*[:\-]\s*([A-Za-z][A-Za-z\s'-]{2,40})/i,
    /\bnom\s*[:\-]\s*([A-Za-z][A-Za-z\s'-]{2,40})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s{2,}/g, ' ');
    }
  }
  return '';
}

function extractProductFromText(message) {
  const text = String(message || '').trim();
  if (!text) return '';

  const quoted = text.match(/["'`]\s*([^"'`]{2,80})\s*["'`]/);
  if (quoted?.[1] && !/(address|phone|note|city)/i.test(quoted[1])) {
    return quoted[1].trim();
  }

  const orderPattern =
    /\b(?:order|commande|commander|acheter|nheb|je veux|i want)\b[\s:,-]*(?:le|la|the)?\s*([A-Za-z0-9][A-Za-z0-9\s\-_]{2,80})/i;
  const orderMatch = text.match(orderPattern);
  if (orderMatch?.[1]) {
    return orderMatch[1].trim().replace(/[.,;!?]+$/, '');
  }

  return '';
}

function extractVariantFromText(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  const variantMatch =
    text.match(/\b(?:size|taille|pointure|color|couleur|variant|version)\s*[:\-]?\s*([A-Za-z0-9\-\/ ]{1,40})/i) ||
    text.match(/\b(?:xl|l|m|s|xxl|36|37|38|39|40|41|42|43|44|45)\b/i);
  if (!variantMatch) return '';
  return String(variantMatch[1] || variantMatch[0] || '')
    .trim()
    .replace(/[.,;!?]+$/, '');
}

function extractNotesFromText(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  const noteMatch = text.match(/\b(?:note|remark|remarque|message)\s*[:\-]\s*([^\n]{2,140})/i);
  return noteMatch?.[1] ? noteMatch[1].trim() : '';
}

function fallbackExtractOrderInformation(conversationHistory) {
  const conversationText = historyToText(conversationHistory);
  const normalizedConversation = normalizeText(conversationText);
  const detectedIntent = detectIntentByRules(normalizedConversation);
  const language = detectLanguage(conversationText, 'fr');
  const customerName = extractCustomerNameFromText(conversationText);
  const phone = detectPhone(conversationText);
  const product = extractProductFromText(conversationText);
  const variant = extractVariantFromText(conversationText);
  const quantity = normalizeOrderQuantity(detectQuantity(conversationText), 1);
  const address = detectAddress(conversationText);
  const city = extractCityFromText(conversationText);
  const notes = extractNotesFromText(conversationText);

  let status = 'needs_review';
  if (detectedIntent !== 'order') {
    status = 'not_confirmed';
  } else if (product && phone && (address || city)) {
    status = 'confirmed';
  } else {
    status = 'needs_review';
  }

  let confidence = 0.62;
  if (status === 'confirmed') confidence = 0.86;
  if (status === 'not_confirmed') confidence = 0.34;
  if (!product) confidence -= 0.16;
  if (!phone) confidence -= 0.12;
  if (!(address || city)) confidence -= 0.1;
  if (quantity <= 0) confidence -= 0.1;
  confidence = clampConfidence(confidence, 0.4);
  const readyToConfirm = status === 'confirmed';
  const missingFields = computeMissingOrderFields({
    product,
    quantity,
    customerName,
    phone,
    address,
    city,
  });

  return {
    status,
    customer_name: customerName,
    phone,
    product,
    variant,
    quantity: quantity > 0 ? quantity : 1,
    address,
    city,
    notes,
    confidence,
    ready_to_confirm: readyToConfirm,
    missing_fields: missingFields,
    follow_up_question: buildOrderFollowUpQuestion({
      language,
      missingFields,
    }),
  };
}

function buildKnownOrderInfo({ customerMessage, productInfo, customerInfo }) {
  const known = {
    product: asNonEmpty(productInfo?.name || productInfo?.product || ''),
    quantity: asNonEmpty(customerInfo?.quantity || detectQuantity(customerMessage)),
    full_name: asNonEmpty(customerInfo?.full_name || customerInfo?.name || customerInfo?.contact || ''),
    phone: asNonEmpty(customerInfo?.phone || detectPhone(customerMessage)),
    address: asNonEmpty(customerInfo?.address || customerInfo?.city || detectAddress(customerMessage)),
    note: asNonEmpty(customerInfo?.note || ''),
  };

  if (/^(customer|client|contact)$/i.test(known.full_name)) {
    known.full_name = '';
  }
  return known;
}

function mergeKnownOrderInfo(baseKnownInfo = {}, extractedOrderInfo = {}) {
  const merged = {
    ...baseKnownInfo,
  };

  const extractedProduct = asNonEmpty(extractedOrderInfo?.product);
  if (extractedProduct) merged.product = extractedProduct;

  const extractedQuantity = normalizeOrderQuantity(extractedOrderInfo?.quantity, 1);
  if (extractedQuantity > 0) merged.quantity = String(extractedQuantity);

  const extractedName = asNonEmpty(extractedOrderInfo?.customer_name);
  if (extractedName) merged.full_name = extractedName;

  const extractedPhone = asNonEmpty(extractedOrderInfo?.phone);
  if (extractedPhone) merged.phone = extractedPhone;

  const extractedAddress = asNonEmpty(extractedOrderInfo?.address || extractedOrderInfo?.city);
  if (extractedAddress) merged.address = extractedAddress;

  const extractedNote = asNonEmpty(extractedOrderInfo?.notes);
  if (extractedNote) merged.note = extractedNote;

  return merged;
}

function toOrderFieldLabel(field, language) {
  if (language === 'ar') {
    if (field === 'product') return 'المنتج';
    if (field === 'quantity') return 'الكمية';
    if (field === 'full_name') return 'الاسم واللقب';
    if (field === 'phone') return 'رقم الهاتف';
    if (field === 'address') return 'الولاية والعنوان';
    return field;
  }
  if (language === 'en') {
    if (field === 'full_name') return 'full name';
    if (field === 'address') return 'address/city';
    return field;
  }
  if (field === 'product') return 'produit';
  if (field === 'quantity') return 'quantite';
  if (field === 'full_name') return 'nom complet';
  if (field === 'phone') return 'telephone';
  if (field === 'address') return 'adresse / ville';
  return field;
}

function fallbackOrderConfirmation({ language, knownOrderInfo }) {
  const missingFields = ORDER_REQUIRED_FIELDS.filter((field) => !asNonEmpty(knownOrderInfo?.[field]));
  const readyToCreateOrder = missingFields.length === 0;

  if (readyToCreateOrder) {
    if (language === 'ar') {
      return {
        reply: 'مريقل. طلبك تسجل و بش يتم التأكيد عليك في أقرب وقت.',
        missing_fields: [],
        ready_to_create_order: true,
      };
    }
    if (language === 'en') {
      return {
        reply: 'Perfect. Your request is registered and our team will confirm this for you shortly.',
        missing_fields: [],
        ready_to_create_order: true,
      };
    }
    return {
      reply: 'Parfait. Votre demande est enregistree, notre equipe va vous confirmer rapidement.',
      missing_fields: [],
      ready_to_create_order: true,
    };
  }

  const labels = missingFields.map((field) => toOrderFieldLabel(field, language)).join(', ');
  if (language === 'ar') {
    return {
      reply: `باش نكمل تسجيل الطلب ابعثلي فقط: ${labels}.`,
      missing_fields: missingFields,
      ready_to_create_order: false,
    };
  }
  if (language === 'en') {
    return {
      reply: `To complete your request, please share only: ${labels}.`,
      missing_fields: missingFields,
      ready_to_create_order: false,
    };
  }
  return {
    reply: `Pour finaliser votre demande, envoyez seulement: ${labels}.`,
    missing_fields: missingFields,
    ready_to_create_order: false,
  };
}

function looksLikeFinalOrderConfirmation(reply) {
  const text = String(reply || '').toLowerCase();
  return /i confirm your order|order confirmed|je confirme votre commande|commande confirmee|تم تاكيد طلبك|تم تأكيد طلبك|طلبك مؤكد/.test(
    text
  );
}

function sanitizeOrderConfirmationPayload(aiPayload, fallbackPayload) {
  if (!aiPayload || typeof aiPayload !== 'object') {
    return fallbackPayload;
  }
  let reply = asNonEmpty(aiPayload.reply) || fallbackPayload.reply;
  const missingFields = normalizeMissingFields(aiPayload.missing_fields);
  const readyFromMissing = missingFields.length === 0;
  const readyToCreateOrder =
    typeof aiPayload.ready_to_create_order === 'boolean' ? aiPayload.ready_to_create_order && readyFromMissing : readyFromMissing;
  if (looksLikeFinalOrderConfirmation(reply)) {
    reply = fallbackPayload.reply;
  }

  return {
    reply,
    missing_fields: readyToCreateOrder ? [] : missingFields,
    ready_to_create_order: readyToCreateOrder,
  };
}

function parseTone(value) {
  const tone = String(value || '').trim().toLowerCase();
  if (tone === 'commercial') return 'commercial';
  if (tone === 'amical') return 'amical';
  return 'professionnel';
}

function findProductMatch(message, products = []) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) return null;

  for (const product of products) {
    const name = String(product?.name || '').trim();
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      continue;
    }
    if (normalizedMessage.includes(normalizedName)) {
      return product;
    }
    const significantTokens = normalizedName
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !['avec', 'pour', 'this', 'that'].includes(token));
    if (significantTokens.some((token) => normalizedMessage.includes(token))) {
      return product;
    }
  }

  return null;
}

function buildRecommendationCatalog(products = [], currency = 'TND', limit = 24) {
  return (Array.isArray(products) ? products : [])
    .slice(0, limit)
    .map((product) => ({
      id: product?.id || null,
      name: String(product?.name || '').trim(),
      category: String(product?.category || '').trim(),
      price: toNumber(product?.price),
      currency: String(currency || 'TND'),
      stock: toNumber(product?.stock),
      status: String(product?.status || '').trim(),
      views: toNumber(product?.views),
    }))
    .filter((product) => product.name);
}

function scoreProductForMessage(product, normalizedMessage) {
  let score = 0;
  const name = normalizeText(product?.name || '');
  const category = normalizeText(product?.category || '');
  const stock = toNumber(product?.stock);
  const views = toNumber(product?.views);

  if (name && normalizedMessage.includes(name)) score += 12;
  if (category && normalizedMessage.includes(category)) score += 5;

  const tokens = name.split(/\s+/).filter((token) => token.length >= 4);
  for (const token of tokens) {
    if (normalizedMessage.includes(token)) {
      score += 3;
    }
  }

  if (stock > 0) score += 2;
  score += Math.min(views, 50) / 50;

  return round(score, 2);
}

function normalizeRecommendedProducts(input, catalog = [], fallback = []) {
  const source = Array.isArray(input) ? input : [];
  const normalizedCatalog = buildRecommendationCatalog(catalog).map((item) => item.name);
  const selected = [];

  for (const rawItem of source) {
    const value = String(rawItem || '').trim();
    if (!value) continue;

    const normalizedValue = normalizeText(value);
    const catalogMatch =
      normalizedCatalog.find((name) => normalizeText(name) === normalizedValue) ||
      normalizedCatalog.find((name) => normalizeText(name).includes(normalizedValue)) ||
      normalizedCatalog.find((name) => normalizedValue.includes(normalizeText(name)));
    const resolved = catalogMatch || value;

    if (!selected.includes(resolved)) {
      selected.push(resolved);
    }
    if (selected.length >= MAX_RECOMMENDED_PRODUCTS) break;
  }

  if (selected.length > 0) {
    return selected;
  }
  return Array.isArray(fallback) ? fallback.slice(0, MAX_RECOMMENDED_PRODUCTS) : [];
}

function buildRecommendationReplyText({ language, recommendedProducts = [] }) {
  const selected = (Array.isArray(recommendedProducts) ? recommendedProducts : []).slice(0, MAX_RECOMMENDED_PRODUCTS);
  if (!selected.length) {
    if (language === 'ar') return 'نجم نقترح عليك زوز خيارات باهين، تحب؟';
    if (language === 'en') return 'I have a few good options for your need. Want me to suggest the best 2 now?';
    return 'J ai quelques options adaptees. Vous voulez que je propose les 2 meilleures maintenant ?';
  }

  const names = selected.join(', ');
  if (language === 'ar') {
    return `ننصحك بـ: ${names}. هاذم من أكثر المنتجات المطلوبة حاليا. تحب نسجلو طلبك في واحد منهم؟`;
  }
  if (language === 'en') {
    return `I recommend: ${names}. They match your need and are in high demand now. Want me to register your request for one?`;
  }
  return `Je recommande: ${names}. Ces produits sont tres demandes en ce moment. On enregistre votre demande pour un de ces choix ?`;
}

function fallbackProductRecommendationPayload({
  message,
  language,
  products = [],
  matchedProduct = null,
  currency = 'TND',
}) {
  const catalog = buildRecommendationCatalog(products, currency);
  const normalizedMessage = normalizeText(message);

  const ranked = catalog
    .map((product) => {
      let score = scoreProductForMessage(product, normalizedMessage);
      if (matchedProduct?.id && product.id === matchedProduct.id) {
        score += 20;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || b.product.stock - a.product.stock || b.product.views - a.product.views);

  const recommendedProducts = ranked.slice(0, MAX_RECOMMENDED_PRODUCTS).map((row) => row.product.name);
  return {
    reply: buildRecommendationReplyText({
      language,
      recommendedProducts,
    }),
    recommended_products: recommendedProducts,
  };
}

function deliveryText(language) {
  return getReplyLibrary(language).delivery;
}

function greetingText(language) {
  return getReplyLibrary(language).greeting;
}

function priceText(language, price) {
  const safePrice = String(price || '{{price}}').trim() || '{{price}}';
  if (safePrice === '{{price}}') {
    if (language === 'ar') return 'بالنسبة للسوم، نثبتوهولك حالا من الفريق ونرجعولك بسرعة.';
    if (language === 'en') return 'I will have our team confirm the exact price for you shortly.';
    return 'Pour le prix exact, notre equipe va vous confirmer rapidement.';
  }
  return getReplyLibrary(language).price.replace('{{price}}', safePrice);
}

function availabilityText(language) {
  return getReplyLibrary(language).availability;
}

function unknownText(language) {
  if (language === 'ar') {
    return 'نجم نعاونك في السعر، التوفر، التوصيل ولا تسجيل الطلب. شنوة تحب بالضبط؟';
  }
  if (language === 'en') {
    return 'I can help with price, availability, delivery, or registering an order request. What do you need exactly?';
  }
  return 'Je peux vous aider pour le prix, la disponibilite, la livraison ou la commande. Vous voulez quoi exactement ?';
}

function leadText(language) {
  if (language === 'ar') {
    return 'مفماش مشكل. قولي فقط شنو المنتج اللي يهمك ونكملك التفاصيل.';
  }
  if (language === 'en') {
    return 'No problem. Tell me the product you are interested in and I will guide you quickly.';
  }
  return 'Pas de souci. Dites-moi juste le produit qui vous interesse et je vous guide rapidement.';
}

function orderText(language, tone) {
  return getReplyLibrary(language).order;
}

function complaintText(language) {
  return getReplyLibrary(language).complaint;
}

function supportText(language) {
  if (language === 'ar') {
    return 'أكيد نعاونك. ابعثلي رقم الطلب ولا رقم الهاتف ونوع المشكلة باش نتثبتولك.';
  }
  if (language === 'en') {
    return 'Sure, I can help. Please send your order number or phone and a short description of the issue.';
  }
  return 'Bien sur, je vous aide. Envoyez votre numero de commande ou telephone et un court resume du probleme.';
}

function spamText(language) {
  if (language === 'ar') {
    return 'الرسالة موش واضحة. ابعث طلب واضح على منتج، سعر، توصيل ولا طلب شراء.';
  }
  if (language === 'en') {
    return 'Thanks. For assistance, please send a clear message about a product, price, delivery, or order.';
  }
  return 'Merci. Pour vous aider, envoyez un message clair sur un produit, un prix, une livraison ou une commande.';
}

function productReply({
  language,
  intent,
  product,
  currency,
  normalizedMessage,
  fallbackMessage,
}) {
  if (intent === 'price_question') {
    const numericPrice = toNumber(product?.price, NaN);
    const priceValue = Number.isFinite(numericPrice) ? `${round(numericPrice, 2)} ${currency}` : '{{price}}';
    return priceText(language, priceValue);
  }

  if (intent === 'availability') {
    if (!product) {
      if (language === 'ar') return 'باش نتثبتلك من التوفر حالا و نرجعلك بسرعة.';
      if (language === 'en') return 'I will quickly confirm availability for you and get back right away.';
      return 'Je verifie la disponibilite avec l equipe et je vous confirme rapidement.';
    }
    const stock = toNumber(product.stock, NaN);
    if (Number.isFinite(stock) && stock <= 0) {
      if (language === 'ar') return 'المنتج هذا موش متوفر حاليا. نجم نقترح عليك بديل إذا تحب.';
      if (language === 'en') return 'This product is currently out of stock. I can suggest an alternative if you want.';
      return 'Ce produit n est pas disponible pour le moment. Je peux vous proposer une alternative.';
    }
    if (Number.isFinite(stock) && stock > 0) {
      return availabilityText(language);
    }
    if (language === 'ar') return 'التوفر يتأكد من الفريق حسب اللحظة. نثبتلك و نرجعلك بسرعة.';
    if (language === 'en') return 'Availability is being checked live by our team. I will confirm it for you shortly.';
    return 'La disponibilite se confirme en direct avec notre equipe. Je vous confirme rapidement.';
  }

  if (!product) {
    if (intent === 'product_question') {
      if (language === 'ar') return 'أكيد. ابعثلي اسم المنتج والسؤال بالضبط باش نجاوبك بسرعة.';
      if (language === 'en') return 'Sure. Share the product name and your exact question so I can answer quickly.';
      return 'Bien sur. Donnez le nom du produit et votre question precise pour une reponse rapide.';
    }
    return fallbackMessage;
  }

  const name = String(product.name || 'Produit');
  const price = toNumber(product.price);
  const stock = toNumber(product.stock);
  const inStock = stock > 0;

  if (language === 'ar') {
    return inStock
      ? `${name}: السعر ${price} ${currency}، والتوفر الحالي ${stock} قطعة. شنو التفاصيل اللي تحب تعرفها أكثر؟`
      : `${name}: السعر ${price} ${currency}. حاليا غير متوفر. نجم نقترح بديل بنفس الميزانية.`;
  }
  if (language === 'en') {
    return inStock
      ? `${name}: price ${price} ${currency}, stock ${stock} units. What detail would you like next?`
      : `${name}: price ${price} ${currency}. It is out of stock for now. I can suggest an alternative in the same budget.`;
  }
  return inStock
    ? `${name}: prix ${price} ${currency}, stock ${stock} pieces. Quel detail voulez-vous en plus ?`
    : `${name}: prix ${price} ${currency}. Produit en rupture pour le moment. Je peux proposer une alternative dans le meme budget.`;
}

function fallbackSocialReply({
  message,
  tone,
  preferredLanguage,
  products,
  currency,
  matchedRule,
}) {
  const normalizedMessage = normalizeText(message);
  const languageProfile = detectLanguageProfile(message, preferredLanguage);
  const language = languageProfile.language;
  const intent = detectIntentByRules(normalizedMessage);
  const sentiment = detectSentimentFromIntent(intent, normalizedMessage);
  const matchedProduct = findProductMatch(message, products);
  const greetingOnly = intent === 'unknown' && isGreetingMessage(normalizedMessage);

  let confidence = 0.58;
  let reply = unknownText(language);
  let needsHuman = false;
  let humanReason = '';

  if (greetingOnly) {
    confidence = 0.83;
    reply = greetingText(language);
  } else if (intent === 'order') {
    confidence = 0.9;
    reply = orderText(language, tone);
  } else if (intent === 'price_question' || intent === 'availability' || intent === 'product_question') {
    confidence = matchedProduct ? 0.9 : 0.78;
    reply = productReply({
      language,
      intent,
      product: matchedProduct,
      currency,
      normalizedMessage,
      fallbackMessage: unknownText(language),
    });
  } else if (intent === 'delivery') {
    confidence = 0.88;
    reply = deliveryText(language);
  } else if (intent === 'complaint') {
    confidence = 0.9;
    needsHuman = true;
    humanReason = 'Complaint detected. Human follow-up recommended.';
    reply = complaintText(language);
  } else if (intent === 'support') {
    confidence = 0.8;
    needsHuman = true;
    humanReason = 'Support request needs manual validation.';
    reply = supportText(language);
  } else if (intent === 'lead') {
    confidence = 0.76;
    reply = leadText(language);
  } else if (intent === 'spam') {
    confidence = 0.92;
    reply = spamText(language);
  }

  if (matchedRule?.action && intent === 'unknown') {
    confidence = 0.74;
    if (language === 'ar') {
      reply = `شكرا على رسالتك. نجم نعاونك في الطلب هذا: ${String(matchedRule.action).trim()}.`;
    } else if (language === 'en') {
      reply = `Thanks for your message. I can help with this request: ${String(matchedRule.action).trim()}.`;
    } else {
      reply = `Merci pour votre message. Je peux vous aider sur cette demande: ${String(matchedRule.action).trim()}.`;
    }
  }

  if (intent === 'unknown' && !greetingOnly) {
    confidence = 0.48;
  }

  let suggestedAction =
    intent === 'availability' && matchedProduct && toNumber(matchedProduct.stock) <= 0
      ? 'offer_alternative'
      : inferActionFromIntent(intent);
  if (intent === 'order') {
    suggestedAction = 'collect_customer_info';
  }
  const escalationReason = deriveEscalationReason({
    intent,
    sentiment,
    confidence,
    normalizedMessage,
  });
  const needsHumanEscalation = needsHuman || Boolean(escalationReason);
  if (needsHumanEscalation) {
    suggestedAction = 'escalate';
  }
  const normalizedSuggestedAction = normalizeAction(suggestedAction, needsHumanEscalation ? 'escalate' : 'ask_clarification');
  const cta = fallbackCta(language, intent, normalizedSuggestedAction);
  const leadData = buildLeadCapturePayload({
    message,
    intent,
    confidence,
    language,
  });

  return {
    language,
    language_variant: languageProfile.language_variant,
    intent,
    sentiment,
    confidence,
    reply,
    cta,
    needs_human: needsHumanEscalation || confidence < LOW_CONFIDENCE_THRESHOLD,
    human_reason:
      needsHumanEscalation || confidence < LOW_CONFIDENCE_THRESHOLD
        ? String(humanReason || escalationReason || 'Low confidence. Human review needed.').trim()
        : '',
    suggested_action: normalizedSuggestedAction,
    lead_data: leadData,
  };
}

function enforceEscalationPolicy(payload, normalizedMessage = '') {
  const escalationReason = deriveEscalationReason({
    intent: payload.intent,
    sentiment: payload.sentiment,
    confidence: payload.confidence,
    normalizedMessage,
  });
  const needsHuman = Boolean(payload.needs_human) || Boolean(escalationReason) || payload.confidence < LOW_CONFIDENCE_THRESHOLD;
  const humanReason = needsHuman
    ? String(payload.human_reason || escalationReason || 'Low confidence. Human review needed.').trim()
    : '';
  const suggestedAction = needsHuman ? 'escalate' : normalizeAction(payload.suggested_action, inferActionFromIntent(payload.intent));

  return {
    ...payload,
    needs_human: needsHuman,
    human_reason: humanReason,
    suggested_action: suggestedAction,
  };
}

function normalizeLeadData(aiLeadData, fallbackLeadData, language) {
  const source = aiLeadData && typeof aiLeadData === 'object' ? aiLeadData : fallbackLeadData;
  if (!source || typeof source !== 'object') return null;
  const score = clampConfidence(source.score, fallbackLeadData?.score ?? 0.52);
  const qualification = String(source.qualification || fallbackLeadData?.qualification || 'warm')
    .trim()
    .toLowerCase();
  const safeQualification = qualification === 'hot' || qualification === 'cold' ? qualification : 'warm';
  const name = asNonEmpty(source.name || fallbackLeadData?.name);
  const phone = asNonEmpty(source.phone || fallbackLeadData?.phone);
  const city = asNonEmpty(source.city || fallbackLeadData?.city);
  const productInterest = asNonEmpty(source.product_interest || source.productInterest || fallbackLeadData?.product_interest);
  return {
    score,
    qualification: safeQualification,
    language: normalizePreferredLanguage(source.language || language),
    name,
    phone,
    city,
    product_interest: productInterest,
  };
}

function sanitizeAiPayload(aiPayload, fallbackPayload, context = {}) {
  if (!aiPayload || typeof aiPayload !== 'object') {
    return fallbackPayload;
  }

  const language = SUPPORTED_LANGUAGES.includes(String(aiPayload.language || '').toLowerCase())
    ? String(aiPayload.language || '').toLowerCase()
    : fallbackPayload.language;
  const languageVariant = String(aiPayload.language_variant || aiPayload.languageVariant || fallbackPayload.language_variant || 'standard')
    .trim()
    .toLowerCase();
  const intent = normalizeIntent(aiPayload.intent || fallbackPayload.intent);
  const sentiment = normalizeSentiment(aiPayload.sentiment || fallbackPayload.sentiment);
  const confidence = clampConfidence(aiPayload.confidence, fallbackPayload.confidence);
  const reply = String(aiPayload.reply || '').trim() || fallbackPayload.reply;
  const cta = cleanCta(aiPayload.cta, fallbackPayload.cta || fallbackCta(language, intent, inferActionFromIntent(intent)));
  const needsHuman =
    typeof aiPayload.needs_human === 'boolean'
      ? aiPayload.needs_human
      : typeof aiPayload.needsHuman === 'boolean'
      ? aiPayload.needsHuman
      : fallbackPayload.needs_human;
  const humanReasonRaw = String(
    aiPayload.human_reason || aiPayload.humanReason || (needsHuman ? fallbackPayload.human_reason : '')
  ).trim();
  const suggestedActionRaw = normalizeAction(
    aiPayload.suggested_action || aiPayload.suggestedAction,
    inferActionFromIntent(intent)
  );
  const normalizedMessage = normalizeText(context?.message || '');
  const escalationSafePayload = enforceEscalationPolicy(
    {
      language,
      language_variant: languageVariant,
      intent,
      sentiment,
      confidence,
      reply,
      cta,
      needs_human: needsHuman,
      human_reason: humanReasonRaw,
      suggested_action: suggestedActionRaw,
    },
    normalizedMessage
  );
  const leadData = normalizeLeadData(aiPayload.lead_data || aiPayload.leadData, fallbackPayload.lead_data, language);

  return {
    ...escalationSafePayload,
    lead_data: leadData,
  };
}

function formatLearningContextForPrompt(learningContext = null) {
  if (!learningContext || typeof learningContext !== 'object') {
    return 'Approved learning context: none.';
  }

  const payload = {
    common_questions: Array.isArray(learningContext.common_questions) ? learningContext.common_questions : [],
    objections: Array.isArray(learningContext.objections) ? learningContext.objections : [],
    successful_styles: Array.isArray(learningContext.successful_styles) ? learningContext.successful_styles : [],
    human_templates: Array.isArray(learningContext.human_templates) ? learningContext.human_templates : [],
    similar_conversations: Array.isArray(learningContext.similar_conversations)
      ? learningContext.similar_conversations
      : [],
    policy: 'Style and structure guidance only. Not business truth.',
  };
  return `Approved learning context JSON: ${JSON.stringify(payload)}`;
}

function buildSystemPrompt({ storeName = 'Store' } = {}) {
  return buildPromptTemplate('social.reply.system', {
    storeName,
  }).systemPrompt;
}

function buildPriceAvailabilityUserPrompt({ language, customerMessage, productContext, channel, storeName }) {
  return buildPromptTemplate('social.reply.price-availability-user', {
    language,
    customerMessage,
    productContext,
    channel,
    storeName,
  }).userPrompt;
}

function buildDeliveryUserPrompt({ language, customerMessage, deliveryPolicy, channel, storeName }) {
  return buildPromptTemplate('social.reply.delivery-user', {
    language,
    customerMessage,
    deliveryPolicy,
    channel,
    storeName,
  }).userPrompt;
}

function buildLeadCaptureUserPrompt({ language, customerMessage, channel, storeName }) {
  return buildPromptTemplate('social.reply.lead-capture-user', {
    language,
    customerMessage,
    channel,
    storeName,
  }).userPrompt;
}

function buildUnhappyCustomerSystemPrompt() {
  return buildPromptTemplate('social.unhappy.system').systemPrompt;
}

function buildLowConfidenceFallbackSystemPrompt() {
  return buildPromptTemplate('social.low-confidence.system').systemPrompt;
}

function buildProductRecommendationSystemPrompt() {
  return buildPromptTemplate('social.product-recommendation.system').systemPrompt;
}

function buildSpamHandlingSystemPrompt() {
  return buildPromptTemplate('social.spam.system').systemPrompt;
}

function buildHumanEscalationSystemPrompt() {
  return buildPromptTemplate('social.escalation.system').systemPrompt;
}

function inferIssueTypeForEscalation(payload, customerMessage = '') {
  if (!payload || typeof payload !== 'object') {
    return 'sensitive_issue';
  }
  const normalizedMessage = normalizeText(customerMessage);
  const normalizedReason = normalizeText(payload.human_reason || payload.reason || '');
  const normalizedRiskText = `${normalizedMessage} ${normalizedReason}`.trim();
  if (hasRefundSignals(normalizedRiskText)) return 'refund_issue';
  if (hasAngrySignals(normalizedRiskText)) return 'angry_customer';
  if (payload.intent === 'complaint') return 'complaint';
  if (payload.intent === 'support') return 'support_request';
  if (payload.intent === 'unknown' || payload.confidence < LOW_CONFIDENCE_THRESHOLD) return 'low_confidence';
  return 'sensitive_issue';
}

function buildConversationSummary(history = [], customerMessage = '', maxItems = 5) {
  const turns = normalizeConversationHistory(history, maxItems);
  const latest = String(customerMessage || '').trim();
  if (latest) {
    turns.push(`customer: ${latest.slice(0, 320)}`);
  }
  return turns.join(' | ').slice(0, 1000);
}

function normalizeSpamAction(value, fallback = 'minimal_reply') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'ignore' || normalized === 'minimal_reply' ? normalized : fallback;
}

function fallbackSpamHandlingPayload({ message, language }) {
  const normalizedMessage = normalizeText(message);
  const shouldIgnore =
    /^(https?:\/\/\S+|www\.\S+)$/i.test(normalizedMessage) ||
    /(bit\.ly|t\.me|crypto|forex|casino|adult|xxx|earn money|quick profit|boost followers|seo service|marketing agency)/.test(
      normalizedMessage
    );

  if (shouldIgnore) {
    return {
      is_spam: true,
      reply: '',
      action: 'ignore',
    };
  }

  if (language === 'ar') {
    return {
      is_spam: true,
      reply: 'الرسالة موش واضحة. ابعث طلب مباشر على منتج.',
      action: 'minimal_reply',
    };
  }
  if (language === 'en') {
    return {
      is_spam: true,
      reply: 'Unclear message. Send a direct product request.',
      action: 'minimal_reply',
    };
  }
  return {
    is_spam: true,
    reply: 'Message non clair. Envoyez une demande produit directe.',
    action: 'minimal_reply',
  };
}

function fallbackEscalationPayload({ language, issueType, customerMessage }) {
  const shortIssue = String(issueType || 'sensitive_issue').replace(/_/g, ' ');
  const shortMessage = String(customerMessage || '').trim().slice(0, 220);
  const isRefundIssue = issueType === 'refund_issue';
  const isAngryIssue = issueType === 'angry_customer';
  const isLowConfidence = issueType === 'low_confidence';

  if (language === 'ar') {
    return {
      admin_note: `تصعيد مطلوب: ${shortIssue}. رسالة العميل: ${shortMessage}`,
      customer_reply: isRefundIssue
        ? 'نسمع فيك. باش نحول طلب الاسترجاع للفريق المختص ويرجعولك بسرعة.'
        : isAngryIssue
        ? 'نعتذر على الإزعاج. باش نحول طلبك للفريق ويرجعولك في أقرب وقت.'
        : isLowConfidence
        ? 'باش نحول رسالتك للمكلف باش نجاوبوك بدقة في أقرب وقت.'
        : 'باش نحول طلبك للفريق متاعنا و يجاوبوك في أقرب وقت.',
    };
  }
  if (language === 'en') {
    return {
      admin_note: `Escalation needed: ${shortIssue}. Customer message: ${shortMessage}`,
      customer_reply: isRefundIssue
        ? 'I understand. I am transferring your refund request to our team for priority follow-up.'
        : isAngryIssue
        ? 'I am sorry for the experience. I am escalating this to our team for immediate follow-up.'
        : isLowConfidence
        ? 'I am escalating your message to our team so we can answer you accurately very quickly.'
        : 'I am transferring your request to our team, they will confirm this for you shortly.',
    };
  }
  return {
    admin_note: `Escalade requise: ${shortIssue}. Message client: ${shortMessage}`,
    customer_reply: isRefundIssue
      ? 'Je comprends. Je transfere votre demande de remboursement a l equipe pour un suivi prioritaire.'
      : isAngryIssue
      ? 'Je suis desole pour cette experience. Je transfere votre demande a notre equipe pour un suivi rapide.'
      : isLowConfidence
      ? 'Je transfere votre message a notre equipe pour vous repondre avec precision tres rapidement.'
      : 'Je transfere votre demande a notre equipe, ils vont vous repondre rapidement.',
  };
}

function buildOrderConfirmationSystemPrompt() {
  return buildPromptTemplate('social.order-confirmation.system').systemPrompt;
}

function buildOrderExtractionSystemPrompt() {
  return buildPromptTemplate('social.order-extraction.system').systemPrompt;
}

async function callSocialAi({
  env,
  intent,
  language,
  customerMessage,
  productContext,
  deliveryPolicy,
  channel,
  storeName,
  learningContext,
}) {
  const systemPrompt = buildSystemPrompt({ storeName });
  const normalizedIntent = normalizeIntent(intent);
  const isPriceOrAvailability = normalizedIntent === 'price_question' || normalizedIntent === 'availability';
  const isDelivery = normalizedIntent === 'delivery';
  const isLead = normalizedIntent === 'lead';
  const learningBlock = formatLearningContextForPrompt(learningContext);
  const userPrompt = isPriceOrAvailability
    ? buildPriceAvailabilityUserPrompt({
        language,
        customerMessage,
        productContext,
        channel,
        storeName,
      }) + `\n${learningBlock}`
    : isDelivery
    ? buildDeliveryUserPrompt({
        language,
        customerMessage,
        deliveryPolicy,
        channel,
        storeName,
      }) + `\n${learningBlock}`
    : isLead
    ? buildLeadCaptureUserPrompt({
        language,
        customerMessage,
        channel,
        storeName,
      }) + `\n${learningBlock}`
    : [
        `Store: ${String(storeName || 'Store').trim()}`,
        `Channel: ${String(channel || 'social').trim()}`,
        `Customer language: ${String(language || 'fr')}`,
        `Customer message: ${String(customerMessage || '').trim()}`,
        `Product info: ${JSON.stringify(productContext || null)}`,
        `Delivery policy: ${JSON.stringify(deliveryPolicy || null)}`,
        learningBlock,
        'Never invent unavailable data. If unsure, say team will confirm.',
        'Never claim order confirmation.',
        'Return only the final reply text.',
      ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.15,
  });

  const text = String(result.text || '').trim();
  if (!text) {
    return '';
  }
  const parsed = extractJson(text);
  if (parsed && typeof parsed.reply === 'string') {
    return String(parsed.reply).trim();
  }
  return text;
}

async function callUnhappyCustomerAi({
  env,
  customerMessage,
  language,
  conversationHistory = [],
}) {
  const systemPrompt = buildUnhappyCustomerSystemPrompt();
  const userPrompt = [
    `Customer message: ${String(customerMessage || '').trim()}`,
    `Language: ${String(language || 'fr')}`,
    `Conversation history: ${JSON.stringify(normalizeConversationHistory(conversationHistory))}`,
    'Return valid JSON only:',
    '{',
    '  "reply": "",',
    '  "needs_human": true,',
    '  "human_reason": "complaint or sensitive issue"',
    '}',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed.reply !== 'string') {
    return null;
  }

  const reply = String(parsed.reply || '').trim();
  if (!reply) {
    return null;
  }

  const needsHuman = typeof parsed.needs_human === 'boolean' ? parsed.needs_human : true;
  const humanReason = String(parsed.human_reason || '').trim();

  return {
    reply,
    needs_human: needsHuman,
    human_reason: humanReason || 'complaint or sensitive issue',
  };
}

async function callLowConfidenceFallbackAi({
  env,
  customerMessage,
  language,
}) {
  const systemPrompt = buildLowConfidenceFallbackSystemPrompt();
  const userPrompt = [
    `Customer message: ${String(customerMessage || '').trim()}`,
    `Language: ${String(language || 'fr')}`,
    'Return only the reply text.',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  return String(result.text || '').trim();
}

async function callProductRecommendationAi({
  env,
  customerMessage,
  language,
  productCatalog = [],
  fallbackPayload = null,
}) {
  const systemPrompt = buildProductRecommendationSystemPrompt();
  const userPrompt = [
    `Customer message: ${String(customerMessage || '').trim()}`,
    `Available products: ${JSON.stringify(productCatalog || [])}`,
    `Language: ${String(language || 'fr')}`,
    'Return valid JSON only:',
    '{',
    '  "reply": "",',
    '  "recommended_products": ["", ""]',
    '}',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.15,
  });

  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const fallbackRecommended = Array.isArray(fallbackPayload?.recommended_products)
    ? fallbackPayload.recommended_products
    : [];
  const recommendedProducts = normalizeRecommendedProducts(
    parsed.recommended_products,
    productCatalog,
    fallbackRecommended
  );
  const reply =
    String(parsed.reply || '').trim() ||
    buildRecommendationReplyText({
      language,
      recommendedProducts,
    });

  if (!recommendedProducts.length && !reply) {
    return null;
  }

  return {
    reply,
    recommended_products: recommendedProducts.slice(0, MAX_RECOMMENDED_PRODUCTS),
  };
}

async function callSpamHandlingAi({
  env,
  customerMessage,
  language,
}) {
  const systemPrompt = buildSpamHandlingSystemPrompt();
  const userPrompt = [
    `Message: ${String(customerMessage || '').trim()}`,
    `Language: ${String(language || 'fr')}`,
    'Return valid JSON only:',
    '{',
    '  "is_spam": true,',
    '  "reply": "",',
    '  "action": "ignore|minimal_reply"',
    '}',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const isSpam = typeof parsed.is_spam === 'boolean' ? parsed.is_spam : true;
  const reply = String(parsed.reply || '').trim();
  const action = normalizeSpamAction(parsed.action, 'minimal_reply');

  return {
    is_spam: isSpam,
    reply: action === 'ignore' ? '' : reply,
    action,
  };
}

async function callHumanEscalationAi({
  env,
  customerMessage,
  issueType,
  conversationSummary,
}) {
  const systemPrompt = buildHumanEscalationSystemPrompt();
  const userPrompt = [
    `Customer message: ${String(customerMessage || '').trim()}`,
    `Detected issue: ${String(issueType || 'sensitive_issue').trim()}`,
    `Conversation summary: ${String(conversationSummary || '').trim()}`,
    'Return valid JSON only:',
    '{',
    '  "admin_note": "",',
    '  "customer_reply": ""',
    '}',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const adminNote = String(parsed.admin_note || '').trim();
  const customerReply = String(parsed.customer_reply || '').trim();
  if (!adminNote || !customerReply) {
    return null;
  }

  return {
    admin_note: adminNote,
    customer_reply: customerReply,
  };
}

async function callOrderConfirmationAi({
  env,
  customerMessage,
  language,
  productInfo,
  customerInfo,
  storeName,
}) {
  const systemPrompt = buildOrderConfirmationSystemPrompt();
  const userPrompt = [
    `Store: ${String(storeName || 'Store').trim()}`,
    `Customer message: ${String(customerMessage || '').trim()}`,
    `Language: ${String(language || 'fr')}`,
    `Known product info: ${JSON.stringify(productInfo || {})}`,
    `Known customer info: ${JSON.stringify(customerInfo || {})}`,
    'Return valid JSON only.',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });
  return extractJson(result.text);
}

async function callOrderExtractionAi({
  env,
  conversationHistoryText,
}) {
  const systemPrompt = buildOrderExtractionSystemPrompt();
  const userPrompt = [
    `Conversation: ${String(conversationHistoryText || '').trim()}`,
    'Return valid JSON only.',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.05,
  });

  return extractJson(result.text);
}

function sanitizeOrderExtractionPayload(aiPayload, fallbackPayload, conversationHistory) {
  if (!aiPayload || typeof aiPayload !== 'object') {
    return fallbackPayload;
  }

  const conversationText = historyToText(conversationHistory);
  const normalizedConversation = normalizeText(conversationText);
  const language = detectLanguage(conversationText, 'fr');
  const detectedIntent = detectIntentByRules(normalizedConversation);

  let status = normalizeOrderExtractionStatus(aiPayload.status, fallbackPayload.status);
  const customerName = asNonEmpty(aiPayload.customer_name || aiPayload.customerName || fallbackPayload.customer_name);
  const phone = asNonEmpty(aiPayload.phone || fallbackPayload.phone);
  const product = asNonEmpty(aiPayload.product || fallbackPayload.product);
  const variant = asNonEmpty(aiPayload.variant || fallbackPayload.variant);
  const quantity = normalizeOrderQuantity(aiPayload.quantity, fallbackPayload.quantity || 1);
  const address = asNonEmpty(aiPayload.address || fallbackPayload.address);
  const city = asNonEmpty(aiPayload.city || fallbackPayload.city);
  const notes = asNonEmpty(aiPayload.notes || fallbackPayload.notes);
  let confidence = clampConfidence(aiPayload.confidence, fallbackPayload.confidence);

  if (detectedIntent !== 'order') {
    status = 'not_confirmed';
    confidence = clampConfidence(Math.min(confidence, 0.49), 0.34);
  } else if (status === 'confirmed' && (!product || !phone || !(address || city))) {
    status = 'needs_review';
    confidence = clampConfidence(Math.min(confidence, 0.74), 0.62);
  }
  const inferredReadyToConfirm = status === 'confirmed' && Boolean(product && phone && (address || city));
  const readyToConfirm =
    typeof aiPayload.ready_to_confirm === 'boolean' ? aiPayload.ready_to_confirm && inferredReadyToConfirm : inferredReadyToConfirm;
  const missingFields = computeMissingOrderFields({
    product,
    quantity,
    customerName,
    phone,
    address,
    city,
  });

  return {
    status,
    customer_name: customerName,
    phone,
    product,
    variant,
    quantity,
    address,
    city,
    notes,
    confidence,
    ready_to_confirm: readyToConfirm,
    missing_fields: missingFields,
    follow_up_question: buildOrderFollowUpQuestion({
      language,
      missingFields,
    }),
  };
}

function fallbackMessageAnalysis({ message, preferredLanguage = 'fr' }) {
  const normalizedMessage = normalizeText(message);
  const languageProfile = detectLanguageProfile(message, preferredLanguage);
  const language = languageProfile.language;
  const intent = detectIntentByRules(normalizedMessage);
  const sentiment = detectSentimentFromIntent(intent, normalizedMessage);
  const readyToOrder = detectOrderReadiness(intent, normalizedMessage);

  const baseConfidence = {
    order: readyToOrder ? 0.88 : 0.72,
    price_question: 0.9,
    availability: 0.88,
    delivery: 0.88,
    complaint: 0.93,
    support: 0.82,
    product_question: 0.8,
    lead: 0.74,
    spam: 0.95,
    unknown: 0.44,
  };

  const confidence = clampConfidence(baseConfidence[intent] ?? 0.56, 0.56);
  const escalationReason = deriveEscalationReason({
    intent,
    sentiment,
    confidence,
    normalizedMessage,
  });
  const needsHuman = shouldEscalateToHuman({
    intent,
    sentiment,
    confidence,
    normalizedMessage,
  });
  const reason = fallbackAnalysisReason({
    intent,
    readyToOrder,
    needsHuman,
  });
  const safeReason = escalationReason || reason;

  return {
    language,
    language_variant: languageProfile.language_variant,
    intent,
    sentiment,
    confidence,
    needs_human: needsHuman,
    reason: safeReason,
  };
}

function sanitizeAiMessageAnalysis(aiPayload, fallbackPayload, context = {}) {
  if (!aiPayload || typeof aiPayload !== 'object') {
    return fallbackPayload;
  }

  const language = SUPPORTED_LANGUAGES.includes(String(aiPayload.language || '').toLowerCase())
    ? String(aiPayload.language || '').toLowerCase()
    : fallbackPayload.language;
  const languageVariant = String(aiPayload.language_variant || aiPayload.languageVariant || fallbackPayload.language_variant || 'standard')
    .trim()
    .toLowerCase();
  const aiIntent = normalizeIntent(aiPayload.intent || fallbackPayload.intent);
  const intent = FIXED_RULE_INTENTS.has(fallbackPayload.intent) ? fallbackPayload.intent : aiIntent;
  const sentiment = normalizeSentiment(aiPayload.sentiment || fallbackPayload.sentiment);
  const confidence = clampConfidence(aiPayload.confidence, fallbackPayload.confidence);
  const aiNeedsHuman =
    typeof aiPayload.needs_human === 'boolean'
      ? aiPayload.needs_human
      : typeof aiPayload.needsHuman === 'boolean'
      ? aiPayload.needsHuman
      : fallbackPayload.needs_human;
  const normalizedMessage = normalizeText(context?.message || '');
  const escalationReason = deriveEscalationReason({
    intent,
    sentiment,
    confidence,
    normalizedMessage,
  });
  const needsHuman = aiNeedsHuman || Boolean(escalationReason) || confidence < LOW_CONFIDENCE_THRESHOLD;
  const reason = String(aiPayload.reason || '').trim() || escalationReason || fallbackPayload.reason;

  return {
    language,
    language_variant: languageVariant,
    intent,
    sentiment,
    confidence,
    needs_human: needsHuman,
    reason,
  };
}

function buildAnalysisSystemPrompt() {
  return buildPromptTemplate('social.analysis.system').systemPrompt;
}

async function callSocialMessageAnalysisAi({
  env,
  message,
  preferredLanguage = 'fr',
}) {
  const systemPrompt = buildAnalysisSystemPrompt();
  const userPrompt = [
    `Preferred language from admin settings: ${preferredLanguage}`,
    `Customer message: ${String(message || '').trim()}`,
    'If Tunisian dialect appears, set language to "ar" and language_variant to "tunisian_dialect".',
    'Return valid JSON only. No markdown. No extra keys.',
  ].join('\n');

  const result = await callAiText({
    env,
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  return extractJson(result.text);
}

async function loadApprovedLearningContext({ dataAccess = {}, customerMessage = '', language = 'fr' }) {
  const legacyLearningRows = await safeList(dataAccess?.learningRepo);
  const learnedKnowledgeRows = await safeList(dataAccess?.learnedKnowledgeRepo);
  const replyTemplateRows = await safeList(dataAccess?.replyTemplatesRepo);

  const approvedLegacyRows = legacyLearningRows
    .filter((row) => normalizeLearningStatus(row?.status) === 'approved')
    .filter((row) => !isToxicOrLowQuality(row?.summary || row?.pattern || row?.template || ''));
  const approvedKnowledgeRows = learnedKnowledgeRows
    .filter((row) => String(row?.status || '').trim().toLowerCase() === 'approved')
    .map((row) => ({
      type: row.type,
      language: row.language,
      summary: row.question_or_pattern,
      pattern: row.question_or_pattern,
      template: row.suggested_answer,
    }))
    .filter((row) => !isToxicOrLowQuality(row?.summary || row?.pattern || row?.template || ''));
  const approvedTemplateRows = replyTemplateRows
    .filter((row) => String(row?.status || '').trim().toLowerCase() === 'approved')
    .filter((row) => !isToxicOrLowQuality(row?.template || row?.situation || ''));
  const approvedLearningRows = [...approvedLegacyRows, ...approvedKnowledgeRows];

  const conversations = await safeList(dataAccess?.conversationsRepo);
  const similarConversations = selectSimilarConversationPatterns({
    customerMessage,
    conversations,
  });

  return buildApprovedLearningContext({
    approvedLearningRows,
    approvedTemplateRows,
    similarConversations,
    language,
  });
}

function buildStyleSummaryFromReply(replyText) {
  const tokenCount = replyText.split(/\s+/).filter(Boolean).length;
  if (tokenCount <= 14) {
    return 'Short and direct answer with one clear next step.';
  }
  if (tokenCount <= 30) {
    return 'Balanced answer: reassurance + practical next action.';
  }
  return 'Detailed but calm structure with practical action at the end.';
}

function buildLearningCandidates({
  customerMessage,
  history = [],
  aiReply = null,
  analysis = null,
  language = 'fr',
  metadata = {},
}) {
  const candidates = [];
  const normalizedMessage = normalizeText(customerMessage);
  const intent = normalizeIntent(analysis?.intent || aiReply?.intent || 'unknown');
  const safeLanguage = normalizePreferredLanguage(language || analysis?.language || aiReply?.language || 'fr');
  const customerSnippet = asSingleLine(customerMessage, 220);

  if (customerSnippet && QUESTION_PATTERN.test(normalizedMessage)) {
    candidates.push(
      buildLearningProposal({
        type: 'common_customer_question',
        language: safeLanguage,
        pattern: customerSnippet,
        summary: 'Recurring customer question pattern before purchase.',
        customerExample: customerSnippet,
        metadata: {
          ...metadata,
          intent,
        },
      })
    );
  }

  if (customerSnippet && OBJECTION_PATTERN.test(normalizedMessage)) {
    candidates.push(
      buildLearningProposal({
        type: 'pre_purchase_objection',
        language: safeLanguage,
        pattern: customerSnippet,
        summary: 'Common hesitation or objection before purchase.',
        customerExample: customerSnippet,
        metadata: {
          ...metadata,
          intent,
        },
      })
    );
  }

  const replyText = asSingleLine(aiReply?.reply || '', 220);
  const aiConfidence = clampConfidence(aiReply?.confidence, 0);
  const aiIsSafeForLearning =
    replyText &&
    !isToxicOrLowQuality(replyText) &&
    !containsSensitiveBusinessFacts(replyText) &&
    !Boolean(aiReply?.needs_human) &&
    aiConfidence >= 0.78 &&
    intent !== 'complaint' &&
    intent !== 'support';

  if (aiIsSafeForLearning) {
    candidates.push(
      buildLearningProposal({
        type: 'successful_reply_style',
        language: safeLanguage,
        pattern: buildStyleSummaryFromReply(replyText),
        summary: buildStyleSummaryFromReply(replyText),
        template: replyText,
        customerExample: customerSnippet,
        replyExample: replyText,
        metadata: {
          ...metadata,
          intent,
          suggested_action: aiReply?.suggested_action || '',
        },
      })
    );
    candidates.push(
      buildLearningProposal({
        type: 'similar_conversation_pattern',
        language: safeLanguage,
        pattern: `${customerSnippet} -> ${replyText}`,
        summary: 'Conversation structure that kept the customer engaged.',
        template: replyText,
        customerExample: customerSnippet,
        replyExample: replyText,
        metadata: {
          ...metadata,
          intent,
        },
      })
    );
  }

  candidates.push(...extractHumanTemplateCandidates(history, safeLanguage));

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate) return false;
    const key = learningFingerprint(candidate);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function captureLearningSignals({
  dataAccess = {},
  customerMessage,
  history = [],
  aiReply = null,
  analysis = null,
  metadata = {},
}) {
  const learningRepo = dataAccess?.learningRepo;
  if (!learningRepo || typeof learningRepo.list !== 'function' || typeof learningRepo.create !== 'function') {
    return [];
  }

  const language = normalizePreferredLanguage(aiReply?.language || analysis?.language || 'fr');
  const proposals = buildLearningCandidates({
    customerMessage,
    history,
    aiReply,
    analysis,
    language,
    metadata,
  });

  if (!proposals.length) {
    return [];
  }

  const existingRows = await safeList(learningRepo);
  const existingByFingerprint = new Map();
  for (const row of existingRows) {
    const key = learningFingerprint(row);
    if (!key) continue;
    existingByFingerprint.set(key, row);
  }

  const saved = [];
  for (const proposal of proposals) {
    const key = learningFingerprint(proposal);
    if (!key) continue;
    const existing = existingByFingerprint.get(key);
    if (!existing) {
      const created = await learningRepo.create(proposal);
      saved.push(created);
      existingByFingerprint.set(key, created);
      continue;
    }

    const nextEvidence = Math.max(1, toNumber(existing.evidence_count, 1) + 1);
    const currentStatus = normalizeLearningStatus(existing.status);
    const nextStatus = currentStatus === 'proposed' && nextEvidence >= 2 ? 'pending_review' : currentStatus;
    const patch = {
      evidence_count: nextEvidence,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      customer_example: proposal.customer_example || existing.customer_example || '',
      reply_example: proposal.reply_example || existing.reply_example || '',
    };
    const updated = await learningRepo.update(existing.id, patch);
    saved.push(updated);
    existingByFingerprint.set(key, updated);
  }

  return saved;
}

export function createSocialAgentService({ env, dataAccess = {} }) {
  async function extractOrderInformation({ conversationHistory }) {
    const conversationText = historyToText(conversationHistory);
    if (!conversationText) {
      throw new AppError(400, 'VALIDATION_ERROR', 'conversation_history is required');
    }

    const fallbackPayload = fallbackExtractOrderInformation(conversationHistory);

    if (canAttemptAi(env)) {
      try {
        const aiPayload = await callOrderExtractionAi({
          env,
          conversationHistoryText: conversationText.slice(0, 6000),
        });
        return sanitizeOrderExtractionPayload(aiPayload, fallbackPayload, conversationHistory);
      } catch (_error) {
        // Keep local fallback active when provider fails.
      }
    }

    return fallbackPayload;
  }

  async function analyzeCustomerMessage({ message, preferredLanguage = 'fr' }) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Message is required');
    }

    const fallbackPayload = fallbackMessageAnalysis({
      message: cleanMessage,
      preferredLanguage,
    });

    if (canAttemptAi(env)) {
      try {
        const aiPayload = await callSocialMessageAnalysisAi({
          env,
          message: cleanMessage,
          preferredLanguage,
        });
        return sanitizeAiMessageAnalysis(aiPayload, fallbackPayload, {
          message: cleanMessage,
        });
      } catch (_error) {
        // Keep local fallback active when provider fails.
      }
    }

    return fallbackPayload;
  }

  async function learnFromConversation({
    customerMessage,
    history = [],
    aiReply = null,
    analysis = null,
    metadata = {},
  }) {
    const cleanMessage = String(customerMessage || '').trim();
    if (!cleanMessage) {
      return [];
    }

    return captureLearningSignals({
      dataAccess,
      customerMessage: cleanMessage,
      history,
      aiReply,
      analysis,
      metadata,
    });
  }

  async function replyToCustomer({
    message,
    channel,
    contact,
    tone = 'professionnel',
    preferredLanguage = 'fr',
    rules = [],
    matchedRule = null,
    history = [],
  }) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Message is required');
    }

    const products = (await dataAccess?.productsRepo?.list?.()) || [];
    const settings = (await dataAccess?.settingsRepo?.getAll?.()) || {};
    const storeName = String(settings?.store?.name || 'Store');
    const currency = String(settings?.payments?.currency || 'TND');
    const deliveryPolicy = settings?.delivery || settings?.shipping || settings?.logistics || null;
    const matchedProduct = findProductMatch(cleanMessage, products);
    const approvedLearningContext = await loadApprovedLearningContext({
      dataAccess,
      customerMessage: cleanMessage,
      language: detectLanguage(cleanMessage, preferredLanguage),
    });

    const rawFallbackPayload = fallbackSocialReply({
      message: cleanMessage,
      tone,
      preferredLanguage,
      products,
      currency,
      matchedRule,
    });
    const fallbackPayload = enforceEscalationPolicy(rawFallbackPayload, normalizeText(cleanMessage));
    const shouldEnforceFixedReply =
      (FIXED_RULE_INTENTS.has(fallbackPayload.intent) && fallbackPayload.intent !== 'order') ||
      (fallbackPayload.intent === 'unknown' && isGreetingMessage(normalizeText(cleanMessage)));

    if (shouldEnforceFixedReply) {
      return {
        ...fallbackPayload,
        admin_note: fallbackPayload.intent === 'complaint' ? 'Complaint detected with fixed escalation template.' : '',
        missing_fields: [],
        ready_to_create_order: false,
      };
    }

    if (canAttemptAi(env)) {
      try {
        const productContext = matchedProduct
          ? {
              id: matchedProduct.id,
              name: matchedProduct.name,
              price: toNumber(matchedProduct.price),
              currency,
              stock: toNumber(matchedProduct.stock),
              status: matchedProduct.status,
              category: matchedProduct.category,
            }
          : null;
        const productCatalog = buildRecommendationCatalog(products, currency);
        const knownCustomerInfo = buildKnownOrderInfo({
          customerMessage: cleanMessage,
          productInfo: productContext,
          customerInfo: {
            full_name: contact,
          },
        });

        if (fallbackPayload.intent === 'order') {
          const extractedOrderInfo = await extractOrderInformation({
            conversationHistory: Array.isArray(history) && history.length ? history : [{ sender: 'contact', text: cleanMessage }],
          });
          const orderFallback = fallbackOrderConfirmation({
            language: fallbackPayload.language,
            knownOrderInfo: mergeKnownOrderInfo(knownCustomerInfo, extractedOrderInfo),
          });
          const aiOrderPayload = await callOrderConfirmationAi({
            env,
            customerMessage: cleanMessage,
            language: fallbackPayload.language,
            productInfo: productContext || {},
            customerInfo: mergeKnownOrderInfo(knownCustomerInfo, extractedOrderInfo),
            storeName,
          });
          const orderPayload = sanitizeOrderConfirmationPayload(aiOrderPayload, orderFallback);
          return {
            ...fallbackPayload,
            reply: orderPayload.reply,
            cta: orderPayload.ready_to_create_order
              ? fallbackCta(fallbackPayload.language, 'order', 'create_order')
              : fallbackCta(fallbackPayload.language, 'order', 'collect_customer_info'),
            suggested_action: orderPayload.ready_to_create_order ? 'create_order' : 'collect_customer_info',
            missing_fields: orderPayload.missing_fields,
            ready_to_create_order: orderPayload.ready_to_create_order,
            order_data: extractedOrderInfo,
          };
        }

        const shouldRecommendProducts =
          ['product_question', 'price_question', 'availability'].includes(fallbackPayload.intent) &&
          !productContext &&
          productCatalog.length > 0;

        if (shouldRecommendProducts) {
          const recommendationFallback = fallbackProductRecommendationPayload({
            message: cleanMessage,
            language: fallbackPayload.language,
            products,
            matchedProduct,
            currency,
          });
          const aiRecommendationPayload = await callProductRecommendationAi({
            env,
            customerMessage: cleanMessage,
            language: fallbackPayload.language,
            productCatalog,
            fallbackPayload: recommendationFallback,
          });
          const recommendationPayload = aiRecommendationPayload || recommendationFallback;

          return {
            ...fallbackPayload,
            reply: recommendationPayload.reply,
            recommended_products: recommendationPayload.recommended_products,
            cta: fallbackCta(fallbackPayload.language, fallbackPayload.intent, 'share_product_info'),
            suggested_action: 'share_product_info',
            missing_fields: [],
            ready_to_create_order: false,
            order_data: null,
          };
        }

        if (fallbackPayload.intent === 'spam') {
          const fallbackSpamPayload = fallbackSpamHandlingPayload({
            message: cleanMessage,
            language: fallbackPayload.language,
          });
          const aiSpamPayload = await callSpamHandlingAi({
            env,
            customerMessage: cleanMessage,
            language: fallbackPayload.language,
          });
          const spamPayload = aiSpamPayload?.is_spam ? aiSpamPayload : fallbackSpamPayload;
          return {
            ...fallbackPayload,
            is_spam: true,
            reply: spamPayload.reply,
            action: spamPayload.action,
            cta: '',
            suggested_action: 'ask_clarification',
            missing_fields: [],
            ready_to_create_order: false,
            order_data: null,
          };
        }

        if (fallbackPayload.needs_human && fallbackPayload.suggested_action === 'escalate') {
          const issueType = inferIssueTypeForEscalation(fallbackPayload, cleanMessage);
          const conversationSummary = buildConversationSummary(history, cleanMessage);
          const fallbackEscalation = fallbackEscalationPayload({
            language: fallbackPayload.language,
            issueType,
            customerMessage: cleanMessage,
          });
          let escalationPayload = fallbackEscalation;
          let customerReplyText = fallbackEscalation.customer_reply;
          let humanReasonText = fallbackPayload.human_reason || `${issueType} escalated to human admin.`;

          if (issueType === 'low_confidence') {
            const lowConfidenceReply = await callLowConfidenceFallbackAi({
              env,
              customerMessage: cleanMessage,
              language: fallbackPayload.language,
            });
            if (lowConfidenceReply) {
              customerReplyText = lowConfidenceReply;
            }
          } else {
            const aiEscalationPayload = await callHumanEscalationAi({
              env,
              customerMessage: cleanMessage,
              issueType,
              conversationSummary,
            });

            escalationPayload = aiEscalationPayload || fallbackEscalation;
            customerReplyText = escalationPayload.customer_reply;

            if (!aiEscalationPayload) {
              const aiUnhappyPayload = await callUnhappyCustomerAi({
                env,
                customerMessage: cleanMessage,
                language: fallbackPayload.language,
                conversationHistory: history,
              });
              if (aiUnhappyPayload?.reply) {
                customerReplyText = aiUnhappyPayload.reply;
                humanReasonText = aiUnhappyPayload.human_reason || humanReasonText;
              }
            }
          }

          const mergedPayload = sanitizeAiPayload(
            {
              reply: customerReplyText,
              needs_human: true,
              human_reason: humanReasonText,
            },
            fallbackPayload,
            {
              message: cleanMessage,
            }
          );

          return {
            ...mergedPayload,
            admin_note: escalationPayload.admin_note,
            missing_fields: [],
            ready_to_create_order: false,
            order_data: null,
          };
        }

        const aiReplyText = await callSocialAi({
          env,
          intent: fallbackPayload.intent,
          language: fallbackPayload.language,
          customerMessage: cleanMessage,
          productContext,
          deliveryPolicy,
          channel,
          storeName,
          learningContext: approvedLearningContext,
        });
        if (aiReplyText) {
          return {
            ...fallbackPayload,
            reply: aiReplyText,
            missing_fields: [],
            ready_to_create_order: false,
            order_data: null,
          };
        }
      } catch (_error) {
        // Keep local fallback active when provider fails.
      }
    }

    if (fallbackPayload.intent === 'order') {
      const extractedOrderInfo = await extractOrderInformation({
        conversationHistory: Array.isArray(history) && history.length ? history : [{ sender: 'contact', text: cleanMessage }],
      });
      const knownCustomerInfo = buildKnownOrderInfo({
        customerMessage: cleanMessage,
        productInfo: matchedProduct
          ? {
              id: matchedProduct.id,
              name: matchedProduct.name,
              price: toNumber(matchedProduct.price),
              currency,
              stock: toNumber(matchedProduct.stock),
              status: matchedProduct.status,
              category: matchedProduct.category,
            }
          : null,
        customerInfo: {
          full_name: contact,
        },
      });
      const orderPayload = fallbackOrderConfirmation({
        language: fallbackPayload.language,
        knownOrderInfo: mergeKnownOrderInfo(knownCustomerInfo, extractedOrderInfo),
      });
      return {
        ...fallbackPayload,
        reply: orderPayload.reply,
        cta: orderPayload.ready_to_create_order
          ? fallbackCta(fallbackPayload.language, 'order', 'create_order')
          : fallbackCta(fallbackPayload.language, 'order', 'collect_customer_info'),
        suggested_action: orderPayload.ready_to_create_order ? 'create_order' : 'collect_customer_info',
        missing_fields: orderPayload.missing_fields,
        ready_to_create_order: orderPayload.ready_to_create_order,
        order_data: extractedOrderInfo,
      };
    }

    if (fallbackPayload.needs_human && fallbackPayload.suggested_action === 'escalate') {
      const issueType = inferIssueTypeForEscalation(fallbackPayload, cleanMessage);
      const escalationPayload = fallbackEscalationPayload({
        language: fallbackPayload.language,
        issueType,
        customerMessage: cleanMessage,
      });
      const fallbackEscalationReply =
        issueType === 'low_confidence'
          ? unknownText(fallbackPayload.language)
          : escalationPayload.customer_reply;
      return {
        ...fallbackPayload,
        reply: fallbackEscalationReply,
        admin_note: escalationPayload.admin_note,
        missing_fields: [],
        ready_to_create_order: false,
        order_data: null,
      };
    }

    if (fallbackPayload.intent === 'spam') {
      const spamPayload = fallbackSpamHandlingPayload({
        message: cleanMessage,
        language: fallbackPayload.language,
      });
      return {
        ...fallbackPayload,
        is_spam: true,
        reply: spamPayload.reply,
        action: spamPayload.action,
        cta: '',
        suggested_action: 'ask_clarification',
        missing_fields: [],
        ready_to_create_order: false,
        order_data: null,
      };
    }

    if (
      ['product_question', 'price_question', 'availability'].includes(fallbackPayload.intent) &&
      !matchedProduct &&
      products.length > 0
    ) {
      const recommendationPayload = fallbackProductRecommendationPayload({
        message: cleanMessage,
        language: fallbackPayload.language,
        products,
        matchedProduct,
        currency,
      });
      return {
        ...fallbackPayload,
        reply: recommendationPayload.reply,
        recommended_products: recommendationPayload.recommended_products,
        cta: fallbackCta(fallbackPayload.language, fallbackPayload.intent, 'share_product_info'),
        suggested_action: 'share_product_info',
        missing_fields: [],
        ready_to_create_order: false,
        order_data: null,
      };
    }

    return {
      ...fallbackPayload,
      missing_fields: [],
      ready_to_create_order: false,
      order_data: null,
    };
  }

  return {
    extractOrderInformation,
    analyzeCustomerMessage,
    learnFromConversation,
    replyToCustomer,
  };
}



