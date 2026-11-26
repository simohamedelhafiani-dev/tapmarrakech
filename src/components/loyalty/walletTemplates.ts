export type GoogleWalletTemplate = {
  id: string;
  name: string;
  description: string;
  layout: 'balance' | 'stamps' | 'member' | 'barcode' | 'reward' | 'tier' | 'location' | 'offer';
  rows: GoogleWalletFieldKey[][];
  background: string;
  accent: string;
  text: string;
};

export type GoogleWalletFieldKey = 'balance' | 'accountName' | 'accountId' | 'reward' | 'tier' | 'venue' | 'offer' | 'program';

export const GOOGLE_WALLET_FIELD_OPTIONS: { id: GoogleWalletFieldKey; label: string; path: string }[] = [
  { id: 'balance', label: 'Solde / progression', path: "object.textModulesData['wallet-balance']" },
  { id: 'accountName', label: 'Nom du membre', path: 'object.accountName' },
  { id: 'accountId', label: 'Numéro membre', path: 'object.accountId' },
  { id: 'reward', label: 'Prochaine récompense', path: "object.textModulesData['wallet-reward']" },
  { id: 'tier', label: 'Niveau fidélité', path: "object.textModulesData['wallet-tier']" },
  { id: 'venue', label: 'Établissement', path: "object.textModulesData['wallet-venue']" },
  { id: 'offer', label: 'Avantage actif', path: "object.textModulesData['wallet-offer']" },
  { id: 'program', label: 'Programme', path: "object.textModulesData['wallet-program']" },
];

export const GOOGLE_WALLET_TEMPLATES: GoogleWalletTemplate[] = [
  { id: 'google-balance-ledger', name: 'Solde en vedette', description: 'Solde principal, identité membre et avantage suivant.', layout: 'balance', rows: [['balance'], ['accountName', 'accountId'], ['reward']], background: '#050505', accent: '#3B82F6', text: '#FFFFFF' },
  { id: 'google-stamp-journey', name: 'Parcours de visites', description: 'Progression de tampons, objectif et récompense dans cet ordre.', layout: 'stamps', rows: [['balance', 'reward'], ['accountName', 'accountId']], background: '#111111', accent: '#3B82F6', text: '#FFFFFF' },
  { id: 'google-member-profile', name: 'Profil membre', description: 'Nom et numéro de membre avant le solde et le QR.', layout: 'member', rows: [['accountName'], ['accountId', 'balance'], ['tier']], background: '#050505', accent: '#686D76', text: '#FFFFFF' },
  { id: 'google-scan-first', name: 'Scan immédiat', description: 'Identifiant et code de scan mis en avant pour le passage en caisse.', layout: 'barcode', rows: [['accountId'], ['balance', 'accountName']], background: '#111111', accent: '#3B82F6', text: '#FFFFFF' },
  { id: 'google-reward-board', name: 'Récompense à débloquer', description: 'Prochaine récompense en premier, solde et identité ensuite.', layout: 'reward', rows: [['reward'], ['balance', 'accountName'], ['accountId']], background: '#050505', accent: '#3B82F6', text: '#FFFFFF' },
  { id: 'google-tier-club', name: 'Club par niveau', description: 'Niveau de fidélité, membre et solde présentés en trois rangées.', layout: 'tier', rows: [['tier'], ['accountName', 'balance'], ['accountId']], background: '#111111', accent: '#3B82F6', text: '#FFFFFF' },
  { id: 'google-venue-guide', name: 'Carte établissement', description: 'Établissement, informations utiles, solde et accès au scan.', layout: 'location', rows: [['venue'], ['accountName', 'balance'], ['accountId']], background: '#050505', accent: '#686D76', text: '#FFFFFF' },
  { id: 'google-offer-pass', name: 'Avantage actif', description: 'Offre, échéance et solde avec une image de couverture.', layout: 'offer', rows: [['offer'], ['balance', 'accountName'], ['accountId']], background: '#111111', accent: '#3B82F6', text: '#FFFFFF' },
];

export type AppleWalletField = 'accountName' | 'accountId' | 'points' | 'visits' | 'reward' | 'tier' | 'establishment' | 'offer';

export type AppleWalletTemplate = {
  id: string;
  name: string;
  description: string;
  artwork: 'ribbon' | 'stack' | 'grid' | 'barcode' | 'reward' | 'monogram' | 'arch' | 'editorial';
  fields: {
    header: AppleWalletField[];
    primary: AppleWalletField[];
    secondary: AppleWalletField[];
    auxiliary: AppleWalletField[];
    back: AppleWalletField[];
  };
};

