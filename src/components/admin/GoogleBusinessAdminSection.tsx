import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, MessageSquare, RefreshCw, Search,
  Settings2, Sparkles, Star, Store,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GoogleReputationModule from '@/components/admin/GoogleReputationModule';

type Establishment = { id: string; name: string };
type BusinessType = { id: string; name: string; active: boolean };
type Connection = {
  id: string;
  establishment_id: string;
  status: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};
type Location = { id: string; connection_id: string | null; google_business_account_id?: string | null; google_location_id: string; title: string | null; location_name: string | null; mapped_establishment_id: string | null };
type ReplySetting = {
  establishment_id: string;
  auto_reply_enabled: boolean;
  require_approval: boolean;
  auto_reply_language: string | null;
  auto_reply_tone: string | null;
};
type Review = {
  id: string;
  location_id: string;
  reviewer_display_name: string | null;
  star_rating: string | null;
  comment: string | null;
  owner_reply: string | null;
  review_created_at: string | null;
  owner_reply_updated_at: string | null;
  reply_draft?: string | null;
  reply_status?: 'none' | 'pending_approval' | 'ready_to_publish' | 'published' | 'failed' | null;
  reply_error?: string | null;
  reply_generated_at?: string | null;
  reply_published_at?: string | null;
};
type ReviewRow = Review & { establishmentName: string; locationName: string };
type View = 'home' | 'reviews' | 'appReviews' | 'establishment' | 'ai' | 'sync' | 'settings';

const navigation: { id: View; label: string; description: string; icon: typeof MessageSquare }[] = [
  { id: 'reviews', label: 'Avis Google', description: 'Avis Google et réponses', icon: MessageSquare },
  { id: 'appReviews', label: 'Avis Kelyani', description: 'Avis reçus dans Kelyani', icon: MessageSquare },
  { id: 'establishment', label: 'Connexion & attribution', description: 'Connecter Google et associer les fiches', icon: Store },
  { id: 'ai', label: 'Configuration IA', description: 'Règles IA pour le commerce choisi', icon: Sparkles },
  { id: 'sync', label: 'Fréquence de rafraîchissement', description: 'Régler le délai de synchronisation', icon: RefreshCw },
  { id: 'settings', label: 'Bonus & liens', description: 'Points et liens vers les avis', icon: Settings2 },
];

function rating(value: string | null) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[String(value ?? '').toUpperCase()] ?? Number(value ?? 0);
}
function effectiveReplyStatus(review: Review): NonNullable<Review['reply_status']> {
  if (review.reply_status === 'ready_to_publish' && !review.reply_draft?.trim()) return 'failed';
  return review.reply_status ?? (review.owner_reply ? 'published' : 'none');
}

