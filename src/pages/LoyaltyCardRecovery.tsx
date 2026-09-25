import { useEffect, useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function LoyaltyCardRecovery() {
  const { establishmentId = '' } = useParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [establishmentName, setEstablishmentName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!establishmentId) {
      setError('Lien de récupération invalide.');
      setLoading(false);
      return;
    }

    let active = true;
    supabase
      .rpc('get_loyalty_recovery_context', { p_establishment_id: establishmentId })
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError || !data?.[0]) {
          setError('Cet établissement ne propose pas de récupération de carte.');
        } else {
          setEstablishmentName(data[0].establishment_name ?? '');
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [establishmentId]);

  async function recoverCard() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('Veuillez saisir votre numéro de téléphone.');
      return;
    }

    setSearching(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('recover_loyalty_card', {
      p_establishment_id: establishmentId,
      p_phone: cleanPhone,
    });

    const row = Array.isArray(data) ? data[0] : data;

    if (rpcError || !row?.access_token) {
      setError('Aucune carte fidélité trouvée avec ce numéro dans cet établissement.');
      setSearching(false);
      return;
    }

    navigate(`/loyalty/${row.access_token}`, { replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-10 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-[2rem] border border-ink/5 bg-white p-7 shadow-xl md:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-forest text-white">
              <ShieldCheck size={30} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Carte fidélité
            </p>
            <h1 className="mt-2 font-display text-3xl text-forest">
              Récupérer ma carte
            </h1>
            {establishmentName && (
              <p className="mt-2 text-sm font-medium text-ink/50">{establishmentName}</p>
            )}
            <p className="mt-3 text-sm leading-6 text-ink/45">
              Saisissez le numéro de téléphone utilisé lors de votre inscription pour retrouver votre carte.
            </p>
          </div>

          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void recoverCard();
              }}
              placeholder="06 XX XX XX XX"
              className="w-full rounded-2xl border border-ink/10 bg-[#f7f7f3] py-4 pl-12 pr-4 text-base outline-none focus:border-forest"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void recoverCard()}
            disabled={searching || !phone.trim()}
            className="mt-4 w-full rounded-2xl bg-forest py-4 text-sm font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? 'Recherche...' : 'Retrouver ma carte'}
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-ink/35">
            Vos points et récompenses restent enregistrés même si vous avez supprimé la carte de votre écran d’accueil.
          </p>
        </div>
      </div>
    </div>
  );
}
