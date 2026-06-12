import { AppError } from '../core/errors.mjs';
import { callAiText, canAttemptAi } from './ai-provider-service.mjs';
import { extractJsonObject } from './ai-json-utils.mjs';
import { buildPromptTemplate } from './prompt-registry.mjs';

const KNOWLEDGE_STATUSES = ['proposed', 'reviewed', 'approved', 'rejected'];
const KNOWLEDGE_TYPES = ['faq', 'objection_handling', 'template', 'escalation_pattern'];

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeStatus(value, fallback = 'proposed') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pending_review') {
    return 'reviewed';
  }
  return KNOWLEDGE_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeType(value, fallback = 'faq') {
  const normalized = String(value || '').trim().toLowerCase();
  return KNOWLEDGE_TYPES.includes(normalized) ? normalized : fallback;
}

function safeLanguage(value, fallback = 'fr') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || fallback;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function safeList(repo) {
  if (!repo || typeof repo.list !== 'function') return [];
  try {
    const rows = await repo.list();
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function countPatterns(rows = [], extractor) {
  const counts = new Map();
  for (const row of rows) {
    const values = extractor(row) || [];
    for (const value of values) {
      const key = normalizeText(value);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function buildKnowledgeFingerprint({ type, language, questionOrPattern }) {
  return `${normalizeType(type)}::${safeLanguage(language)}::${normalizeText(questionOrPattern)}`;
}

function normalizeProposedKnowledge(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      type: normalizeType(item?.type),
      question_or_pattern: asLine(item?.question_or_pattern || '', 220),
      suggested_answer: asLine(item?.suggested_answer || '', 220),
      confidence: clampConfidence(item?.confidence, 0.6),
    }))
    .filter((item) => item.question_or_pattern);
}

function normalizeWinningTemplates(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      customer_situation: asLine(item?.customer_situation || '', 160),
      recommended_reply: asLine(item?.recommended_reply || '', 220),
      why_it_worked: asLine(item?.why_it_worked || '', 180),
    }))
    .filter((item) => item.customer_situation && item.recommended_reply);
}

function normalizeObjections(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      type: asLine(item?.type || '', 80),
      customer_words: asLine(item?.customer_words || '', 180),
      recommended_response: asLine(item?.recommended_response || '', 220),
      needs_human_review: typeof item?.needs_human_review === 'boolean' ? item.needs_human_review : true,
    }))
    .filter((item) => item.type && item.customer_words);
}

function normalizeFaqCandidates(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      question: asLine(item?.question || '', 180),
      suggested_answer: asLine(item?.suggested_answer || '', 220),
      must_be_verified: typeof item?.must_be_verified === 'boolean' ? item.must_be_verified : true,
      category: asLine(item?.category || 'product_details', 40),
    }))
    .filter((item) => item.question);
}

function isValidTransition(fromStatus, toStatus) {
  const from = normalizeStatus(fromStatus, 'proposed');
  const to = normalizeStatus(toStatus, from);
  if (from === to) return true;
  if (from === 'proposed') return to === 'reviewed' || to === 'rejected';
  if (from === 'reviewed') return to === 'approved' || to === 'rejected';
  if (from === 'approved') return to === 'reviewed' || to === 'rejected';
  if (from === 'rejected') return to === 'reviewed';
  return false;
}