export default function GoogleBusinessAdminSection({ establishments, legacyReviews, businessTypes = [], onEstablishmentCreated }: { establishments: Establishment[]; legacyReviews?: ReactNode; businessTypes?: BusinessType[]; onEstablishmentCreated?: () => Promise<void> | void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replySettings, setReplySettings] = useState<ReplySetting[]>([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState('all');
  const [activeView, setActiveView] = useState<View>('home');
  const [search, setSearch] = useState('');
  const [replyFilter, setReplyFilter] = useState('all');
  const [replyActionId, setReplyActionId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingForLocationId, setCreatingForLocationId] = useState<string | null>(null);
  const [newEstablishmentName, setNewEstablishmentName] = useState('');
  const [newEstablishmentSlug, setNewEstablishmentSlug] = useState('');
  const [newEstablishmentTypeId, setNewEstablishmentTypeId] = useState('');
  const [creatingEstablishment, setCreatingEstablishment] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState<Array<{id:string; google_account_id:string|null; email:string|null; status:string; last_sync_at:string|null; last_error:string|null}>>([]);
  const [accountLoading, setAccountLoading] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: accountRows, error: accountError } = await supabase
        .from('google_business_accounts')
        .select('id,google_account_id,email,status,last_sync_at,last_error')
        .order('created_at', { ascending: false });
      if (accountError && !/google_business_accounts|does not exist|schema cache/i.test(accountError.message)) throw accountError;
      setGoogleAccounts((accountRows ?? []) as Array<{id:string; google_account_id:string|null; email:string|null; status:string; last_sync_at:string|null; last_error:string|null}>);

      const { data: connectionRows, error: connectionError } = await supabase
        .from('google_business_connections')
        .select('id,establishment_id,status,last_sync_at,last_error');
      if (connectionError) throw connectionError;
      const nextConnections = (connectionRows ?? []) as Connection[];
      setConnections(nextConnections);

      const { data: settingsRows, error: settingsError } = await supabase
        .from('google_business_settings')
        .select('establishment_id,auto_reply_enabled,require_approval,auto_reply_language,auto_reply_tone');
      if (settingsError) throw settingsError;
      setReplySettings((settingsRows ?? []) as ReplySetting[]);

      const connectionIds = nextConnections.map((item) => item.id);
      // Load both legacy establishment-linked locations and new account-linked locations.
      // The query below is global and remains admin-only; do not early-return when there
      // are no legacy connections because an account-first Google connection may exist.
      // Backward compatibility: the explicit-mapping migration may not yet be applied
      // to the database used by this preview. Keep legacy review loading operational.
      let locationRows: Location[] = [];
      const mappedQuery = await supabase
        .from('google_business_locations')
        .select('id,connection_id,google_business_account_id,google_location_id,title,location_name,mapped_establishment_id');
      if (mappedQuery.error && /mapped_establishment_id|column .* does not exist|schema cache/i.test(mappedQuery.error.message)) {
        const legacyQuery = await supabase
          .from('google_business_locations')
          .select('id,connection_id,google_location_id,title,location_name')
          .not('connection_id','is',null);
        if (legacyQuery.error) throw legacyQuery.error;
        locationRows = ((legacyQuery.data ?? []) as Omit<Location, 'mapped_establishment_id'>[])
          .map((location) => ({ ...location, mapped_establishment_id: null }));
      } else {
        if (mappedQuery.error) throw mappedQuery.error;
        locationRows = (mappedQuery.data ?? []) as Location[];
      }
      const nextLocations = locationRows;
      setLocations(nextLocations);

      const locationIds = nextLocations.map((item) => item.id);
      if (!locationIds.length) {
        setReviews([]);
        return;
      }
      const { data: reviewRows, error: reviewError } = await supabase
        .from('google_business_reviews')
        .select('id,location_id,reviewer_display_name,star_rating,comment,owner_reply,review_created_at,owner_reply_updated_at,reply_draft,reply_status,reply_error,reply_generated_at,reply_published_at')
        .in('location_id', locationIds)
        .order('review_created_at', { ascending: false })
        .limit(500);
      if (reviewError) throw reviewError;
      setReviews((reviewRows ?? []) as Review[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les avis Google.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (selectedEstablishmentId !== 'all' && !establishments.some((item) => item.id === selectedEstablishmentId)) {
      setSelectedEstablishmentId('all');
    }
  }, [establishments, selectedEstablishmentId]);

  const rows = useMemo<ReviewRow[]>(() => {
    const locationById = new Map(locations.map((item) => [item.id, item]));
    const establishmentById = new Map(establishments.map((item) => [item.id, item.name]));
    return reviews.map((review) => {
      const location = locationById.get(review.location_id);
      return {
        ...review,
        establishmentName: location?.mapped_establishment_id
          ? (establishmentById.get(location.mapped_establishment_id) ?? 'Établissement associé introuvable')
          : 'Non associé — validation requise',
        locationName: location?.title || location?.location_name || 'Fiche Google',
      };
    })
      .filter((review) => selectedEstablishmentId === 'all'
        ? Boolean(locationById.get(review.location_id)?.mapped_establishment_id)
        : locationById.get(review.location_id)?.mapped_establishment_id === selectedEstablishmentId)
      .filter((review) => replyFilter === 'all' || effectiveReplyStatus(review) === replyFilter)
      .filter((review) => {
        const query = search.trim().toLocaleLowerCase();
        return !query || [review.establishmentName, review.locationName, review.reviewer_display_name, review.comment, review.owner_reply, review.reply_draft, review.reply_status, review.reply_error]
          .some((value) => (value ?? '').toLocaleLowerCase().includes(query));
      });
  }, [connections, establishments, locations, reviews, search, selectedEstablishmentId, replyFilter]);

  const connectedIds = new Set(connections.filter((item) => item.status === 'active').map((item) => item.establishment_id));
  const connectedCount = establishments.filter((item) => connectedIds.has(item.id)).length;
  const autoReplyCount = establishments.filter((item) => connectedIds.has(item.id) &&
    replySettings.some((setting) => setting.establishment_id === item.id && setting.auto_reply_enabled)).length;
  const repliedCount = rows.filter((item) => Boolean(item.owner_reply)).length;
  const replyCounts = { published: rows.filter((item) => effectiveReplyStatus(item) === 'published').length, pending: rows.filter((item) => effectiveReplyStatus(item) === 'pending_approval').length, ready: rows.filter((item) => effectiveReplyStatus(item) === 'ready_to_publish').length, failed: rows.filter((item) => effectiveReplyStatus(item) === 'failed').length };
  const runReplyAction = async (reviewId: string, action: 'generate' | 'publish' | 'save', reply?: string) => {
    setReplyActionId(reviewId); setReplyMessage(''); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('google-business-reply', {
        body: { review_id: reviewId, action, ...(reply !== undefined ? { reply } : {}) },
      });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Action sur la réponse impossible.');
      if ((action === 'generate' || action === 'save') && typeof data.reply === 'string' || (action === 'save' && typeof reply === 'string')) {
        const draft = typeof data.reply === 'string' ? data.reply : (reply ?? '');
        if (!draft.trim()) throw new Error('Le serveur a confirmé l’action sans renvoyer de texte. Le brouillon ne peut pas être affiché.');
        setReviews(current => current.map(item => item.id === reviewId ? {
          ...item, reply_draft: draft,
          reply_status: data.status ?? 'ready_to_publish',
          reply_error: null,
          reply_generated_at: action === 'generate' ? new Date().toISOString() : item.reply_generated_at,
        } : item));
      }
      setReplyMessage(action === 'generate' ? 'Réponse IA générée et chargée dans le champ.' : action === 'publish' ? 'Publication confirmée par Google.' : 'Brouillon enregistré.');
      await load();
      // Keep the returned draft visible even if a stale read replica/cache returns the old row.
      if ((action === 'generate' || action === 'save') && (typeof data.reply === 'string' || typeof reply === 'string')) {
        const draft = typeof data.reply === 'string' ? data.reply : (reply ?? '');
        setReviews(current => current.map(item => item.id === reviewId ? { ...item, reply_draft: draft, reply_status: data.status ?? 'ready_to_publish', reply_error: null } : item));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de traiter cette réponse.');
    } finally { setReplyActionId(null); }
  };
  const averageRating = rows.length ? rows.reduce((sum, item) => sum + rating(item.star_rating), 0) / rows.length : 0;
  const selectedEstablishment = establishments.find((item) => item.id === selectedEstablishmentId);
  const selectedSetting = replySettings.find((item) => item.establishment_id === selectedEstablishmentId);
  const selectedConnection = connections.find((item) => item.establishment_id === selectedEstablishmentId);
  const needsSpecificEstablishment = activeView === 'ai' || activeView === 'sync' || activeView === 'settings';

  const metric = (label: string, value: string | number, accent = false) => (
    <div className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
      <p className="text-xs text-white/45">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? 'text-[#C9A45C]' : 'text-white'}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-[#242424] bg-[#111111] p-5 sm:p-7">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-[#C9A45C]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Administration centralisée</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Google Business Profile</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Gérez les avis Google, la connexion et les réponses IA depuis une seule interface.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/30 px-4 py-2.5 text-xs font-semibold text-[#C9A45C] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metric('Établissements connectés', `${connectedCount} / ${establishments.length}`, true)}
        {metric('Avis affichés', rows.length)}
        {metric('Note moyenne', averageRating ? `${averageRating.toFixed(1)} ★` : '—', true)}
        {metric('Réponses auto configurées et connectées', `${autoReplyCount} / ${establishments.length}`)}
      </div>

      <div className="space-y-5">
        <nav aria-label="Options Google Business" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {navigation.map(({ id, label, description, icon: Icon }) => {
            const active = activeView === id;
            return (
              <button key={id} type="button" onClick={() => setActiveView(id)} aria-current={active ? 'page' : undefined}
                className={`flex min-h-[124px] min-w-0 flex-col items-start gap-3 rounded-2xl border p-4 text-left transition [transform:perspective(900px)_rotateX(2deg)] hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(0,0,0,.32)] ${active ? 'border-[#C9A45C]/60 bg-[#C9A45C]/10' : 'border-[#242424] bg-[#111111] hover:border-[#C9A45C]/30'}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-[#C9A45C] text-[#111111]' : 'bg-white/5 text-[#C9A45C]'}`}><Icon size={17} /></span>
                <span className="min-w-0">
                  <span className={`block text-xs font-semibold sm:text-sm ${active ? 'text-[#C9A45C]' : 'text-white'}`}>{label}</span>
                  <span className="mt-1 hidden text-[11px] leading-4 text-white/40 sm:block">{description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {activeView !== 'home' && <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A45C]">Établissement concerné</p>
                <p className="mt-1 text-sm font-semibold text-white">{selectedEstablishment?.name ?? 'Tous les établissements'}</p>
                <p className="mt-1 text-xs text-white/40">{needsSpecificEstablishment ? 'Sélectionnez un établissement avant de modifier ses réglages.' : activeView === 'establishment' ? 'Choisissez un établissement pour connecter son compte Google ; les associations de fiches restent globales.' : 'Choisissez un établissement pour filtrer les avis, ou gardez la vue globale.'}</p>
              </div>
              <label className="block w-full sm:max-w-xs">
                <span className="sr-only">Sélectionner l’établissement concerné</span>
                <select value={selectedEstablishmentId} onChange={(event) => setSelectedEstablishmentId(event.target.value)}
                  className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white focus:border-[#C9A45C] focus:outline-none">
                  <option value="all">Tous les établissements</option>
                  {establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>
            {selectedEstablishment && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#242424] pt-4">
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${selectedConnection?.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>
                  {selectedConnection?.status === 'active' ? 'Google connecté' : 'Google non connecté'}
                </span>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${selectedSetting?.auto_reply_enabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-white/45'}`}>
                  {selectedSetting?.auto_reply_enabled ? (selectedSetting.require_approval ? 'IA avec validation' : 'Réponses automatiques activées') : 'Réponses IA désactivées'}
                </span>
              </div>
            )}
          </section>

          {activeView === 'reviews' && (
            <>
              <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h3 className="text-lg font-semibold text-white">Avis Google reçus</h3><p className="mt-1 text-xs text-white/40">Les avis sont filtrés selon l’établissement sélectionné ci-dessus.</p></div>
                  <label className="relative block w-full sm:max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A45C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans les avis…" className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] py-3 pl-9 pr-3 text-sm text-white placeholder:text-white/25" /></label>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-5">{[{key:'all',label:'Tous',count:rows.length},{key:'published',label:'Publiées',count:replyCounts.published},{key:'pending_approval',label:'En attente',count:replyCounts.pending},{key:'ready_to_publish',label:'Prêtes à publier',count:replyCounts.ready},{key:'failed',label:'En échec',count:replyCounts.failed}].map((item)=><button key={item.key} type="button" onClick={()=>setReplyFilter(item.key)} className={`rounded-xl border px-3 py-3 text-left ${replyFilter===item.key?'border-[#C9A45C]/50 bg-[#C9A45C]/10':'border-[#242424] bg-[#0b0b0b]'}`}><span className="block text-[10px] text-white/45">{item.label}</span><span className="mt-1 block text-lg font-semibold text-white">{item.count}</span></button>)}</div>{replyMessage && <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200">{replyMessage}</p>}
                <div className="mt-4 space-y-3">
                  {loading ? <div className="py-12 text-center text-sm text-white/35">Chargement des avis…</div> :
                    rows.length === 0 ? <div className="rounded-xl border border-dashed border-[#242424] px-5 py-12 text-center"><MessageSquare size={24} className="mx-auto text-white/20" /><p className="mt-3 text-sm font-semibold text-white">Aucun avis trouvé</p><p className="mt-1 text-xs text-white/35">Aucun avis pour ce filtre, ou aucune fiche Google synchronisée.</p></div> :
                    rows.map((review) => <article key={review.id} className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><Building2 size={14} className="text-[#C9A45C]" /><span className="text-xs font-semibold text-[#C9A45C]">{review.establishmentName}</span><span className="text-white/20">·</span><span className="text-xs text-white/45">{review.locationName}</span></div>
                          <p className="mt-2 text-sm font-semibold text-white">{review.reviewer_display_name || 'Client Google'}</p>
                          <p className="mt-1 text-sm text-[#C9A45C]">{'★'.repeat(Math.max(0, Math.min(5, rating(review.star_rating))))}<span className="ml-2 text-xs text-white/30">{review.review_created_at ? new Date(review.review_created_at).toLocaleDateString('fr-FR') : 'Date inconnue'}</span></p>
                        </div>
                        {(() => { const status=effectiveReplyStatus(review); const labels:Record<string,string>={published:'Réponse publiée',pending_approval:'En attente de validation',ready_to_publish:'Prête à publier',failed:'Échec de publication',none:'Sans réponse'}; const styles:Record<string,string>={published:'border-emerald-400/20 bg-emerald-400/5 text-emerald-300',pending_approval:'border-amber-400/20 bg-amber-400/5 text-amber-200',ready_to_publish:'border-sky-400/20 bg-sky-400/5 text-sky-200',failed:'border-red-400/20 bg-red-400/5 text-red-200',none:'border-white/10 bg-white/5 text-white/45'}; return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold ${styles[status]||styles.none}`}>{status==='published'&&<CheckCircle2 size={12} />}{labels[status]||labels.none}</span>; })()}
                      </div>
                      {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{review.comment}</p>}
                      {review.owner_reply && <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">Réponse publiée sur Google</p><span className="text-[10px] text-white/35">{review.reply_published_at || review.owner_reply_updated_at ? new Date(review.reply_published_at || review.owner_reply_updated_at!).toLocaleString('fr-FR') : ''}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{review.owner_reply}</p></div>}
                      {(!review.owner_reply || ['pending_approval','ready_to_publish','failed'].includes(review.reply_status)) && <div className="mt-3 rounded-xl border border-[#242424] bg-[#111111] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{effectiveReplyStatus(review)==='pending_approval'?'Brouillon en attente de validation':effectiveReplyStatus(review)==='ready_to_publish'?'Brouillon prêt à publier':effectiveReplyStatus(review)==='failed'?'Échec ou brouillon vide : générez à nouveau':'Réponse à préparer'}</p><textarea value={review.reply_draft ?? ''} onChange={(event)=>setReviews(current=>current.map(item=>item.id===review.id?{...item,reply_draft:event.target.value,reply_status:item.reply_status==='pending_approval'?'pending_approval':'ready_to_publish'}:item))} rows={3} placeholder="Générez ou rédigez une réponse…" className="mt-2 w-full rounded-xl border border-[#242424] bg-[#0b0b0b] p-3 text-sm text-white placeholder:text-white/25"/>{review.reply_error && <p className="mt-2 text-xs text-red-300">Erreur : {review.reply_error}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={replyActionId===review.id} onClick={()=>void runReplyAction(review.id,'generate')} className="inline-flex items-center gap-2 rounded-lg border border-[#C9A45C]/30 px-3 py-2 text-xs font-semibold text-[#C9A45C] disabled:opacity-50"><Sparkles size={13}/>{replyActionId===review.id?'Traitement…':'Générer avec IA'}</button><button type="button" disabled={replyActionId===review.id||!review.reply_draft?.trim()} onClick={()=>void runReplyAction(review.id,'save',review.reply_draft??'')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-50">Enregistrer le brouillon</button><button type="button" disabled={replyActionId===review.id||!review.reply_draft?.trim()} onClick={()=>void runReplyAction(review.id,'publish',review.reply_draft??'')} className="rounded-lg bg-[#C9A45C] px-3 py-2 text-xs font-semibold text-[#111111] disabled:opacity-50">{replyActionId===review.id?'Publication…':'Valider et publier'}</button></div></div>}
                    </article>)
                  }
                </div>
              </section>
            </>
          )}

          {activeView === 'appReviews' && (
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Avis Kelyani</h3>
                <p className="mt-1 text-xs text-white/40">Les avis collectés directement par Kelyani restent disponibles ici, séparément des avis Google.</p>
              </div>
              {legacyReviews}
            </section>
          )}

          {activeView === 'establishment' && (
            <>
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <section className="mb-5 rounded-2xl border border-[#C9A45C]/25 bg-gradient-to-br from-[#17130b] to-[#0b0b0b] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A45C]">Compte Google central</p><h3 className="mt-1 text-lg font-semibold text-white">Comptes Google connectés</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Connectez le compte qui possède les accès Google Business Profile, puis découvrez ses fiches et attribuez-les aux établissements KELYANI.</p></div>
                  <button type="button" onClick={async()=>{setAccountLoading(true);setError('');try{const {data,error}=await supabase.functions.invoke('google-business-oauth',{body:{action:'start_account'}});if(error)throw error;if(!data?.success||!data?.authorization_url)throw new Error(data?.error||'Connexion du compte Google indisponible : la fonction OAuth doit prendre en charge le mode compte.');window.open(data.authorization_url,'_blank','noopener,noreferrer');}catch(e){setError(e instanceof Error?e.message:'Connexion Google impossible.');}finally{setAccountLoading(false);}}} disabled={accountLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-3 text-xs font-semibold text-[#111111] disabled:opacity-50"><Store size={15}/>{accountLoading?'Connexion…':'Connecter un compte Google'}</button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {googleAccounts.map(account=><article key={account.id} className="rounded-xl border border-[#29251b] bg-black/30 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-white">{account.email||account.google_account_id||'Compte Google Business'}</p><p className="mt-1 text-[11px] text-white/40">Compte {account.google_account_id||'en attente de synchronisation'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${account.status==='active'?'bg-emerald-400/10 text-emerald-300':'bg-amber-400/10 text-amber-200'}`}>{account.status==='active'?'Connecté':account.status}</span></div>{account.last_error&&<p className="mt-2 text-xs text-red-300">{account.last_error}</p>}<p className="mt-3 text-[10px] text-white/35">Dernière synchronisation : {account.last_sync_at?new Date(account.last_sync_at).toLocaleString('fr-FR'):'Jamais'}</p><button type="button" onClick={async()=>{setAccountLoading(true);setError('');try{const {data,error}=await supabase.functions.invoke('google-business-sync-access-test',{body:{google_business_account_id:account.id}});if(error)throw error;if(!data?.success)throw new Error(data?.error||'Synchronisation impossible');setReplyMessage('Synchronisation terminée : '+(data.locations??0)+' fiche(s) Google et '+(data.reviews??0)+' avis.');await load();}catch(e){setError(e instanceof Error?e.message:'Synchronisation impossible.');}finally{setAccountLoading(false);}}} disabled={accountLoading} className="mt-3 rounded-lg border border-[#C9A45C]/30 px-3 py-2 text-xs font-semibold text-[#C9A45C] disabled:opacity-50"><RefreshCw size={12} className="mr-1 inline"/>Synchroniser les fiches</button></article>)}
                  {!googleAccounts.length&&<p className="rounded-xl border border-dashed border-[#29251b] p-4 text-xs text-white/40 sm:col-span-2 xl:col-span-3">Aucun compte Google centralisé. La connexion par établissement existante reste disponible pendant la transition.</p>}
                </div>
              </section>
              <div className="mb-4"><h3 className="text-lg font-semibold text-white">Associer les fiches Google manuellement</h3><p className="mt-1 text-xs leading-5 text-white/40">Chaque fiche Google reste indépendante. Les avis d’une fiche ne seront affichés sous un établissement Kelyani qu’après association explicite ci-dessous. Vérifiez le nom et l’adresse avant de choisir.</p></div>
              <div className="space-y-3">
                {locations.map((location) => {
                  const connection = connections.find((row) => row.id === location.connection_id);
                  const label = location.title || location.location_name || 'Fiche Google sans nom';
                  return <div key={location.id} className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="text-sm font-semibold text-white">{label}</p><p className="mt-1 text-xs text-white/40">ID Google : {location.google_location_id} · Connexion : {connections.find((item) => item.id === location.connection_id)?.status === 'active' ? 'active' : 'à vérifier'}</p><p className="mt-1 text-xs text-amber-200">{location.mapped_establishment_id ? 'Fiche associée explicitement' : 'Non associée — ses avis sont masqués des vues par établissement'}</p></div>
                      <div className="w-full space-y-2 sm:max-w-xs">
                        <label className="block"><span className="sr-only">Associer la fiche Google {label} à un établissement Kelyani</span><select value={location.mapped_establishment_id ?? ''} onChange={async (event) => {
                          const mappedId = event.target.value || null;
                          if (mappedId === '__create__') {
                            setCreatingForLocationId(location.id);
                            setNewEstablishmentName(label);
                            setNewEstablishmentSlug(label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                            setNewEstablishmentTypeId('');
                            return;
                          }
                          setError('');
                          const { error: saveError } = await supabase.from('google_business_locations').update({ mapped_establishment_id: mappedId, updated_at: new Date().toISOString() }).eq('id', location.id);
                          if (saveError) { setError(saveError.message); return; }
                          setLocations(current => current.map(item => item.id === location.id ? { ...item, mapped_establishment_id: mappedId } : item));
                        }} className="w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-3 text-sm text-white focus:border-[#C9A45C] focus:outline-none"><option value="">Ne pas associer</option>{establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__create__">＋ Créer une fiche établissement</option></select></label>
                        {creatingForLocationId === location.id && <div className="space-y-3 rounded-xl border border-[#C9A45C]/25 bg-[#C9A45C]/5 p-3">
                          <p className="text-xs font-semibold text-[#C9A45C]">Créer depuis cette fiche Google</p>
                          <label className="block text-[11px] text-white/60">Nom de l’établissement<input value={newEstablishmentName} onChange={(event) => { const value = event.target.value; setNewEstablishmentName(value); setNewEstablishmentSlug(value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')); }} className="mt-1 w-full rounded-lg border border-[#242424] bg-[#111111] px-3 py-2 text-sm text-white" /></label>
                          <label className="block text-[11px] text-white/60">Slug<input value={newEstablishmentSlug} onChange={(event) => setNewEstablishmentSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))} className="mt-1 w-full rounded-lg border border-[#242424] bg-[#111111] px-3 py-2 text-sm text-white" /></label>
                          <label className="block text-[11px] text-white/60">Type de commerce<select value={newEstablishmentTypeId} onChange={(event) => setNewEstablishmentTypeId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#242424] bg-[#111111] px-3 py-2 text-sm text-white"><option value="">Choisir un type</option>{businessTypes.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
                          <div className="flex gap-2"><button type="button" disabled={creatingEstablishment} onClick={() => setCreatingForLocationId(null)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60">Annuler</button><button type="button" disabled={creatingEstablishment || !newEstablishmentName.trim() || !newEstablishmentSlug.trim() || !newEstablishmentTypeId} onClick={async () => {
                            setCreatingEstablishment(true);
                            setError('');
                            try {
                              const slug = newEstablishmentSlug.trim();
                              const { data: duplicate, error: duplicateError } = await supabase.from('establishments').select('id,name').eq('slug', slug).maybeSingle();
                              if (duplicateError) throw duplicateError;
                              if (duplicate) throw new Error('Ce slug existe déjà. Modifiez-le avant de créer la fiche.');
                              const { data: created, error: createError } = await supabase.from('establishments').insert({ name: newEstablishmentName.trim(), slug, ai_business_type_id: newEstablishmentTypeId }).select('id,name').single();
                              if (createError) throw createError;
                              await onEstablishmentCreated?.();
                              const { error: mappingError } = await supabase.from('google_business_locations').update({ mapped_establishment_id: created.id, updated_at: new Date().toISOString() }).eq('id', location.id);
                              if (mappingError) throw new Error('Fiche créée, mais association non enregistrée : ' + mappingError.message + '. La fiche est créée ; sélectionnez-la manuellement dans la liste après actualisation.');
                              setLocations(current => current.map(item => item.id === location.id ? { ...item, mapped_establishment_id: created.id } : item));
                              setCreatingForLocationId(null);
                              setReplyMessage('Fiche « ' + created.name + ' » créée et associée à cette fiche Google.');
                              await load();
                            } catch (caught) {
                              setError(caught instanceof Error ? caught.message : 'Impossible de créer la fiche établissement.');
                            } finally {
                              setCreatingEstablishment(false);
                            }
                          }} className="flex-1 rounded-lg bg-[#C9A45C] px-3 py-2 text-xs font-semibold text-[#111111] disabled:opacity-50">{creatingEstablishment ? 'Création…' : 'Créer et associer'}</button></div>
                        </div>}
                      </div>
                    </div>
                  </div>;
                })}
                {!locations.length && <p className="py-8 text-center text-sm text-white/40">Aucune fiche Google synchronisée. Connectez Google puis actualisez pour découvrir les fiches.</p>}
              </div>
            </section>
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <div className="mb-4"><h3 className="text-lg font-semibold text-white">Connexion Google pour cet établissement</h3><p className="mt-1 text-xs text-white/40">Choisissez un établissement dans le sélecteur au-dessus pour démarrer ou vérifier sa connexion Google. L’association des fiches reste gérée dans le panneau précédent.</p></div>
              {!selectedEstablishment ? <p className="rounded-xl border border-dashed border-[#242424] p-6 text-center text-sm text-amber-100">Sélectionnez un établissement précis dans le sélecteur ci-dessus pour connecter Google.</p> :
                <GoogleReputationModule key={selectedEstablishment.id} establishmentId={selectedEstablishment.id} mode="connection" />
              }
            </section>
            </>
          )}

          {activeView === 'ai' && (
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <div className="mb-4"><h3 className="text-lg font-semibold text-white">Configuration IA par établissement</h3><p className="mt-1 text-xs text-white/40">Réglez le mode de réponse, la validation, le seuil de publication, la langue et le ton pour le commerce sélectionné.</p></div>
              {!selectedEstablishment ? <p className="rounded-xl border border-dashed border-[#242424] p-6 text-center text-sm text-amber-100">Sélectionnez un établissement dans le menu ci-dessus pour configurer ses réponses IA.</p> :
                <GoogleReputationModule key={selectedEstablishment.id} establishmentId={selectedEstablishment.id} mode="ai" />
              }
            </section>
          )}

          {activeView === 'sync' && (
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <div className="mb-4"><h3 className="text-lg font-semibold text-white">Délai de rafraîchissement des avis</h3><p className="mt-1 text-xs text-white/40">Le délai est indépendant pour chaque établissement et ne modifie pas les autres tâches planifiées de KELYANI.</p></div>
              {!selectedEstablishment ? <p className="rounded-xl border border-dashed border-[#242424] p-6 text-center text-sm text-amber-100">Sélectionnez un établissement pour régler son intervalle de synchronisation.</p> :
                <GoogleReputationModule key={selectedEstablishment.id} establishmentId={selectedEstablishment.id} mode="sync" />
              }
            </section>
          )}

          {activeView === 'settings' && (
            <section className="rounded-2xl border border-[#242424] bg-[#111111] p-4 sm:p-5">
              <div className="mb-5"><h3 className="text-lg font-semibold text-white">Bonus et liens d’avis</h3><p className="mt-1 text-xs text-white/40">Les réglages ci-dessous ne concernent que l’établissement sélectionné.</p></div>
              {!selectedEstablishment ? <p className="rounded-xl border border-dashed border-[#242424] p-6 text-center text-sm text-amber-100">Sélectionnez un établissement dans le menu « Établissement concerné ».</p> :
                <GoogleReputationModule key={selectedEstablishment.id} establishmentId={selectedEstablishment.id} mode="links" />
              }
            </section>
          )}
        </main>}
      </div>
    </div>
  );
}
