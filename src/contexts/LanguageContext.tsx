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

const expandedUiTranslations: Record<string, { en: string; ar: string }> = {
  'Accueil': { en: 'Home', ar: 'الرئيسية' },
  'Vue générale': { en: 'Overview', ar: 'نظرة عامة' },
  'Espace administrateur': { en: 'Administrator workspace', ar: 'مساحة المشرف' },
  'Espace responsable': { en: 'Manager workspace', ar: 'مساحة المسؤول' },
  'Espace établissement': { en: 'Establishment workspace', ar: 'مساحة المؤسسة' },
  'Gérer': { en: 'Manage', ar: 'إدارة' },
  'Gestion': { en: 'Management', ar: 'الإدارة' },
  'Profil': { en: 'Profile', ar: 'الملف الشخصي' },
  'Informations': { en: 'Information', ar: 'المعلومات' },
  'Description': { en: 'Description', ar: 'الوصف' },
  'Nom de l’établissement': { en: 'Establishment name', ar: 'اسم المؤسسة' },
  'Nom de l’établissement *': { en: 'Establishment name *', ar: 'اسم المؤسسة *' },
  'Créer un établissement': { en: 'Create establishment', ar: 'إنشاء مؤسسة' },
  'Nouvel établissement': { en: 'New establishment', ar: 'مؤسسة جديدة' },
  'Aucun établissement': { en: 'No establishments', ar: 'لا توجد مؤسسات' },
  'Sélectionnez ou créez un établissement avant d’utiliser cette fonctionnalité.': { en: 'Select or create an establishment before using this feature.', ar: 'اختر مؤسسة أو أنشئ مؤسسة قبل استخدام هذه الميزة.' },
  'Crée d’abord ton établissement pour gérer ses promotions.': { en: 'Create your establishment first to manage its promotions.', ar: 'أنشئ مؤسستك أولاً لإدارة عروضها.' },
  'Avis': { en: 'Reviews', ar: 'التقييمات' },
  'Avis Google': { en: 'Google reviews', ar: 'تقييمات Google' },
  'Réputation': { en: 'Reputation', ar: 'السمعة' },
  'Répondre aux avis': { en: 'Reply to reviews', ar: 'الرد على التقييمات' },
  'Nouvel avis client': { en: 'New customer review', ar: 'تقييم عميل جديد' },
  'Note moyenne': { en: 'Average rating', ar: 'متوسط التقييم' },
  'Analyse': { en: 'Analysis', ar: 'التحليل' },
  'Analyses': { en: 'Analysis', ar: 'التحليلات' },
  'Analyse des avis': { en: 'Review analysis', ar: 'تحليل التقييمات' },
  'Statut': { en: 'Status', ar: 'الحالة' },
  'En attente': { en: 'Pending', ar: 'قيد الانتظار' },
  'Traité': { en: 'Processed', ar: 'تمت المعالجة' },
  'Approuvé': { en: 'Approved', ar: 'تمت الموافقة' },
  'Refusé': { en: 'Rejected', ar: 'مرفوض' },
  'Erreur': { en: 'Error', ar: 'خطأ' },
  'Succès': { en: 'Success', ar: 'نجاح' },
  'Avertissement': { en: 'Warning', ar: 'تحذير' },
  'Impossible': { en: 'Unable', ar: 'تعذر' },
  'Impossible de charger les données.': { en: 'Unable to load data.', ar: 'تعذر تحميل البيانات.' },
  'Une erreur est survenue.': { en: 'An error occurred.', ar: 'حدث خطأ.' },
  'Enregistrer les modifications': { en: 'Save changes', ar: 'حفظ التغييرات' },
  'Enregistrer': { en: 'Save', ar: 'حفظ' },
  'Enregistré': { en: 'Saved', ar: 'تم الحفظ' },
  'Enregistrée': { en: 'Saved', ar: 'تم الحفظ' },
  'Créer': { en: 'Create', ar: 'إنشاء' },
  'Créer maintenant': { en: 'Create now', ar: 'إنشاء الآن' },
  'Ajouter': { en: 'Add', ar: 'إضافة' },
  'Ajouter un client': { en: 'Add customer', ar: 'إضافة عميل' },
  'Modifier': { en: 'Edit', ar: 'تعديل' },
  'Modifier l’établissement': { en: 'Edit establishment', ar: 'تعديل المؤسسة' },
  'Supprimer': { en: 'Delete', ar: 'حذف' },
  'Confirmer': { en: 'Confirm', ar: 'تأكيد' },
  'Fermer': { en: 'Close', ar: 'إغلاق' },
  'Annuler': { en: 'Cancel', ar: 'إلغاء' },
  'Retour': { en: 'Back', ar: 'رجوع' },
  'Continuer': { en: 'Continue', ar: 'متابعة' },
  'Valider': { en: 'Confirm', ar: 'تأكيد' },
  'Rechercher': { en: 'Search', ar: 'بحث' },
  'Filtrer': { en: 'Filter', ar: 'تصفية' },
  'Réinitialiser': { en: 'Reset', ar: 'إعادة تعيين' },
  'Actualiser': { en: 'Refresh', ar: 'تحديث' },
  'Rafraîchir': { en: 'Refresh', ar: 'تحديث' },
  'Exporter': { en: 'Export', ar: 'تصدير' },
  'Télécharger': { en: 'Download', ar: 'تنزيل' },
  'Imprimer': { en: 'Print', ar: 'طباعة' },
  'Copier le lien': { en: 'Copy link', ar: 'نسخ الرابط' },
  'Lien copié': { en: 'Link copied', ar: 'تم نسخ الرابط' },
  'Ouvrir': { en: 'Open', ar: 'فتح' },
  'Voir': { en: 'View', ar: 'عرض' },
  'Voir tout': { en: 'View all', ar: 'عرض الكل' },
  'Voir plus': { en: 'View more', ar: 'عرض المزيد' },
  'Détails': { en: 'Details', ar: 'التفاصيل' },
  'Actions': { en: 'Actions', ar: 'الإجراءات' },
  'Date': { en: 'Date', ar: 'التاريخ' },
  'Aujourd’hui': { en: 'Today', ar: 'اليوم' },
  'Aujourd’hui': { en: 'Today', ar: 'اليوم' },
  'Hier': { en: 'Yesterday', ar: 'أمس' },
  'Cette semaine': { en: 'This week', ar: 'هذا الأسبوع' },
  'Ce mois-ci': { en: 'This month', ar: 'هذا الشهر' },
  'Mois': { en: 'Month', ar: 'الشهر' },
  'Semaine': { en: 'Week', ar: 'الأسبوع' },
  'Année': { en: 'Year', ar: 'السنة' },
  '7 derniers jours': { en: 'Last 7 days', ar: 'آخر 7 أيام' },
  '30 derniers jours': { en: 'Last 30 days', ar: 'آخر 30 days' },
  '90 derniers jours': { en: 'Last 90 days', ar: 'آخر 90 يوماً' },
  'Aucun résultat': { en: 'No results', ar: 'لا توجد نتائج' },
  'Aucune donnée': { en: 'No data', ar: 'لا توجد بيانات' },
  'Aucun avis': { en: 'No reviews', ar: 'لا توجد تقييمات' },
  'Aucun client': { en: 'No customers', ar: 'لا يوجد عملاء' },
  'Aucune promotion': { en: 'No promotions', ar: 'لا توجد عروض' },
  'Aucune promotion publiée': { en: 'No published promotions', ar: 'لا توجد عروض منشورة' },
  'Chargement': { en: 'Loading', ar: 'جارٍ التحميل' },
  'Chargement…': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'Chargement...': { en: 'Loading...', ar: 'جارٍ التحميل...' },
  'En cours': { en: 'In progress', ar: 'قيد التنفيذ' },
  'Actif': { en: 'Active', ar: 'نشط' },
  'Active': { en: 'Active', ar: 'نشط' },
  'Inactif': { en: 'Inactive', ar: 'غير نشط' },
  'Activé': { en: 'Enabled', ar: 'مفعّل' },
  'Désactivé': { en: 'Disabled', ar: 'معطّل' },
  'Oui': { en: 'Yes', ar: 'نعم' },
  'Non': { en: 'No', ar: 'لا' },
  'Nom': { en: 'Name', ar: 'الاسم' },
  'Prénom': { en: 'First name', ar: 'الاسم الأول' },
  'Nom de famille': { en: 'Last name', ar: 'اسم العائلة' },
  'Téléphone': { en: 'Phone', ar: 'الهاتف' },
  'Adresse': { en: 'Address', ar: 'العنوان' },
  'Email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'Mot de passe': { en: 'Password', ar: 'كلمة المرور' },
  'Code': { en: 'Code', ar: 'الرمز' },
  'Prix': { en: 'Price', ar: 'السعر' },
  'Prix normal': { en: 'Regular price', ar: 'السعر العادي' },
  'Prix promo': { en: 'Promotional price', ar: 'السعر الترويجي' },
  'Description': { en: 'Description', ar: 'الوصف' },
  'Catégorie': { en: 'Category', ar: 'الفئة' },
  'Catégories': { en: 'Categories', ar: 'الفئات' },
  'Produit': { en: 'Product', ar: 'المنتج' },
  'Produits': { en: 'Products', ar: 'المنتجات' },
  'Article': { en: 'Item', ar: 'العنصر' },
  'Articles': { en: 'Items', ar: 'العناصر' },
  'Menu digital': { en: 'Digital menu', ar: 'القائمة الرقمية' },
  'Concevoir le menu': { en: 'Design menu', ar: 'تصميم القائمة' },
  'Aperçu': { en: 'Overview', ar: 'نظرة عامة' },
  'Publier': { en: 'Publish', ar: 'نشر' },
  'Publication': { en: 'Publishing', ar: 'النشر' },
  'Publié': { en: 'Published', ar: 'منشور' },
  'Promotion': { en: 'Promotion', ar: 'عرض ترويجي' },
  'Promotions': { en: 'Promotions', ar: 'العروض' },
  'Nouvelle promotion': { en: 'New promotion', ar: 'عرض ترويجي جديد' },
  'Tes promotions': { en: 'Your promotions', ar: 'عروضك' },
  'Générer et publier avec l’IA': { en: 'Generate and publish with AI', ar: 'إنشاء ونشر بالذكاء الاصطناعي' },
  'Génération du visuel…': { en: 'Generating visual…', ar: 'جارٍ إنشاء التصميم…' },
  'Fidélité': { en: 'Loyalty', ar: 'الولاء' },
  'Programme de fidélité': { en: 'Loyalty program', ar: 'برنامج الولاء' },
  'Clients fidélisés': { en: 'Loyal customers', ar: 'العملاء المخلصون' },
  'Clients': { en: 'Customers', ar: 'العملاء' },
  'Membres': { en: 'Members', ar: 'الأعضاء' },
  'Récompenses': { en: 'Rewards', ar: 'المكافآت' },
  'Récompense': { en: 'Reward', ar: 'مكافأة' },
  'Points': { en: 'Points', ar: 'النقاط' },
  'Visites': { en: 'Visits', ar: 'الزيارات' },
  'Réductions': { en: 'Discounts', ar: 'الخصومات' },
  'Avantages': { en: 'Benefits', ar: 'المزايا' },
  'Campagnes': { en: 'Campaigns', ar: 'الحملات' },
  'Scanner fidélité': { en: 'Loyalty scanner', ar: 'ماسح الولاء' },
  'Nouveau client': { en: 'New customer', ar: 'عميل جديد' },
  'Nouveau client fidélité': { en: 'New loyalty customer', ar: 'عميل ولاء جديد' },
  'Points fidélité ajoutés': { en: 'Loyalty points added', ar: 'تمت إضافة نقاط الولاء' },
  'Récompense utilisée': { en: 'Reward redeemed', ar: 'تم استخدام المكافأة' },
  'Opération fidélité': { en: 'Loyalty activity', ar: 'عملية ولاء' },
  'Enregistrer ma carte sur mon téléphone': { en: 'Save my card on my phone', ar: 'حفظ بطاقتي على هاتفي' },
  'Ajoutez-la à votre écran d’accueil ou partagez votre carte.': { en: 'Add it to your home screen or share your card.', ar: 'أضفها إلى شاشتك الرئيسية أو شارك بطاقتك.' },
  'Ma carte fidélité': { en: 'My loyalty card', ar: 'بطاقة الولاء الخاصة بي' },
  'Carte indisponible': { en: 'Card unavailable', ar: 'البطاقة غير متاحة' },
  'Carte de fidélité introuvable.': { en: 'Loyalty card not found.', ar: 'لم يتم العثور على بطاقة الولاء.' },
  'Appeler': { en: 'Call', ar: 'اتصال' },
  'WhatsApp': { en: 'WhatsApp', ar: 'واتساب' },
  'Sécurité': { en: 'Security', ar: 'الأمان' },
  'Paramètres': { en: 'Settings', ar: 'الإعدادات' },
  'Notifications': { en: 'Notifications', ar: 'الإشعارات' },
  'Système': { en: 'System', ar: 'النظام' },
  'Rapports': { en: 'Reports', ar: 'التقارير' },
  'Facturation': { en: 'Billing', ar: 'الفوترة' },
  'Abonnement': { en: 'Subscription', ar: 'الاشتراك' },
  'Abonnements': { en: 'Subscriptions', ar: 'الاشتراكات' },
  'Essai': { en: 'Trial', ar: 'تجربة' },
  'Actif ·': { en: 'Active ·', ar: 'نشط ·' },
  'Se déconnecter': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'Bienvenue': { en: 'Welcome', ar: 'مرحباً' },
  'Bon retour 👋': { en: 'Welcome back 👋', ar: 'مرحباً بعودتك 👋' },
  'Aide': { en: 'Help', ar: 'المساعدة' },
  'En savoir plus': { en: 'Learn more', ar: 'معرفة المزيد' },
  'L’expérience client, c’est un atout.': { en: 'Customer experience is an asset.', ar: 'تجربة العميل هي ميزة.' },
  'Crée une promotion avec l’IA': { en: 'Create a promotion with AI', ar: 'أنشئ عرضاً ترويجياً بالذكاء الاصطناعي' },
  'Le visuel est toujours généré par l’IA.': { en: 'The visual is always generated by AI.', ar: 'يتم إنشاء التصميم دائماً بواسطة الذكاء الاصطناعي.' },
\n};
Object.assign(uiTranslations, expandedUiTranslations);

