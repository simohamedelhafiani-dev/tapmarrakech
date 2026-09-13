import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type LoginRole = 'admin' | 'responsible' | null;

const EMPLOYEE_SESSION_KEY = 'tapmarrakech_employee_session';

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
    if (role === 'employee') navigate('/employee', { replace: true });
  }, [loading, user, role, navigate]);

  function selectRole(nextRole: LoginRole) {
    setError('');
    setEmail('');
    setPassword('');
    setSelectedRole(nextRole);

    // A regular Supabase login must never leave an old employee
    // code-session active in the browser.
    if (nextRole === 'admin' || nextRole === 'responsible') {
      localStorage.removeItem(EMPLOYEE_SESSION_KEY);
    }
  }

  async function handleLogin() {
    setError('');

    if (!email.trim() || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setSaving(true);

    // Make sure an old employee code-session cannot coexist with
    // an Admin/Responsable session.
    localStorage.removeItem(EMPLOYEE_SESSION_KEY);

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
      <div className="relative min-h-screen overflow-hidden bg-[#f7f7f3] px-4 py-8">
        <img
          src="/tapmarrakech-logo.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.15]"
        />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[2rem] border border-ink/5 bg-white p-7 shadow-2xl md:p-9">
            <button
              onClick={() => selectRole(null)}
              className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-ink/40 transition hover:text-forest"
            >
              <ArrowLeft size={15} />
              Changer d’accès
            </button>

            <div className="mb-8">
              <div className="mt-7 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                  {isAdmin ? <ShieldCheck size={21} /> : <UserRound size={21} />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                    Connexion
                  </p>
                  <h1 className="font-display text-2xl text-forest">
                    {isAdmin ? 'Administrateur' : 'Responsable'}
                  </h1>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-ink/55">
                  Email
                </label>
                <div className="relative">
                  <UserRound
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25"
                  />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                    placeholder="vous@exemple.com"
                    className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-forest"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-ink/55">
                  Mot de passe
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/25"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                    placeholder="Votre mot de passe"
                    className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] py-3.5 pl-11 pr-11 text-sm outline-none focus:border-forest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/30 hover:text-forest"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-forest-light disabled:opacity-50"
              >
                {saving ? 'Connexion...' : 'Se connecter'}
                {!saving && <ArrowRight size={17} />}
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-2 text-center text-xs">
              <Link
                to="/forgot-password"
                className="font-medium text-ink/40 hover:text-forest"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f7f3] px-4 py-8">
      <img
        src="/tapmarrakech-logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.15]"
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="relative z-10 w-full">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-gold">
              Espace professionnel
            </p>
            <h1 className="mt-3 font-display text-3xl text-forest md:text-5xl">
              Comment souhaitez-vous accéder à TapMarrakech ?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink/45 md:text-base">
              Choisissez votre profil. Chaque accès ouvre uniquement les fonctions qui lui sont destinées.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <button
              onClick={() => selectRole('admin')}
              className="group rounded-[2rem] border border-ink/5 bg-white p-7 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-forest/20 hover:shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest text-white shadow-lg">
                  <ShieldCheck size={27} />
                </div>
                <ArrowRight size={19} className="text-ink/20 transition group-hover:translate-x-1 group-hover:text-forest" />
              </div>
              <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Accès principal
              </p>
              <h2 className="mt-2 font-display text-3xl text-forest">Admin</h2>
              <p className="mt-3 text-sm leading-6 text-ink/45">
                Administration de TapMarrakech, établissements, équipes et configuration.
              </p>
              <p className="mt-6 text-xs font-semibold text-forest">Email + mot de passe</p>
            </button>

            <button
              onClick={() => selectRole('responsible')}
              className="group rounded-[2rem] border border-ink/5 bg-white p-7 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-forest/20 hover:shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f4ead3] text-forest shadow-sm">
                  <UserRound size={27} />
                </div>
                <ArrowRight size={19} className="text-ink/20 transition group-hover:translate-x-1 group-hover:text-forest" />
              </div>
              <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Gestion établissement
              </p>
              <h2 className="mt-2 font-display text-3xl text-forest">Responsable</h2>
              <p className="mt-3 text-sm leading-6 text-ink/45">
                Pilotage de votre établissement, réputation, fidélité et performances.
              </p>
              <p className="mt-6 text-xs font-semibold text-forest">Email + mot de passe</p>
            </button>

            <button
              onClick={async () => {
                localStorage.removeItem(EMPLOYEE_SESSION_KEY);
                await supabase.auth.signOut();
                navigate('/employee');
              }}
              className="group rounded-[2rem] border border-forest/10 bg-forest p-7 text-left text-white shadow-xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-gold ring-1 ring-white/10">
                  <KeyRound size={27} />
                </div>
                <ArrowRight size={19} className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Accès rapide
              </p>
              <h2 className="mt-2 font-display text-3xl">Employé</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Entrez simplement votre code. TapMarrakech retrouve automatiquement votre établissement.
              </p>
              <p className="mt-6 text-xs font-semibold text-gold">Code employé uniquement</p>
            </button>
          </div>

          <div className="mt-8 flex justify-center gap-5 text-xs text-ink/35">
            <Link to="/register" className="hover:text-forest">
              Créer un compte
            </Link>
            <span>•</span>
            <Link to="/forgot-password" className="hover:text-forest">
              Mot de passe oublié
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
