import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, Star, MessageSquare, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GoogleReputationModule from '@/components/admin/GoogleReputationModule';

type Establishment = { id: string; name: string };
type Connection = {
  id: string;
  establishment_id: string;
  status: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};
type Location = { id: string; connection_id: string; title: string | null; location_name: string | null };
type Review = {
  id: string;
  location_id: string;
  reviewer_display_name: string | null;
  star_rating: string | null;
  comment: string | null;
  owner_reply: string | null;
  review_created_at: string | null;
  owner_reply_updated_at: string | null;
};
type ReviewRow = Review & { establishmentName: string; locationName: string };

function rating(value: string | null) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[String(value ?? '').toUpperCase()] ?? Number(value ?? 0);
}

export default function GoogleBusinessAdminSection({ establishments }: { establishments: Establishment[] }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: connectionRows, error: connectionError } = await supabase
        .from('google_business_connections')
        .select('id,establishment_id,status,last_sync_at,last_error');
      if (connectionError) throw connectionError;
      const nextConnections = (connectionRows ?? []) as Connection[];
      setConnections(nextConnections);

      const connectionIds = nextConnections.map((item) => item.id);
      if (!connectionIds.length) {
        setLocations([]);
        setReviews([]);
        return;
      }

      const { data: locationRows, error: locationError } = await supabase
        .from('google_business_locations')
        .select('id,connection_id,title,location_name')
        .in('connection_id', connectionIds);
      if (locationError) throw locationError;
      const nextLocations = (locationRows ?? []) as Location[];
      setLocations(nextLocations);

      const locationIds = nextLocations.map((item) => item.id);
      if (!locationIds.length) {
        setReviews([]);
        return;
      }

      const { data: reviewRows, error: reviewError } = await supabase
        .from('google_business_reviews')
        .select('id,location_id,reviewer_display_name,star_rating,comment,owner_reply,review_created_at,owner_reply_updated_at')
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

  const rows = useMemo<ReviewRow[]>(() => {
    const connectionById = new Map(connections.map((item) => [item.id, item]));
    const locationById = new Map(locations.map((item) => [item.id, item]));
    const establishmentById = new Map(establishments.map((item) => [item.id, item.name]));
    return reviews.map((review) => {
      const location = locationById.get(review.location_id);
      const connection = location ? connectionById.get(location.connection_id) : undefined;
      return {
        ...review,
        establishmentName: connection ? (establishmentById.get(connection.establishment_id) ?? 'Établissement inconnu') : 'Établissement inconnu',
        locationName: location?.title || location?.location_name || 'Fiche Google',
      };
    }).filter((review) => selectedEstablishmentId === 'all' || connections.some((connection) => connection.establishment_id === selectedEstablishmentId && locations.some((location) => location.connection_id === connection.id && location.id === review.location_id)))
      .filter((review) => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return true;
        return [review.establishmentName, review.locationName, review.reviewer_display_name, review.comment, review.owner_reply]
          .some((value) => (value ?? '').toLocaleLowerCase().includes(query));
      });
  }, [connections, establishments, locations, reviews, search, selectedEstablishmentId]);

  const connectedCount = connections.filter((item) => item.status === 'active').length;
  const repliedCount = rows.filter((item) => Boolean(item.owner_reply)).length;
  const averageRating = rows.length ? rows.reduce((sum, item) => sum + rating(item.star_rating), 0) / rows.length : 0;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-[#242424] bg-[#111111] p-6 sm:p-8">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-[#C9A45C]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Administration centralisée</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Google Business Profile</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Tous les avis Google des établissements au même endroit. Filtrez les avis, contrôlez les réponses et gérez la connexion de chaque fiche sans passer par le profil de l’établissement.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/30 px-4 py-2.5 text-xs font-semibold text-[#C9A45C] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser les avis
          </button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-xs text-white/40">Établissements Google connectés</p><p className="mt-2 text-3xl font-semibold text-[#C9A45C]">{connectedCount}<span className="ml-2 text-sm font-normal text-white/30">/ {establishments.length}</span></p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-xs text-white/40">Avis récupérés</p><p className="mt-2 text-3xl font-semibold text-white">{rows.length}</p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-xs text-white/40">Note moyenne</p><p className="mt-2 text-3xl font-semibold text-[#C9A45C]">{averageRating ? averageRating.toFixed(1) : '—'} <span className="text-lg">★</span></p></div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5"><p className="text-xs text-white/40">Avis avec réponse</p><p className="mt-2 text-3xl font-semibold text-white">{repliedCount}<span className="ml-2 text-sm font-normal text-white/30">/ {rows.length}</span></p></div>
      </div>

      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="block w-full max-w-sm"><span className="mb-2 block text-xs font-semibold text-white/50">Filtrer par établissement</span><select value={selectedEstablishmentId} onChange={(event) => setSelectedEstablishmentId(event.target.value)} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white"><option value="all">Tous les établissements</option>{establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}</select></label>
          <label className="relative block w-full max-w-md"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A45C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un avis, un client..." className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] py-3 pl-9 pr-3 text-sm text-white placeholder:text-white/25" /></label>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? <div className="py-12 text-center text-sm text-white/35">Chargement des avis de tous les établissements…</div> :
            rows.length === 0 ? <div className="rounded-2xl border border-dashed border-[#242424] px-5 py-12 text-center"><MessageSquare size={24} className="mx-auto text-white/20" /><p className="mt-3 text-sm font-semibold text-white">Aucun avis trouvé</p><p className="mt-1 text-xs text-white/35">Connectez une fiche Google ou modifiez les filtres.</p></div> :
            rows.map((review) => <article key={review.id} className="rounded-2xl border border-[#242424] bg-[#0b0b0b] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Building2 size={14} className="text-[#C9A45C]" /><span className="text-xs font-semibold text-[#C9A45C]">{review.establishmentName}</span><span className="text-white/20">·</span><span className="text-xs text-white/45">{review.locationName}</span></div>
                  <p className="mt-2 text-sm font-semibold text-white">{review.reviewer_display_name || 'Client Google'}</p>
                  <p className="mt-1 text-sm text-[#C9A45C]">{'★'.repeat(Math.max(0, Math.min(5, rating(review.star_rating))))}<span className="ml-2 text-xs text-white/30">{review.review_created_at ? new Date(review.review_created_at).toLocaleDateString('fr-FR') : 'Date inconnue'}</span></p>
                </div>
                {review.owner_reply ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-[10px] font-semibold text-emerald-300"><CheckCircle2 size={12} /> Réponse publiée</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1 text-[10px] font-semibold text-amber-200">À traiter</span>}
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{review.comment}</p>}
              {review.owner_reply && <div className="mt-3 rounded-xl border border-[#242424] bg-[#111111] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Réponse de l’établissement</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/60">{review.owner_reply}</p></div>}
            </article>)
          }
        </div>
      </section>

      <section className="rounded-3xl border border-[#242424] bg-[#111111] p-5 sm:p-6">
        <div className="mb-5"><h3 className="text-lg font-semibold text-white">Connexion et paramètres par établissement</h3><p className="mt-1 text-sm text-white/40">Choisissez un établissement pour connecter sa fiche, synchroniser ses avis et configurer les réponses IA.</p></div>
        {establishments.length ? <><label className="mb-5 block max-w-md"><span className="mb-2 block text-xs font-semibold text-white/50">Établissement à configurer</span><select value={selectedEstablishmentId === 'all' ? (establishments[0]?.id ?? '') : selectedEstablishmentId} onChange={(event) => setSelectedEstablishmentId(event.target.value)} className="w-full rounded-xl border border-[#242424] bg-[#0b0b0b] px-3 py-3 text-sm text-white">{establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}</select></label><GoogleReputationModule key={selectedEstablishmentId === 'all' ? establishments[0]?.id : selectedEstablishmentId} establishmentId={selectedEstablishmentId === 'all' ? establishments[0].id : selectedEstablishmentId} /></> : <p className="rounded-2xl border border-dashed border-[#242424] p-8 text-center text-sm text-white/40">Aucun établissement à configurer.</p>}
      </section>
    </div>
  );
}
