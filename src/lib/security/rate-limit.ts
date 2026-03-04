import { tooManyRequests } from "@/lib/http/errors";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

declare global {
  var __rateLimitStore: Map<string, RateLimitRecord> | undefined;
}

function getStore(): Map<string, RateLimitRecord> {
  if (!global.__rateLimitStore) {
    global.__rateLimitStore = new Map<string, RateLimitRecord>();
  }
  return global.__rateLimitStore;
}

export function enforceRateLimit(options: RateLimitOptions): void {
  const { key, limit, windowMs } = options;
  const now = Date.now();
  const store = getStore();

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw tooManyRequests("Rate limit exceeded");
  }

  store.set(key, { ...current, count: current.count + 1 });
}