function buildCandidatesFromAnalysis({ analysis = {}, language = 'fr' }) {
  const proposed = normalizeProposedKnowledge(analysis?.proposed_knowledge);
  const winning = normalizeWinningTemplates(analysis?.winning_reply_patterns);
  const objections = normalizeObjections(analysis?.objections);
  const faqCandidates = normalizeFaqCandidates(analysis?.faq_candidates);

  const knowledge = [];
  for (const row of proposed) {
    knowledge.push({
      type: row.type,
      question_or_pattern: row.question_or_pattern,
      suggested_answer: row.suggested_answer,
      confidence: row.confidence,
      language,
      requires_verification: ['faq', 'objection_handling', 'escalation_pattern'].includes(row.type),
    });
  }
  for (const row of faqCandidates) {
    knowledge.push({
      type: 'faq',
      question_or_pattern: row.question,
      suggested_answer: row.suggested_answer,
      confidence: row.must_be_verified ? 0.6 : 0.8,
      language,
      requires_verification: row.must_be_verified,
      category: row.category,
    });
  }
  for (const row of objections) {
    knowledge.push({
      type: 'objection_handling',
      question_or_pattern: `${row.type}: ${row.customer_words}`,
      suggested_answer: row.recommended_response,
      confidence: row.needs_human_review ? 0.55 : 0.74,
      language,
      requires_verification: row.needs_human_review,
    });
  }

  const templates = winning.map((row) => ({
    situation: row.customer_situation,
    template: row.recommended_reply,
    rationale: row.why_it_worked,
    confidence: 0.74,
    language,
  }));

  return {
    knowledge,
    templates,
  };
}

function thresholdForType(type) {
  if (type === 'faq') return 5;
  if (type === 'objection_handling') return 3;
  if (type === 'template') return 3;
  if (type === 'escalation_pattern') return 2;
  return 3;
}

async function callAdminReviewAi({ env, item }) {
  const prompt = buildPromptTemplate('learning.review.admin', {
    itemJson: JSON.stringify(item || {}),
  });
  const result = await callAiText({
    env,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    temperature: 0.1,
  });
  return extractJsonObject(result.text);
}

