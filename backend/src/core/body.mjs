import { AppError } from './errors.mjs';

export async function parseJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    throw new AppError(400, 'INVALID_JSON', 'Invalid JSON request body');
  }
}
