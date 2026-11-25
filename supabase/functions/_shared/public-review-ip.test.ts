import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTrustedClientIp } from './public-review-ip.ts';

Deno.test('uses cf-connecting-ip and ignores caller-controlled forwarding headers', () => {
  const request = new Request('https://example.test', {
    headers: {
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.99, 203.0.113.7',
      'x-real-ip': '198.51.100.99',
    },
  });
  assertEquals(getTrustedClientIp(request), '203.0.113.7');
});

Deno.test('does not fall back to spoofable x-forwarded-for when CF IP is missing', () => {
  const request = new Request('https://example.test', {
    headers: { 'x-forwarded-for': '198.51.100.99' },
  });
  assertEquals(getTrustedClientIp(request), null);
});

Deno.test('rejects empty or ambiguous CF client IP headers', () => {
  assertEquals(
    getTrustedClientIp(new Request('https://example.test', {
      headers: { 'cf-connecting-ip': '   ' },
    })),
    null,
  );
  assertEquals(
    getTrustedClientIp(new Request('https://example.test', {
      headers: { 'cf-connecting-ip': '203.0.113.7, 198.51.100.99' },
    })),
    null,
  );
});
