import { withTransientPostgrestJwtRetry } from './retryFetch.ts';

Deno.test('retries a transient PostgREST JWT-issued-in-future response', async () => {
  let calls = 0;
  const delays: number[] = [];
  const fakeFetch: typeof fetch = async (_input, _init) => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{"ok":true}', { status: 200 });
  };

  const response = await withTransientPostgrestJwtRetry(
    fakeFetch,
    async (milliseconds) => { delays.push(milliseconds); },
  )('https://example.invalid/rest/v1/establishments');

  if (response.status !== 200) throw new Error(`Expected retry to recover, got HTTP ${response.status}`);
  if (calls !== 2) throw new Error(`Expected exactly two requests, got ${calls}`);
  if (delays.join(',') !== '100') throw new Error(`Unexpected retry delays: ${delays.join(',')}`);
});

Deno.test('does not retry ordinary unauthorized responses', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (_input, _init) => {
    calls += 1;
    return new Response(JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await withTransientPostgrestJwtRetry(
    fakeFetch,
    async () => {},
  )('https://example.invalid/rest/v1/establishments');

  if (response.status !== 401) throw new Error(`Expected original 401, got ${response.status}`);
  if (calls !== 1) throw new Error(`Expected no retry for ordinary 401, got ${calls} requests`);
});

Deno.test('stops after the configured retry limit', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (_input, _init) => {
    calls += 1;
    return new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await withTransientPostgrestJwtRetry(
    fakeFetch,
    async () => {},
    2,
  )('https://example.invalid/rest/v1/establishments');

  if (response.status !== 401) throw new Error(`Expected final 401, got ${response.status}`);
  if (calls !== 3) throw new Error(`Expected one initial call plus two retries, got ${calls}`);
});
