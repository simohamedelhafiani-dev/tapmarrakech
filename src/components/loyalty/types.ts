export type LoyaltyType = 'STAMP' | 'POINTS' | 'DISCOUNT' | 'REWARD' | 'TIER' | 'CHALLENGE' | 'CASHBACK';

export type LoyaltyTemplate = {
  id: string;
  name: string;
  description: string;
  category: 'Élégant' | 'Moderne' | 'Minimaliste' | 'Gastronomique' | 'Premium' | 'Authentique';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  borderRadius: number;
  coverOverlay: number;
  layout: 'editorial' | 'photo' | 'split' | 'minimal' | 'luxury';
  stampStyle: 'circles' | 'squares' | 'stars' | 'hearts';
};

export type LoyaltyBuilderConfig = {
  templateId: string;
  loyaltyType: LoyaltyType;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  borderRadius: number;
  logoUrl: string | null;
  coverImageUrl: string | null;
  programName: string;
  cardTitle: string;
  cardSubtitle: string;
  progressText: string;
  rewardTitle: string;
  rewardDescription: string;
  stampGoal: number;
  rewardThreshold: number;
  discountPercent: number;
  rewardName: string;
  stampStyle: 'circles' | 'squares' | 'stars' | 'hearts';
  published: boolean;
};
