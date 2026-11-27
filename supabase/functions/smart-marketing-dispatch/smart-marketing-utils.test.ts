import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractBearerToken, constantTimeEqual, normalizeLimit, progressThreshold, buildTriggerKey, parseSmartConfigNumber, resolveSmartMessage, retryDelayMinutes, parseHappyHourSchedule, formatLocalDateKey, resolveRewardClaimCycle } from './smart-marketing-utils.ts';

Deno.test('Bearer token parsing is case-insensitive and whitespace tolerant',()=>{
 assertEquals(extractBearerToken('Bearer abc123'),'abc123');
 assertEquals(extractBearerToken('bearer   abc123'),'abc123');
 assertEquals(extractBearerToken('Basic abc123'),null);
 assertEquals(extractBearerToken(null),null);
});
Deno.test('dispatch batch limit stays between 1 and 200',()=>{
 assertEquals(normalizeLimit(undefined),50);
 assertEquals(normalizeLimit(0),50);
 assertEquals(normalizeLimit(300),200);
 assertEquals(normalizeLimit(12),12);
 assertEquals(normalizeLimit(-4),50);
 assertEquals(normalizeLimit(Number.NaN),50);
 assertEquals(normalizeLimit(12.9),12);
});
Deno.test('progress thresholds use ceiling at 80 percent',()=>{
 assertEquals(progressThreshold(10),8);
 assertEquals(progressThreshold(9),8);
 assertEquals(progressThreshold(1),1);
});
Deno.test('trigger keys are stable and date scoped',()=>{
 assertEquals(buildTriggerKey('birthday','2026-11-21'),'birthday:2026-11-21');
 assertMatch(buildTriggerKey('winback','2026-10-01',30),/^winback:2026-10-01:30$/);
});

Deno.test('Smart config numeric values accept labels such as days and percent',()=>{
 assertEquals(parseSmartConfigNumber('30 jours',30),30);
 assertEquals(parseSmartConfigNumber('80%',50),80);
 assertEquals(parseSmartConfigNumber('invalid',12),12);
 assertEquals(parseSmartConfigNumber(7,12),7);
});

Deno.test('custom Smart message overrides fallback only when non-empty',()=>{
 assertEquals(resolveSmartMessage(' Message personnalisé ','fallback'),'Message personnalisé');
 assertEquals(resolveSmartMessage('   ','fallback'),'fallback');
 assertEquals(resolveSmartMessage(null,'fallback'),'fallback');
});

Deno.test('retry backoff grows with attempts and is capped at 30 minutes',()=>{
 assertEquals(retryDelayMinutes(1),1);
 assertEquals(retryDelayMinutes(2),2);
 assertEquals(retryDelayMinutes(3),4);
 assertEquals(retryDelayMinutes(5),16);
 assertEquals(retryDelayMinutes(7),30);
 assertEquals(retryDelayMinutes(8),30);
 assertEquals(retryDelayMinutes(0),1);
 assertEquals(retryDelayMinutes(-3),1);
 assertEquals(retryDelayMinutes(2.9),2);
 assertEquals(retryDelayMinutes(Number.NaN),1);
});

Deno.test('Happy Hour schedule parses HH:mm ranges with optional spaces and rejects invalid ranges',()=>{
 assertEquals(parseHappyHourSchedule('17:00-19:30'),{start:'17:00',end:'19:30'});
 assertEquals(parseHappyHourSchedule(' 17:00 - 19:30 '),{start:'17:00',end:'19:30'});
 assertEquals(parseHappyHourSchedule('25:00-26:00'),null);
 assertEquals(parseHappyHourSchedule('19:00-17:00'),null);
 assertEquals(parseHappyHourSchedule('17:00'),null);
 assertEquals(parseHappyHourSchedule(null),null);
});

Deno.test('local date keys stay ISO-padded for single-digit days and months',()=>{
 assertEquals(formatLocalDateKey('2026','11','5'),'2026-11-05');
 assertEquals(formatLocalDateKey('2026','2','9'),'2026-02-09');
 assertEquals(formatLocalDateKey('2026','12','31'),'2026-12-31');
 assertEquals(formatLocalDateKey('bad','2','9'),'');
});

Deno.test('Smart Reward trigger remains stable until a claim cycle changes',()=>{
 const now=Date.parse('2026-11-25T12:00:00.000Z');
 assertEquals(resolveRewardClaimCycle(10,null,now),{pendingActive:false,triggerKey:'reward:10:initial'});
 assertEquals(resolveRewardClaimCycle(10,{id:'claim-1',status:'PENDING',expires_at:'2026-11-26T12:00:00.000Z'},now),{pendingActive:true,triggerKey:'reward:10:claim-1:PENDING'});
 assertEquals(resolveRewardClaimCycle(10,{id:'claim-1',status:'PENDING',expires_at:'2026-11-24T12:00:00.000Z'},now),{pendingActive:false,triggerKey:'reward:10:claim-1:EXPIRED'});
 assertEquals(resolveRewardClaimCycle(10,{claim_id:'claim-2',claim_status:'REDEEMED',expires_at:'2026-11-24T12:00:00.000Z'},now),{pendingActive:false,triggerKey:'reward:10:claim-2:REDEEMED'});
});

Deno.test('cron bearer secret comparison rejects mismatches and accepts exact matches',()=>{
 assertEquals(constantTimeEqual('secret-value','secret-value'),true);
 assertEquals(constantTimeEqual('secret-value','secret-valUe'),false);
 assertEquals(constantTimeEqual('short','longer'),false);
});
