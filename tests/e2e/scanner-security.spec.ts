import { test, expect } from '@playwright/test';

test('Scanner fidélité — refuse un lien sans jeton', async ({ page }) => {
  await page.goto('/employee');
  await expect(page.getByRole('heading', { name: 'Scanner indisponible' })).toBeVisible();
  await expect(page.getByText('Lien scanner invalide.')).toBeVisible();
});

test('Scanner fidélité — refuse un jeton inexistant sans ouvrir de session', async ({ page }) => {
  await page.goto('/employee?scanner=e2e-invalid-token-not-a-real-secret');
  await expect(page.getByRole('heading', { name: 'Scanner indisponible' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lien scanner invalide ou introuvable.')).toBeVisible();
});
