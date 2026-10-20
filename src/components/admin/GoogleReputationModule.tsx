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

type Props = { establishmentId: string; mode?: 'connection' | 'ai' | 'sync' | 'links' };

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
  auto_reply_min_rating: number;
  sync_interval_minutes: number;
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
  auto_reply_min_rating: 4,
  sync_interval_minutes: 10,
};

function stars(value: string | null) {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
 const normalizedValue = String(value ?? '').toUpperCase();
const mappedValue = map[normalizedValue];

if (mappedValue !== undefined) {
  return mappedValue;
}

const numericValue = Number(value ?? 0);
return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function GoogleReputationModule({ establishmentId, mode = 'ai' }: Props) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [settings, setSettings] = useState<Setting>(emptySettings);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [tripadvisorReviewUrl, setTripadvisorReviewUrl] = useState('');
  const [feedbackBonus, setFeedbackBonus] = useState(10);
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
      ] = await Promise.all([
        supabase
          .from('establishments')
          .select('google_review_url,tripadvisor_review_url,feedback_bonus_points')
          .eq('id', establishmentId)
          .maybeSingle(),
        supabase
          .from('google_business_connections')
          .select('status,last_sync_at,last_error,google_account_id')
          .eq('establishment_id', establishmentId)
          .maybeSingle(),
      ]);

      if (establishmentError) throw establishmentError;
      if (connectionError) throw connectionError;

      // Some existing deployments do not yet have sync_interval_minutes.
      // Fall back to the established settings columns so the AI panel remains usable.
      let settingsRow: Record<string, unknown> | null = null;
      const settingsWithInterval = await supabase
        .from('google_business_settings')
        .select('auto_reply_enabled,auto_reply_language,auto_reply_tone,require_approval,auto_reply_min_rating,sync_interval_minutes')
        .eq('establishment_id', establishmentId)
        .maybeSingle();
      if (settingsWithInterval.error && /sync_interval_minutes|column .* does not exist|schema cache/i.test(settingsWithInterval.error.message)) {
        const legacySettings = await supabase
          .from('google_business_settings')
          .select('auto_reply_enabled,auto_reply_language,auto_reply_tone,require_approval,auto_reply_min_rating')
          .eq('establishment_id', establishmentId)
          .maybeSingle();
        if (legacySettings.error) throw legacySettings.error;
        settingsRow = legacySettings.data as Record<string, unknown> | null;
      } else {
        if (settingsWithInterval.error) throw settingsWithInterval.error;
        settingsRow = settingsWithInterval.data as Record<string, unknown> | null;
      }

      setGoogleReviewUrl(establishment?.google_review_url ?? '');
      setTripadvisorReviewUrl(establishment?.tripadvisor_review_url ?? '');
      setFeedbackBonus(Math.max(0, Number(establishment?.feedback_bonus_points ?? 10)));
      if (!establishment?.google_review_url) {
        const { data: mappedLocations } = await supabase
          .from('google_business_locations')
          .select('metadata')
          .eq('mapped_establishment_id', establishmentId)
          .limit(10);
        const generatedReviewUrl = (mappedLocations ?? [])
          .map((row: { metadata?: unknown }) => {
            const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
            return typeof metadata.newReviewUri === 'string' ? metadata.newReviewUri : '';
          })
          .find((url: string) => /^https:\/\//i.test(url));
        if (generatedReviewUrl) setGoogleReviewUrl(generatedReviewUrl);
      }
      setConnection(connectionRow as Connection | null);
      setSettings(settingsRow ? { ...emptySettings, ...(settingsRow as Setting), auto_reply_min_rating: Number((settingsRow as Setting).auto_reply_min_rating ?? 4), sync_interval_minutes: Number((settingsRow as Setting).sync_interval_minutes ?? 10) } : emptySettings);

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
    // Keep the opener reference so the OAuth URL can be assigned after the Edge Function responds.
    // Using noopener here can leave the newly opened tab stuck on about:blank in some browsers.
    const popup = window.open('about:blank', '_blank');

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'google-business-oauth',
        { body: { establishment_id: establishmentId } },
      );

      if (invokeError) {
        let detail = '';
        const context = (invokeError as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            detail = body?.error || body?.message || '';
          } catch {
            // Keep the Supabase error message when the response body is not JSON.
          }
        }
        throw new Error(detail || invokeError.message);
      }

      if (!data?.success || !data.authorization_url) {
        throw new Error(data?.error || 'Impossible de démarrer Google OAuth.');
      }

      if (popup) {
        popup.location.href = data.authorization_url;
        popup.focus();
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
      // Explicitly attach the current user session. This prevents the Edge Function
      // gateway from receiving the sync request without an Authorization header.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Votre session a expiré. Reconnectez-vous à Kelyani puis relancez la synchronisation.');
      }

      // Use fetch directly so an HTML gateway/protection response is captured as text
      // instead of being auto-parsed as JSON inside supabase.functions.invoke().
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Configuration Supabase manquante dans cet aperçu Vercel.');
      }

      const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
      const response = await fetch(`${baseUrl}/functions/v1/google-business-sync-access-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ establishment_id: establishmentId }),
      });
      const rawBody = await response.text();
      let data: { success?: boolean; error?: string; message?: string; locations?: number; reviews?: number } | null = null;
      try {
        data = JSON.parse(rawBody);
      } catch {
        const status = `HTTP ${response.status}`;
        const excerpt = rawBody.replaceAll('\n', ' ').replaceAll('\r', ' ').slice(0, 240);
        throw new Error(`La synchronisation a reçu une réponse non JSON (${status}). Vérifie le routage/protection de la fonction. Réponse : ${excerpt || '(vide)'}`);
      }
      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Erreur HTTP ${response.status}`);
      }
      if (!data?.success) throw new Error(data?.error || 'Synchronisation impossible.');
      setMessage(`Synchronisation terminée : ${data.locations ?? 0} établissement(s), ${data.reviews ?? 0} avis.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synchronisation Google impossible.');
    } finally {
      setSyncing(false);
    }
  };

  const saveSettings = async (scope: 'ai' | 'sync' | 'links') => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (scope === 'ai' || scope === 'sync') {
        const settingsPayload = scope === 'ai'
          ? { establishment_id: establishmentId, auto_reply_enabled: settings.auto_reply_enabled, auto_reply_language: settings.auto_reply_language, auto_reply_tone: settings.auto_reply_tone, require_approval: settings.require_approval, auto_reply_min_rating: settings.auto_reply_min_rating }
          : { establishment_id: establishmentId, sync_interval_minutes: settings.sync_interval_minutes };
        const { error: settingsError } = await supabase.from('google_business_settings').upsert(settingsPayload, { onConflict: 'establishment_id' });
        if (settingsError) throw settingsError;
        setMessage(scope === 'ai' ? 'Configuration des réponses IA enregistrée.' : 'Fréquence de synchronisation enregistrée.');
      } else {
        const { error: establishmentError } = await supabase.from('establishments').update({
          google_review_url: googleReviewUrl.trim(),
          tripadvisor_review_url: tripadvisorReviewUrl.trim() || null,
          feedback_bonus_points: Math.max(0, Math.floor(Number(feedbackBonus) || 0)),
        }).eq('id', establishmentId);
        if (establishmentError) throw establishmentError;
        setFeedbackBonus(Math.max(0, Math.floor(Number(feedbackBonus) || 0)));
        setMessage('Liens et bonus du questionnaire enregistrés.');
      }
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
      {mode === 'connection' && (
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Réputation Google</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Google Business Profile</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Connexion, synchronisation et réponses IA sont administrées ici. Le Responsable reste en lecture seule.
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

      )}

      {(error || message) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/20 bg-red-400/5 text-red-200' : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200'}`}>
          {error ? <AlertTriangle size={16} className="mr-2 inline" /> : <CheckCircle2 size={16} className="mr-2 inline" />}
          {error || message}
        </div>
      )}

      {mode === 'connection' && (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Avis Google</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.total}</p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Note moyenne</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.average ? summary.average.toFixed(1) : '—'} ★</p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Réponses générées</p><p className="mt-2 text-2xl font-semibold text-[#C9A45C]">{summary.replied}</p></div>
      </div>

      )}

      {mode === 'ai' && (
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
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Seuil de publication automatique</span><select value={settings.auto_reply_min_rating} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_min_rating: Number(e.target.value) }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value={5}>5 étoiles uniquement</option><option value={4}>4 étoiles et plus (recommandé)</option><option value={3}>3 étoiles et plus</option><option value={2}>2 étoiles et plus</option><option value={1}>Toutes les notes</option></select><p className="mt-2 text-xs text-white/35">Les avis sous ce seuil restent en brouillon et nécessitent une validation humaine.</p></label>

          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Langue</span><select value={settings.auto_reply_language} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_language: e.target.value }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value="auto">Détecter la langue de chaque avis</option><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Ton</span><select value={settings.auto_reply_tone} onChange={(e) => setSettings((v) => ({ ...v, auto_reply_tone: e.target.value }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value="professional_warm">Professionnel & chaleureux</option><option value="professional">Professionnel</option><option value="friendly">Amical</option><option value="luxury">Premium / luxe</option></select></label>
        </div>
        <button type="button" onClick={() => void saveSettings('ai')} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50"><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
      </section>


      )}

      {mode === 'links' && (
      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-[#C9A45C]" /><h3 className="font-semibold text-white">Avis & retour client</h3></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/55">Lien avis Google</span><input value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/…" className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /></label>
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/55">Lien avis TripAdvisor</span><input value={tripadvisorReviewUrl} onChange={(e) => setTripadvisorReviewUrl(e.target.value)} placeholder="https://www.tripadvisor.fr/…" className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">Bonus questionnaire privé (points)</span><input type="number" min="0" max="10000" step="1" value={feedbackBonus} onChange={(e) => setFeedbackBonus(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white" /><span className="mt-1 block text-[10px] text-white/35">Attribué une seule fois après l’envoi du questionnaire privé.</span></label>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-white/40">Les points configurés ici récompensent uniquement le questionnaire privé de satisfaction, jamais la publication d’un avis Google ou TripAdvisor.</p>
        <button type="button" onClick={() => void saveSettings('links')} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C9A45C]/30 px-4 py-2.5 text-xs font-semibold text-[#C9A45C] disabled:opacity-50"><Save size={14} /> Enregistrer les liens et le bonus</button>
      </section>


      )}

      {mode === 'sync' && (
        <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
          <div className="flex items-center gap-2"><RefreshCw size={17} className="text-[#C9A45C]" /><h3 className="font-semibold text-white">Fréquence de synchronisation</h3></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Définissez à quelle fréquence KELYANI vérifie les nouveaux avis de cet établissement. La synchronisation manuelle reste disponible dans la section de connexion.</p>
          <label className="mt-5 block max-w-xl"><span className="mb-2 block text-xs font-semibold text-white/55">Intervalle de rafraîchissement</span><select value={settings.sync_interval_minutes} onChange={(e) => setSettings((v) => ({ ...v, sync_interval_minutes: Number(e.target.value) }))} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value={5}>Toutes les 5 minutes — flux élevé</option><option value={10}>Toutes les 10 minutes — recommandé</option><option value={15}>Toutes les 15 minutes</option><option value={30}>Toutes les 30 minutes — flux modéré</option><option value={60}>Toutes les heures — flux faible</option></select><p className="mt-2 text-xs text-white/35">Le planificateur vérifie périodiquement les établissements et respecte cet intervalle configuré.</p></label>
          <button type="button" onClick={() => void saveSettings('sync')} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50"><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer la fréquence'}</button>
        </section>
      )}

      {mode === 'ai' || mode === 'links' ? (
      <div className="flex items-start gap-3 rounded-2xl border border-[#242424] bg-[#0b0b0b] p-4 text-xs text-white/40">
        <Star size={15} className="mt-0.5 shrink-0 text-[#C9A45C]" />
        <p>Les programmes de fidélité restent indépendants des avis publics. Ne conditionnez jamais une récompense à la publication d’un avis.</p>
      </div>
      ) : null}
    </div>
  );
}
