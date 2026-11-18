import { test, expect, type Page } from '@playwright/test';

type LoginRole = 'Responsable' | 'Administrateur';

async function signIn(page: Page, role: LoginRole, email: string, password: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(role, 'i') }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /Entrer dans KELYANI/i }).click();
}

test('Responsable — connexion, dashboard, espace IA et restriction admin', async ({ page }) => {
  await signIn(
    page,
    'Responsable',
    process.env.E2E_RESPONSIBLE_EMAIL!,
    process.env.E2E_RESPONSIBLE_PASSWORD!,
  );

  await expect(page).toHaveURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });
  await expect(
    page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Vue d’ensemble' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Faites de chaque client un client régulier.' })).toBeVisible();

  await page.goto('/dashboard/assistant-ia');
  await expect(page).toHaveURL(/\/dashboard\/assistant-ia$/);
  await expect(page.getByRole('heading', { name: 'Votre espace d’outils intelligents' })).toBeVisible();

  // A Responsable must never enter the admin console, even by direct URL.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard(?:$|\/)/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Faites de chaque client un client régulier.' })).toBeVisible();
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
