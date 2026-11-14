import { test, expect } from '@playwright/test';

const STAGING_REF = 'jsllksnmylpxcgqaeidq';

function stagingEndpoint(slug: string) {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? '';
  expect(supabaseUrl, 'E2E_SUPABASE_URL doit être défini').not.toBe('');
  expect(new URL(supabaseUrl).hostname).toBe(`${STAGING_REF}.supabase.co`);
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
  return `${baseUrl}/functions/v1/${slug}`;
}

function stagingApiKey() {
  const apiKey = process.env.E2E_SUPABASE_ANON_KEY ?? '';
  expect(apiKey, 'E2E_SUPABASE_ANON_KEY doit être défini').not.toBe('');
  return apiKey;
}

test('Google Business — les fonctions privées refusent les appels sans session', async ({ request }) => {
  const apiKey = stagingApiKey();
  const privateFunctions = [
    'google-business-oauth',
    'google-business-sync',
    'google-business-reply',
    'analyze-reviews',
    'import-menu',
  ];

  for (const slug of privateFunctions) {
    const response = await request.post(stagingEndpoint(slug), {
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(
      response.status(),
      `${slug} doit refuser une requête sans Bearer token`,
    ).toBe(401);
  }
});

test('Google Business webhook — refuse une requête sans secret Pub/Sub', async ({ request }) => {
  const response = await request.post(stagingEndpoint('google-business-webhook'), {
    headers: { apikey: stagingApiKey(), 'Content-Type': 'application/json' },
    data: { message: {} },
  });

  // Fail-closed whether the secret is missing (503) or configured (401).
  expect([401, 503]).toContain(response.status());
  const body = await response.json();
  expect(body?.ok).toBe(false);
});