function sourceUiText(value: string) {
  const clean = value.trim();
  if (uiTranslations[clean]) return clean;
  for (const [source, translation] of Object.entries(uiTranslations)) {
    if (translation.en === clean || translation.ar === clean) return source;
  }
  return value;
}

function translateUiText(value: string, language: Language) {
  const source = sourceUiText(value);
  const clean = source.trim();
  const translation = uiTranslations[clean];
  if (!translation || language === 'fr') return value.replace(value.trim(), clean);
  return value.replace(value.trim(), translation[language]);
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

type Translation = typeof translations[Language];

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

  useEffect(() => {
    const translatableAttributes = ['placeholder', 'title', 'aria-label', 'alt'];

    const translateNode = (node: Text) => {
      const current = node.nodeValue ?? '';
      if (!current.trim()) return;
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, current);
      const source = originalTextNodes.get(node) ?? current;
      const translated = translateUiText(source, language);
      if (node.nodeValue !== translated) node.nodeValue = translated;
    };

    const translateElement = (element: Element) => {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let current: Node | null;
      while ((current = walker.nextNode())) translateNode(current as Text);
      for (const attribute of translatableAttributes) {
        const value = element.getAttribute(attribute);
        if (!value?.trim()) continue;
        const key = 'tapmarrakech:i18n:' + attribute;
        const original = element.getAttribute(key) ?? value;
        if (!element.hasAttribute(key)) element.setAttribute(key, original);
        const translated = translateUiText(original, language);
        if (value !== translated && value !== original) element.setAttribute(attribute, translated);
        else if (value === original && translated !== original) element.setAttribute(attribute, translated);
      }
    };

    translateElement(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateNode(mutation.target as Text);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateNode(node as Text);
          else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element);
        });
      }
    });

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
