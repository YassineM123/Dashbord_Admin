import { hashPassword, verifyPassword } from '../core/auth.mjs';
import { AppError } from '../core/errors.mjs';
import { assertRole, normalizeRole } from '../core/roles.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createUsersRepository(store, env) {
  async function list() {
    const users = await store.read('users', []);
    return clone(users);
  }

  async function sanitize(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role) || 'Executive',
      active: user.active !== false,
    };
  }

  async function ensureHashes() {
    const users = await store.read('users', []);
    let changed = false;

    for (const user of users) {
      const normalizedRole = normalizeRole(user.role);
      if (normalizedRole && normalizedRole !== user.role) {
        user.role = normalizedRole;
        changed = true;
      }

      if (user.passwordHash) {
        continue;
      }
      if (user.password) {
        user.passwordHash = hashPassword(user.password, env.passwordSalt);
        delete user.password;
        changed = true;
      }
    }

    if (changed) {
      await store.write('users', users);
    }
  }

  async function ensureBootstrapAdmin() {
    const bootstrap = env.bootstrapAdmin || {};
    const email = String(bootstrap.email || '').trim().toLowerCase();
    const password = String(bootstrap.password || '');
    if (!email || !password) {
      return null;
    }

    const role = assertRole(bootstrap.role || 'Executive') || 'Executive';
    const users = await store.read('users', []);
    const index = users.findIndex((entry) => String(entry.email || '').toLowerCase() === email);
    const existing = index >= 0 ? users[index] : null;
    const passwordHash = hashPassword(password, env.passwordSalt);
    const name = String(bootstrap.name || existing?.name || 'Admin Client');

    if (existing) {
      const next = {
        ...existing,
        email,
        name,
        role,
        active: true,
        passwordHash,
      };
      delete next.password;
      users[index] = next;
      await store.write('users', users);
      return sanitize(next);
    }

    const user = {
      id: 'u_admin_1',
      email,
      name,
      role,
      active: true,
      passwordHash,
    };
    users.push(user);
    await store.write('users', users);
    return sanitize(user);
  }

  async function authenticate(email, password) {
    await ensureHashes();
    const users = await store.read('users', []);
    const normalized = email.trim().toLowerCase();
    const user = users.find((entry) => entry.email.toLowerCase() === normalized && entry.active !== false);
    if (!user) {
      return null;
    }

    if (!verifyPassword(password, user.passwordHash, env.passwordSalt)) {
      return null;
    }

    return sanitize(user);
  }

  async function getById(id) {
    await ensureHashes();
    const users = await store.read('users', []);
    const user = users.find((entry) => String(entry.id) === String(id));
    return user ? sanitize(user) : null;
  }

  async function create(input) {
    await ensureHashes();
    const role = assertRole(input.role);
    if (!role) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid role');
    }

    const users = await store.read('users', []);
    const user = {
      id: input.id,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      role,
      active: input.active !== false,
      passwordHash: hashPassword(input.password, env.passwordSalt),
    };
    users.push(user);
    await store.write('users', users);
    return sanitize(user);
  }

  async function update(id, patch) {
    await ensureHashes();
    const users = await store.read('users', []);
    const index = users.findIndex((entry) => String(entry.id) === String(id));
    if (index === -1) {
      return null;
    }

    if ('role' in patch) {
      const role = assertRole(patch.role);
      if (!role) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid role');
      }
    }

    const current = users[index];
    const next = {
      ...current,
      ...('email' in patch ? { email: patch.email.trim().toLowerCase() } : {}),
      ...('name' in patch ? { name: patch.name } : {}),
      ...('role' in patch ? { role: assertRole(patch.role) } : {}),
      ...('active' in patch ? { active: patch.active } : {}),
    };

    if (patch.password) {
      next.passwordHash = hashPassword(patch.password, env.passwordSalt);
    }

    users[index] = next;
    await store.write('users', users);
    return sanitize(next);
  }

  async function remove(id) {
    await ensureHashes();
    const users = await store.read('users', []);
    const index = users.findIndex((entry) => String(entry.id) === String(id));
    if (index === -1) {
      return null;
    }
    const [deleted] = users.splice(index, 1);
    await store.write('users', users);
    return sanitize(deleted);
  }

  async function listAdminUsers() {
    await ensureHashes();
    const users = await list();
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role) || 'Executive',
      active: user.active !== false,
    }));
  }

  async function existsByEmail(email, exceptId = null) {
    await ensureHashes();
    const users = await store.read('users', []);
    const normalized = email.trim().toLowerCase();
    return users.some(
      (entry) =>
        entry.email.toLowerCase() === normalized && String(entry.id) !== String(exceptId || '')
    );
  }

  return {
    authenticate,
    getById,
    create,
    update,
    remove,
    listAdminUsers,
    existsByEmail,
    ensureHashes,
    ensureBootstrapAdmin,
  };
}
