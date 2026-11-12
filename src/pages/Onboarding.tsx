import { useEffect, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, UserRound, Building2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function makeSlug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(String(user?.user_metadata?.name ?? ''));
  const [establishmentName, setEstablishmentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    void supabase.from('profiles').select('name, onboarding_completed_at').eq('id', user.id).maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) setError('Impossible de charger votre profil. Réessayez.');
        else if (data?.onboarding_completed_at) navigate('/dashboard', { replace: true });
        else if (data?.name) setName(data.name);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id, navigate]);

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="grid min-h-screen place-items-center bg-[var(--kelyani-bg)]"><LoaderCircle className="animate-spin text-[var(--kelyani-gold)]" size={30} /></div>;

  const completeProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedEstablishment = establishmentName.trim();
    const slug = makeSlug(normalizedEstablishment);
    if (normalizedName.length < 2) return setError('Saisissez votre nom complet pour continuer.');
    if (normalizedEstablishment.length < 2 || !slug) return setError('Saisissez le nom de votre établissement.');

    setSaving(true);
    setError('');
    const { error: profileError } = await supabase.from('profiles').update({ name: normalizedName }).eq('id', user.id);
    if (profileError) {
      console.error('Erreur de sauvegarde du profil:', profileError);
      setSaving(false);
      return setError('Votre profil n’a pas pu être enregistré. Vérifiez votre connexion puis réessayez.');
    }

    const { data: existing, error: existingError } = await supabase.rpc('get_my_establishments');
    if (existingError) {
      console.error('Erreur de vérification des établissements:', existingError);
      setSaving(false);
      return setError('Impossible de vérifier votre espace professionnel. Réessayez.');
    }

    if (!Array.isArray(existing) || existing.length === 0) {
      const { error: trialError } = await supabase.rpc('create_establishment_with_premium_trial', {
        p_name: normalizedEstablishment, p_slug: slug,
      });
      if (trialError) {
        console.error('Erreur création établissement et essai Premium:', trialError);
        setSaving(false);
        return setError(trialError.code === '23505'
          ? 'Cet identifiant public est déjà utilisé. Modifiez légèrement le nom de votre établissement.'
          : trialError.message || 'Impossible de créer votre établissement et votre essai gratuit. Réessayez.');
      }
    }

    const { error: completeError } = await supabase.from('profiles').update({
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
    if (completeError) {
      console.error('Erreur de finalisation du profil:', completeError);
      return setError('Votre établissement est créé, mais la finalisation du profil a échoué. Réessayez.');
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--kelyani-bg)] px-5 py-12 text-[var(--kelyani-text)]">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--kelyani-border)] bg-[var(--kelyani-panel)] p-6 shadow-2xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kelyani-gold)]">KELYANI · Première connexion</p>
        <h1 className="mt-4 font-display text-3xl text-[var(--kelyani-gold)] sm:text-4xl">Bienvenue dans votre espace.</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">Configurez votre profil et votre établissement pour commencer vos 30 jours d’essai Premium gratuit.</p>
        <form onSubmit={completeProfile} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Nom complet</span>
            <span className="relative block">
              <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kelyani-gold)]/70" />
              <input autoComplete="name" required minLength={2} value={name} onChange={event => setName(event.target.value)} placeholder="Votre nom et prénom" className="w-full rounded-xl border border-[var(--kelyani-border)] bg-[var(--kelyani-bg)] py-3 pl-10 pr-4 text-sm text-[var(--kelyani-text)] outline-none transition focus:border-[var(--kelyani-gold)] focus:ring-2 focus:ring-[var(--kelyani-gold)]/20" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Nom de votre établissement</span>
            <span className="relative block">
              <Building2 size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kelyani-gold)]/70" />
              <input autoComplete="organization" required minLength={2} maxLength={120} value={establishmentName} onChange={event => setEstablishmentName(event.target.value)} placeholder="Ex. Café Medina" className="w-full rounded-xl border border-[var(--kelyani-border)] bg-[var(--kelyani-bg)] py-3 pl-10 pr-4 text-sm text-[var(--kelyani-text)] outline-none transition focus:border-[var(--kelyani-gold)] focus:ring-2 focus:ring-[var(--kelyani-gold)]/20" />
            </span>
            {establishmentName.trim() && <span className="mt-2 block text-xs text-white/40">Votre adresse publique : /p/{makeSlug(establishmentName) || 'nom-etablissement'}</span>}
          </label>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
            30 jours gratuits · Offre Premium · Aucun paiement n’est déclenché pendant l’inscription.
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--kelyani-gold)] px-5 py-3.5 text-sm font-semibold text-[var(--kelyani-bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
            {saving ? 'Activation de votre essai…' : 'Activer mes 30 jours gratuits'}
            {!saving && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/35">Vos informations sont enregistrées de manière sécurisée.</p>
      </section>
    </main>
  );
}
