// Single source of truth for the seller identity shown on every legal page.
// Update LEGAL_VERSION whenever the legal texts change: new sign-ups record it.

export const LEGAL_VERSION = '2026-11-28';
export const LEGAL_UPDATED_AT = '28 novembre 2026';

export const LEGAL = {
  brand: 'Kelyani',
  ownerName: 'Mohamed Elhafiani',
  legalStatus: 'Auto-entrepreneur (personne physique), Maroc',
  address: '861 Lot Maatalah, Askejour, Marrakech, Maroc',
  ice: '',
  fiscalId: '',
  rnaeNumber: '',
  email: '',
  phone: '+212 6 30 35 91 76',
  cndpReceipt: '',
  website: 'https://app.kelyani.com',
  court: 'Marrakech',
} as const;

export const LEGAL_DOCS = [
  { slug: 'mentions-legales', title: 'Mentions légales' },
  { slug: 'cgv', title: 'Conditions générales de vente' },
  { slug: 'cgu', title: 'Conditions d’utilisation (clients)' },
  { slug: 'confidentialite', title: 'Politique de confidentialité' },
] as const;

export type LegalDocSlug = (typeof LEGAL_DOCS)[number]['slug'];
