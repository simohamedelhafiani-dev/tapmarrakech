export function extractBearerToken(authorization: string | null): string | null {
  const value = authorization?.trim();
  if (!value) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(value);
  return match?.[1] ?? null;
}
