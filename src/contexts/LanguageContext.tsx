import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'fr' | 'en' | 'ar';

const originalTextNodes = new WeakMap<Text, string>();

const uiTranslations: Record<string, { en: string; ar: string }> = {
  'Vue d’ensemble': { en: 'Overview', ar: 'نظرة عامة' },
  'Établissements': { en: 'Establishments', ar: 'المؤسسات' },
  'Avis reçus': { en: 'Reviews', ar: 'التقييمات' },
  'Avis clients': { en: 'Customer reviews', ar: 'تقييمات العملاء' },
  'Fidélité': { en: 'Loyalty', ar: 'الولاء' },
  'Programme fidélité': { en: 'Loyalty program', ar: 'برنامج الولاء' },
  'Promotions': { en: 'Promotions', ar: 'العروض' },
  'Analytics': { en: 'Analytics', ar: 'التحليلات' },
  'Statistiques': { en: 'Statistics', ar: 'الإحصائيات' },
  'Menu': { en: 'Menu', ar: 'القائمة' },
  'Paramètres': { en: 'Settings', ar: 'الإعدادات' },
  'Tableau de bord': { en: 'Dashboard', ar: 'لوحة التحكم' },
  'Espace de gestion': { en: 'Management workspace', ar: 'مساحة الإدارة' },
  'Gérer mes établissements': { en: 'Manage my establishments', ar: 'إدارة مؤسساتي' },
  'Se déconnecter': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'Scanner fidélité': { en: 'Loyalty scanner', ar: 'ماسح الولاء' },
  'Ouvrir': { en: 'Open', ar: 'فتح' },
  'Copier': { en: 'Copy', ar: 'نسخ' },
  'Annuler': { en: 'Cancel', ar: 'إلغاء' },
  'Enregistrer': { en: 'Save', ar: 'حفظ' },
  'Modifier': { en: 'Edit', ar: 'تعديل' },
  'Supprimer': { en: 'Delete', ar: 'حذف' },
  'Ajouter': { en: 'Add', ar: 'إضافة' },
  'Créer': { en: 'Create', ar: 'إنشاء' },
  'Rechercher': { en: 'Search', ar: 'بحث' },
  'Filtrer': { en: 'Filter', ar: 'تصفية' },
  'Exporter': { en: 'Export', ar: 'تصدير' },
  'Voir tout': { en: 'View all', ar: 'عرض الكل' },
  'Voir plus': { en: 'View more', ar: 'عرض المزيد' },
  'Chargement…': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'Chargement...': { en: 'Loading...', ar: 'جارٍ التحميل...' },
  'Aucun résultat': { en: 'No results', ar: 'لا توجد نتائج' },
  'Aucun établissement sélectionné': { en: 'No establishment selected', ar: 'لم يتم اختيار مؤسسة' },
  'Mon établissement': { en: 'My establishment', ar: 'مؤسستي' },
  'Avis & Réputation': { en: 'Reviews & Reputation', ar: 'التقييمات والسمعة' },
  'Expérience client': { en: 'Customer experience', ar: 'تجربة العميل' },
  'Performance': { en: 'Performance', ar: 'الأداء' },
  'Clients fidélisés': { en: 'Loyal customers', ar: 'العملاء المخلصون' },
  'Nouveaux avis': { en: 'New reviews', ar: 'تقييمات جديدة' },
  'Note moyenne': { en: 'Average rating', ar: 'متوسط التقييم' },
  'Derniers avis clients': { en: 'Latest customer reviews', ar: 'أحدث تقييمات العملاء' },
  'Répondre': { en: 'Reply', ar: 'الرد' },
  'Réponse': { en: 'Response', ar: 'الرد' },
  'Récompenses': { en: 'Rewards', ar: 'المكافآت' },
  'Clients': { en: 'Customers', ar: 'العملاء' },
  'Membres': { en: 'Members', ar: 'الأعضاء' },
  'Points': { en: 'Points', ar: 'النقاط' },
  'Récompense': { en: 'Reward', ar: 'مكافأة' },
  'Campagnes': { en: 'Campaigns', ar: 'الحملات' },
  'Aujourd’hui': { en: 'Today', ar: 'اليوم' },
  'Cette semaine': { en: 'This week', ar: 'هذا الأسبوع' },
  'Ce mois-ci': { en: 'This month', ar: 'هذا الشهر' },
  '7 derniers jours': { en: 'Last 7 days', ar: 'آخر 7 أيام' },
  '30 derniers jours': { en: 'Last 30 days', ar: 'آخر 30 يوماً' },
  '3 mois': { en: '3 months', ar: '3 أشهر' },
  '6 mois': { en: '6 months', ar: '6 أشهر' },
  '12 mois': { en: '12 months', ar: '12 شهراً' },
  'Total': { en: 'Total', ar: 'الإجمالي' },
  'Activé': { en: 'Enabled', ar: 'مفعّل' },
  'Désactivé': { en: 'Disabled', ar: 'معطّل' },
  'Actif': { en: 'Active', ar: 'نشط' },
  'Inactif': { en: 'Inactive', ar: 'غير نشط' },
  'Oui': { en: 'Yes', ar: 'نعم' },
  'Non': { en: 'No', ar: 'لا' },
  'Fermer': { en: 'Close', ar: 'إغلاق' },
  'Continuer': { en: 'Continue', ar: 'متابعة' },
  'Retour': { en: 'Back', ar: 'رجوع' },
  'Sélectionner': { en: 'Select', ar: 'اختيار' },
  'Nom': { en: 'Name', ar: 'الاسم' },
  'Téléphone': { en: 'Phone', ar: 'الهاتف' },
  'Email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'Adresse': { en: 'Address', ar: 'العنوان' },
  'Statut': { en: 'Status', ar: 'الحالة' },
  'Date': { en: 'Date', ar: 'التاريخ' },
  'Actions': { en: 'Actions', ar: 'الإجراءات' },
  'Utilisateur': { en: 'User', ar: 'المستخدم' },
  'Responsable': { en: 'Manager', ar: 'المسؤول' },
  'Administrateur': { en: 'Administrator', ar: 'المشرف' },
  'Bienvenue': { en: 'Welcome', ar: 'مرحباً' },
  'Aperçu': { en: 'Overview', ar: 'نظرة عامة' },
  'Aucun': { en: 'None', ar: 'لا يوجد' },
  'Enregistrer les modifications': { en: 'Save changes', ar: 'حفظ التغييرات' },
  'Nouvelle récompense': { en: 'New reward', ar: 'مكافأة جديدة' },
  'Créer une campagne': { en: 'Create campaign', ar: 'إنشاء حملة' },
  'Ajouter un client': { en: 'Add customer', ar: 'إضافة عميل' },
  'Générer un QR code': { en: 'Generate QR code', ar: 'إنشاء رمز QR' },
};

function translateUiText(value: string, language: Language) {
  const clean = value.trim();
  const translation = uiTranslations[clean];
  if (!translation || language === 'fr') return value;
  const translated = translation[language];
  return value.replace(clean, translated);
}

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

    const translateDom = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) nodes.push(node as Text);
      nodes.forEach((textNode) => {
        const current = textNode.nodeValue ?? '';
        if (!current.trim()) return;
        const original = originalTextNodes.get(textNode) ?? current;
        originalTextNodes.set(textNode, original);
        const translated = translateUiText(original, language);
        if (translated !== current) textNode.nodeValue = translated;
      });

      document.querySelectorAll<HTMLElement>('[placeholder],[title],[aria-label]').forEach((el) => {
        for (const attr of ['placeholder', 'title', 'aria-label']) {
          const value = el.getAttribute(attr);
          if (!value) continue;
          const key = `tapmarrakech:i18n-original:${attr}`;
          const original = el.dataset[key.replace(/:/g, '')] ?? value;
          el.dataset[key.replace(/:/g, '')] = original;
          const translated = translateUiText(original, language);
          if (translated !== value) el.setAttribute(attr, translated);
        }
      });
    };

    translateDom();
    const observer = new MutationObserver(() => translateDom());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
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
