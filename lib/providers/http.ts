export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
const cache = new Map<
  string,
  { until: number; value: unknown; retrievedAt: string }
>();
export function retrievalTime(url: string): string {
  return cache.get(url)?.retrievedAt ?? new Date().toISOString();
}
const pending = new Map<string, Promise<unknown>>();
const blocked = new Map<string, number>();
export async function providerJson(
  url: string,
  ttl = 15_000,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const old = cache.get(url);
  if (old && old.until > Date.now()) return old.value;
  if (pending.has(url)) return pending.get(url)!;
  const host = new URL(url).host;
  if ((blocked.get(host) ?? 0) > Date.now())
    throw new ProviderError(
      `${host} is rate limited. Requests paused; retry later.`,
      429,
    );
  const task = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json", ...headers },
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        if (res.status === 429) {
          const seconds = Math.min(
            300,
            Math.max(10, Number(res.headers.get("retry-after")) || 60),
          );
          blocked.set(host, Date.now() + seconds * 1000);
          throw new ProviderError(
            `${host} rate limit reached. Paused for ${seconds}s.`,
            429,
          );
        }
        if (!res.ok)
          throw new ProviderError(
            `${host} returned HTTP ${res.status}.`,
            res.status,
          );
        const value: unknown = await res.json();
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
        cache.set(url, {
          until: Date.now() + ttl,
          value,
          retrievedAt: new Date().toISOString(),
        });
        return value;
      } catch (e) {
        if (e instanceof ProviderError && (e.status === 429 || e.status < 500))
          throw e;
        if (attempt === 1) throw e;
        await new Promise((r) => setTimeout(r, 250 + Math.random() * 300));
      }
    }
    throw new ProviderError("Provider unavailable.");
  })();
  pending.set(url, task);
  try {
    return await task;
  } finally {
    pending.delete(url);
  }
}
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Provider request failed.";
}
