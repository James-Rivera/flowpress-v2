type RateEntry = {
  count: number;
  resetsAt: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const entries = new Map<string, RateEntry>();

export function consumeUploadRateLimit(key: string, limit: number, now = Date.now()) {
  if (entries.size > 10_000) {
    for (const [entryKey, entry] of entries) {
      if (entry.resetsAt <= now) {
        entries.delete(entryKey);
      }
    }
  }

  const existing = entries.get(key);
  const entry = !existing || existing.resetsAt <= now
    ? { count: 0, resetsAt: now + WINDOW_MS }
    : existing;

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetsAt - now) / 1000)),
    };
  }

  entry.count += 1;
  entries.set(key, entry);

  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetsAt - now) / 1000)),
  };
}
