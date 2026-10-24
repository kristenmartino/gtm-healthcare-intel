// In-memory sliding-window rate limit, keyed by IP.
// Survives within a single Vercel function instance — not across cold
// starts or instances, but enough to block naive abuse of a public demo.

const buckets = new Map();

function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(request, { limit = 10, windowMs = 60_000 } = {}) {
  const ip = clientIp(request);
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = (buckets.get(ip) || []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
    return { ok: false, retryAfter };
  }

  recent.push(now);
  buckets.set(ip, recent);

  if (buckets.size > 5000) {
    for (const [key, times] of buckets) {
      if (times[times.length - 1] < cutoff) buckets.delete(key);
    }
  }

  return { ok: true };
}
