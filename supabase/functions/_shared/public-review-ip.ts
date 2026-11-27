/**
 * Returns the client IP only from the Cloudflare ingress header.
 *
 * X-Forwarded-For is caller-influenced and must not be used as a fallback for
 * security-sensitive rate limiting. If the trusted header is absent or
 * ambiguous, callers should fail closed rather than share or spoof a bucket.
 */
export function getTrustedClientIp(request: Request): string | null {
  const value = request.headers.get('cf-connecting-ip')?.trim();

  if (!value || value.includes(',')) {
    return null;
  }

  return value;
}
