export type BusinessModule =
  | 'wifi'
  | 'menu'
  | 'services'
  | 'restaurant'
  | 'activities'
  | 'trips'
  | 'offers'
  | 'promotions'
  | 'booking'
  | 'contact'
  | 'reviews'
  | 'loyalty';

export const BUSINESS_MODULES: Record<BusinessModule, string> = {
  wifi: 'Wi-Fi',
  menu: 'Menu',
  services: 'Services',
  restaurant: 'Restaurant',
  activities: 'Activités',
  trips: 'Voyages',
  offers: 'Offres',
  promotions: 'Promotions',
  booking: 'Réservation',
  contact: 'Contact',
  reviews: 'Avis',
  loyalty: 'Fidélité',
};

const DEFAULT_MODULES: BusinessModule[] = [
  'wifi',
  'services',
  'promotions',
  'reviews',
  'loyalty',
];

const MODULES_BY_BUSINESS_TYPE: Record<string, BusinessModule[]> = {
  restaurant: ['wifi', 'menu', 'promotions', 'reviews', 'loyalty'],
  cafe: ['wifi', 'menu', 'promotions', 'reviews', 'loyalty'],
  hotel: [
    'wifi',
    'services',
    'restaurant',
    'activities',
    'promotions',
    'reviews',
    'loyalty',
  ],
  riad: [
    'wifi',
    'services',
    'restaurant',
    'activities',
    'promotions',
    'reviews',
    'loyalty',
  ],
  travel_agency: [
    'wifi',
    'trips',
    'activities',
    'offers',
    'promotions',
    'contact',
    'reviews',
    'loyalty',
  ],
  activities: [
    'wifi',
    'activities',
    'promotions',
    'booking',
    'contact',
    'reviews',
    'loyalty',
  ],
  excursions: [
    'wifi',
    'activities',
    'promotions',
    'booking',
    'contact',
    'reviews',
    'loyalty',
  ],
  spa: [
    'wifi',
    'services',
    'promotions',
    'booking',
    'contact',
    'reviews',
    'loyalty',
  ],
  beauty_salon: [
    'wifi',
    'services',
    'promotions',
    'booking',
    'contact',
    'reviews',
    'loyalty',
  ],
  garage: [
    'services',
    'promotions',
    'contact',
    'reviews',
    'loyalty',
  ],
  commerce: [
    'services',
    'promotions',
    'contact',
    'reviews',
    'loyalty',
  ],
  other: DEFAULT_MODULES,
};

function normalizeBusinessType(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveBusinessTypeKey(
  typeName: string | null | undefined,
): string {
  const normalized = normalizeBusinessType(typeName);

  const aliases: Record<string, string> = {
    restaurant: 'restaurant',
    restaurants: 'restaurant',
    cafe: 'cafe',
    café: 'cafe',
    'restaurant_cafe': 'restaurant',
    'restaurant_et_cafe': 'restaurant',
    hotel: 'hotel',
    hotels: 'hotel',
    riad: 'riad',
    riads: 'riad',
    'hotel_riad': 'hotel',
    'hotel_et_riad': 'hotel',
    'agence_de_voyage': 'travel_agency',
    'agence_voyage': 'travel_agency',
    'travel_agency': 'travel_agency',
    voyages: 'travel_agency',
    voyage: 'travel_agency',
    activites: 'activities',
    activite: 'activities',
    activities: 'activities',
    excursions: 'excursions',
    excursion: 'excursions',
    spa: 'spa',
    'salon_de_beaute': 'beauty_salon',
    'salon_beaute': 'beauty_salon',
    'beauty_salon': 'beauty_salon',
    garage: 'garage',
    garages: 'garage',
    commerce: 'commerce',
    commerces: 'commerce',
    boutique: 'commerce',
    boutiques: 'commerce',
    autre: 'other',
    autres: 'other',
    other: 'other',
  };

  return aliases[normalized] ?? normalized;
}

export function getBusinessModules(
  businessTypeName: string | null | undefined,
): BusinessModule[] {
  const key = resolveBusinessTypeKey(businessTypeName);
  return MODULES_BY_BUSINESS_TYPE[key] ?? DEFAULT_MODULES;
}

export function hasBusinessModule(
  businessTypeName: string | null | undefined,
  module: BusinessModule,
): boolean {
  return getBusinessModules(businessTypeName).includes(module);
}
