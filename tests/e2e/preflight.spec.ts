import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const REQUIRED = [
  'E2E_BASE_URL',
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_RESPONSIBLE_EMAIL',
  'E2E_RESPONSIBLE_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
] as const;

// KELYANI Staging project. This prevents a mistakenly configured E2E secret
// from sending test traffic to Production or to another Supabase project.
const STAGING_HOST = 'jsllksnmylpxcgqaeidq.supabase.co';

test('Préflight — Vercel Preview + Supabase Staging uniquement', async ({ page }) => {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  expect(missing, `Secrets GitHub Actions manquants: ${missing.join(', ')}`).toEqual([]);

  const baseUrl = new URL(process.env.E2E_BASE_URL!);
  expect(baseUrl.protocol).toBe('https:');
  expect(baseUrl.hostname).toMatch(/\.vercel\.app$/);
  expect(baseUrl.hostname).not.toBe('tapmarrakech.vercel.app');

  const supabaseUrl = new URL(process.env.E2E_SUPABASE_URL!);
  expect(supabaseUrl.hostname, 'Le projet Supabase doit être exactement le projet Staging KELYANI')
    .toBe(STAGING_HOST);

  const response = await page.goto(baseUrl.toString(), { waitUntil: 'domcontentloaded' });
  expect(response, 'La Preview doit répondre').not.toBeNull();
  expect(response!.status(), 'HTTP Preview').toBeLessThan(400);

  const supabase = createClient(
    supabaseUrl.toString(),
    process.env.E2E_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(error?.message ?? null, 'Connexion du Responsable QA sur Staging').toBeNull();
  expect(data.user?.id, 'Utilisateur Responsable authentifié sur Staging').toBeTruthy();

  const { data: establishments, error: establishmentsError } =
    await supabase.rpc('get_my_establishments');
  expect(establishmentsError?.message ?? null, 'RPC get_my_establishments sur Staging').toBeNull();
  expect(establishments?.length ?? 0, 'Le Responsable QA doit avoir au moins un établissement')
    .toBeGreaterThan(0);

  await supabase.auth.signOut();
});

test('Smoke — la Preview sert bien l’application KELYANI', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('body')).toContainText(/KELYANI|Kelyani/i);
});
