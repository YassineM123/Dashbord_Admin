export const AI_CONFIDENCE_THRESHOLDS = {
  veryHigh: 0.85,
  high: 0.72,
  medium: 0.58,
  low: 0.45,
  escalation: 0.5,
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampConfidenceScore(value, fallback = 0.5) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return Math.round(parsed * 100) / 100;
}

export function resolveConfidenceTier(value) {
  const confidence = clampConfidenceScore(value, 0.5);
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.veryHigh) return 'very_high';
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.medium) return 'medium';
  if (confidence >= AI_CONFIDENCE_THRESHOLDS.low) return 'low';
  return 'very_low';
}

export function shouldEscalateConversation({ intent, confidence, sentiment }) {
  const normalizedIntent = String(intent || '').trim().toLowerCase();
  if (normalizedIntent === 'complaint' || normalizedIntent === 'support') return true;
  if (normalizedIntent === 'spam') return false;
  if (String(sentiment || '').trim().toLowerCase() === 'negative' && clampConfidenceScore(confidence, 0.5) < 0.72) {
    return true;
  }
  return clampConfidenceScore(confidence, 0.5) < AI_CONFIDENCE_THRESHOLDS.escalation;
}

export function shouldAutoCreateOrder({ confidence, orderStatus, missingFields = [] }) {
  const normalizedStatus = String(orderStatus || '').trim().toLowerCase();
  const confidenceScore = clampConfidenceScore(confidence, 0.4);
  const missingCount = Array.isArray(missingFields) ? missingFields.filter(Boolean).length : 0;
  return normalizedStatus === 'confirmed' && missingCount === 0 && confidenceScore >= AI_CONFIDENCE_THRESHOLDS.high;
}

export function shouldCaptureLead({ intent, confidence, needsHuman = false }) {
  if (Boolean(needsHuman)) return false;
  const normalizedIntent = String(intent || '').trim().toLowerCase();
  if (!['lead', 'order', 'product_question', 'price_question', 'availability'].includes(normalizedIntent)) {
    return false;
  }
  return clampConfidenceScore(confidence, 0.5) >= AI_CONFIDENCE_THRESHOLDS.medium;
}

export function buildDecisionTrace({ intent, confidence, needsHuman = false, orderStatus = 'needs_review', missingFields = [] }) {
  const normalizedIntent = String(intent || '').trim().toLowerCase() || 'unknown';
  const score = clampConfidenceScore(confidence, 0.5);
  const tier = resolveConfidenceTier(score);
  const escalate = shouldEscalateConversation({
    intent: normalizedIntent,
    confidence: score,
  });
  const createOrder = shouldAutoCreateOrder({
    confidence: score,
    orderStatus,
    missingFields,
  });
  const captureLead = shouldCaptureLead({
    intent: normalizedIntent,
    confidence: score,
    needsHuman: needsHuman || escalate,
  });

  return {
    confidence: score,
    confidence_tier: tier,
    escalate,
    auto_create_order: createOrder,
    capture_lead: captureLead,
  };
}
