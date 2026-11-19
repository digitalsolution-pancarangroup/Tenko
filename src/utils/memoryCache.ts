interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 120_000,
  forceRefresh: boolean = false,
  shouldCache?: (data: T) => boolean
): Promise<T> {
  const now = Date.now();

  if (!forceRefresh) {
    const existing = cacheStore.get(key) as CacheEntry<T> | undefined;
    if (existing && existing.expiresAt > now) {
      return existing.data;
    }

    const inFlight = inFlightStore.get(key) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (!shouldCache || shouldCache(data)) {
        cacheStore.set(key, {
          data,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return data;
    } finally {
      inFlightStore.delete(key);
    }
  })();

  inFlightStore.set(key, promise);
  return promise;
}

export function invalidateCache(key: string): void {
  cacheStore.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

export function clearAllCaches(): void {
  cacheStore.clear();
  inFlightStore.clear();
}
