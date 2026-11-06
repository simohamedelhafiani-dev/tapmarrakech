import { test, expect } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page, role: 'admin' | 'responsible', email: string, password: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: role === 'admin' ? /Administrateur/ : /Responsable/ }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrer dans KELYANI' }).click();
}

test('Responsable — connexion et accès au tableau de bord', async ({ page }) => {
  await signIn(page, 'responsible', process.env.E2E_RESPONSIBLE_EMAIL!, process.env.E2E_RESPONSIBLE_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });
  await expect(page.getByText(/Tableau de bord|Vue d'ensemble|Bienvenue/i).first()).toBeVisible({ timeout: 30_000 });
});

test('Admin — connexion et accès à la console d’administration', async ({ page }) => {
  await signIn(page, 'admin', process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin(?:$|\/)/, { timeout: 30_000 });
  await expect(page.getByText('Établissements', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Responsables', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});
