function stripMarkdownFences(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return source;
}

function tryParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function findBalancedJson(source, openChar, closeChar) {
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== openChar) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let cursor = index; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === openChar) {
        depth += 1;
        continue;
      }
      if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(index, cursor + 1);
          const parsed = tryParse(candidate);
          if (parsed !== null) {
            return parsed;
          }
          break;
        }
      }
    }
  }
  return null;
}

export function extractJsonObject(text, { allowArray = false } = {}) {
  const source = stripMarkdownFences(text);
  if (!source) return null;

  const direct = tryParse(source);
  if (direct && typeof direct === 'object' && (allowArray || !Array.isArray(direct))) {
    return direct;
  }

  const objectCandidate = findBalancedJson(source, '{', '}');
  if (objectCandidate && typeof objectCandidate === 'object' && !Array.isArray(objectCandidate)) {
    return objectCandidate;
  }

  if (allowArray) {
    const arrayCandidate = findBalancedJson(source, '[', ']');
    if (Array.isArray(arrayCandidate)) {
      return arrayCandidate;
    }
  }

  return null;
}

export function safeStructuredParse({
  text,
  fallback = null,
  validator = null,
  normalizer = null,
  allowArray = false,
} = {}) {
  const parsed = extractJsonObject(text, { allowArray });
  if (!parsed) return fallback;
  const normalized = typeof normalizer === 'function' ? normalizer(parsed) : parsed;
  if (typeof validator === 'function' && !validator(normalized)) {
    return fallback;
  }
  return normalized;
}

export function normalizeStringArray(input, limit = 5) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    const text = String(item || '').trim();
    if (!text) continue;
    if (!out.includes(text)) {
      out.push(text);
    }
    if (out.length >= limit) break;
  }
  return out;
}
