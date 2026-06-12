import { AppError } from '../core/errors.mjs';

function extractOpenAIText(payload) {
  return (
    payload.output_text ||
    (payload.output || [])
      .flatMap((item) => item.content || [])
      .map((contentItem) => contentItem.text || '')
      .join('\n')
      .trim()
  );
}

function extractGeminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n')
    .trim();
}

function hasAnyKey(env) {
  return Boolean(env.geminiApiKey || env.openaiApiKey);
}

function normalizeProvider(value) {
  return String(value || 'auto').trim().toLowerCase();
}

export function resolveActiveProvider(env) {
  const requested = normalizeProvider(env.aiProvider);

  if (requested === 'gemini') {
    if (!env.geminiApiKey) {
      throw new AppError(503, 'AI_NOT_CONFIGURED', 'GEMINI_API_KEY is missing.');
    }
    return 'gemini';
  }

  if (requested === 'openai') {
    if (!env.openaiApiKey) {
      throw new AppError(503, 'AI_NOT_CONFIGURED', 'OPENAI_API_KEY is missing.');
    }
    return 'openai';
  }

  if (requested === 'auto') {
    if (env.geminiApiKey) return 'gemini';
    if (env.openaiApiKey) return 'openai';
    throw new AppError(
      503,
      'AI_NOT_CONFIGURED',
      'No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.'
    );
  }

  throw new AppError(
    400,
    'AI_PROVIDER_INVALID',
    'AI_PROVIDER must be one of: auto, gemini, openai.'
  );
}

async function callOpenAI({ env, systemPrompt, userPrompt, temperature }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      503,
      'AI_INVALID_API_KEY',
      'OpenAI API key is invalid or unauthorized.'
    );
  }

  if (!response.ok) {
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'OpenAI request failed.');
  }

  const payload = await response.json();
  const text = extractOpenAIText(payload);
  if (!text) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI returned an empty response.');
  }

  return {
    text,
    provider: 'openai',
    model: env.openaiModel,
  };
}

async function callGemini({ env, systemPrompt, userPrompt, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiModel
  )}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature,
      },
    }),
  });

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new AppError(
      503,
      'AI_INVALID_API_KEY',
      'Gemini API key is invalid or unauthorized.'
    );
  }

  if (!response.ok) {
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'Gemini request failed.');
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  if (!text) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'Gemini returned an empty response.');
  }

  return {
    text,
    provider: 'gemini',
    model: env.geminiModel,
  };
}

export async function callAiText({ env, systemPrompt, userPrompt, temperature = 0.2 }) {
  const provider = resolveActiveProvider(env);
  if (provider === 'gemini') {
    return callGemini({ env, systemPrompt, userPrompt, temperature });
  }
  return callOpenAI({ env, systemPrompt, userPrompt, temperature });
}

export function canAttemptAi(env) {
  return hasAnyKey(env);
}
