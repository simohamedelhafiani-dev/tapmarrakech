import { useEffect, useState } from 'react';
import {
  ArrowLeft,
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

type LoginRole = 'admin' | 'responsible' | null;

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

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

  if (selectedRole) {
    const isAdmin = selectedRole === 'admin';

    return (
      <div className="min-h-screen bg-[#f7f7f3]">
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
          <div className="relative hidden overflow-hidden bg-[#173D32] lg:flex lg:w-[44%]">
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-white/10" />
            <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
              <img src="/tapmarrakech-logo.png" alt="TapMarrakech" className="h-14 w-auto object-contain object-left brightness-0 invert" />
              <div className="max-w-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D3A84C]">Espace professionnel</p>
                <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight text-white xl:text-6xl">L’expérience client, votre meilleur atout.</h1>
                <p className="mt-6 max-w-sm text-sm leading-7 text-white/55">Gérez votre réputation, votre fidélité et votre expérience client depuis un seul espace.</p>
              </div>
              <p className="text-xs text-white/30">© TapMarrakech</p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
            <div className="w-full max-w-xl">
              <div className="mb-10 lg:hidden">
                <img src="/tapmarrakech-logo.png" alt="TapMarrakech" className="h-11 w-auto object-contain object-left" />
              </div>
              <button
                onClick={() => selectRole(null)}
                className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-ink/40 transition hover:text-forest"
              >
                <ArrowLeft size={15} /> Changer d’accès
              </button>
              <div className="mb-8">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-white">
                    {isAdmin ? <ShieldCheck size={21} /> : <UserRound size={21} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">Connexion</p>
                    <h1 className="font-display text-3xl text-forest">{isAdmin ? 'Administrateur' : 'Responsable'}</h1>
                  </div>
                </div>
              </div>
              {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-ink/55">Email</label>
                  <div className="relative">
                    <UserRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25" />
                    <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder="vous@exemple.com" className="w-full rounded-xl border border-ink/10 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/5" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-ink/55">Mot de passe</label>
                  <div className="relative">
                    <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25" />
                    <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} placeholder="Votre mot de passe" className="w-full rounded-xl border border-ink/10 bg-white py-3.5 pl-11 pr-11 text-sm outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/5" />
                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/30 hover:text-forest">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleLogin} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light disabled:opacity-50">
                  {saving ? 'Connexion...' : 'Se connecter'}
                  {!saving && <ArrowRight size={17} />}
                </button>
              </div>
              <div className="mt-6 text-center text-xs">
                <Link to="/forgot-password" className="font-medium text-ink/40 hover:text-forest">Mot de passe oublié ?</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <div className="relative hidden overflow-hidden bg-[#173D32] lg:flex lg:w-[44%]">
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <img src="/tapmarrakech-logo.png" alt="TapMarrakech" className="h-14 w-auto object-contain object-left brightness-0 invert" />
            <div className="max-w-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D3A84C]">Plateforme professionnelle</p>
              <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight text-white xl:text-6xl">L’expérience client, votre meilleur atout.</h1>
              <p className="mt-6 max-w-sm text-sm leading-7 text-white/55">Une plateforme pensée pour piloter la réputation, la fidélité et l’expérience client.</p>
            </div>
            <p className="text-xs text-white/30">© TapMarrakech</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-xl">
            <div className="mb-10 lg:hidden">
              <img src="/tapmarrakech-logo.png" alt="TapMarrakech" className="h-11 w-auto object-contain object-left" />
            </div>
            <div className="mb-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Espace professionnel</p>
              <h2 className="mt-3 font-display text-4xl leading-tight text-forest sm:text-5xl">Bienvenue.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-ink/45">Sélectionnez votre espace pour continuer.</p>
            </div>

            <div className="grid gap-4">
              <button onClick={() => selectRole('admin')} className="group flex w-full items-center gap-5 rounded-[1.5rem] border border-ink/8 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-xl sm:p-6">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest text-white shadow-lg"><ShieldCheck size={25} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Accès plateforme</p>
                  <h3 className="mt-1 font-display text-2xl text-forest">Administrateur</h3>
                  <p className="mt-1 text-sm text-ink/45">Administration, établissements, configuration et pilotage global.</p>
                </div>
                <ArrowRight size={20} className="shrink-0 text-ink/20 transition group-hover:translate-x-1 group-hover:text-forest" />
              </button>

              <button onClick={() => selectRole('responsible')} className="group flex w-full items-center gap-5 rounded-[1.5rem] border border-ink/8 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-xl sm:p-6">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f4ead3] text-forest"><UserRound size={25} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Espace établissement</p>
                  <h3 className="mt-1 font-display text-2xl text-forest">Responsable</h3>
                  <p className="mt-1 text-sm text-ink/45">Gestion de votre établissement, réputation, fidélité et activité.</p>
                </div>
                <ArrowRight size={20} className="shrink-0 text-ink/20 transition group-hover:translate-x-1 group-hover:text-forest" />
              </button>
            </div>

            <div className="mt-8 flex justify-center gap-5 text-xs text-ink/35">
              <Link to="/register" className="hover:text-forest">Créer un compte</Link>
              <span>•</span>
              <Link to="/forgot-password" className="hover:text-forest">Mot de passe oublié</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
