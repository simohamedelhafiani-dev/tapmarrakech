import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Link2,
  RefreshCw,
  Settings2,
  Star,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Establishment = {
  id: string;
  name: string;
};

type Connection = {
  id: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
};

type GoogleSettings = {
  auto_reply_enabled: boolean;
  auto_reply_language: string;
  auto_reply_tone: string;
  require_approval: boolean;
};

type GoogleReview = {
  id: string;
  reviewer_display_name: string | null;
  reviewer_is_anonymous: boolean;
  star_rating: string | null;
  comment: string | null;
  review_created_at: string | null;
  owner_reply: string | null;
  owner_reply_updated_at: string | null;
};

const DEFAULT_SETTINGS: GoogleSettings = {
  auto_reply_enabled: false,
  auto_reply_language: 'français',
  auto_reply_tone: 'professionnel et chaleureux',
  require_approval: false,
};

function ratingValue(value: string | null) {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[value ?? ''] ?? Number(value ?? 0) || 0;
}

export default function GoogleReputationModule({
  canManage,
}: {
  canManage: boolean;
}) {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [settings, setSettings] = useState<GoogleSettings>(DEFAULT_SETTINGS);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [reviewUrl, setReviewUrl] = useState('');
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    void loadEstablishments();
  }, [user?.id]);

  useEffect(() => {
    if (!establishmentId) return;
    void loadData(establishmentId);
  }, [establishmentId]);

  async function loadEstablishments() {
    setLoading(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('get_my_establishments');

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []).map((row: { id: string; name: string }) => ({
      id: row.id,
      name: row.name,
    }));

    setEstablishments(rows);
    if (rows.length) {
      setEstablishmentId((current) => current || rows[0].id);
    } else {
      setLoading(false);
    }
  }

  async function loadData(id: string) {
    setLoading(true);
    setError('');
    setMessage('');

    const [
      establishmentResult,
      connectionResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from('establishments')
        .select('review_bonus_points,google_review_url')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('google_business_connections')
        .select('id,status,last_sync_at,last_error')
        .eq('establishment_id', id)
        .maybeSingle(),
      supabase
        .from('google_business_settings')
        .select('auto_reply_enabled,auto_reply_language,auto_reply_tone,require_approval')
        .eq('establishment_id', id)
        .maybeSingle(),
    ]);

    if (establishmentResult.error) {
      setError(establishmentResult.error.message);
    }

    setBonusPoints(Number(establishmentResult.data?.review_bonus_points ?? 0));
    setReviewUrl(establishmentResult.data?.google_review_url ?? '');
    setConnection((connectionResult.data as Connection | null) ?? null);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...(settingsResult.data ?? {}),
    });

    if (!connectionResult.data) {
      setReviews([]);
      setLoading(false);
      return;
    }

    const { data: locations, error: locationsError } = await supabase
      .from('google_business_locations')
      .select('id')
      .eq('connection_id', connectionResult.data.id);

    if (locationsError) {
      setError(locationsError.message);
      setReviews([]);
      setLoading(false);
      return;
    }

    const locationIds = (locations ?? []).map((row) => row.id);

    if (!locationIds.length) {
      setReviews([]);
      setLoading(false);
      return;
    }

    const { data: reviewRows, error: reviewsError } = await supabase
      .from('google_business_reviews')
      .select('id,reviewer_display_name,reviewer_is_anonymous,star_rating,comment,review_created_at,owner_reply,owner_reply_updated_at')
      .in('location_id', locationIds)
      .order('review_created_at', { ascending: false });

    if (reviewsError) {
      setError(reviewsError.message);
      setReviews([]);
    } else {
      setReviews((reviewRows ?? []) as GoogleReview[]);
    }

    setLoading(false);
  }

  async function connectGoogle() {
    if (!canManage || !establishmentId) return;

    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke(
      'google-business-oauth',
      { body: { action: 'start', establishment_id: establishmentId } }
    );

    if (invokeError || !data?.authorization_url) {
      setError(invokeError?.message ?? data?.error ?? 'Impossible de démarrer la connexion Google.');
      return;
    }

    window.open(data.authorization_url, '_blank', 'width=600,height=750');
  }

  async function syncReviews() {
    if (!canManage || !establishmentId) return;

    setSyncing(true);
    setError('');
    setMessage('');

    const { data, error: invokeError } = await supabase.functions.invoke(
      'google-business-sync',
      { body: { establishment_id: establishmentId } }
    );

    if (invokeError || !data?.success) {
      setError(invokeError?.message ?? data?.error ?? 'Synchronisation impossible.');
      setSyncing(false);
      return;
    }

    setMessage(`${data.reviews ?? 0} avis Google synchronisés.`);
    await loadData(establishmentId);
    setSyncing(false);
  }

  async function saveSettings() {
    if (!canManage || !establishmentId) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { error: settingsError } = await supabase
      .from('google_business_settings')
      .upsert(
        {
          establishment_id: establishmentId,
          auto_reply_enabled: settings.auto_reply_enabled,
          auto_reply_language: settings.auto_reply_language,
          auto_reply_tone: settings.auto_reply_tone,
          require_approval: settings.require_approval,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'establishment_id' }
      );

    if (settingsError) {
      setError(settingsError.message);
      setSaving(false);
      return;
    }

    const { error: bonusError } = await supabase
      .from('establishments')
      .update({ review_bonus_points: Math.max(0, Math.floor(Number(bonusPoints) || 0)) })
      .eq('id', establishmentId);

    if (bonusError) {
      setError(bonusError.message);
      setSaving(false);
      return;
    }

    setMessage('Configuration Google enregistrée.');
    setSaving(false);
    await loadData(establishmentId);
  }

  const average = useMemo(() => {
    const values = reviews.map((review) => ratingValue(review.star_rating)).filter((value) => value > 0);
    if (!values.length) return '—';
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  }, [reviews]);

  if (loading && !establishments.length) {
    return (
      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/5" />
      </section>
    );
  }

  if (!establishments.length) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-[#242424] bg-[#111111] shadow-xl">
      <div className="border-b border-[#242424] p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
              Réputation Google
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Avis Google & réponses IA
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
              {canManage
                ? 'Connectez Google, configurez la réponse automatique et définissez la récompense accordée au client après son avis.'
                : 'Consultation uniquement : avis Google et réponses générées par KELYANI.'}
            </p>
          </div>

          <select
            value={establishmentId}
            onChange={(event) => setEstablishmentId(event.target.value)}
            className="rounded-xl border border-[#242424] bg-[#0B0B0B] px-4 py-3 text-xs font-semibold text-white outline-none"
          >
            {establishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.name}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs font-semibold text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs font-semibold text-red-300">
            {error}
          </div>
        )}
      </div>

      {canManage && (
        <div className="grid gap-4 border-b border-[#242424] p-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Google Business</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {connection?.status === 'active' ? 'Connecté' : 'Non connecté'}
                </p>
              </div>
              {connection?.status === 'active' ? (
                <CheckCircle2 className="text-emerald-300" size={20} />
              ) : (
                <XCircle className="text-white/25" size={20} />
              )}
            </div>
            <button
              type="button"
              onClick={() => void connectGoogle()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2 text-[11px] font-bold text-[#0D0D0D]"
            >
              <Link2 size={14} />
              {connection?.status === 'active' ? 'Reconnecter Google' : 'Connecter Google'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Synchronisation</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {connection?.last_sync_at
                ? new Date(connection.last_sync_at).toLocaleString('fr-FR')
                : 'Jamais synchronisé'}
            </p>
            <button
              type="button"
              onClick={() => void syncReviews()}
              disabled={syncing || connection?.status !== 'active'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#242424] bg-[#111111] px-3 py-2 text-[11px] font-bold text-[#D4AF37] disabled:opacity-40"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Synchronisation…' : 'Synchroniser les avis'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Réponse IA</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {settings.auto_reply_enabled ? 'Activée' : 'Désactivée'}
            </p>
            <p className="mt-1 text-[10px] text-white/35">
              {settings.require_approval ? 'Validation manuelle avant publication' : 'Publication automatique'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#D4AF37]">Récompense avis</p>
            <p className="mt-1 text-2xl font-semibold text-white">+{bonusPoints} pts</p>
            <p className="mt-1 text-[10px] text-white/35">0 = récompense désactivée</p>
          </div>
        </div>
      )}

      {canManage && (
        <div className="border-b border-[#242424] p-6 md:p-7">
          <div className="flex items-center gap-2">
            <Settings2 size={17} className="text-[#D4AF37]" />
            <h4 className="text-sm font-semibold text-white">Configuration administrateur</h4>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
              <span>
                <span className="block text-xs font-semibold text-white">Réponse automatique</span>
                <span className="mt-1 block text-[10px] text-white/35">KELYANI génère et publie la réponse Google.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.auto_reply_enabled}
                onChange={(event) => setSettings((current) => ({ ...current, auto_reply_enabled: event.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
              <span>
                <span className="block text-xs font-semibold text-white">Validation avant publication</span>
                <span className="mt-1 block text-[10px] text-white/35">Bloque la publication automatique.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.require_approval}
                onChange={(event) => setSettings((current) => ({ ...current, require_approval: event.target.checked }))}
              />
            </label>

            <label className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
              <span className="block text-xs font-semibold text-white">Langue des réponses</span>
              <select
                value={settings.auto_reply_language}
                onChange={(event) => setSettings((current) => ({ ...current, auto_reply_language: event.target.value }))}
                className="mt-3 w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-2.5 text-xs text-white outline-none"
              >
                <option>français</option>
                <option>anglais</option>
                <option>arabe</option>
                <option>espagnol</option>
              </select>
            </label>

            <label className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
              <span className="block text-xs font-semibold text-white">Ton</span>
              <select
                value={settings.auto_reply_tone}
                onChange={(event) => setSettings((current) => ({ ...current, auto_reply_tone: event.target.value }))}
                className="mt-3 w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-2.5 text-xs text-white outline-none"
              >
                <option>professionnel et chaleureux</option>
                <option>premium et élégant</option>
                <option>amical et naturel</option>
                <option>sobre et professionnel</option>
              </select>
            </label>

            <label className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 lg:col-span-2">
              <span className="block text-xs font-semibold text-white">Points accordés après un avis Google</span>
              <span className="mt-1 block text-[10px] text-white/35">La valeur est lue dynamiquement par la carte fidélité. L’avis ne peut être récompensé qu’une seule fois par plateforme.</span>
              <div className="mt-3 flex max-w-xs items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bonusPoints}
                  onChange={(event) => setBonusPoints(Number(event.target.value))}
                  className="w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                />
                <span className="text-xs font-semibold text-[#D4AF37]">pts</span>
              </div>
              {reviewUrl && (
                <p className="mt-3 truncate text-[10px] text-white/25">Lien Google : {reviewUrl}</p>
              )}
            </label>
          </div>

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-xs font-bold text-[#0D0D0D] disabled:opacity-50"
          >
            <Settings2 size={15} />
            {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
          </button>
        </div>
      )}

      <div className="border-b border-[#242424] p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Avis Google</p>
            <p className="mt-1 text-2xl font-semibold text-white">{reviews.length}</p>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Note moyenne</p>
            <p className="mt-1 text-2xl font-semibold text-[#D4AF37]">{average}</p>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Réponses</p>
            <p className="mt-1 text-2xl font-semibold text-white">{reviews.filter((review) => review.owner_reply).length}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[#242424]">
        {reviews.length === 0 ? (
          <div className="p-10 text-center">
            <Bot className="mx-auto text-[#D4AF37]/50" size={28} />
            <p className="mt-3 text-sm font-semibold text-white">Aucun avis Google synchronisé</p>
            <p className="mt-1 text-xs text-white/35">
              {canManage ? 'Connectez Google puis lancez une synchronisation.' : 'Les avis apparaîtront ici après synchronisation par l’Admin.'}
            </p>
          </div>
        ) : (
          reviews.map((review) => {
            const rating = ratingValue(review.star_rating);
            return (
              <article key={review.id} className="p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {review.reviewer_is_anonymous ? 'Client Google' : review.reviewer_display_name || 'Client Google'}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[#D4AF37]">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} size={13} fill={index < rating ? 'currentColor' : 'none'} />
                        ))}
                      </span>
                      {review.review_created_at && (
                        <span className="text-[10px] text-white/25">
                          {new Date(review.review_created_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {review.comment || 'Avis sans commentaire.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/5 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
                    <Bot size={14} />
                    Réponse KELYANI
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {review.owner_reply || (canManage && settings.auto_reply_enabled
                      ? 'En attente de génération/publication automatique.'
                      : 'Aucune réponse publiée.')}
                  </p>
                  {review.owner_reply_updated_at && (
                    <p className="mt-2 text-[9px] text-white/25">
                      Réponse publiée le {new Date(review.owner_reply_updated_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
