import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STAGING_REF = 'jsllksnmylpxcgqaeidq';
const PRIMARY_ESTABLISHMENT = '9366af04-bda7-4fb1-a521-8c08868b27ad';
const SECOND_ESTABLISHMENT = 'aaacb2ac-ef2e-4318-8ec7-01e9f271681c';

function stagingClient() {
  const url = process.env.E2E_SUPABASE_URL!;
  expect(new URL(url).hostname).toBe(`${STAGING_REF}.supabase.co`);
  return createClient(url, process.env.E2E_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verify(manager: SupabaseClient, customerId: string) {
  const { data, error } = await manager.rpc('fn_test_verify_loyalty_data', {
    p_establishment_id: PRIMARY_ESTABLISHMENT,
    p_customer_id: customerId,
  });
  expect(error, 'Pont SQL Staging doit autoriser le Responsable sur son établissement').toBeNull();
  expect(data?.customer_id).toBe(customerId);
  expect(data?.establishment_id).toBe(PRIMARY_ESTABLISHMENT);
  return data as {
    customer_id: string;
    establishment_id: string;
    points_balance: number;
    total_points_earned: number;
    total_points_redeemed: number;
    visit_count: number;
    transactions: Array<{ id: string; type: string; points: number; amount: number | null }>;
  };
}

test('Parcours Client — inscription publique, 3 scans, récompense et assertions SQL après chaque mutation', async () => {
  const manager = stagingClient();
  const publicClient = stagingClient();

  const { error: loginError } = await manager.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(loginError).toBeNull();

  const { data: establishments, error: accessError } = await manager.rpc('get_my_establishments');
  expect(accessError).toBeNull();
  expect((establishments ?? []).some((item: { id: string }) => item.id === PRIMARY_ESTABLISHMENT)).toBeTruthy();

  const { data: scannerRows, error: scannerError } = await manager.rpc(
    'get_or_create_establishment_scanner_link',
    { p_establishment_id: PRIMARY_ESTABLISHMENT },
  );
  expect(scannerError).toBeNull();
  const scanner = Array.isArray(scannerRows) ? scannerRows[0] : scannerRows;
  expect(scanner?.scanner_token).toBeTruthy();

  const unique = Date.now().toString().slice(-8);
  const phone = `+2126${unique}`;
  const firstName = `QA-${unique}`;

  // 1) Public loyalty enrollment (the actual public enrollment RPC used by /loyalty/join).
  const { data: enrollmentRows, error: enrollmentError } = await publicClient.rpc(
    'register_public_loyalty_customer_for_enrollment_v2',
    {
      p_establishment_id: PRIMARY_ESTABLISHMENT,
      p_first_name: firstName,
      p_last_name: 'Automation',
      p_phone: phone,
      p_birth_date: null,
      p_email: null,
      p_interests: [],
      p_marketing_consent: false,
      p_notification_consent: false,
      p_preferred_channel: 'NONE',
      p_visit_frequency: null,
    },
  );
  expect(enrollmentError, 'Inscription publique').toBeNull();
  const enrollment = Array.isArray(enrollmentRows) ? enrollmentRows[0] : enrollmentRows;
  expect(enrollment?.access_token).toBeTruthy();

  const { data: cardRows, error: cardError } = await publicClient.rpc('get_public_loyalty_card', {
    p_access_token: enrollment.access_token,
  });
  expect(cardError).toBeNull();
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;
  expect(card?.first_name).toBe(firstName);
  expect(card?.establishment_id).toBe(PRIMARY_ESTABLISHMENT);

  // SQL proof of customer/profile + loyalty card insertion before earning points.
  const initial = await verify(manager, card.customer_id);
  expect(initial.points_balance).toBe(0);
  expect(initial.total_points_earned).toBe(0);
  expect(initial.visit_count).toBe(0);
  expect(initial.transactions).toHaveLength(0);

  // 2) Three real scanner RPC calls, each followed by SQL verification.
  for (let visit = 1; visit <= 3; visit += 1) {
    const invoice = `QA-${unique}-VISIT-${visit}`;
    const { data: newBalance, error } = await publicClient.rpc('add_loyalty_points_by_scanner', {
      p_scanner_token: scanner.scanner_token,
      p_customer_id: card.customer_id,
      p_amount: 1,
      p_invoice_number: invoice,
      p_description: `Playwright E2E visit ${visit}`,
    });
    expect(error, `Scan ${visit} doit réussir`).toBeNull();
    expect(Number(newBalance)).toBe(visit);

    const state = await verify(manager, card.customer_id);
    expect(Number(state.points_balance)).toBe(visit);
    expect(Number(state.total_points_earned)).toBe(visit);
    expect(Number(state.visit_count)).toBe(visit);
    expect(state.transactions.filter((tx) => tx.type === 'EARN')).toHaveLength(visit);
    expect(state.transactions.some((tx) => tx.type === 'EARN' && tx.points === 1)).toBeTruthy();
  }

  // 3) Create a 3-point gift, claim it from the public loyalty-card token, redeem at scanner.
  const rewardName = `QA Reward ${unique}`;
  const { data: rewardId, error: rewardError } = await manager.rpc('create_loyalty_reward', {
    p_establishment_id: PRIMARY_ESTABLISHMENT,
    p_name: rewardName,
    p_description: 'Temporary Playwright Staging fixture',
    p_points_required: 3,
    p_reward_type: 'GIFT',
    p_discount_percent: null,
    p_discount_max_amount: null,
  });
  expect(rewardError, 'Création récompense par Responsable').toBeNull();
  expect(rewardId).toBeTruthy();

  const { data: claimRows, error: claimError } = await publicClient.rpc('create_public_loyalty_reward_claim', {
    p_access_token: enrollment.access_token,
    p_reward_id: rewardId,
  });
  expect(claimError, 'Réclamation publique de la récompense').toBeNull();
  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  expect(claim?.claim_token).toBeTruthy();
  expect(claim?.points_required).toBe(3);

  const { data: redemptionRows, error: redemptionError } = await publicClient.rpc('redeem_loyalty_reward_claim', {
    p_scanner_token: scanner.scanner_token,
    p_claim_token: claim.claim_token,
    p_invoice_amount: null,
    p_invoice_number: `QA-${unique}-REWARD`,
  });
  expect(redemptionError, 'Validation de la récompense au scanner').toBeNull();
  const redemption = Array.isArray(redemptionRows) ? redemptionRows[0] : redemptionRows;
  expect(Number(redemption?.new_points_balance)).toBe(0);
  expect(Number(redemption?.points_used)).toBe(3);

  const { data: claimAfterRows, error: claimAfterError } = await publicClient.rpc(
    'get_public_loyalty_reward_claim',
    { p_claim_token: claim.claim_token },
  );
  expect(claimAfterError, 'Lecture publique de la réclamation après validation').toBeNull();
  const claimAfter = Array.isArray(claimAfterRows) ? claimAfterRows[0] : claimAfterRows;
  expect(claimAfter?.status).toBe('REDEEMED');

  const finalState = await verify(manager, card.customer_id);
  expect(Number(finalState.points_balance)).toBe(0);
  expect(Number(finalState.total_points_earned)).toBe(3);
  expect(Number(finalState.total_points_redeemed)).toBe(3);
  expect(Number(finalState.visit_count)).toBe(3);
  expect(finalState.transactions.filter((tx) => tx.type === 'EARN')).toHaveLength(3);
  const rewardTransactions = finalState.transactions.filter((tx) => tx.type === 'REDEEM');
  expect(rewardTransactions).toHaveLength(1);
  expect(Number(rewardTransactions[0].points)).toBe(-3);

  await manager.auth.signOut();
});

test('Intrus — scanner d’un établissement B ne peut pas créditer un client de A', async () => {
  const manager = stagingClient();
  const admin = stagingClient();
  const publicClient = stagingClient();

  const { error: managerLoginError } = await manager.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(managerLoginError).toBeNull();
  const { error: adminLoginError } = await admin.auth.signInWithPassword({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  });
  expect(adminLoginError).toBeNull();

  // The global Admin obtains the legitimate scanner token for establishment B.
  const { data: scannerRows, error: scannerError } = await admin.rpc(
    'get_or_create_establishment_scanner_link',
    { p_establishment_id: SECOND_ESTABLISHMENT },
  );
  expect(scannerError, 'Admin doit pouvoir accéder au scanner de B').toBeNull();
  const scanner = Array.isArray(scannerRows) ? scannerRows[0] : scannerRows;
  expect(scanner?.scanner_token).toBeTruthy();

  // Client A is created through the public enrollment path, then asserted via SQL bridge.
  const unique = Date.now().toString().slice(-8);
  const { data: enrollmentRows, error: enrollmentError } = await publicClient.rpc(
    'register_public_loyalty_customer_for_enrollment_v2',
    {
      p_establishment_id: PRIMARY_ESTABLISHMENT,
      p_first_name: `QA-INTRUDER-${unique}`,
      p_last_name: 'Isolation',
      p_phone: `+2126${unique}`,
      p_birth_date: null,
      p_email: null,
      p_interests: [],
      p_marketing_consent: false,
      p_notification_consent: false,
      p_preferred_channel: 'NONE',
      p_visit_frequency: null,
    },
  );
  expect(enrollmentError).toBeNull();
  const enrollment = Array.isArray(enrollmentRows) ? enrollmentRows[0] : enrollmentRows;
  const { data: cardRows, error: cardError } = await publicClient.rpc('get_public_loyalty_card', {
    p_access_token: enrollment.access_token,
  });
  expect(cardError).toBeNull();
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;
  const before = await verify(manager, card.customer_id);

  // Scanner B tries to award 999 points to customer A. The RPC must reject it.
  const { error: attackError } = await publicClient.rpc('add_loyalty_points_by_scanner', {
    p_scanner_token: scanner.scanner_token,
    p_customer_id: card.customer_id,
    p_amount: 999,
    p_invoice_number: `QA-INTRUDER-${unique}`,
    p_description: 'Cross-establishment attack simulation',
  });
  expect(attackError, 'Le scanner B ne doit pas modifier un client de A').not.toBeNull();

  // SQL proof that the attempted write produced no balance or transaction change.
  const after = await verify(manager, card.customer_id);
  expect(after.points_balance).toBe(before.points_balance);
  expect(after.total_points_earned).toBe(before.total_points_earned);
  expect(after.visit_count).toBe(before.visit_count);
  expect(after.transactions).toHaveLength(before.transactions.length);

  await Promise.all([manager.auth.signOut(), admin.auth.signOut()]);
});


test('Admin — création établissement, attribution Responsable et accès à son Dashboard', async ({ page }) => {
  const admin = stagingClient();
  const manager = stagingClient();
  const { error: adminLoginError } = await admin.auth.signInWithPassword({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  });
  expect(adminLoginError).toBeNull();

  const { data: managerProfile, error: managerProfileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', process.env.E2E_RESPONSIBLE_EMAIL!)
    .single();
  expect(managerProfileError, 'Compte Responsable de test trouvé').toBeNull();

  const suffix = Date.now().toString();
  const name = `QA E2E Establishment ${suffix}`;
  const slug = `qa-e2e-establishment-${suffix}`;

  let createdEstablishmentId: string | null = null;
  let assignmentRestored = false;

  try {
    // Create the establishment through the actual Admin UI form.
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/login');
    await page.getByRole('button', { name: /Administrateur/i }).click();
    await page.locator('input[type="email"]').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /Entrer dans KELYANI/i }).click();
    await expect(page).toHaveURL(/\/admin(?:$|\/)/, { timeout: 30_000 });

    await page.getByText('Établissements', { exact: true }).first().click();
    await page.getByRole('button', { name: /Nouvel établissement/i }).click();
    await page.getByPlaceholder('Ex : Restaurant Atlas').fill(name);
    await page.getByPlaceholder('restaurant-atlas').fill(slug);

    const typeSelect = page.locator('select').filter({ has: page.locator('option', { hasText: /restaurant|commerce|salon|café/i }) }).first();
    await expect(typeSelect).toBeVisible();
    const typeOption = await typeSelect.locator('option:not([value=""])').first().getAttribute('value');
    expect(typeOption).toBeTruthy();
    await typeSelect.selectOption(typeOption!);
    await page.getByRole('button', { name: 'Créer l’établissement' }).click();

    // SQL/API assertion: persisted establishment row and generated id.
    const { data: created, error: createdError } = await admin
      .from('establishments')
      .select('id,name,slug,ai_business_type_id')
      .eq('slug', slug)
      .single();
    expect(createdError, 'Insertion établissement vérifiée en base').toBeNull();
    expect(created.name).toBe(name);
    expect(created.ai_business_type_id).toBeTruthy();
    createdEstablishmentId = created.id;

    // Assign the existing QA Responsable via the same secured Edge Function as the UI.
    const { data: assignment, error: assignmentError } = await admin.functions.invoke('admin-manage-responsibles', {
      body: { action: 'assign', user_id: managerProfile.id, establishment_id: created.id },
    });
    expect(assignmentError, 'Edge Function attribution Responsable').toBeNull();
    expect(assignment?.success).toBeTruthy();

    const { data: staffRow, error: staffError } = await admin
      .from('establishment_staff')
      .select('user_id,establishment_id,role,active')
      .eq('user_id', managerProfile.id)
      .eq('establishment_id', created.id)
      .eq('role', 'MANAGER')
      .eq('active', true)
      .single();
    expect(staffError, 'Rattachement Responsable vérifié en base').toBeNull();
    expect(staffRow.establishment_id).toBe(created.id);

    // The assigned Responsable must resolve the new establishment and reach the Dashboard.
    const { error: managerLoginError } = await manager.auth.signInWithPassword({
      email: process.env.E2E_RESPONSIBLE_EMAIL!,
      password: process.env.E2E_RESPONSIBLE_PASSWORD!,
    });
    expect(managerLoginError).toBeNull();
    const { data: accessible, error: accessibleError } = await manager.rpc('get_my_establishments');
    expect(accessibleError).toBeNull();
    expect((accessible ?? []).some((row: { id: string }) => row.id === created.id)).toBeTruthy();

    await page.goto('/login');
    await page.getByRole('button', { name: /Responsable/i }).click();
    await page.locator('input[type="email"]').fill(process.env.E2E_RESPONSIBLE_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_RESPONSIBLE_PASSWORD!);
    await page.getByRole('button', { name: /Entrer dans KELYANI/i }).click();
    await expect(page).toHaveURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  } finally {
    // Restore the pre-existing QA Responsable to its original Riad Demo assignment.
    const { data: restored, error: restoreError } = await admin.functions.invoke('admin-manage-responsibles', {
      body: { action: 'assign', user_id: managerProfile.id, establishment_id: PRIMARY_ESTABLISHMENT },
    });
    assignmentRestored = !restoreError && Boolean(restored?.success);
    await manager.auth.signOut();
    await admin.auth.signOut();
    expect(assignmentRestored, 'Le compte Responsable QA doit être restauré sur Riad Demo').toBeTruthy();
  }

  expect(createdEstablishmentId).toBeTruthy();
});
