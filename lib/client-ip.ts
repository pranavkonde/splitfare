/**
 * Best-effort client IP for rate limiting. Prefer headers set by a trusted edge
 * (Cloudflare, Vercel, etc.); avoid treating spoofed X-Forwarded-For as reliable
 * without a proxy that normalizes it.
 */
export function getRateLimitIdentifier(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[0]!;
  }
  return "127.0.0.1";
}
