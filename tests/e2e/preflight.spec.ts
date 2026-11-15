import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const required = [
  'E2E_BASE_URL',
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_CLIENT_EMAIL',
  'E2E_CLIENT_PASSWORD',
  'E2E_RESPONSIBLE_EMAIL',
  'E2E_RESPONSIBLE_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const;

test('Préflight — secrets, Preview Vercel et Supabase Staging', async ({ page }) => {
  const missing = required.filter((key) => !process.env[key]);
  expect(missing, `Secrets GitHub Actions manquants: ${missing.join(', ')}`).toEqual([]);

  const baseUrl = process.env.E2E_BASE_URL!;
  expect(new URL(baseUrl).hostname).toMatch(/vercel\.app$/);

  const supabase = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const stagingHost = new URL(process.env.E2E_SUPABASE_URL!).hostname;
  expect(stagingHost).toContain('.supabase.co');

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  expect(response, 'La Preview doit répondre').not.toBeNull();
  expect(response!.status(), 'HTTP Preview').toBeLessThan(400);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(error?.message ?? null, 'Connexion au compte Responsable sur Staging').toBeNull();
  expect(data.user?.id, 'Utilisateur Responsable authentifié').toBeTruthy();

  const { data: establishments, error: establishmentsError } = await supabase.rpc('get_my_establishments');
  expect(establishmentsError?.message ?? null, 'RPC get_my_establishments').toBeNull();
  expect(establishments?.length ?? 0, 'Le Responsable doit avoir au moins un établissement').toBeGreaterThan(0);

  await supabase.auth.signOut();
});
