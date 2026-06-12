import { AppError } from '../core/errors.mjs';

const INTEGRATION_DEFINITIONS = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'Sales channel',
    envKeys: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    fields: [
      { key: 'shopDomain', label: 'Shop domain', type: 'text', secret: false },
      { key: 'accessToken', label: 'Access token', type: 'password', secret: true },
    ],
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'Sales channel',
    envKeys: ['WOOCOMMERCE_SITE_URL', 'WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'],
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'url', secret: false },
      { key: 'consumerKey', label: 'Consumer key', type: 'password', secret: true },
      { key: 'consumerSecret', label: 'Consumer secret', type: 'password', secret: true },
    ],
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    category: 'Sales channel',
    envKeys: ['PRESTASHOP_SITE_URL', 'PRESTASHOP_API_KEY'],
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'url', secret: false },
      { key: 'apiKey', label: 'API key', type: 'password', secret: true },
    ],
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    category: 'Advertising',
    envKeys: ['META_ADS_ACCOUNT_ID', 'META_ADS_ACCESS_TOKEN'],
    fields: [
      { key: 'accountId', label: 'Ad account ID', type: 'text', secret: false },
      { key: 'accessToken', label: 'Access token', type: 'password', secret: true },
    ],
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    category: 'Advertising',
    envKeys: ['GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_DEVELOPER_TOKEN'],
    fields: [
      { key: 'customerId', label: 'Customer ID', type: 'text', secret: false },
      { key: 'developerToken', label: 'Developer token', type: 'password', secret: true },
    ],
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    category: 'Analytics',
    envKeys: ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET'],
    fields: [
      { key: 'measurementId', label: 'Measurement ID', type: 'text', secret: false },
      { key: 'apiSecret', label: 'API secret', type: 'password', secret: true },
    ],
  },
  {
    id: 'email_provider',
    name: 'Email provider',
    category: 'Messaging',
    envKeys: ['EMAIL_PROVIDER', 'EMAIL_API_KEY'],
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', secret: false },
      { key: 'apiKey', label: 'API key', type: 'password', secret: true },
      { key: 'fromEmail', label: 'From email', type: 'email', secret: false },
    ],
  },
  {
    id: 'sms_provider',
    name: 'SMS provider',
    category: 'Messaging',
    envKeys: ['SMS_PROVIDER', 'SMS_API_KEY'],
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', secret: false },
      { key: 'apiKey', label: 'API key', type: 'password', secret: true },
      { key: 'senderId', label: 'Sender ID', type: 'text', secret: false },
    ],
  },
  {
    id: 'whatsapp_provider',
    name: 'WhatsApp provider',
    category: 'Messaging',
    envKeys: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', type: 'text', secret: false },
      { key: 'accessToken', label: 'Access token', type: 'password', secret: true },
    ],
  },
  {
    id: 'ai_provider',
    name: 'AI provider',
    category: 'AI',
    envKeys: ['OPENAI_API_KEY', 'AI_PROVIDER'],
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', secret: false },
      { key: 'model', label: 'Model', type: 'text', secret: false },
      { key: 'apiKey', label: 'API key', type: 'password', secret: true },
    ],
  },
];

function now() {
  return new Date().toISOString();
}

function maskValue(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 6) return '******';
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function envHasAny(env, keys) {
  return keys.some((key) => Boolean(env?.[key]));
}

function normalizeStored(record = {}) {
  return {
    status: ['connected', 'disconnected', 'error'].includes(record.status) ? record.status : 'disconnected',
    lastSync: String(record.lastSync || record.lastSyncAt || ''),
    lastTestAt: String(record.lastTestAt || ''),
    config: record.config && typeof record.config === 'object' ? record.config : {},
    secrets: record.secrets && typeof record.secrets === 'object' ? record.secrets : {},
    message: String(record.message || ''),
  };
}

