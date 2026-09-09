import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get('Authorization');

      if (authorization === `Bearer ${supabaseKey}`) {
        headers.delete('Authorization');
      }

      return fetch(input, { ...init, headers });
    },
  },
});