// Each preset maps to the native PassKit storeCard field groups. The artwork key
// selects the strip composition in the editor preview; these are not color-only skins.
export const APPLE_WALLET_TEMPLATES: AppleWalletTemplate[] = [
  { id: 'apple-ledger', name: 'Solde éditorial', description: 'Solde en champ principal, récompense et identifiant sur la face.', artwork: 'editorial', fields: { header: ['accountId'], primary: ['points'], secondary: ['accountName', 'reward'], auxiliary: ['tier'], back: ['establishment', 'reward', 'accountId'] } },
  { id: 'apple-visit-stamps', name: 'Carnet de visites', description: 'Progression de visites au premier plan avec objectif et cadeau.', artwork: 'stack', fields: { header: ['visits'], primary: ['reward'], secondary: ['accountName', 'points'], auxiliary: ['accountId'], back: ['establishment', 'visits', 'reward'] } },
  { id: 'apple-member-pass', name: 'Membre signature', description: 'Nom du membre en grand, solde et niveau en champs de soutien.', artwork: 'monogram', fields: { header: ['tier'], primary: ['accountName'], secondary: ['points', 'accountId'], auxiliary: ['reward'], back: ['establishment', 'accountId', 'tier'] } },
  { id: 'apple-scan-card', name: 'Scan express', description: 'Identifiant compact et champs caisse alignés pour une lecture rapide.', artwork: 'barcode', fields: { header: ['accountId'], primary: ['points'], secondary: ['tier', 'reward'], auxiliary: ['visits'], back: ['establishment', 'accountId', 'reward'] } },
  { id: 'apple-reward-card', name: 'Récompense proche', description: 'Récompense prioritaire, solde et seuil de progression sur la face.', artwork: 'reward', fields: { header: ['points'], primary: ['reward'], secondary: ['accountName', 'visits'], auxiliary: ['accountId'], back: ['establishment', 'reward', 'points'] } },
  { id: 'apple-tier-card', name: 'Niveau fidélité', description: 'Niveau dans l’en-tête, nom au centre et statut dans les champs secondaires.', artwork: 'ribbon', fields: { header: ['tier'], primary: ['points'], secondary: ['accountName', 'reward'], auxiliary: ['accountId'], back: ['establishment', 'tier', 'reward'] } },
  { id: 'apple-offer-card', name: 'Avantage membre', description: 'Offre active mise en avant et solde visible sans ouvrir le verso.', artwork: 'arch', fields: { header: ['offer'], primary: ['reward'], secondary: ['accountName', 'points'], auxiliary: ['tier'], back: ['establishment', 'offer', 'reward'] } },
  { id: 'apple-venue-card', name: 'Établissement', description: 'Nom du commerce en tête, solde principal et coordonnées au verso.', artwork: 'grid', fields: { header: ['establishment'], primary: ['points'], secondary: ['accountName', 'tier'], auxiliary: ['accountId'], back: ['establishment', 'reward', 'accountId'] } },
];

export function getAppleWalletTemplate(id: string) {
  return APPLE_WALLET_TEMPLATES.find(template => template.id === id) ?? APPLE_WALLET_TEMPLATES[0];
}

export function getGoogleWalletTemplate(id: string) {
  return GOOGLE_WALLET_TEMPLATES.find(template => template.id === id) ?? GOOGLE_WALLET_TEMPLATES[0];
}

export const APPLE_WALLET_FIELD_LABELS: Record<AppleWalletField, string> = {
  accountName: 'Membre',
  accountId: 'Numéro membre',
  points: 'Points',
  visits: 'Visites',
  reward: 'Prochaine récompense',
  tier: 'Niveau',
  establishment: 'Établissement',
  offer: 'Avantage actif',
};


/** Normalize stored legacy card colors without changing custom Nardo-compatible values. */
export function normalizeNardoCardColor(value: unknown, fallback = '#686D76'): string {
  const candidate = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
  const legacyColors = new Set(['#173D32', '#D3A84C', '#D4AF37', '#C5A059', '#B8860B', '#00DFA5']);
  return legacyColors.has(candidate) ? '#686D76' : candidate;
}

/** Keep Electric Blue as an accent only; blue-toned surfaces fall back to Nardo grey. */
export function normalizeNardoBackgroundColor(value: unknown, fallback = '#686D76'): string {
  const candidate = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
  if (candidate === '#F7F7F3') return '#050505';
  const red = Number.parseInt(candidate.slice(1, 3), 16);
  const green = Number.parseInt(candidate.slice(3, 5), 16);
  const blue = Number.parseInt(candidate.slice(5, 7), 16);
  return blue - red >= 35 && blue - green >= 35 ? '#686D76' : candidate;
}
