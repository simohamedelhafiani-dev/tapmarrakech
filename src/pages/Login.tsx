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

  const [selectedRole, setSelectedRole] = useState<LoginRole>(null);
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
    <div className="tm-auth min-h-screen bg-[var(--ink)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <section className="relative overflow-hidden bg-[#06382e] px-7 py-8 text-white sm:px-10 lg:min-h-screen lg:w-[48%] lg:px-14 lg:py-10 xl:px-20">
          <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-44 top-1/3 h-[520px] w-[520px] rounded-full border border-white/[0.07]" />
          <div className="absolute -bottom-48 left-1/3 h-[460px] w-[460px] rounded-full bg-[#0b493c]/60 blur-3xl" />

          <div className="relative z-10 flex h-full min-h-[620px] flex-col">
            <div className="flex items-start justify-between">
              <div>
                <img
                  src="/tapmarrakech-logo.svg"
                  alt="TapMarrakech"
                  className="h-16 w-auto max-w-[180px] object-contain object-left"
                />
                <p className="mt-2 text-xs text-white/75">L’expérience client, c’est un atout.</p>
              </div>
              <span className="hidden rounded-full border border-[#d3a84c]/45 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.25em] text-[#e0bc68] sm:inline-flex">
                {t.allInOne}
              </span>
            </div>

            <div className="mt-12 max-w-2xl lg:mt-16">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d3a84c]">{language === 'fr' ? 'Des établissements qui grandissent avec leurs clients' : language === 'en' ? 'Establishments that grow with their customers' : 'مؤسسات تنمو مع عملائها'}</p>
              <h1 className="mt-5 max-w-2xl font-display text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl xl:text-[58px]">
                {t.hero} <span className="text-[#d3a84c]">{t.heroAccent}</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-white/65 sm:text-base">
                {t.heroDesc}
              </p>
            </div>

            <div className="mt-9 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icon: Star, title: t.services.reviews, text: t.services.reviewsDesc },
                { icon: Users, title: t.services.loyalty, text: t.services.loyaltyDesc },
                { icon: Heart, title: t.services.experience, text: t.services.experienceDesc },
                { icon: BarChart3, title: t.services.performance, text: t.services.performanceDesc },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#214c40]/45 p-4 transition-colors hover:bg-[#214c40]/65">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d3a84c]/15 text-[#e1bc68]">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{title}</h2>
                      <p className="mt-1 text-xs leading-5 text-white/55">{text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto hidden border-t border-white/10 pt-6 md:block">
              <div className="mb-4 h-px w-12 bg-[#d3a84c]" />
              <p className="max-w-md text-sm leading-6 text-white/65">{t.heroDesc}</p>
              <div className="mt-6 grid max-w-2xl grid-cols-3 gap-6">
                <div><p className="text-2xl font-semibold text-[#d3a84c]">+2 000</p><p className="mt-1 text-[11px] text-white/45">{t.establishments}</p></div>
                <div><p className="text-2xl font-semibold text-[#d3a84c]">+50 000</p><p className="mt-1 text-[11px] text-white/45">{t.reviewsManaged}</p></div>
                <div><p className="text-2xl font-semibold text-[#d3a84c]">+30 %</p><p className="mt-1 text-[11px] text-white/45">{t.recurring}</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="tm-auth-main flex flex-1 items-center justify-center bg-[#f7f7f3] px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-xl">
            <div className="mb-12 flex justify-end">
              <label className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs font-medium text-ink/65 shadow-sm">
                <Globe2 size={16} />
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  aria-label="Language"
                  className="cursor-pointer bg-transparent outline-none"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#b58b3e]">{t.welcome}</p>
              <h2 className="mt-3 max-w-xl font-display text-4xl leading-[1.05] tracking-[-0.035em] text-[#10201c] sm:text-5xl">{t.loginTitle}</h2>
              <p className="mt-4 text-sm leading-6 text-ink/50">{t.selectSpace}</p>
            </div>

            <div className="tm-role-switch mb-8 grid grid-cols-2 gap-1 rounded-[4px] border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => selectRole('admin')}
                className={`tm-role-option rounded-2xl border p-5 text-left transition-all duration-200 ${selectedRole === 'admin' ? 'border-[#173d32] bg-[#173d32] text-white shadow-lg' : 'border-black/5 bg-white text-ink shadow-sm hover:-translate-y-0.5 hover:border-[#173d32]/25 hover:shadow-md'}`}
              >
                <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${selectedRole === 'admin' ? 'bg-white/10' : 'bg-[#06382e]/10 text-[#06382e]'}`}>
                  <ShieldCheck size={21} />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-55">{t.platformAccess}</p>
                <p className="mt-1 font-display text-xl">{t.admin}</p>
                <p className="mt-1 text-[11px] leading-4 opacity-55">{t.adminDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => selectRole('responsible')}
                className={`tm-role-option rounded-2xl border p-5 text-left transition-all duration-200 ${selectedRole === 'responsible' ? 'border-[#173d32] bg-[#173d32] text-white shadow-lg' : 'border-black/5 bg-white text-ink shadow-sm hover:-translate-y-0.5 hover:border-[#173d32]/25 hover:shadow-md'}`}
              >
                <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${selectedRole === 'responsible' ? 'bg-white/10' : 'bg-[#f4ead3] text-[#06382e]'}`}>
                  <UserRound size={21} />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-55">{t.establishmentSpace}</p>
                <p className="mt-1 font-display text-xl">{t.responsible}</p>
                <p className="mt-1 text-[11px] leading-4 opacity-55">{t.responsibleDesc}</p>
              </button>
            </div>

            {selectedRole ? (
              <>
                {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-ink/65">{t.email}</label>
                    <div className="relative">
                      <UserRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25" />
                      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder={t.emailPlaceholder} className="w-full rounded-xl border border-ink/10 bg-white py-4 pl-11 pr-4 text-sm outline-none transition focus:border-[#06382e] focus:ring-4 focus:ring-[#06382e]/5" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-semibold text-ink/65">{t.password}</label>
                      <Link to="/forgot-password" className="text-xs font-medium text-[#06382e] hover:underline">{t.forgot}</Link>
                    </div>
                    <div className="relative">
                      <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25" />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder={t.passwordPlaceholder} className="w-full rounded-xl border border-ink/10 bg-white py-4 pl-11 pr-11 text-sm outline-none transition focus:border-[#06382e] focus:ring-4 focus:ring-[#06382e]/5" />
                      <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/30 hover:text-[#06382e]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </div>
                  </div>
                  <button onClick={handleLogin} disabled={saving} className="tm-login-submit flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 text-sm font-semibold shadow-lg transition disabled:opacity-50">
                    {saving ? `${t.login}...` : t.login} {!saving && <ArrowRight size={17} />}
                  </button>
                </div>
                <button type="button" onClick={() => selectRole(null)} className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-ink/35 hover:text-[#06382e]">
                  <ArrowLeft size={14} /> {t.changeSpace}
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-black/5 bg-white px-5 py-4 text-center text-xs text-ink/40">
                {t.selectSpace}
              </div>
            )}

            <div className="mt-9 flex items-center justify-center gap-4 text-xs text-ink/35">
              <Link to="/register" className="hover:text-[#06382e]">{t.createAccount}</Link>
              <span>•</span>
              <Link to="/forgot-password" className="hover:text-[#06382e]">{t.forgot}</Link>
            </div>

            <div className="mt-10 flex items-center justify-center gap-8 border-t border-ink/8 pt-6 text-[10px] text-ink/35">
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
