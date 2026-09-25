type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  send(body: string): void;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const token = first(req.query.token).trim();

  if (!token) {
    return res.status(400).send('Missing loyalty token');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).send('Supabase configuration missing');
  }

  try {
    const rpcUrl = new URL('/rest/v1/rpc/get_public_loyalty_card', supabaseUrl);
    const response = await fetch(rpcUrl.toString(), {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_access_token: token,
      }),
    });

    const rows = await response.json();
    const card = Array.isArray(rows) ? rows[0] : rows;

    if (!response.ok || !card) {
      return res.status(404).send('Carte fidélité introuvable');
    }

    const establishmentName =
      String(card.establishment_name || 'Carte fidélité').trim() ||
      'Carte fidélité';

    const logo = safeUrl(String(card.establishment_logo_url || ''));
    const origin = `https://${first(req.headers?.host) || 'tapmarrakech.vercel.app'}`;
    const cardUrl = `${origin}/loyalty/${encodeURIComponent(token)}`;

    const title = `${establishmentName} — Carte fidélité`;
    const description = `Votre carte fidélité numérique chez ${establishmentName}.`;

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(cardUrl)}">
  ${logo ? `<meta property="og:image" content="${escapeHtml(logo)}">` : ''}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${logo ? `<meta name="twitter:image" content="${escapeHtml(logo)}">` : ''}
  <link rel="canonical" href="${escapeHtml(cardUrl)}">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(cardUrl)}">Ouvrir ma carte fidélité</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.status(200).send(html);
  } catch (error) {
    console.error('loyalty-share error', error);
    return res.status(500).send('Erreur lors de la génération de l’aperçu');
  }
}
