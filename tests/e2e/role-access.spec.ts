import { test, expect, type Page } from '@playwright/test';

type LoginRole = 'Responsable' | 'Administrateur';

async function signIn(page: Page, role: LoginRole, email: string, password: string) {
  await page.goto('/login');

  // The current login screen first asks the user to choose their profile.
  await page.getByRole('button', { name: new RegExp(role, 'i') }).click();

  // Use input types rather than translated placeholders: the placeholders
  // depend on the selected language and are not stable test selectors.
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /Entrer dans KELYANI/i }).click();
}

test('Responsable — connexion et accès au tableau de bord', async ({ page }) => {
  await signIn(
    page,
    'Responsable',
    process.env.E2E_RESPONSIBLE_EMAIL!,
    process.env.E2E_RESPONSIBLE_PASSWORD!,
  );
  await expect(page).toHaveURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });
  await expect(page.getByText(/Tableau de bord|Vue d'ensemble|Bienvenue/i).first()).toBeVisible({ timeout: 30_000 });
});

test('Admin — connexion et accès à la console d’administration', async ({ page }) => {
  await signIn(
    page,
    'Administrateur',
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  );
  await expect(page).toHaveURL(/\/admin(?:$|\/)/, { timeout: 30_000 });
  await expect(page.getByText('Établissements', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Responsables', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});
