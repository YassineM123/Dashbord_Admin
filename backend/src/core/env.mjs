import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadDotEnv() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = join(currentDir, '..', '..', '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const INSECURE_SECRET_VALUES = new Set([
  '',
  'change-this-secret-in-production',
  'change-this-refresh-secret-in-production',
  'change-this-salt-in-production',
  'admin-dashboard-salt',
]);

function requireProductionSecret(name, value) {
  const normalized = String(value || '').trim();
  if (process.env.NODE_ENV !== 'production') {
    return normalized;
  }
  if (normalized.length < 32 || INSECURE_SECRET_VALUES.has(normalized)) {
    throw new Error(`${name} must be set to a strong secret in production`);
  }
  return normalized;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: requireProductionSecret(
    'JWT_SECRET',
    process.env.JWT_SECRET || 'change-this-secret-in-production'
  ),
  refreshTokenSecret: requireProductionSecret(
    'REFRESH_TOKEN_SECRET',
    process.env.REFRESH_TOKEN_SECRET ||
      `${process.env.JWT_SECRET || 'change-this-secret-in-production'}-refresh`
  ),
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 60 * 15),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7),
  tokenIssuer: process.env.TOKEN_ISSUER || 'admin-dashboard-backend',
  tokenAudience: process.env.TOKEN_AUDIENCE || 'admin-dashboard-frontend',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  dataDir: process.env.DATA_DIR || '',
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  passwordSalt: requireProductionSecret(
    'PASSWORD_SALT',
    process.env.PASSWORD_SALT || 'admin-dashboard-salt'
  ),
  bootstrapAdmin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin Client',
    role: process.env.ADMIN_ROLE || 'Executive',
  },
  aiProvider: process.env.AI_PROVIDER || 'auto',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
};
