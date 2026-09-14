export const cacheKey = (namespace: string, identifier: string | number): string =>
  `cache:${namespace}:${identifier}`;
