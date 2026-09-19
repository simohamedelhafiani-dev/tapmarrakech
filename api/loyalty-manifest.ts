type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  send(body: string): void;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function safeIconUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const name = first(req.query.name).trim() || 'Carte fidélité';
  const logo = safeIconUrl(first(req.query.logo));
  const startUrl = first(req.query.start_url).trim() || '/loyalty';

  const manifest = {
    name,
    short_name: name.slice(0, 30),
    description: `Carte fidélité de ${name}`,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    background_color: '#f7f7f3',
    theme_color: '#17352a',
    icons: logo
      ? [
          {
            src: logo,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ]
      : [
          {
            src: '/tapmarrakech-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(JSON.stringify(manifest));
}
