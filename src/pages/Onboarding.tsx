import { useEffect, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, UserRound } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(String(user?.user_metadata?.name ?? ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    void supabase.from('profiles').select('name, onboarding_completed_at').eq('id', user.id).maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) {
          setError('Impossible de charger votre profil. Réessayez.');
        } else if (data?.onboarding_completed_at) {
          navigate('/dashboard', { replace: true });
        } else if (data?.name) {
          setName(data.name);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id, navigate]);

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="grid min-h-screen place-items-center bg-[var(--kelyani-bg)]"><LoaderCircle className="animate-spin text-[var(--kelyani-gold)]" size={30} /></div>;

  const completeProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setError('Saisissez votre nom complet pour continuer.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.from('profiles').update({
      name: normalizedName,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
    if (updateError) {
      console.error('Erreur de sauvegarde du profil:', updateError);
      setError('Votre profil n’a pas pu être enregistré. Vérifiez votre connexion puis réessayez.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--kelyani-bg)] px-5 py-12 text-[var(--kelyani-text)]">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--kelyani-border)] bg-[var(--kelyani-panel)] p-6 shadow-2xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kelyani-gold)]">KELYANI · Première connexion</p>
        <h1 className="mt-4 font-display text-3xl text-[var(--kelyani-gold)] sm:text-4xl">Bienvenue dans votre espace.</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">Complétez votre profil pour personnaliser votre expérience et accéder à votre tableau de bord.</p>
        <form onSubmit={completeProfile} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Nom complet</span>
            <span className="relative block">
              <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kelyani-gold)]/70" />
              <input autoComplete="name" required minLength={2} value={name} onChange={event => setName(event.target.value)} placeholder="Votre nom et prénom" className="w-full rounded-xl border border-[var(--kelyani-border)] bg-[var(--kelyani-bg)] py-3 pl-10 pr-4 text-sm text-[var(--kelyani-text)] outline-none transition focus:border-[var(--kelyani-gold)] focus:ring-2 focus:ring-[var(--kelyani-gold)]/20" />
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--kelyani-gold)] px-5 py-3.5 text-sm font-semibold text-[var(--kelyani-bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
            {saving ? 'Enregistrement…' : 'Terminer mon profil'}
            {!saving && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/35">Vos informations sont enregistrées de manière sécurisée.</p>
      </section>
    </main>
  );
}
