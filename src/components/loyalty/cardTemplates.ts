// Generic Wallet-style templates for the KELYANI web loyalty card (the card customers
// add to their home screen). Usable by any business: each one has its own palette and
// layout; the business photo goes in the image area. Chosen by the admin.

export type PassLayout = 'band' | 'immersive' | 'top';
export type PassPattern = 'waves' | 'dots' | 'grid' | 'rays' | 'rings' | 'none';

export type CardCategoryTemplate = {
  id: string;
  name: string;
  /** Short description shown in the picker. */
  category: string;
  background: string;
  backgroundEnd: string;
  accent: string;
  text: string;
  layout: PassLayout;
  pattern: PassPattern;
  light?: boolean;
};

export const CARD_CATEGORY_TEMPLATES: CardCategoryTemplate[] = [
  { id: 'pass-kelyani', name: 'Signature', category: 'Couleurs KELYANI', background: '#050505', backgroundEnd: '#0B2A22', accent: '#10B981', text: '#FFFFFF', layout: 'band', pattern: 'rings' },
  { id: 'pass-onyx', name: 'Onyx', category: 'Noir élégant', background: '#0B0B0C', backgroundEnd: '#26262A', accent: '#F4F4F5', text: '#FFFFFF', layout: 'band', pattern: 'grid' },
  { id: 'pass-ivoire', name: 'Ivoire', category: 'Clair et chic', background: '#F6F1E7', backgroundEnd: '#E9DFCB', accent: '#A9864E', text: '#2A2420', layout: 'top', pattern: 'waves', light: true },
  { id: 'pass-bordeaux', name: 'Bordeaux', category: 'Chaleureux', background: '#3A0F17', backgroundEnd: '#6E1F2B', accent: '#F2C46D', text: '#FFF6EC', layout: 'band', pattern: 'rays' },
  { id: 'pass-foret', name: 'Forêt', category: 'Naturel', background: '#0F2E22', backgroundEnd: '#1E4A35', accent: '#CFE8A9', text: '#F3FAEE', layout: 'immersive', pattern: 'waves' },
  { id: 'pass-terracotta', name: 'Terracotta', category: 'Marrakech', background: '#9E4524', backgroundEnd: '#C8693C', accent: '#FFE3C7', text: '#FFF8F1', layout: 'band', pattern: 'rings' },
  { id: 'pass-lagon', name: 'Lagon', category: 'Frais', background: '#0E4A4F', backgroundEnd: '#16706F', accent: '#8BE7D8', text: '#F1FFFC', layout: 'top', pattern: 'dots' },
  { id: 'pass-poudre', name: 'Rose poudré', category: 'Doux', background: '#F7E4E4', backgroundEnd: '#EBC9CC', accent: '#B94E68', text: '#4A2630', layout: 'band', pattern: 'dots', light: true },
  { id: 'pass-sable', name: 'Sable', category: 'Apaisant', background: '#EADFCF', backgroundEnd: '#D6C0A2', accent: '#8F5F4F', text: '#3D2E24', layout: 'immersive', pattern: 'waves', light: true },
  { id: 'pass-prune', name: 'Prune', category: 'Raffiné', background: '#3B1E3F', backgroundEnd: '#5E2F63', accent: '#F2BDE3', text: '#FFF2FB', layout: 'band', pattern: 'waves' },
  { id: 'pass-moutarde', name: 'Moutarde', category: 'Énergique', background: '#E3A92B', backgroundEnd: '#F0C455', accent: '#1F1A12', text: '#1F1A12', layout: 'top', pattern: 'rays', light: true },
  { id: 'pass-carbone', name: 'Carbone', category: 'Technique', background: '#1C1C1E', backgroundEnd: '#34343A', accent: '#FF6A2B', text: '#FFFFFF', layout: 'band', pattern: 'grid' },
  { id: 'pass-passion', name: 'Passion', category: 'Gourmand', background: '#A9111D', backgroundEnd: '#D6362A', accent: '#FFD9A8', text: '#FFFFFF', layout: 'immersive', pattern: 'rays' },
  { id: 'pass-neon', name: 'Néon', category: 'Sportif', background: '#121417', backgroundEnd: '#1F2A1A', accent: '#B8F23F', text: '#FFFFFF', layout: 'top', pattern: 'grid' },
  { id: 'pass-or-noir', name: 'Or noir', category: 'Prestige', background: '#141110', backgroundEnd: '#2C2420', accent: '#E8C57E', text: '#FFF8EA', layout: 'immersive', pattern: 'rings' },
];

const BY_ID = new Map(CARD_CATEGORY_TEMPLATES.map(template => [template.id, template]));

export function getCategoryTemplate(id: string | null | undefined): CardCategoryTemplate | null {
  return id ? BY_ID.get(id) ?? null : null;
}

// The former card templates are retired: each old id now opens its closest pass, and
// anything unknown (including 'custom') falls back to the KELYANI Signature pass.
const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  'onyx-black': 'pass-onyx',
  'royal-gold': 'pass-or-noir',
  'deep-ocean': 'pass-lagon',
  'minimal-white': 'pass-ivoire',
  'emerald-luxe': 'pass-kelyani',
  burgundy: 'pass-bordeaux',
  'midnight-blue': 'pass-prune',
  sandstone: 'pass-sable',
};

export const DEFAULT_PASS_TEMPLATE_ID = 'pass-kelyani';

export function resolvePassTemplate(id: string | null | undefined): CardCategoryTemplate {
  return getCategoryTemplate(id)
    ?? getCategoryTemplate(id ? LEGACY_TEMPLATE_MAP[id] : null)
    ?? (BY_ID.get(DEFAULT_PASS_TEMPLATE_ID) as CardCategoryTemplate);
}

export function isCategoryTemplate(id: string | null | undefined): boolean {
  return Boolean(id && BY_ID.has(id));
}

export type QrSize = 'small' | 'medium' | 'large';
export type QrFrame = 'white' | 'accent' | 'glass';

export const QR_SIZES: { id: QrSize; label: string; width: number }[] = [
  { id: 'small', label: 'Petit', width: 20 },
  { id: 'medium', label: 'Moyen', width: 25 },
  { id: 'large', label: 'Grand', width: 31 },
];

export const QR_FRAMES: { id: QrFrame; label: string }[] = [
  { id: 'white', label: 'Cadre blanc' },
  { id: 'accent', label: 'Cadre couleur' },
  { id: 'glass', label: 'Verre' },
];