export function createLearningMemoryService({
  env,
  dataAccess = {},
}) {
  async function upsertConversationAnalysis({
    conversationId,
    analysis,
    channel = '',
    language = 'fr',
  }) {
    if (!dataAccess?.conversationAnalysesRepo) {
      return null;
    }
    const repo = dataAccess.conversationAnalysesRepo;
    const recordId = `analysis_${conversationId}`;
    const now = new Date().toISOString();
    const payload = {
      id: recordId,
      conversation_id: conversationId,
      intent: asLine(analysis?.customer_intent || 'unknown', 80),
      sentiment: asLine(analysis?.customer_sentiment || 'neutral', 20),
      outcome: asLine(analysis?.order_outcome || 'unknown', 40),
      questions: Array.isArray(analysis?.main_questions) ? analysis.main_questions : [],
      objections: Array.isArray(analysis?.main_objections) ? analysis.main_objections : [],
      winning_patterns: Array.isArray(analysis?.winning_reply_patterns) ? analysis.winning_reply_patterns : [],
      language: safeLanguage(language),
      channel: asLine(channel, 30),
      raw: analysis,
      updated_at: now,
      created_at: now,
    };

    if (typeof repo.getById === 'function' && typeof repo.update === 'function') {
      const existing = await repo.getById(recordId);
      if (existing) {
        return repo.update(recordId, {
          ...payload,
          created_at: existing.created_at || now,
        });
      }
    }
    if (typeof repo.create === 'function') {
      return repo.create(payload);
    }
    return null;
  }

  async function ingestFromAnalysis({
    conversation,
    analysis,
  }) {
    const conversationId = String(conversation?.id || '').trim();
    if (!conversationId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'conversation.id is required');
    }
    if (!analysis || typeof analysis !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'analysis is required');
    }

    const language = safeLanguage(analysis.language || conversation?.language || 'fr');
    await upsertConversationAnalysis({
      conversationId,
      analysis,
      channel: conversation?.channel || '',
      language,
    });

    const analyses = await safeList(dataAccess?.conversationAnalysesRepo);
    const since = daysAgoIso(7);
    const recentAnalyses = analyses.filter((row) => String(row?.updated_at || row?.created_at || '') >= since);

    const questionCounts = countPatterns(recentAnalyses, (row) => row?.questions || []);
    const objectionCounts = countPatterns(recentAnalyses, (row) => row?.objections || []);
    const templateCounts = countPatterns(recentAnalyses, (row) =>
      (Array.isArray(row?.winning_patterns) ? row.winning_patterns.map((item) => item?.recommended_reply) : []).filter(Boolean)
    );

    const { knowledge, templates } = buildCandidatesFromAnalysis({
      analysis,
      language,
    });

    const knowledgeRepo = dataAccess?.learnedKnowledgeRepo;
    const templateRepo = dataAccess?.replyTemplatesRepo;

    const existingKnowledge = await safeList(knowledgeRepo);
    const existingTemplates = await safeList(templateRepo);

    let createdKnowledge = 0;
    let createdTemplates = 0;

    for (const candidate of knowledge) {
      const fingerprint = buildKnowledgeFingerprint({
        type: candidate.type,
        language,
        questionOrPattern: candidate.question_or_pattern,
      });
      const counter =
        candidate.type === 'faq'
          ? questionCounts.get(normalizeText(candidate.question_or_pattern)) || 0
          : candidate.type === 'objection_handling'
          ? objectionCounts.get(normalizeText(candidate.question_or_pattern)) || 0
          : 0;
      const threshold = thresholdForType(candidate.type);
      if (counter < threshold) {
        continue;
      }

      const existing = existingKnowledge.find(
        (row) =>
          buildKnowledgeFingerprint({
            type: row.type,
            language: row.language,
            questionOrPattern: row.question_or_pattern,
          }) === fingerprint
      );

      const now = new Date().toISOString();
      if (existing && knowledgeRepo?.update) {
        const sourceIds = unique([...(existing.source_conversation_ids || []), conversationId]).slice(-30);
        await knowledgeRepo.update(existing.id, {
          suggested_answer: candidate.suggested_answer || existing.suggested_answer || '',
          confidence: Math.max(clampConfidence(existing.confidence, 0.5), candidate.confidence),
          occurrence_count: Math.max(toNumber(existing.occurrence_count, 1), counter),
          source_conversation_ids: sourceIds,
          updated_at: now,
          status: normalizeStatus(existing.status, 'proposed'),
        });
      } else if (knowledgeRepo?.create) {
        await knowledgeRepo.create({
          id: createId('know'),
          type: normalizeType(candidate.type),
          question_or_pattern: candidate.question_or_pattern,
          suggested_answer: candidate.suggested_answer,
          language,
          status: 'proposed',
          confidence: candidate.confidence,
          source: 'conversation_pattern',
          source_conversation_ids: [conversationId],
          occurrence_count: counter,
          requires_verification: Boolean(candidate.requires_verification),
          created_at: now,
          updated_at: now,
        });
        createdKnowledge += 1;
      }
    }

    for (const candidate of templates) {
      const normalizedTemplate = normalizeText(candidate.template);
      if (!normalizedTemplate) continue;
      const counter = templateCounts.get(normalizedTemplate) || 0;
      const threshold = thresholdForType('template');
      if (counter < threshold) {
        continue;
      }
      const existing = existingTemplates.find(
        (row) => normalizeText(row.template) === normalizedTemplate && safeLanguage(row.language) === language
      );
      const now = new Date().toISOString();
      if (existing && templateRepo?.update) {
        const sourceIds = unique([...(existing.source_conversation_ids || []), conversationId]).slice(-30);
        await templateRepo.update(existing.id, {
          situation: candidate.situation || existing.situation,
          performance_score: Math.max(clampConfidence(existing.performance_score, 0.5), clampConfidence(counter / 10, 0.6)),
          source_conversation_ids: sourceIds,
          updated_at: now,
          status: normalizeStatus(existing.status, 'proposed'),
        });
      } else if (templateRepo?.create) {
        await templateRepo.create({
          id: createId('tpl'),
          situation: candidate.situation,
          language,
          template: candidate.template,
          performance_score: clampConfidence(counter / 10, 0.6),
          status: 'proposed',
          source_conversation_ids: [conversationId],
          created_at: now,
          updated_at: now,
        });
        createdTemplates += 1;
      }
    }

    return {
      created_knowledge: createdKnowledge,
      created_templates: createdTemplates,
    };
  }

  async function listKnowledge({ status = '', type = '' } = {}) {
    const rows = await safeList(dataAccess?.learnedKnowledgeRepo);
    const statusFilter = normalizeStatus(status, '');
    const typeFilter = normalizeType(type, '');
    return rows
      .filter((row) => (statusFilter ? normalizeStatus(row?.status) === statusFilter : true))
      .filter((row) => (typeFilter ? normalizeType(row?.type) === typeFilter : true))
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
  }

  async function listTemplates({ status = '' } = {}) {
    const rows = await safeList(dataAccess?.replyTemplatesRepo);
    const statusFilter = normalizeStatus(status, '');
    return rows
      .filter((row) => (statusFilter ? normalizeStatus(row?.status) === statusFilter : true))
      .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
  }

  async function updateKnowledgeStatus({ id, status, reviewedBy = '', reason = '', editedAnswer = '' }) {
    const repo = dataAccess?.learnedKnowledgeRepo;
    if (!repo?.getById || !repo?.update) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'learned knowledge repository is not configured');
    }
    const row = await repo.getById(id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Knowledge item not found');
    }
    const from = normalizeStatus(row.status, 'proposed');
    const to = normalizeStatus(status, from);
    if (!isValidTransition(from, to)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid status transition: ${from} -> ${to}`);
    }
    const now = new Date().toISOString();
    return repo.update(id, {
      status: to,
      reviewed_by: reviewedBy,
      review_reason: asLine(reason, 240),
      suggested_answer: editedAnswer ? asLine(editedAnswer, 220) : row.suggested_answer,
      reviewed_at: now,
      updated_at: now,
      ...(to === 'approved' ? { approved_at: now } : {}),
    });
  }

  async function updateTemplateStatus({ id, status, reviewedBy = '', reason = '', editedTemplate = '' }) {
    const repo = dataAccess?.replyTemplatesRepo;
    if (!repo?.getById || !repo?.update) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'reply templates repository is not configured');
    }
    const row = await repo.getById(id);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Template item not found');
    }
    const from = normalizeStatus(row.status, 'proposed');
    const to = normalizeStatus(status, from);
    if (!isValidTransition(from, to)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid status transition: ${from} -> ${to}`);
    }
    const now = new Date().toISOString();
    return repo.update(id, {
      status: to,
      reviewed_by: reviewedBy,
      review_reason: asLine(reason, 240),
      template: editedTemplate ? asLine(editedTemplate, 220) : row.template,
      reviewed_at: now,
      updated_at: now,
      ...(to === 'approved' ? { approved_at: now } : {}),
    });
  }

  async function suggestAdminReview({ item }) {
    if (!canAttemptAi(env)) {
      return {
        decision: 'edit',
        edited_answer: asLine(item?.suggested_answer || '', 220),
        reason: 'AI review unavailable; manual review required.',
      };
    }
    try {
      const payload = await callAdminReviewAi({
        env,
        item,
      });
      const decision = String(payload?.decision || '').trim().toLowerCase();
      return {
        decision: decision === 'approve' || decision === 'reject' || decision === 'edit' ? decision : 'edit',
        edited_answer: asLine(payload?.edited_answer || '', 220),
        reason: asLine(payload?.reason || '', 240),
      };
    } catch (_error) {
      return {
        decision: 'edit',
        edited_answer: asLine(item?.suggested_answer || '', 220),
        reason: 'AI review failed; manual review required.',
      };
    }
  }

  return {
    ingestFromAnalysis,
    listKnowledge,
    listTemplates,
    updateKnowledgeStatus,
    updateTemplateStatus,
    suggestAdminReview,
  };
}

