import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractBearerToken, normalizeLimit, progressThreshold, buildTriggerKey } from './smart-marketing-utils.ts';

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
