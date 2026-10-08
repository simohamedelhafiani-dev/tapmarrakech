import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  MessageSquare,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { establishmentId: string };

type Connection = {
  status: 'active' | 'revoked' | 'error';
  last_sync_at: string | null;
  last_error: string | null;
  google_account_id: string | null;
};

type Setting = {
  auto_reply_enabled: boolean;
  auto_reply_language: string;
  auto_reply_tone: string;
  require_approval: boolean;
};

type GoogleReview = {
  id: string;
  reviewer_display_name: string | null;
  star_rating: string | null;
  comment: string | null;
  owner_reply: string | null;
  review_created_at: string | null;
  owner_reply_updated_at: string | null;
};

const emptySettings: Setting = {
  auto_reply_enabled: false,
  auto_reply_language: 'fr',
  auto_reply_tone: 'professional_warm',
  require_approval: false,
};

function stars(value: string | null) {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[String(value ?? '').toUpperCase()] ?? Number(value ?? 0) ?? 0;
}

export default function GoogleReputationModule({ establishmentId }: Props) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [settings, setSettings] = useState<Setting>(emptySettings);
  const [reviewBonus, setReviewBonus] = useState(0);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [tripadvisorReviewUrl, setTripadvisorReviewUrl] = useState('');
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        { data: establishment, error: establishmentError },
        { data: connectionRow, error: connectionError },
        { data: settingsRow, error: settingsError },
      ] = await Promise.all([
        supabase
          .from('establishments')
          .select('review_bonus_points,google_review_url,tripadvisor_review_url')
          .eq('id', establishmentId)
          .maybeSingle(),
        supabase
          .from('google_business_connections')
          .select('status,last_sync_at,last_error,google_account_id')
          .eq('establishment_id', establishmentId)
          .maybeSingle(),
        supabase
          .from('google_business_settings')
          .select('auto_reply_enabled,auto_reply_language,auto_reply_tone,require_approval')
          .eq('establishment_id', establishmentId)
          .maybeSingle(),
      ]);

      if (establishmentError) throw establishmentError;
      if (connectionError) throw connectionError;
      if (settingsError) throw settingsError;

      setReviewBonus(Number(establishment?.review_bonus_points ?? 0));
      setGoogleReviewUrl(establishment?.google_review_url ?? '');
      setTripadvisorReviewUrl(establishment?.tripadvisor_review_url ?? '');
      setConnection(connectionRow as Connection | null);
      setSettings((settingsRow as Setting | null) ?? emptySettings);

      await loadReviews();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger Google Business.');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    const { data: locations, error: locationsError } = await supabase
      .from('google_business_locations')
      .select('id,google_business_connections!inner(establishment_id)')
      .eq('google_business_connections.establishment_id', establishmentId);

    if (locationsError) {
      setError(locationsError.message);
      return;
    }

    const ids = (locations ?? []).map((row: { id: string }) => row.id);
    if (!ids.length) {
      setReviews([]);
      return;
    }

    const { data, error: reviewsError } = await supabase
      .from('google_business_reviews')
      .select('id,reviewer_display_name,star_rating,comment,owner_reply,review_created_at,owner_reply_updated_at')
      .in('location_id', ids)
      .order('review_created_at', { ascending: false })
      .limit(100);

    if (reviewsError) {
      setError(reviewsError.message);
      return;
    }

    setReviews((data ?? []) as GoogleReview[]);
  };

  useEffect(() => {
    void load();
  }, [establishmentId]);

  const connectGoogle = async () => {
    setConnecting(true);
    setError('');
    setMessage('');
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'google-business-oauth',
        { body: { establishment_id: establishmentId } },
      );

      if (invokeError) throw invokeError;
      if (!data?.success || !data.authorization_url) {
        throw new Error(data?.error || 'Impossible de démarrer Google OAuth.');
      }

      if (popup) {
        popup.location.href = data.authorization_url;
      } else {
        window.location.href = data.authorization_url;
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : 'Connexion Google impossible.');
    } finally {
      setConnecting(false);
    }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'google-business-sync',
        { body: { establishment_id: establishmentId } },
      );
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Synchronisation impossible.');
      setMessage(`Synchronisation terminée : ${data.locations ?? 0} établissement(s), ${data.reviews ?? 0} avis.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synchronisation Google impossible.');
    } finally {
      setSyncing(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { error: settingsError } = await supabase
        .from('google_business_settings')
        .upsert(
          {
            establishment_id: establishmentId,
            ...settings,
          },
          { onConflict: 'establishment_id' },
        );
      if (settingsError) throw settingsError;

      const { error: establishmentError } = await supabase
        .from('establishments')
        .update({
          review_bonus_points: Math.max(0, Math.floor(Number(reviewBonus) || 0)),
          google_review_url: googleReviewUrl.trim(),
          tripadvisor_review_url: tripadvisorReviewUrl.trim() || null,
        })
        .eq('id', establishmentId);

      if (establishmentError) throw establishmentError;

      setReviewBonus(Math.max(0, Math.floor(Number(reviewBonus) || 0)));
      setMessage('Paramètres Google Business enregistrés.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer les paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const ratings = reviews.map((review) => stars(review.star_rating)).filter((n) => n > 0);
    const average = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : 0;
    return {
      total: reviews.length,
      replied: reviews.filter((review) => Boolean(review.owner_reply)).length,
      average,
    };
  }, [reviews]);

  if (loading) {
    return <div className="grid min-h-[320px] place-items-center text-sm text-white/40">Chargement Google Business…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Réputation Google</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Google Business Profile</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Connexion, synchronisation, réponses IA et bonus sont administrés ici. Le Responsable reste en lecture seule.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connection?.status === 'active' ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 size={14} /> Connecté
                </span>
                <button type="button" onClick={() => void syncGoogle()} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50">
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Synchronisation…' : 'Synchroniser'}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void connectGoogle()} disabled={connecting} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50">
                <Link2 size={14} /> {connecting ? 'Connexion…' : 'Connecter Google'}
              </button>
            )}
          </div>
        </div>
        {connection?.last_sync_at && <p className="mt-4 text-[10px] text-white/30">Dernière synchronisation : {new Date(connection.last_sync_at).toLocaleString('fr-FR')}</p>}
        {connection?.last_error && <p className="mt-2 text-xs text-amber-300">{connection.last_error}</p>}
      </div>

      {(error || message) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/20 bg-red-400/5 text-red-200' : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200'}`}>
          {error ? <AlertTriangle size={16} className="mr-2 inline" /> : <CheckCircle2 size={16} className="mr-2 inline" />}
          {error || message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Avis Google</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.total}</p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Note moyenne</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.average ? summary.average.toFixed(1) : '—'} ★</p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Réponses générées</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.replied}</p></div>
      </div>

      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex items-center gap-2"><Settings2 size={17} className="text-[#C9A45C]" /><h3 className="font-semibold text-white">Configuration des réponses IA</h3></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-2xl border border-[#242424] bg-[#0b0b0b] p-4">
            <span><span className="block text-sm font-semibold text-white">Réponse automatique</span><span className="mt-1 block text-xs text-white/35">Générer et publier automatiquement les réponses.</span></span>
            <input type="checkbox" checked={settings.auto_reply_enabled} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_enabled: e.target.checked }))} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[#242424] bg-[#0b0b0b] p-4">
            <span><span className="block text-sm font-semibold text-white">Validation avant publication</span><span className="mt-1 block text-xs text-white/35">Bloque la publication automatique pour validation humaine.</span></span>
            <input type="checkbox" checked={settings.require_approval} onChange={(e) => setSettings((v) => ({ ...v, require_approval: e.target.checked }))} />
          </label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Langue</span><select value={settings.auto_reply_language} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_language: e.target.value }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Ton</span><select value={settings.auto_reply_tone} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_tone: e.target.value }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value="professional_warm">Professionnel & chaleureux</option><option value="professional">Professionnel</option><option value="friendly">Amical</option><option value="luxury">Premium / luxe</option></select></label>
        </div>
        <button type="button" onClick={() => void saveSettings()} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50"><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
      </section>

      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-[#C9A45C]" /><h3 className="font-semibold text-white">Bonus & liens d’avis</h3></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Bonus Google / TripAdvisor (points)</span><input type="number" min="0" step="1" value={reviewBonus} onChange={(e) => setReviewBonus(Number(e.target.value))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /></label>
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/55">Lien avis Google</span><input value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/…" className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /></label>
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/55">Lien avis TripAdvisor</span><input value={tripadvisorReviewUrl} onChange={(e) => setTripadvisorReviewUrl(e.target.value)} placeholder="https://www.tripadvisor.fr/…" className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /></label>
        </div>
        <p className="mt-3 text-[10px] text-white/30">Le bonus est configuré par établissement et ne rétroactive pas un avis déjà réclamé.</p>
        <button type="button" onClick={() => void saveSettings()} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C9A45C]/30 px-4 py-2.5 text-xs font-semibold text-[#C9A45C] disabled:opacity-50"><Save size={14} /> Enregistrer bonus & liens</button>
      </section>

      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex items-center gap-2"><MessageSquare size={17} className="text-[#C9A45C]" /><h3 className="font-semibold text-white">Avis Google & réponses générées</h3></div>
        <div className="mt-5 space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#242424] p-8 text-center text-sm text-white/35">Aucun avis Google synchronisé.</div>
          ) : reviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-[#242424] bg-[#0b0b0b] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="font-semibold text-white">{review.reviewer_display_name || 'Client Google'}</span><span className="text-[#C9A45C]">{'★'.repeat(stars(review.star_rating))}<span className="text-white/15">{'★'.repeat(Math.max(0, 5 - stars(review.star_rating)))}</span></span></div>
                {review.review_created_at && <span className="text-[10px] text-white/30">{new Date(review.review_created_at).toLocaleString('fr-FR')}</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/65">{review.comment || 'Avis sans commentaire.'}</p>
              <div className="mt-4 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 p-4">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A45C]"><Sparkles size={13} /> Réponse générée</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{review.owner_reply || 'Aucune réponse générée pour le moment.'}</p>
                {review.owner_reply_updated_at && <p className="mt-2 text-[10px] text-white/25">Dernière mise à jour : {new Date(review.owner_reply_updated_at).toLocaleString('fr-FR')}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-[#242424] bg-[#0b0b0b] p-4 text-xs text-white/40">
        <Star size={15} className="mt-0.5 shrink-0 text-[#C9A45C]" />
        <p>Les avis Google et les réponses sont séparés du système de bonus de fidélité. Les réponses IA ne mentionnent pas les récompenses.</p>
      </div>
    </div>
  );
}
