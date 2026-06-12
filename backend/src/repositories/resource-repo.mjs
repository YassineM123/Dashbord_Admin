import { AppError } from '../core/errors.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createArrayRepository(store, resourceName, options = {}) {
  const { idKey = 'id', defaultData = [] } = options;

  async function list() {
    const rows = await store.read(resourceName, defaultData);
    return clone(rows);
  }

  async function getById(id) {
    const rows = await store.read(resourceName, defaultData);
    return clone(rows.find((row) => String(row[idKey]) === String(id)) || null);
  }

  async function create(record) {
    const rows = await store.read(resourceName, defaultData);
    rows.push(record);
    await store.write(resourceName, rows);
    return clone(record);
  }

  async function update(id, patch) {
    const rows = await store.read(resourceName, defaultData);
    const index = rows.findIndex((row) => String(row[idKey]) === String(id));
    if (index === -1) {
      throw new AppError(404, 'NOT_FOUND', `${resourceName} item not found`);
    }
    rows[index] = { ...rows[index], ...patch };
    await store.write(resourceName, rows);
    return clone(rows[index]);
  }

  async function remove(id) {
    const rows = await store.read(resourceName, defaultData);
    const index = rows.findIndex((row) => String(row[idKey]) === String(id));
    if (index === -1) {
      throw new AppError(404, 'NOT_FOUND', `${resourceName} item not found`);
    }
    const [removed] = rows.splice(index, 1);
    await store.write(resourceName, rows);
    return clone(removed);
  }

  async function replaceAll(nextRows) {
    await store.write(resourceName, nextRows);
    return clone(nextRows);
  }

  return {
    list,
    getById,
    create,
    update,
    remove,
    replaceAll,
  };
}

export function createObjectRepository(store, resourceName, defaultData = {}) {
  async function get() {
    const data = await store.read(resourceName, defaultData);
    return clone(data);
  }

  async function patch(patchValue) {
    const current = await store.read(resourceName, defaultData);
    const merged = { ...current, ...patchValue };
    await store.write(resourceName, merged);
    return clone(merged);
  }

  async function replace(value) {
    await store.write(resourceName, value);
    return clone(value);
  }

  return {
    get,
    patch,
    replace,
  };
}
