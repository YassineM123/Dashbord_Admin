import { AppError } from './errors.mjs';

export function assertObject(value, message = 'Invalid payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }
  return value;
}

export function requireString(payload, field, label = field) {
  const value = String(payload?.[field] || '').trim();
  if (!value) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} is required`);
  }
  return value;
}

export function optionalString(payload, field, fallback = '') {
  const value = payload?.[field];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

export function enumValue(value, allowed, field, fallback = null) {
  const normalized = String(value || '').trim();
  if (!normalized && fallback !== null) {
    return fallback;
  }
  if (!allowed.includes(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
}

export function numberValue(value, field, options = {}) {
  const { fallback = 0, min = null } = options;
  const parsed = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a number`);
  }
  if (min !== null && parsed < min) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be at least ${min}`);
  }
  return parsed;
}

export function integerValue(value, field, options = {}) {
  const parsed = Math.trunc(numberValue(value, field, options));
  return parsed;
}

export function dateValue(value, field, fallback = null) {
  if (!value && fallback !== null) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid date`);
  }
  return date.toISOString();
}

export function parseListQuery(query = {}) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize || '50'), 10) || 50));
  const search = String(query.search || query.q || '').trim().toLowerCase();
  return { page, pageSize, search };
}

export function paginate(rows, query = {}, filters = {}) {
  const { page, pageSize } = parseListQuery(query);
  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    meta: {
      total: rows.length,
      page,
      pageSize,
      filters,
    },
  };
}