export function createIntegrationSettingsService({ env, settingsRepo, auditLogService, notificationService }) {
  async function getSettings() {
    return settingsRepo.getAll();
  }

  async function saveIntegrations(nextIntegrations) {
    await settingsRepo.patchSection('integrations', nextIntegrations);
  }

  function publicRecord(definition, stored = {}) {
    const normalized = normalizeStored(stored);
    const hasEnvSecrets = envHasAny(env, definition.envKeys);
    const secretFields = definition.fields.filter((field) => field.secret);
    const config = {};
    const maskedSecrets = {};

    definition.fields.forEach((field) => {
      if (field.secret) {
        const secretMeta = normalized.secrets[field.key] || {};
        maskedSecrets[field.key] = {
          hasValue: Boolean(secretMeta.hasValue || hasEnvSecrets),
          maskedValue: secretMeta.maskedValue || (hasEnvSecrets ? '********' : ''),
          source: secretMeta.source || (hasEnvSecrets ? 'backend_env' : ''),
        };
      } else {
        config[field.key] = normalized.config[field.key] || '';
      }
    });

    const status = normalized.status === 'disconnected' && hasEnvSecrets ? 'connected' : normalized.status;
    return {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      status,
      connected: status === 'connected',
      lastSync: normalized.lastSync,
      lastTestAt: normalized.lastTestAt,
      message: normalized.message,
      fields: definition.fields,
      config,
      secrets: maskedSecrets,
      envConfigured: hasEnvSecrets,
    };
  }

  async function listIntegrations() {
    const settings = await getSettings();
    const integrations = settings.integrations || {};
    return INTEGRATION_DEFINITIONS.map((definition) => publicRecord(definition, integrations[definition.id]));
  }

  async function getIntegration(id) {
    const definition = INTEGRATION_DEFINITIONS.find((entry) => entry.id === id);
    if (!definition) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    const settings = await getSettings();
    return publicRecord(definition, settings.integrations?.[id]);
  }

  async function connect(context, id, payload = {}) {
    const definition = INTEGRATION_DEFINITIONS.find((entry) => entry.id === id);
    if (!definition) throw new AppError(404, 'NOT_FOUND', 'Integration not found');
    const settings = await getSettings();
    const current = normalizeStored(settings.integrations?.[id]);
    const config = { ...current.config };
    const secrets = { ...current.secrets };

    definition.fields.forEach((field) => {
      const value = payload.config?.[field.key] ?? payload[field.key];
      if (field.secret) {
        if (value) {
          secrets[field.key] = {
            hasValue: true,
            maskedValue: maskValue(value),
            source: 'encrypted_backend_storage_required',
            updatedAt: now(),
          };
        }
      } else if (value !== undefined) {
        config[field.key] = String(value);
      }
    });

    const nextIntegrations = {
      ...(settings.integrations || {}),
      [id]: {
        status: 'connected',
        lastSync: current.lastSync,
        lastTestAt: current.lastTestAt,
        config,
        secrets,
        message: 'Connected. Secret values are masked and never returned by the API.',
      },
    };
    await saveIntegrations(nextIntegrations);
    await auditLogService.record(context, 'integrations.connect', 'integration', id, { config, secretFields: Object.keys(secrets) });
    return getIntegration(id);
  }

  async function disconnect(context, id) {
    const settings = await getSettings();
    const current = normalizeStored(settings.integrations?.[id]);
    const nextIntegrations = {
      ...(settings.integrations || {}),
      [id]: {
        ...current,
        status: 'disconnected',
        message: 'Disconnected by user.',
      },
    };
    await saveIntegrations(nextIntegrations);
    await auditLogService.record(context, 'integrations.disconnect', 'integration', id, {});
    return getIntegration(id);
  }

  async function testConnection(context, id) {
    const integration = await getIntegration(id);
    const healthy = integration.connected || integration.envConfigured;
    const settings = await getSettings();
    const current = normalizeStored(settings.integrations?.[id]);
    const nextIntegrations = {
      ...(settings.integrations || {}),
      [id]: {
        ...current,
        lastTestAt: now(),
        status: healthy ? current.status : 'error',
        message: healthy ? 'Health check passed with stored metadata or backend env.' : 'Missing connection metadata or backend env credentials.',
      },
    };
    await saveIntegrations(nextIntegrations);
    if (!healthy) {
      await notificationService.notify({
        type: 'warning',
        priority: 'high',
        title: 'Integration test failed',
        message: `${integration.name} is missing connection credentials.`,
        link: '/admin/integrations-settings',
        entityType: 'integration',
        entityId: id,
        dedupeKey: `integration_test_failed:${id}`,
      });
    }
    await auditLogService.record(context, 'integrations.test', 'integration', id, { healthy });
    return { ...(await getIntegration(id)), healthy };
  }

  async function health() {
    const rows = await listIntegrations();
    const connected = rows.filter((row) => row.connected || row.envConfigured).length;
    const failed = rows.filter((row) => row.status === 'error').length;
    return {
      ok: failed === 0,
      total: rows.length,
      connected,
      failed,
      checkedAt: now(),
      integrations: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        connected: row.connected,
        envConfigured: row.envConfigured,
        lastSync: row.lastSync,
        lastTestAt: row.lastTestAt,
        message: row.message,
      })),
    };
  }

  return {
    listIntegrations,
    connect,
    disconnect,
    testConnection,
    health,
  };
}
