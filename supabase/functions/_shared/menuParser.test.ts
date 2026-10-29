import { parseMenuJson } from './menuParser.ts';

Deno.test('parses raw JSON returned from the menu importer', () => {
  const result = parseMenuJson('{"categories":[{"name":"Boissons","items":[]}]}') as { categories: { name: string }[] };
  if (result.categories[0]?.name !== 'Boissons') throw new Error('Expected parsed menu category');
});

Deno.test('parses JSON wrapped in a markdown code fence', () => {
  const result = parseMenuJson('```json\n{"categories":[{"name":"Desserts","items":[]}]}\n```') as { categories: { name: string }[] };
  if (result.categories[0]?.name !== 'Desserts') throw new Error('Expected fenced JSON to be parsed');
});

Deno.test('recovers a JSON object surrounded by explanatory text', () => {
  const result = parseMenuJson('Résultat :\n{"categories":[{"name":"Entrées","items":[]}]}\nFin du résultat.') as { categories: { name: string }[] };
  if (result.categories[0]?.name !== 'Entrées') throw new Error('Expected JSON payload to be extracted');
});

Deno.test('rejects text with no JSON object', () => {
  let threw = false;
  try {
    parseMenuJson('Aucune donnée de menu');
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('Expected invalid menu output to be rejected');
});
