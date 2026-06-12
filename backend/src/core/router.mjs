function compilePath(pathPattern) {
  const keys = [];
  const regexPattern = pathPattern
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return {
    keys,
    regex: new RegExp(`^${regexPattern}$`),
  };
}

export function createRouter() {
  const routes = [];

  function register(method, pathPattern, handler) {
    const compiled = compilePath(pathPattern);
    routes.push({
      method: method.toUpperCase(),
      pathPattern,
      handler,
      ...compiled,
    });
  }

  function match(method, path) {
    const targetMethod = method.toUpperCase();
    for (const route of routes) {
      if (route.method !== targetMethod) {
        continue;
      }
      const matches = path.match(route.regex);
      if (!matches) {
        continue;
      }

      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(matches[index + 1] || '');
      });

      return {
        handler: route.handler,
        params,
        method: route.method,
        pathPattern: route.pathPattern,
      };
    }
    return null;
  }

  return {
    register,
    match,
  };
}
