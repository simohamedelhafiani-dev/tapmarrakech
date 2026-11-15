import { expect, test } from '@playwright/test';

test('admin can verify Google Wallet Staging without creating a pass', async ({ page }) => {
  const baseUrl = process.env.E2E_BASE_URL;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const expectedSupabaseHost = new URL(process.env.E2E_SUPABASE_URL || '').hostname;

  if (!baseUrl || !email || !password || !expectedSupabaseHost) {
    throw new Error('E2E Preview URL and dedicated Staging admin credentials are required.');
  }

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
  await page.getByRole('button', { name: /fidélité/i }).click();
  await expect(page.getByText('Google Wallet · Staging')).toBeVisible();

  await page.getByRole('button', { name: 'Tester Google Wallet' }).click();
  await expect(page.getByText('Connexion validée')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/aucun pass ni donnée client/i)).toBeVisible();
});
