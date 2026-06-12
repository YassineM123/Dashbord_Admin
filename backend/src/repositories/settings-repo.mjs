function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const LOCKED_CURRENCY = 'TND';
const RULE_STATUSES = ['proposed', 'pending_review', 'approved'];

function normalizeRuleStatus(value, fallback = 'approved') {
  const normalized = String(value || '').trim().toLowerCase();
  return RULE_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeRule(rule = {}) {
  return {
    ...rule,
    contains: String(rule.contains || '').trim(),
    action: String(rule.action || '').trim(),
    active: rule.active !== false,
    triggers: Number(rule.triggers || 0),
    source: String(rule.source || 'manual'),
    status: normalizeRuleStatus(rule.status, 'approved'),
  };
}

function enforceLockedCurrency(settings) {
  return {
    ...settings,
    payments: {
      ...(settings.payments || {}),
      currency: LOCKED_CURRENCY,
    },
  };
}

const defaultSettings = {
  store: {
    name: 'Ma Boutique E-commerce',
    supportEmail: 'support@example.com',
    supportPhone: '+216 XX XXX XXX',
    address: '123 Avenue Habib Bourguiba, Tunis 1000',
  },
  payments: {
    cardEnabled: true,
    codEnabled: true,
    bankTransferEnabled: false,
    currency: LOCKED_CURRENCY,
  },
  notifications: {
    newOrders: true,
    lowStock: true,
    campaignReports: true,
    executiveSummaryEnabled: true,
    executiveSummaryFrequency: 'weekly',
  },
  security: {
    sessionDuration: '24h',
  },
  agents: {
    autoReplyEnabled: true,
    tone: 'professionnel',
    language: 'fr',
  },
  agentRules: [],
};

export function createSettingsRepository(store) {
  async function writeSettings(nextValue) {
    const normalized = enforceLockedCurrency(nextValue);
    await store.write('settings', normalized);
    return normalized;
  }

  async function getAll() {
    const data = await store.read('settings', defaultSettings);
    return clone(enforceLockedCurrency(data));
  }

  async function patchSection(section, patch) {
    const current = await store.read('settings', defaultSettings);
    current[section] = {
      ...(current[section] || {}),
      ...patch,
    };
    const saved = await writeSettings(current);
    return clone(saved[section]);
  }

  async function replaceAll(nextValue) {
    const saved = await writeSettings(nextValue);
    return clone(saved);
  }

  async function listRules() {
    const current = await store.read('settings', defaultSettings);
    return clone((current.agentRules || []).map((rule) => normalizeRule(rule)));
  }

  async function createRule(rule) {
    const current = await store.read('settings', defaultSettings);
    const normalizedRule = normalizeRule(rule);
    current.agentRules = [...(current.agentRules || []).map((row) => normalizeRule(row)), normalizedRule];
    await writeSettings(current);
    return clone(normalizedRule);
  }

  async function updateRule(id, patch) {
    const current = await store.read('settings', defaultSettings);
    const index = (current.agentRules || []).findIndex((rule) => String(rule.id) === String(id));
    if (index === -1) {
      return null;
    }
    current.agentRules[index] = normalizeRule({
      ...current.agentRules[index],
      ...patch,
    });
    await writeSettings(current);
    return clone(current.agentRules[index]);
  }

  async function deleteRule(id) {
    const current = await store.read('settings', defaultSettings);
    const index = (current.agentRules || []).findIndex((rule) => String(rule.id) === String(id));
    if (index === -1) {
      return null;
    }
    const [deleted] = current.agentRules.splice(index, 1);
    await writeSettings(current);
    return clone(deleted);
  }

  return {
    getAll,
    patchSection,
    replaceAll,
    listRules,
    createRule,
    updateRule,
    deleteRule,
  };
}
