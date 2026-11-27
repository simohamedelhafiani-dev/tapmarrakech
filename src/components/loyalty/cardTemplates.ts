// Category templates for the KELYANI web loyalty card (the card customers add to
// their home screen). Each template has its own colors and a Wallet-style layout.
// Chosen by the admin in the Loyalty Studio; stored as the design template_id.

export type CardCategoryTemplate = {
  id: string;
  name: string;
  category: string;
  background: string;
  /** Second background stop, used for the gradient when there is no photo. */
  backgroundEnd: string;
  /** Labels, stamps and highlights. */
  accent: string;
  text: string;
  /** Decorative motif shown in the image band when the business has no photo. */
  motif: string;
  /** Light templates use a dark QR frame shadow and darker overlays. */
  light?: boolean;
};

export const CARD_CATEGORY_TEMPLATES: CardCategoryTemplate[] = [
  { id: 'cat-cafe', name: 'Café torréfié', category: 'Café', background: '#2B1A12', backgroundEnd: '#5A3622', accent: '#E0A96D', text: '#FFF4E6', motif: '☕' },
  { id: 'cat-restaurant', name: 'Table bordeaux', category: 'Restaurant', background: '#3A0F17', backgroundEnd: '#6E1F2B', accent: '#F2C46D', text: '#FFF6EC', motif: '🍽️' },
  { id: 'cat-spa', name: 'Spa sable', category: 'Spa', background: '#EADFCF', backgroundEnd: '#D8C3A8', accent: '#9C6B5E', text: '#3D2E24', motif: '🌿', light: true },
  { id: 'cat-beaute', name: 'Beauté rosé', category: 'Salon de beauté', background: '#4A1D33', backgroundEnd: '#7A3355', accent: '#F6AFC2', text: '#FFF0F5', motif: '💅' },
  { id: 'cat-boutique', name: 'Boutique champagne', category: 'Boutique', background: '#111111', backgroundEnd: '#2A2622', accent: '#E8CBA0', text: '#FFFFFF', motif: '🛍️' },
  { id: 'cat-boulangerie', name: 'Boulangerie blé', category: 'Boulangerie', background: '#F2E2C2', backgroundEnd: '#E2C48F', accent: '#A85A1E', text: '#43290F', motif: '🥐', light: true },
  { id: 'cat-riad', name: 'Riad zellige', category: 'Hôtel & riad', background: '#0F3D3E', backgroundEnd: '#1C5B57', accent: '#E3BC78', text: '#F6EFE2', motif: '🕌' },
  { id: 'cat-garage', name: 'Garage carbone', category: 'Garage & auto', background: '#1C1C1E', backgroundEnd: '#34343A', accent: '#FF6A2B', text: '#FFFFFF', motif: '🚗' },
  { id: 'cat-snack', name: 'Snack pop', category: 'Snack & fast-food', background: '#C8231B', backgroundEnd: '#E8462A', accent: '#FFD84A', text: '#FFFFFF', motif: '🍔' },
  { id: 'cat-sport', name: 'Sport énergie', category: 'Salle de sport', background: '#121417', backgroundEnd: '#1F2A1A', accent: '#B8F23F', text: '#FFFFFF', motif: '💪' },
  { id: 'cat-kelyani', name: 'Signature KELYANI', category: 'Tous commerces', background: '#050505', backgroundEnd: '#0B2A22', accent: '#10B981', text: '#FFFFFF', motif: '✦' },
];

const BY_ID = new Map(CARD_CATEGORY_TEMPLATES.map(template => [template.id, template]));

export function getCategoryTemplate(id: string | null | undefined): CardCategoryTemplate | null {
  return id ? BY_ID.get(id) ?? null : null;
}

export function isCategoryTemplate(id: string | null | undefined): boolean {
  return Boolean(id && BY_ID.has(id));
}
