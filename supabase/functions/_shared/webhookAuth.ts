export type WebhookSecretFailure = 'not_configured' | 'unauthorized' | null;

/** Fail closed when Pub/Sub webhook authentication is not configured. */
export function validateWebhookSecret(configuredSecret: string, suppliedSecret: string): WebhookSecretFailure {
  if (!configuredSecret) return 'not_configured';
  if (!suppliedSecret || suppliedSecret.length !== configuredSecret.length) return 'unauthorized';

  // Constant-work string comparison over the full secret length avoids an
  // early exit on the first mismatching character.
  let difference = 0;
  for (let index = 0; index < configuredSecret.length; index += 1) {
    difference |= configuredSecret.charCodeAt(index) ^ suppliedSecret.charCodeAt(index);
  }
  return difference === 0 ? null : 'unauthorized';
}
