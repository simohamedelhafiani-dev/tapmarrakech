import { expect, test } from '@playwright/test';

test('admin can verify Google Wallet Staging without creating a pass', async ({ page }) => {
  const baseUrl = process.env.E2E_BASE_URL;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const expectedSupabaseHost = new URL(process.env.E2E_SUPABASE_URL || '').hostname;
  const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (!baseUrl || !email || !password || !expectedSupabaseHost || !vercelBypassSecret) {
    throw new Error('Preview URL, Vercel bypass and dedicated Staging admin credentials are required.');
  }

  const previewOrigin = new URL(baseUrl).origin;
  await page.route(`${previewOrigin}/**`, async (route) => {
    const headers = {
      ...route.request().headers(),
      'x-vercel-protection-bypass': vercelBypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    };
    await route.continue({ headers });
  });

  await page.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host !== expectedSupabaseHost) {
      await route.abort();
      throw new Error(`Blocked Supabase request outside the configured Staging project: ${host}`);
    }
    await route.continue();
  });

  await page.goto(new URL('/login', baseUrl).toString());
  await page.getByRole('button', { name: /administrateur/i }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /entrer dans kelyani/i }).click();

  await expect(page).toHaveURL(/\/admin(?:\/|$)/, { timeout: 45_000 });
  const adminNav = page.getByRole('navigation', { name: 'Navigation administration' });
  await adminNav.getByRole('button', { name: /fidélité/i }).click();
  await expect(page).toHaveURL(/\\/admin\\/loyalty$/);
  await expect(page.getByText('Google Wallet · Staging')).toBeVisible();

  await page.getByRole('button', { name: 'Tester Google Wallet' }).click();
  await expect(page.getByText('Connexion validée')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/aucun pass ni donnée client/i)).toBeVisible();
});
