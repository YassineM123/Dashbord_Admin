import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch (_error) {
    return false;
  }
}

export class JsonStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
    this.writeQueues = new Map();
    this.backupDir = join(dataDir, 'backups');
  }

  resourcePath(resourceName) {
    return join(this.dataDir, `${resourceName}.json`);
  }

  async read(resourceName, defaultValue) {
    if (this.cache.has(resourceName)) {
      return this.cache.get(resourceName);
    }

    const path = this.resourcePath(resourceName);
    const exists = await fileExists(path);
    if (!exists) {
      await this.write(resourceName, defaultValue);
      return defaultValue;
    }

    const raw = await readFile(path, 'utf8');
    const normalized = raw.replace(/^\uFEFF/, '');
    const parsed = normalized.trim() ? JSON.parse(normalized) : defaultValue;
    this.cache.set(resourceName, parsed);
    return parsed;
  }

  async enqueueWrite(resourceName, operation) {
    const previous = this.writeQueues.get(resourceName) || Promise.resolve();
    const next = previous.then(operation).catch(() => operation());
    this.writeQueues.set(resourceName, next);
    return next;
  }

  async write(resourceName, value) {
    return this.enqueueWrite(resourceName, async () => {
      const path = this.resourcePath(resourceName);
      const parent = dirname(path);
      await mkdir(parent, { recursive: true });
      await mkdir(this.backupDir, { recursive: true });

      if (await fileExists(path)) {
        const currentContent = await readFile(path, 'utf8');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(this.backupDir, `${resourceName}-${stamp}.json`);
        await writeFile(backupPath, currentContent, 'utf8');
      }

      const tmpPath = `${path}.tmp`;
      await writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf8');
      await rename(tmpPath, path);
      this.cache.set(resourceName, value);
      return value;
    });
  }
}
