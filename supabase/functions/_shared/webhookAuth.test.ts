import { validateWebhookSecret } from './webhookAuth.ts';

Deno.test('fails closed when webhook secret is missing', () => {
  if (validateWebhookSecret('', 'anything') !== 'not_configured') {
    throw new Error('A missing configured secret must block webhook processing');
  }
});

Deno.test('rejects missing, mismatched and wrong-length request secrets', () => {
  const invalid = ['', 'wrong-secret', 'shared-secret-extra'];
  for (const value of invalid) {
    if (validateWebhookSecret('shared-secret', value) !== 'unauthorized') {
      throw new Error(`Expected request secret to be rejected: ${value}`);
    }
  }
});

Deno.test('accepts only the exact configured webhook secret', () => {
  if (validateWebhookSecret('shared-secret', 'shared-secret') !== null) {
    throw new Error('The exact configured secret should be accepted');
  }
});
