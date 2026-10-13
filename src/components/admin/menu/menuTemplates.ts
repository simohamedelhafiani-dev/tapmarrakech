export type MenuTemplateFamily = 'editorial' | 'luxury' | 'cards' | 'dark' | 'onyx' | 'royal-gold' | 'deep-ocean' | 'pearl';

export type MenuTemplateDefinition = {
  id: string;
  label: string;
  sector: string;
  description: string;
  family: MenuTemplateFamily;
  layout: 'price-list' | 'stacked-photo' | 'split-catalog' | 'editorial-center' | 'minimal-list' | 'service-table' | 'product-grid' | 'compact-list' | 'magazine-grid';
};

export const MENU_TEMPLATES: MenuTemplateDefinition[] = [
  { id: '01_cafe_classic', label: 'Café Classique', sector: 'Cafés', description: 'Carte claire et lisible pour cafés et snacks.', family: 'editorial', layout: 'price-list' },
  { id: '02_burger_house', label: 'Burger House', sector: 'Restauration', description: 'Contraste fort et produits mis en avant.', family: 'dark', layout: 'stacked-photo' },
  { id: '03_restaurant_modern', label: 'Restaurant Moderne', sector: 'Restauration', description: 'Présentation contemporaine et structurée.', family: 'cards', layout: 'split-catalog' },
  { id: '04_menu_luxe', label: 'Menu Prestige', sector: 'Restauration', description: 'Typographie raffinée et détails dorés.', family: 'royal-gold', layout: 'editorial-center' },
  { id: '05_minimal_food', label: 'Minimal Food', sector: 'Restauration', description: 'Carte légère, épurée et mobile-first.', family: 'pearl', layout: 'minimal-list' },
  { id: '06_beauty_studio', label: 'Beauty Studio', sector: 'Beauté', description: 'Services et tarifs dans une présentation élégante.', family: 'pearl', layout: 'service-table' },
  { id: '07_hair_salon', label: 'Hair Salon', sector: 'Coiffure', description: 'Prestations et prix faciles à parcourir.', family: 'onyx', layout: 'service-table' },
  { id: '08_shop_catalog', label: 'Shop Catalog', sector: 'Boutiques', description: 'Catalogue visuel pour produits et collections.', family: 'cards', layout: 'product-grid' },
  { id: '09_wellness', label: 'Wellness', sector: 'Bien-être', description: 'Palette douce et lecture apaisante.', family: 'deep-ocean', layout: 'service-table' },
  { id: '10_service_list', label: 'Services Pro', sector: 'Services', description: 'Liste claire de prestations et tarifs.', family: 'editorial', layout: 'compact-list' },
  { id: '11_brunch_cafe', label: 'Brunch Café', sector: 'Cafés & brunch', description: 'Carte chaleureuse pour brunchs et cafés.', family: 'pearl', layout: 'editorial-center' },
  { id: '12_sushi_bar', label: 'Sushi Bar', sector: 'Restauration', description: 'Univers frais et contemporain pour sushi.', family: 'deep-ocean', layout: 'split-catalog' },
  { id: '13_healthy_food', label: 'Healthy Food', sector: 'Restauration saine', description: 'Présentation lumineuse des recettes et ingrédients.', family: 'editorial', layout: 'minimal-list' },
  { id: '14_bakery', label: 'Boulangerie', sector: 'Boulangeries', description: 'Vitrine éditoriale pour pains, pâtisseries et prix.', family: 'pearl', layout: 'stacked-photo' },
  { id: '15_ice_cream', label: 'Ice Cream', sector: 'Glaciers', description: 'Style coloré et léger pour parfums et formats.', family: 'cards', layout: 'product-grid' },
  { id: '16_tacos', label: 'Tacos', sector: 'Restauration rapide', description: 'Carte dynamique avec produits et suppléments.', family: 'dark', layout: 'stacked-photo' },
  { id: '17_fine_dining', label: 'Fine Dining', sector: 'Gastronomie', description: 'Présentation haut de gamme et typographique.', family: 'royal-gold', layout: 'editorial-center' },
  { id: '18_seafood', label: 'Seafood', sector: 'Poisson & fruits de mer', description: 'Palette marine et fiches produits nettes.', family: 'deep-ocean', layout: 'split-catalog' },
  { id: '19_tea_lounge', label: 'Tea Lounge', sector: 'Salons de thé', description: 'Ambiance calme, chaleureuse et premium.', family: 'luxury', layout: 'price-list' },
  { id: '20_food_truck', label: 'Food Truck', sector: 'Street food', description: 'Carte compacte et très lisible au téléphone.', family: 'dark', layout: 'compact-list' },
  { id: '21_nails_lashes', label: 'Nails & Lashes', sector: 'Beauté', description: 'Prestations beauté avec une finition chic.', family: 'pearl', layout: 'service-table' },
  { id: '22_hair_luxury', label: 'Hair Luxury', sector: 'Coiffure', description: 'Style sombre et premium pour salons de coiffure.', family: 'onyx', layout: 'editorial-center' },
  { id: '23_massage_spa', label: 'Massage & Spa', sector: 'Spa', description: 'Univers doux pour soins, massages et durées.', family: 'deep-ocean', layout: 'service-table' },
  { id: '24_makeup', label: 'Makeup Artist', sector: 'Maquillage', description: 'Mise en valeur des prestations et forfaits.', family: 'pearl', layout: 'split-catalog' },
  { id: '25_perfume', label: 'Parfumerie', sector: 'Parfumerie', description: 'Catalogue parfumé avec détails élégants.', family: 'royal-gold', layout: 'product-grid' },
  { id: '26_jewelry', label: 'Bijouterie', sector: 'Bijoux', description: 'Écrin visuel premium pour collections et prix.', family: 'luxury', layout: 'product-grid' },
  { id: '27_shoes', label: 'Chaussures', sector: 'Mode', description: 'Catalogue produit adapté aux collections.', family: 'cards', layout: 'product-grid' },
  { id: '28_home_decor', label: 'Home Decor', sector: 'Maison & décoration', description: 'Catalogue éditorial pour objets et décoration.', family: 'editorial', layout: 'magazine-grid' },
  { id: '29_electronics', label: 'Électronique', sector: 'Électronique', description: 'Fiches produits nettes avec informations essentielles.', family: 'deep-ocean', layout: 'split-catalog' },
  { id: '30_flower_shop', label: 'Fleuriste', sector: 'Fleuristes', description: 'Style doux et lumineux pour bouquets et compositions.', family: 'pearl', layout: 'magazine-grid' },
  { id: '31_optician', label: 'Opticien', sector: 'Optique', description: 'Catalogue propre pour montures et services.', family: 'cards', layout: 'product-grid' },
  { id: '32_pet_shop', label: 'Animalerie', sector: 'Animaux', description: 'Catalogue accueillant pour produits et services.', family: 'editorial', layout: 'magazine-grid' },
  { id: '33_tattoo', label: 'Tattoo Studio', sector: 'Tatouage', description: 'Style graphique contrasté pour prestations.', family: 'onyx', layout: 'stacked-photo' },
  { id: '34_yoga', label: 'Yoga & Fitness', sector: 'Bien-être', description: 'Planning et tarifs dans un univers apaisant.', family: 'deep-ocean', layout: 'service-table' },
  { id: '35_dental', label: 'Cabinet dentaire', sector: 'Santé & soins', description: 'Services et tarifs présentés avec clarté.', family: 'pearl', layout: 'compact-list' },
  { id: '36_auto_garage', label: 'Garage Auto', sector: 'Automobile', description: 'Prestations, forfaits et tarifs du garage.', family: 'dark', layout: 'service-table' },
  { id: '37_real_estate', label: 'Immobilier', sector: 'Immobilier', description: 'Catalogue de biens avec hiérarchie visuelle.', family: 'luxury', layout: 'magazine-grid' },
  { id: '38_travel_agency', label: 'Agence de voyage', sector: 'Voyages', description: 'Offres et prestations présentées par destination.', family: 'deep-ocean', layout: 'magazine-grid' },
  { id: '39_event_planner', label: 'Event Planner', sector: 'Événementiel', description: 'Catalogue de formules et services événementiels.', family: 'royal-gold', layout: 'editorial-center' },
  { id: '40_laundry', label: 'Pressing & Laundry', sector: 'Services', description: 'Liste rapide des prestations et tarifs.', family: 'editorial', layout: 'compact-list' },
];

export const LEGACY_TEMPLATE_FAMILY: Record<string, MenuTemplateFamily> = {
  editorial: 'editorial',
  luxury: 'luxury',
  cards: 'cards',
  dark: 'dark',
  onyx: 'onyx',
  'royal-gold': 'royal-gold',
  'deep-ocean': 'deep-ocean',
  pearl: 'pearl',
};

export function getMenuTemplate(id: string): MenuTemplateDefinition | undefined {
  return MENU_TEMPLATES.find(template => template.id === id);
}

export function getMenuTemplateFamily(id: string): MenuTemplateFamily {
  return getMenuTemplate(id)?.family ?? LEGACY_TEMPLATE_FAMILY[id] ?? 'editorial';
}

export function getMenuTemplateLayout(id: string): MenuTemplateDefinition['layout'] {
  return getMenuTemplate(id)?.layout ?? 'price-list';
}
