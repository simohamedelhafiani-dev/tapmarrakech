import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Star,
  Users,
  Heart,
  BarChart3,
  Globe2,
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

type LoginRole = 'admin' | 'responsible' | null;

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<LoginRole>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    if (role === 'admin') navigate('/admin', { replace: true });
    if (role === 'responsible') navigate('/dashboard', { replace: true });
  }, [loading, user, role, navigate]);

  function selectRole(nextRole: LoginRole) {
    setError('');
    setEmail('');
    setPassword('');
    setSelectedRole(nextRole);
  }

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setSaving(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (loginError || !data.user) {
      setSaving(false);
      setError(loginError?.message ?? 'Email ou mot de passe incorrect.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Impossible de déterminer votre accès.');
      return;
    }

    if (selectedRole === 'admin' && profile.role !== 'admin') {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Ce compte n’est pas un compte administrateur.');
      return;
    }

    if (selectedRole === 'responsible' && profile.role !== 'responsible') {
      await supabase.auth.signOut();
      setSaving(false);
      setError('Ce compte n’est pas un compte responsable.');
      return;
    }

    setSaving(false);
    if (profile.role === 'admin') navigate('/admin', { replace: true });
    else if (profile.role === 'responsible') navigate('/dashboard', { replace: true });
    else navigate('/login', { replace: true });
  }

  return (
    <div className="auth-surface min-h-screen bg-[#0D110E]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <section className="relative flex overflow-hidden bg-[#0D110E] px-7 py-8 text-[#EFE9DC] sm:px-10 lg:min-h-screen lg:w-[52%] lg:px-14 lg:py-10 xl:px-20">
          <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full border border-[rgba(239,233,220,0.12)]" />
          <div className="pointer-events-none absolute -right-44 top-1/3 h-[520px] w-[520px] rounded-full border border-[rgba(239,233,220,0.08)]" />
          <div className="pointer-events-none absolute -bottom-48 left-1/3 h-[460px] w-[460px] rounded-full bg-[#8A6C33]/10 blur-3xl" />

          <div className="relative z-10 flex w-full min-h-[620px] flex-col">
            <div className="flex items-start justify-between">
              <div>
                <img
                  src="/tapmarrakech-logo.png"
                  alt="TapMarrakech"
                  className="h-16 w-auto max-w-[180px] object-contain object-left"
                />
                <p className="mt-2 text-xs text-[#EFE9DC]/56">L’expérience client, c’est un atout.</p>
              </div>
              <span className="hidden border border-[#C9A15A]/45 px-4 py-2 text-[9px] font-bold text-[#C9A15A] sm:inline-flex">
                {t.allInOne}
              </span>
            </div>

            <div className="mt-14 max-w-2xl lg:mt-20">
              <p className="text-[10px] font-semibold tracking-[0.08em] text-[#C9A15A]">
                {language === 'fr'
                  ? 'UNE SEULE PLATEFORME POUR L’EXPÉRIENCE CLIENT'
                  : language === 'en'
                    ? 'ONE PLATFORM FOR CUSTOMER EXPERIENCE'
                    : 'منصة واحدة لتجربة العميل'}
              </p>

              <h1 className="mt-5 max-w-2xl font-display text-[42px] leading-[0.98] sm:text-5xl xl:text-[60px]">
                {language === 'fr'
                  ? 'Chaque interaction peut donner envie de revenir.'
                  : language === 'en'
                    ? 'Every interaction can give customers a reason to return.'
                    : 'كل تفاعل يمكن أن يمنح العميل سبباً للعودة.'}
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#EFE9DC]/56 sm:text-base">
                {language === 'fr'
                  ? 'Avis, fidélité et expérience client réunis dans un espace simple pour piloter ce qui compte vraiment.'
                  : language === 'en'
                    ? 'Reviews, loyalty and customer experience brought together in one simple space to manage what really matters.'
                    : 'التقييمات والولاء وتجربة العميل في مساحة واحدة بسيطة لإدارة ما يهم فعلاً.'}
              </p>
            </div>

            <div className="mt-12 max-w-2xl">
              {[
                {
                  number: '01',
                  title: t.services.reviews,
                  text: t.services.reviewsDesc,
                },
                {
                  number: '02',
                  title: t.services.loyalty,
                  text: t.services.loyaltyDesc,
                },
                {
                  number: '03',
                  title: t.services.experience,
                  text: t.services.experienceDesc,
                },
                {
                  number: '04',
                  title: t.services.performance,
                  text: t.services.performanceDesc,
                },
              ].map(({ number, title, text }) => (
                <div
                  key={number}
                  className="grid grid-cols-[42px_150px_1fr] items-baseline gap-4 border-t border-[rgba(239,233,220,0.12)] py-4 last:border-b sm:grid-cols-[48px_170px_1fr] sm:gap-5"
                >
                  <span className="font-display text-sm text-[#C9A15A]">{number}</span>
                  <p className="text-sm font-medium text-[#EFE9DC]">{title}</p>
                  <p className="text-xs leading-5 text-[#EFE9DC]/56 sm:text-sm">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto hidden border-t border-[rgba(239,233,220,0.12)] pt-6 md:block">
              <div className="flex items-stretch">
                <div className="pr-8">
                  <p className="font-display text-2xl text-[#C9A15A]">+2 000</p>
                  <p className="mt-1 text-[11px] text-[#EFE9DC]/56">{t.establishments}</p>
                </div>
                <div className="border-l border-[rgba(239,233,220,0.12)] px-8">
                  <p className="font-display text-2xl text-[#C9A15A]">+50 000</p>
                  <p className="mt-1 text-[11px] text-[#EFE9DC]/56">{t.reviewsManaged}</p>
                </div>
                <div className="border-l border-[rgba(239,233,220,0.12)] pl-8">
                  <p className="font-display text-2xl text-[#C9A15A]">+30 %</p>
                  <p className="mt-1 text-[11px] text-[#EFE9DC]/56">{t.recurring}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center bg-[#0D110E] px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-xl">
            <div className="mb-12 flex justify-end">
              <label className="inline-flex items-center gap-2 border-b border-[rgba(239,233,220,0.12)] px-1 py-2 text-xs text-[#EFE9DC]/56">
                <Globe2 size={16} />
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  aria-label="Language"
                  className="cursor-pointer bg-transparent text-[#EFE9DC] outline-none"
                >
                  <option className="bg-[#141A15]" value="fr">Français</option>
                  <option className="bg-[#141A15]" value="en">English</option>
                  <option className="bg-[#141A15]" value="ar">العربية</option>
                </select>
              </label>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-bold text-[#C9A15A]">{t.welcome}</p>
              <h2 className="mt-3 max-w-xl font-display text-4xl leading-[1.05] text-[#EFE9DC] sm:text-5xl">
                {t.loginTitle}
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#EFE9DC]/56">{t.selectSpace}</p>
            </div>

            <div className="segmented mb-8">
              <button
                type="button"
                onClick={() => selectRole('admin')}
                className={selectedRole === 'admin' ? 'active' : ''}
              >
                <ShieldCheck size={17} />
                <span>{t.admin}</span>
              </button>
              <button
                type="button"
                onClick={() => selectRole('responsible')}
                className={selectedRole === 'responsible' ? 'active' : ''}
              >
                <UserRound size={17} />
                <span>{t.responsible}</span>
              </button>
            </div>

            {selectedRole ? (
              <>
                {error && (
                  <div className="mb-5 border border-[rgba(239,233,220,0.12)] bg-[#141A15] px-4 py-3 text-sm text-[#EFE9DC]">
                    {error}
                  </div>
                )}
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs text-[#EFE9DC]/56">{t.email}</label>
                    <div className="relative">
                      <UserRound size={17} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#EFE9DC]/40" />
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                        placeholder={t.emailPlaceholder}
                        className="w-full border-0 border-b border-[rgba(239,233,220,0.12)] bg-transparent py-4 pl-7 pr-4 text-sm text-[#EFE9DC] outline-none focus:border-[#C9A15A]"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs text-[#EFE9DC]/56">{t.password}</label>
                      <Link to="/forgot-password" className="text-xs text-[#C9A15A]">{t.forgot}</Link>
                    </div>
                    <div className="relative">
                      <LockKeyhole size={17} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#EFE9DC]/40" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                        placeholder={t.passwordPlaceholder}
                        className="w-full border-0 border-b border-[rgba(239,233,220,0.12)] bg-transparent py-4 pl-7 pr-11 text-sm text-[#EFE9DC] outline-none focus:border-[#C9A15A]"
                      />
                      <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-[#EFE9DC]/40">
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                  <button onClick={handleLogin} disabled={saving} className="flex w-full items-center justify-center gap-2 bg-gradient-to-b from-[#D9B673] to-[#B08A45] py-4 text-sm font-semibold text-[#1A1409] shadow-[0_8px_20px_rgba(201,161,90,0.18)] disabled:opacity-50">
                    {saving ? `${t.login}...` : t.login}
                  </button>
                </div>
                <button type="button" onClick={() => selectRole(null)} className="mt-5 inline-flex items-center gap-2 text-xs text-[#EFE9DC]/56">
                  <ArrowLeft size={14} /> {t.changeSpace}
                </button>
              </>
            ) : (
              <div className="border-b border-[rgba(239,233,220,0.12)] px-1 py-4 text-center text-xs text-[#EFE9DC]/56">
                {t.selectSpace}
              </div>
            )}

            <div className="mt-9 flex items-center justify-center gap-4 text-xs text-[#EFE9DC]/56">
              <Link to="/register">{t.createAccount}</Link>
              <span className="h-4 w-px bg-[rgba(239,233,220,0.12)]" />
              <Link to="/forgot-password">{t.forgot}</Link>
            </div>

            <div className="mt-10 flex items-center justify-center gap-8 border-t border-[rgba(239,233,220,0.12)] pt-6 text-[10px] text-[#EFE9DC]/56">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> {t.secured}</span>
              <span className="inline-flex items-center gap-2"><BarChart3 size={15} /> {t.simple}</span>
              <span className="inline-flex items-center gap-2"><Heart size={15} /> {t.experienceShort}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
