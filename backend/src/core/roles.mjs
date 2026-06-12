const ROLE_ALIASES = new Map([
  ['executive', 'Executive'],
  ['operations', 'Operations'],
  ['operation', 'Operations'],
  ['opérations', 'Operations'],
  ['opÃ©rations', 'Operations'],
  ['marketing', 'Marketing'],
  ['support', 'Support'],
]);

export const SUPPORTED_ROLES = ['Executive', 'Operations', 'Marketing', 'Support'];

export function normalizeRole(input) {
  const normalized = String(input || '')
    .trim()
    .toLowerCase();
  return ROLE_ALIASES.get(normalized) || null;
}

export function assertRole(input) {
  const role = normalizeRole(input);
  if (!role) {
    return null;
  }
  return role;
}

export function isRoleAllowed(role, allowedRoles = []) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return false;
  }
  const normalizedAllowed = allowedRoles
    .map((item) => normalizeRole(item))
    .filter(Boolean);
  return normalizedAllowed.includes(normalizedRole);
}
