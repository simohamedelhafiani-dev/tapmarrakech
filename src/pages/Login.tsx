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
import KelyaniMark from '@/components/brand/KelyaniMark';

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
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
        <section className="relative flex min-h-[42vh] flex-col overflow-hidden border-b border-[#242424] px-5 py-6 sm:px-8 lg:min-h-screen lg:w-[56%] lg:border-b-0 lg:border-r lg:px-12 lg:py-10 xl:px-16">
          <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full border border-[#C9A45C]/10" />
          <div className="pointer-events-none absolute right-[-20%] top-[18%] h-[520px] w-[520px] rounded-full border border-[#C9A45C]/[0.07]" />
          <div className="pointer-events-none absolute bottom-[-20%] left-[20%] h-[480px] w-[480px] rounded-full bg-[#C9A45C]/[0.035] blur-[100px]" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => navigate('/')} className="group flex items-center gap-4 text-left" aria-label="KELYANI">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-[18px] bg-[#C9A45C]/10 blur-xl transition group-hover:bg-[#C9A45C]/20" />
                  <KelyaniMark size={72} className="relative" />
                </div>
                <div className="leading-none">
                  <p className="font-display text-[22px] font-semibold tracking-[0.07em] text-[#E1C27A]">KELYANI</p>
                  <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.28em] text-[#C9A45C]/65">CUSTOMER INTELLIGENCE</p>
                </div>
              </button>
              <label className="inline-flex items-center rounded-full border border-[#242424] bg-[#111111]/80 px-3 py-2 text-[10px] font-semibold text-[#F5F5DC]/65 backdrop-blur">
                <Globe2 size={14} className="mr-2 text-[#C9A45C]" />
                <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language" className="bg-transparent outline-none">
                  <option className="bg-[#111111]" value="fr">FR</option>
                  <option className="bg-[#111111]" value="en">EN</option>
                  <option className="bg-[#111111]" value="ar">AR</option>
                </select>
              </label>
            </div>

            <div className="relative mt-auto max-w-3xl pb-2 pt-14 lg:pt-0">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C9A45C]/25 bg-[#C9A45C]/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.24em] text-[#E1C27A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A45C]" />
                Plateforme client 2026
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#C9A45C]">
                {language === 'fr' ? 'Réputation · Fidélité · Relation client' : language === 'en' ? 'Reputation · Loyalty · Customer relationship' : 'السمعة · الولاء · علاقة العملاء'}
              </p>

              <h1 className="mt-4 max-w-3xl font-display text-[42px] leading-[0.98] tracking-[-0.045em] sm:text-6xl xl:text-[76px]">
                Faites de chaque client
                <span className="block text-[#C9A45C]">un client régulier.</span>
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-6 text-[#F5F5DC]/50 sm:text-base">
                KELYANI réunit vos avis, votre fidélité et votre expérience client dans un seul espace de pilotage.
              </p>

              <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3">
                <div className="group rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#C9A45C]/25">
                  <Star size={18} className="text-[#C9A45C]" />
                  <p className="mt-8 text-sm font-semibold text-white">Réputation</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/30">Avis & réponses</p>
                </div>
                <div className="group rounded-[22px] border border-[#C9A45C]/20 bg-[#C9A45C]/[0.055] p-4 backdrop-blur-xl transition hover:-translate-y-1">
                  <Heart size={18} className="text-[#C9A45C]" />
                  <p className="mt-8 text-sm font-semibold text-white">Fidélité</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/30">Clients réguliers</p>
                </div>
                <div className="group rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#C9A45C]/25">
                  <BarChart3 size={18} className="text-[#C9A45C]" />
                  <p className="mt-8 text-sm font-semibold text-white">Pilotage</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/30">Une seule vision</p>
                </div>
              </div>
              <div className="mt-6 flex max-w-2xl items-center gap-3 rounded-[22px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                <div className="h-2 w-2 rounded-full bg-[#C9A45C] shadow-[0_0_14px_rgba(201,164,92,.7)]" />
                <p className="text-xs text-white/45">Une plateforme pensée pour transformer chaque interaction en relation durable.</p>
              </div>

              <div className="mt-8 hidden items-center gap-4 text-[10px] uppercase tracking-[0.16em] text-[#F5F5DC]/25 lg:flex">
                <span>Simple</span><span className="h-px w-8 bg-[#242424]" /><span>Rapide</span><span className="h-px w-8 bg-[#242424]" /><span>Orienté client</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
          <div className="w-full max-w-[500px]">
            <div className="mb-7 rounded-[28px] border border-white/[0.06] bg-white/[0.018] p-7 backdrop-blur-xl sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#C9A45C]">Espace sécurisé</p>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.035em] text-white sm:text-4xl">
                {selectedRole ? 'Bienvenue dans KELYANI' : 'Accédez à votre espace'}
              </h2>
              <p className="mt-2 text-sm text-[#F5F5DC]/40">
                {selectedRole ? 'Connectez-vous pour continuer.' : 'Choisissez votre profil pour commencer.'}
              </p>
            </div>

            {!selectedRole ? (
              <div className="space-y-3">
                <button type="button" onClick={() => selectRole('admin')} className="group flex w-full items-center gap-4 rounded-3xl border border-[#242424] bg-[#111111] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C9A45C]/45 hover:bg-[#151515]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#E1C27A]"><ShieldCheck size={21} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#F5F5DC]/30">Plateforme</p>
                    <p className="mt-1 font-display text-xl text-white">Administrateur</p>
                    <p className="mt-1 text-xs text-[#F5F5DC]/40">Vue globale et pilotage KELYANI</p>
                  </div>
                  <ArrowRight size={18} className="text-[#C9A45C] transition-transform group-hover:translate-x-1" />
                </button>

                <button type="button" onClick={() => selectRole('responsible')} className="group flex w-full items-center gap-4 rounded-3xl border border-[#242424] bg-[#111111] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C9A45C]/45 hover:bg-[#151515]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#E1C27A]"><UserRound size={21} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#F5F5DC]/30">Établissement</p>
                    <p className="mt-1 font-display text-xl text-white">Responsable</p>
                    <p className="mt-1 text-xs text-[#F5F5DC]/40">Clients, avis et fidélité</p>
                  </div>
                  <ArrowRight size={18} className="text-[#C9A45C] transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ) : (
              <div className="rounded-[28px] border border-[#242424] bg-[#111111]/90 p-5 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-6">
                <div className="mb-6 flex items-center gap-3">
                  <KelyaniMark size={38} />
                  <div>
                    <p className="text-xs font-semibold text-white">{selectedRole === 'admin' ? 'Administrateur' : 'Responsable'}</p>
                    <p className="text-[10px] text-[#F5F5DC]/35">Connexion sécurisée</p>
                  </div>
                  <button type="button" onClick={() => selectRole(null)} className="ml-auto rounded-full border border-[#242424] px-3 py-1.5 text-[9px] font-semibold text-[#F5F5DC]/40 hover:text-[#E1C27A]">Changer</button>
                </div>

                {error && <div className="mb-4 rounded-2xl border border-[#C9A45C]/20 bg-[#C9A45C]/[0.06] px-4 py-3 text-xs text-[#E1C27A]">{error}</div>}

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F5F5DC]/45">{t.email}</label>
                    <div className="relative">
                      <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C9A45C]/50" />
                      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder={t.emailPlaceholder} className="w-full rounded-2xl border border-[#242424] bg-[#050505] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#F5F5DC]/20 focus:border-[#C9A45C]/55 focus:ring-4 focus:ring-[#C9A45C]/[0.07]" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F5F5DC]/45">{t.password}</label>
                      <Link to="/forgot-password" className="text-[10px] font-semibold text-[#C9A45C] hover:underline">{t.forgot}</Link>
                    </div>
                    <div className="relative">
                      <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C9A45C]/50" />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder={t.passwordPlaceholder} className="w-full rounded-2xl border border-[#242424] bg-[#050505] py-3.5 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-[#F5F5DC]/20 focus:border-[#C9A45C]/55 focus:ring-4 focus:ring-[#C9A45C]/[0.07]" />
                      <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#F5F5DC]/25 hover:text-[#C9A45C]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </div>
                  <button onClick={handleLogin} disabled={saving} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] py-3.5 text-sm font-bold text-[#050505] transition hover:bg-[#E1C27A] disabled:opacity-50">
                    {saving ? 'Connexion…' : 'Entrer dans KELYANI'} {!saving && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
                  </button>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#242424] pt-4">
                  <Link to="/register" className="text-[10px] font-semibold text-[#F5F5DC]/35 hover:text-[#C9A45C]">{t.createAccount}</Link>
                  <Link to="/forgot-password" className="text-[10px] font-semibold text-[#F5F5DC]/35 hover:text-[#C9A45C]">{t.forgot}</Link>
                </div>
              </div>
            )}

            <div className="mt-7 flex items-center justify-center gap-5 text-[9px] uppercase tracking-[0.12em] text-[#F5F5DC]/20">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Sécurisé</span>
              <span className="inline-flex items-center gap-1.5"><Heart size={13} /> Client d’abord</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
