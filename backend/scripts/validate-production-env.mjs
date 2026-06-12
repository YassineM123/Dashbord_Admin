const INSECURE_SECRET_VALUES = new Set([
  '',
  'change-this-secret-in-production',
  'change-this-refresh-secret-in-production',
  'change-this-salt-in-production',
  'admin-dashboard-salt',
  'replace-with-a-long-random-secret',
  'replace-with-a-different-long-random-secret',
  'replace-with-a-long-random-salt',
]);

const REQUIRED_PRODUCTION_SECRETS = [
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'PASSWORD_SALT',
];

function isStrongSecret(value) {
  const normalized = String(value || '').trim();
  return normalized.length >= 32 && !INSECURE_SECRET_VALUES.has(normalized);
}

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PRODUCTION_SECRETS.filter((name) => !isStrongSecret(process.env[name]));

  if (missing.length > 0) {
    console.error(
      [
        'Production backend environment is incomplete.',
        `Set these Render environment variables to unique 32+ character secrets: ${missing.join(', ')}.`,
        'Do not commit production secrets to the repository.',
      ].join('\n')
    );
    process.exit(1);
  }
}
