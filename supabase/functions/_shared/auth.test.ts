import { extractBearerToken } from './auth.ts';

Deno.test('extracts a normal Bearer token', () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
  const actual = extractBearerToken(`Bearer ${token}`);
  if (actual !== token) throw new Error('Expected the token without the Bearer prefix');
});

Deno.test('accepts case-insensitive scheme and surrounding whitespace', () => {
  const actual = extractBearerToken('  bearer   abc.def.signature  ');
  if (actual !== 'abc.def.signature') throw new Error('Expected whitespace and scheme normalization');
});

Deno.test('rejects missing and non-Bearer authorization headers', () => {
  for (const header of [null, '', 'Basic abc', 'Bearer', 'Bearer   ']) {
    if (extractBearerToken(header) !== null) {
      throw new Error(`Expected invalid header to be rejected: ${String(header)}`);
    }
  }
});

Deno.test('rejects multiple token fields', () => {
  if (extractBearerToken('Bearer abc.def signature') !== null) {
    throw new Error('Expected a header with multiple token fields to be rejected');
  }
});
