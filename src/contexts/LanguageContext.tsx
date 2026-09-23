import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'fr' | 'en' | 'ar';

const translations = {
  fr: {
    language: 'Français',
    welcome: 'Bon retour 👋',
    loginTitle: 'Connectez-vous à votre espace',
    loginSubtitle: 'Accédez à toutes vos fonctionnalités et continuez à faire grandir votre établissement.',
    admin: 'Administrateur',
    responsible: 'Responsable',
    adminDesc: 'Gestion globale',
    responsibleDesc: 'Gestion de l’établissement',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    emailPlaceholder: 'votre@email.com',
    passwordPlaceholder: 'Votre mot de passe',
    forgot: 'Mot de passe oublié ?',
    login: 'Se connecter',
    changeSpace: 'Changer d’espace',
    selectSpace: 'Sélectionnez votre espace pour continuer.',
    createAccount: 'Créer un compte',
    back: 'Retour',
    services: {
      reviews: 'Avis & Réputation',
      reviewsDesc: 'Collectez, analysez et gérez vos avis sur Google et les principales plateformes.',
      loyalty: 'Fidélité',
      loyaltyDesc: 'Récompensez vos clients et donnez-leur envie de revenir.',
      experience: 'Expérience client',
      experienceDesc: 'Mesurez la satisfaction et améliorez chaque étape du parcours.',
      performance: 'Performance',
      performanceDesc: 'Suivez vos données, identifiez vos opportunités et prenez de meilleures décisions.',
    },
    hero: 'Transformez chaque client en',
    heroAccent: 'client fidèle.',
    heroDesc: 'Tap Marrakech vous aide à gérer vos avis, fidéliser vos clients et offrir une expérience exceptionnelle, simplement.',
    allInOne: 'Plateforme tout-en-un',
    establishments: 'établissements',
    reviewsManaged: 'avis gérés',
    recurring: 'clients récurrents',
    platformAccess: 'Accès plateforme',
    establishmentSpace: 'Espace établissement',
    secured: 'Sécurisé',
    simple: 'Simple',
    experienceShort: 'Expérience client',
  },
  en: {
    language: 'English',
    welcome: 'Welcome back 👋',
    loginTitle: 'Sign in to your workspace',
    loginSubtitle: 'Access all your features and keep growing your establishment.',
    admin: 'Administrator',
    responsible: 'Manager',
    adminDesc: 'Global management',
    responsibleDesc: 'Establishment management',
    email: 'Email address',
    password: 'Password',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: 'Your password',
    forgot: 'Forgot password?',
    login: 'Sign in',
    changeSpace: 'Change workspace',
    selectSpace: 'Select your workspace to continue.',
    createAccount: 'Create an account',
    back: 'Back',
    services: {
      reviews: 'Reviews & Reputation',
      reviewsDesc: 'Collect, analyze and manage your reviews on Google and major platforms.',
      loyalty: 'Loyalty',
      loyaltyDesc: 'Reward your customers and give them a reason to come back.',
      experience: 'Customer experience',
      experienceDesc: 'Measure satisfaction and improve every step of the journey.',
      performance: 'Performance',
      performanceDesc: 'Track your data, identify opportunities and make better decisions.',
    },
    hero: 'Turn every customer into a',
    heroAccent: 'loyal customer.',
    heroDesc: 'Tap Marrakech helps you manage reviews, build loyalty and deliver an exceptional customer experience, simply.',
    allInOne: 'All-in-one platform',
    establishments: 'establishments',
    reviewsManaged: 'reviews managed',
    recurring: 'returning customers',
    platformAccess: 'Platform access',
    establishmentSpace: 'Establishment workspace',
    secured: 'Secure',
    simple: 'Simple',
    experienceShort: 'Customer experience',
  },
  ar: {
    language: 'العربية',
    welcome: 'مرحباً بعودتك 👋',
    loginTitle: 'سجّل الدخول إلى مساحتك',
    loginSubtitle: 'الوصول إلى جميع الميزات ومواصلة تطوير مؤسستك.',
    admin: 'المشرف',
    responsible: 'المسؤول',
    adminDesc: 'إدارة شاملة',
    responsibleDesc: 'إدارة المؤسسة',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: 'كلمة المرور الخاصة بك',
    forgot: 'هل نسيت كلمة المرور؟',
    login: 'تسجيل الدخول',
    changeSpace: 'تغيير المساحة',
    selectSpace: 'اختر مساحتك للمتابعة.',
    createAccount: 'إنشاء حساب',
    back: 'رجوع',
    services: {
      reviews: 'التقييمات والسمعة',
      reviewsDesc: 'اجمع وحلل وأدر تقييماتك على Google والمنصات الرئيسية.',
      loyalty: 'الولاء',
      loyaltyDesc: 'كافئ عملاءك وشجعهم على العودة.',
      experience: 'تجربة العميل',
      experienceDesc: 'قس رضا العملاء وحسّن كل مرحلة من رحلتهم.',
      performance: 'الأداء',
      performanceDesc: 'تابع بياناتك وحدد فرصك واتخذ قرارات أفضل.',
    },
    hero: 'حوّل كل عميل إلى',
    heroAccent: 'عميل وفيّ.',
    heroDesc: 'تساعدك Tap Marrakech على إدارة تقييماتك وتعزيز ولاء عملائك وتقديم تجربة استثنائية ببساطة.',
    allInOne: 'منصة متكاملة',
    establishments: 'مؤسسة',
    reviewsManaged: 'تقييم مُدار',
    recurring: 'عملاء عائدون',
    platformAccess: 'الوصول إلى المنصة',
    establishmentSpace: 'مساحة المؤسسة',
    secured: 'آمن',
    simple: 'بسيط',
    experienceShort: 'تجربة العميل',
  },
} as const;

type Translation = typeof translations.fr;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = window.localStorage.getItem('tapmarrakech:language');
    return saved === 'en' || saved === 'ar' ? saved : 'fr';
  });

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem('tapmarrakech:language', next);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: translations[language],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
