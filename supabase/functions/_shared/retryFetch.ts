type Sleep = (milliseconds: number) => Promise<void>;

const defaultSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Retries only the transient PostgREST clock-skew response. Other 401s (expired
 * sessions, bad tokens, missing permissions) are returned untouched.
 */
export function withTransientPostgrestJwtRetry(
  fetchImpl: typeof fetch = fetch,
  sleep: Sleep = defaultSleep,
  maxRetries = 2,
): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt += 1) {
      const requestInput = input instanceof Request ? input.clone() : input;
      const response = await fetchImpl(requestInput, init);
      if (response.status !== 401 || attempt >= maxRetries) return response;

      const body = await response.clone().text().catch(() => '');
      if (!body.includes('PGRST303') || !body.includes('JWT issued at future')) {
        return response;
      }

      await sleep(100 * (attempt + 1));
    }
  };
}
