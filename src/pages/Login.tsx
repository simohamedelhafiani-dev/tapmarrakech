import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, ShieldCheck, UserRound, Eye, EyeOff } from 'lucide-react';
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
    <main className="kelyani-login min-h-screen bg-[#080A0B] text-[#F2F5F6]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-b border-white/10 px-6 py-8 sm:px-12 lg:border-b-0 lg:border-r lg:px-16 lg:py-12">
          <div className="flex items-start justify-between gap-6">
            <KelyaniMark size={150} />
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#343A40] px-3 py-2 text-xs">
              <Globe2 size={15} className="text-[#00DFA5]" />
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language" className="bg-transparent text-[#F2F5F6] outline-none">
                <option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option>
              </select>
            </label>
          </div>
          <div className="max-w-[640px] py-12 lg:py-16">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#00DFA5]">Réputation · Fidélité · Relation client</p>
            <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl">
              Faites de chaque client <span className="text-[#00DFA5]">un client régulier.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#B5BEC3]">
              Pilotez vos avis, fidélisez vos clients et développez votre activité depuis un seul espace.
            </p>
            <div className="kelyani-login-stage mt-12" aria-label="Aperçu de la plateforme KELYANI">
              <div className="kelyani-orbit kelyani-orbit-one" />
              <div className="kelyani-orbit kelyani-orbit-two" />
              <div className="kelyani-float-chip kelyani-chip-review"><span className="kelyani-chip-dot" /> Nouvel avis <strong>5.0 ★</strong></div>
              <div className="kelyani-float-chip kelyani-chip-loyalty"><span className="kelyani-chip-icon">K</span> Client fidèle <strong>+1 récompense</strong></div>
              <div className="kelyani-dashboard-card">
                <div className="kelyani-card-topline"><span className="kelyani-mini-mark">K</span><span><b>KELYANI</b><small> CUSTOMER INTELLIGENCE</small></span><i>● LIVE</i></div>
                <div className="kelyani-card-heading"><span>Vue d'ensemble</span><small>APERÇU DE VOTRE ACTIVITÉ</small></div>
                <div className="kelyani-metric-row">
                  <div className="kelyani-metric"><small>RÉPUTATION</small><strong>4.9 <em>/5</em></strong><span>★★★★★</span></div>
                  <div className="kelyani-metric kelyani-metric-accent"><small>FIDÉLITÉ</small><strong>+28<em>%</em></strong><span>Clients qui reviennent</span></div>
                </div>
                <div className="kelyani-chart-panel"><div><small>ENGAGEMENT CLIENT</small><b>+18.6%</b></div><svg viewBox="0 0 520 90" role="img" aria-label="Courbe de progression"><defs><linearGradient id="kelyaniChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#00DFA5" stopOpacity=".32"/><stop offset="100%" stopColor="#00DFA5" stopOpacity="0"/></linearGradient></defs><path d="M0 72 C35 65 45 44 82 54 S132 32 164 42 S210 18 248 34 S302 15 338 27 S390 10 420 18 S480 4 520 8 L520 90 L0 90Z" fill="url(#kelyaniChartFill)"/><path d="M0 72 C35 65 45 44 82 54 S132 32 164 42 S210 18 248 34 S302 15 338 27 S390 10 420 18 S480 4 520 8" fill="none" stroke="#00DFA5" strokeWidth="2.5"/></svg></div>
                <div className="kelyani-card-footer"><span>● Données synchronisées</span><span>RÉPUTATION · FIDÉLITÉ · CROISSANCE</span></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#B5BEC3]">KELYANI · L’art de la relation client</p>
        </section>
        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-[460px]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">Espace sécurisé</p>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">{selectedRole ? 'Connexion à KELYANI' : 'Accédez à votre espace'}</h2>
            <p className="mb-8 mt-3 text-sm text-[#B5BEC3]">{selectedRole ? 'Renseignez vos identifiants pour continuer.' : 'Choisissez votre profil pour commencer.'}</p>
            {!selectedRole ? (
              <div className="space-y-3">
                {([
                  { id: 'admin' as const, title: 'Administrateur', description: 'Gestion et pilotage de la plateforme', Icon: ShieldCheck },
                  { id: 'responsible' as const, title: 'Responsable', description: 'Clients, avis et fidélisation', Icon: UserRound },
                ]).map(({ id, title, description, Icon }) => (
                  <button key={id} type="button" onClick={() => selectRole(id)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-white/15 bg-[#343A40] p-5 text-left transition-colors hover:border-[#00DFA5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00DFA5]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#454D54] text-[#00DFA5]"><Icon size={21} /></span>
                    <span className="flex-1"><span className="block text-base font-semibold text-[#F2F5F6]">{title}</span><span className="mt-1 block text-xs text-[#B5BEC3]">{description}</span></span>
                    <ArrowRight size={18} className="text-[#00DFA5] transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
                <Link to="/register" className="group flex items-center justify-between rounded-2xl border border-white/15 bg-[#343A40] p-5 text-sm font-semibold text-[#F2F5F6] hover:border-[#00DFA5]">
                  Créer votre compte <ArrowRight size={18} className="text-[#00DFA5]" />
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-[#343A40] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <span className="font-semibold">{selectedRole === 'admin' ? 'Administrateur' : 'Responsable'}</span>
                  <button type="button" onClick={() => selectRole(null)} className="text-xs text-[#00D9F5] hover:underline">Changer de profil</button>
                </div>
                {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-[#454D54] p-3 text-sm text-red-200">{error}</p>}
                <div className="space-y-4">
                  <div><label htmlFor="login-email" className="mb-2 block text-sm text-[#F2F5F6]">{t.email}</label>
                    <input id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleLogin(); }} placeholder={t.emailPlaceholder} className="w-full rounded-xl border border-white/20 bg-[#454D54] px-4 py-3 text-sm outline-none focus:border-[#00DFA5]" />
                  </div>
                  <div><div className="mb-2 flex justify-between"><label htmlFor="login-password" className="text-sm">{t.password}</label><Link to="/forgot-password" className="text-xs text-[#00D9F5] hover:underline">{t.forgot}</Link></div>
                    <div className="relative"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleLogin(); }} placeholder={t.passwordPlaceholder} className="w-full rounded-xl border border-white/20 bg-[#454D54] px-4 py-3 pr-12 text-sm outline-none focus:border-[#00DFA5]" />
                      <button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5BEC3]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                  <button type="button" disabled={saving} onClick={handleLogin} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00DFA5] px-5 py-3.5 font-semibold text-[#07110F] disabled:opacity-50">{saving ? 'Connexion…' : 'Se connecter'}<ArrowRight size={17} /></button>
                </div>
                <Link to="/register" className="mt-5 block text-center text-xs text-[#00D9F5] hover:underline">{t.createAccount}</Link>
              </div>
            )}
            <p className="mt-8 text-center text-xs text-[#B5BEC3]">Connexion sécurisée à votre espace KELYANI</p>
          </div>
        </section>
      </div>
    </main>
  );
}
