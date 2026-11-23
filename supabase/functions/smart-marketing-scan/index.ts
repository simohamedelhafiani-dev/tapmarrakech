import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerToken, parseSmartConfigNumber } from '../smart-marketing-dispatch/smart-marketing-utils.ts';

const headers = { 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const supported = new Set(['winback', 'birthday', 'vip', 'progress', 'reward', 'happyhour', 'challenge', 'referral', 'comeback']);
type ConfigRow = { establishment_id: string; smart_id: string; enabled: boolean; config: Record<string, unknown> };
type Customer = { id: string; establishment_id: string; first_name: string | null; last_visit_at: string | null; visit_count: number | null; points_balance: number | null; birth_day: number | null; birth_month: number | null; stamps_balance: number | null; notification_consent: boolean | null; marketing_consent: boolean | null; };

const num = parseSmartConfigNumber;
const localDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: Number(p.day), month: Number(p.month), date: `${p.year}-${p.month}-${p.day}` };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, error: 'POST requis.' }, 405);
  const secret = Deno.env.get('SMART_MARKETING_CRON_SECRET');
  const token = extractBearerToken(req.headers.get('Authorization'));
  if (!secret || !token || token !== secret) return json({ success: false, error: 'Non autorisé.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ success: false, error: 'Configuration Supabase absente.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const date = localDateParts();
  const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const { data: configs, error: configError } = await admin.from('smart_marketing_configs').select('establishment_id,smart_id,enabled,config').eq('enabled', true);
  if (configError) return json({ success: false, error: 'Lecture configurations impossible.' }, 500);
  let scanned = 0, queued = 0, skippedUnsupported = 0;
  const errors: string[] = [];
  for (const cfg of (configs ?? []) as ConfigRow[]) {
    if (!supported.has(cfg.smart_id)) { skippedUnsupported++; continue; }
    const runInsert = await admin.from('smart_marketing_runs').insert({ establishment_id: cfg.establishment_id, smart_id: cfg.smart_id, run_type: 'SCAN', status: 'STARTED' }).select('id').single();
    if (runInsert.error || !runInsert.data) { errors.push(`${cfg.smart_id}: log start failed`); continue; }
    const runId = runInsert.data.id;
    const { data: customers, error: customerError } = await admin.from('loyalty_customers')
      .select('id,establishment_id,first_name,last_visit_at,visit_count,points_balance,birth_day,birth_month,stamps_balance,notification_consent,marketing_consent')
      .eq('establishment_id', cfg.establishment_id)
      .eq('notification_consent', true);
    if (customerError) {
      const { error: failLogError } = await admin.from('smart_marketing_runs').update({ status: 'FAILED', details: { error: 'Customer scan failed' }, finished_at: new Date().toISOString() }).eq('id', runId);
      errors.push(`${cfg.smart_id}: scan failed`);
      if (failLogError) errors.push(`${cfg.smart_id}: failure log update failed`);
      continue;
    }
    const eligible: Array<{customer:Customer; trigger:string; payload:Record<string,unknown>}> = [];
    const settings = cfg.config ?? {};
    const { data: loyaltySetting, error: settingsError } = cfg.smart_id === 'progress'
      ? await admin.from('loyalty_settings').select('stamp_goal').eq('establishment_id', cfg.establishment_id).maybeSingle()
      : { data: null, error: null };
    const runErrors: string[] = [];
    if (settingsError) {
      runErrors.push('Loyalty settings lookup failed');
      errors.push(`${cfg.smart_id}: loyalty settings lookup failed`);
    }
    // Smart Reward: notify customers once a stamp reward is unlocked (scanner cadence, not claim expiry).
    if (cfg.smart_id === 'reward') {
      const { data: rewardSettings, error: rewardSettingsError } = await admin.from('loyalty_settings')
        .select('stamp_goal,stamp_reward_name,stamp_reward_description').eq('establishment_id', cfg.establishment_id).eq('program_type', 'STAMP').eq('enabled', true).maybeSingle();
      if (rewardSettingsError) { runErrors.push('Reward settings lookup failed'); errors.push('reward: settings lookup failed'); }
      const goal = Math.max(1, num(rewardSettings?.stamp_goal, 10));
      if (rewardSettings && !rewardSettingsError) {
        for (const customer of (customers ?? []) as Customer[]) {
          const stamps = customer.stamps_balance ?? 0;
          if (customer.marketing_consent && stamps >= goal) eligible.push({ customer, trigger: `reward:${goal}:${stamps}`, payload: { stamps, goal, reward_name: rewardSettings.stamp_reward_name, reward_description: rewardSettings.stamp_reward_description } });
        }
      }
    }
    // Smart Happy Hour: schedule config accepts "HH:mm-HH:mm" and optional weekdays (0-6).
    if (cfg.smart_id === 'happyhour') {
      const schedule = String(settings.schedule ?? '').trim();
      const match = schedule.match(/(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})/);
      const daysRaw = String(settings.days ?? '').trim();
      const weekday = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', weekday: 'short' }).format(new Date()).replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/, m => String(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(m))));
      const validTime = (s: string) => /^([01]\\d|2[0-3]):[0-5]\\d$/.test(s);
      if (match && validTime(match[1]) && validTime(match[2]) && match[1] < match[2] && localTime >= match[1] && localTime < match[2]) {
        const allowed = daysRaw.split(',').map(x => Number(x.trim())).filter(x => Number.isInteger(x) && x >= 0 && x <= 6);
        if (!allowed.length || allowed.includes(weekday)) {
          for (const customer of (customers ?? []) as Customer[]) if (customer.marketing_consent) eligible.push({ customer, trigger: `happyhour:${date.date}:${match[1]}:${match[2]}`, payload: { schedule, offer: settings.offer ?? '' } });
        }
      }
    }
    // Smart Challenge: total visit-count milestone (not a weekly visit counter).
    if (cfg.smart_id === 'challenge') {
      const goal = Math.max(1, Math.min(1000, num(settings.goalVisits ?? settings.goal_visits ?? settings.goal, 3)));
      for (const customer of (customers ?? []) as Customer[]) if (customer.marketing_consent && (customer.visit_count ?? 0) >= goal) eligible.push({ customer, trigger: `challenge:${goal}`, payload: { visits: customer.visit_count, goal, reward: settings.reward ?? '' } });
    }
    // Smart Referral: notify the referrer when a pending referral is created (reward remains governed by referral engine).
    if (cfg.smart_id === 'referral') {
      const { data: refs, error: referralError } = await admin.from('loyalty_referrals').select('id,referrer_id,referee_id,status,created_at').eq('establishment_id', cfg.establishment_id).eq('status', 'pending');
      if (referralError) { runErrors.push('Referral lookup failed'); errors.push('referral: lookup failed'); }
      for (const ref of refs ?? []) {
        const customer = (customers ?? []).find((c: Customer) => c.id === ref.referrer_id);
        if (customer?.marketing_consent) eligible.push({ customer, trigger: `referral:${ref.id}`, payload: { referral_id: ref.id, referred_customer_id: ref.referee_id } });
      }
    }
    // Smart Comeback: stepped messages at configured inactivity thresholds, deduped per visit date and step.
    if (cfg.smart_id === 'comeback') {
      const rawSteps = String(settings.steps ?? '30,37,45').match(/\\d+/g)?.map(Number) ?? [30,37,45];
      const steps = [...new Set(rawSteps.filter(n => n >= 1 && n <= 365))].sort((a,b)=>a-b);
      for (const customer of (customers ?? []) as Customer[]) {
        if (!customer.marketing_consent || !customer.last_visit_at || !steps.length) continue;
        const elapsed = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / 86400000);
        const step = steps.filter(n => n <= elapsed).at(-1);
        if (step) eligible.push({ customer, trigger: `comeback:${customer.last_visit_at.slice(0,10)}:${step}`, payload: { inactive_days: elapsed, step_days: step, steps } });
      }
    }
    for (const customer of (customers ?? []) as Customer[]) {
      scanned++;
      let trigger = '', payload: Record<string,unknown> = {};
      if (cfg.smart_id === 'birthday' && customer.birth_day === date.day && customer.birth_month === date.month && customer.marketing_consent) {
        trigger = `birthday:${date.date}`; payload = { date: date.date, template: 'birthday' };
      } else if (cfg.smart_id === 'winback' && customer.last_visit_at && customer.marketing_consent) {
        const delayDays = Math.max(1, Math.min(365, num(settings.delayDays ?? settings.delay_days ?? settings.delay, 30)));
        const elapsed = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / 86400000);
        if (elapsed >= delayDays) { trigger = `winback:${customer.last_visit_at.slice(0,10)}:${delayDays}`; payload = { inactive_days: elapsed, delay_days: delayDays }; }
      } else if (cfg.smart_id === 'vip' && customer.marketing_consent) {
        const visitThreshold = Math.max(1, num(settings.thresholdVisits ?? settings.threshold_visits ?? settings.threshold, 10));
        if ((customer.visit_count ?? 0) >= visitThreshold) { trigger = `vip:${visitThreshold}`; payload = { visits: customer.visit_count, threshold: visitThreshold }; }
      } else if (cfg.smart_id === 'progress' && customer.marketing_consent && !settingsError) {
        const goal = Math.max(1, num(loyaltySetting?.stamp_goal, 10));
        const progressPercent = Math.max(1, Math.min(100, num(settings.thresholdPercent ?? settings.threshold_percent ?? settings.threshold, 80)));
        const threshold = Math.max(1, Math.ceil(goal * progressPercent / 100));
        const stamps = customer.stamps_balance ?? 0;
        if (stamps >= threshold && stamps < goal) { trigger = `progress:${goal}:${threshold}`; payload = { stamps, goal, threshold, percent: Math.round((stamps / goal) * 100) }; }
      }
      if (trigger) eligible.push({ customer, trigger, payload });
    }
    let added = 0, deduplicated = 0;
    for (const item of eligible) {
      const { error: insertError } = await admin.from('smart_marketing_queue').insert({
        establishment_id: cfg.establishment_id, customer_id: item.customer.id, smart_id: cfg.smart_id,
        trigger_key: item.trigger, payload: item.payload, status: 'PENDING', scheduled_at: new Date().toISOString(),
      });
      if (!insertError) added++;
      else if (insertError.code === '23505') deduplicated++;
      else { runErrors.push(`${cfg.smart_id}: queue insert failed`); errors.push(`${cfg.smart_id}: queue insert failed`); }
    }
    queued += added;
    const runUpdate = await admin.from('smart_marketing_runs').update({ status: runErrors.length ? 'PARTIAL' : 'COMPLETED', scanned: customers?.length ?? 0, queued: added, skipped: (customers?.length ?? 0) - eligible.length, details: { eligible: eligible.length, deduplicated, errors: runErrors }, finished_at: new Date().toISOString() }).eq('id', runId);
    if (runUpdate.error) errors.push(`${cfg.smart_id}: run log update failed`);
  }
  return json({ success: errors.length === 0, scanned, queued, supported: [...supported], skippedUnsupported, errors });
});
