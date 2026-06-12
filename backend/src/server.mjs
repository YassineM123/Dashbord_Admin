import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { env } from './core/env.mjs';

const app = await createApp(env);

const server = createServer(async (request, response) => {
  await app.handle(request, response);
});

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };

    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

async function isExistingBackendHealthy(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(`http://localhost:${port}/api/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.data?.ok === true && payload?.data?.service === 'admin-dashboard-backend';
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await tryListen(env.port);
} catch (error) {
  const canReuseExistingBackend =
    process.env.NODE_ENV !== 'production' &&
    error &&
    error.code === 'EADDRINUSE' &&
    (await isExistingBackendHealthy(env.port));

  if (!canReuseExistingBackend) {
    throw error;
  }

  // Keep this dev task alive so concurrently does not terminate the frontend.
  // eslint-disable-next-line no-console
  console.log(`Backend already running on http://localhost:${env.port}; reusing existing process.`);
  setInterval(() => {}, 60 * 60 * 1000);
}

// eslint-disable-next-line no-console
if (server.listening) {
  console.log(`Backend running on http://localhost:${env.port}`);
}
