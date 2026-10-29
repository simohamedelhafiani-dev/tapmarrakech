export function parseMenuJson(outputText: string): unknown {
  const fence = String.fromCharCode(96).repeat(3);
  const cleaned = outputText.trim()
    .replace(new RegExp('^' + fence + '(?:json)?\\s*', 'i'), '')
    .replace(new RegExp('\\s*' + fence + '$', 'i'), '')
    .trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
    }

    throw new Error('Le moteur IA n’a pas retourné un JSON valide.');
  }
}
