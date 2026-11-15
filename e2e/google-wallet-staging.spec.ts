import { expect, test } from '@playwright/test';

test('admin can verify Google Wallet Staging without creating a pass', async ({ page }) => {
  const baseUrl = process.env.E2E_BASE_URL;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!baseUrl || !email || !password) {
    throw new Error('E2E Preview URL and dedicated Staging admin credentials are required.');
  }

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
