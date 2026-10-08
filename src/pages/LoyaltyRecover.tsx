import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function LoyaltyRecover() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    let active = true;

    const recover = async () => {
      if (!token) {
        if (active) setStatus('error');
        return;
      }

      const { data, error } = await supabase.rpc('consume_loyalty_card_recovery', {
        p_recovery_token: token,
      });

      if (!active) return;

      if (error || !data?.[0]?.access_token) {
        setStatus('error');
        return;
      }

      const accessToken = String(data[0].access_token);
      const name = String(data[0].first_name ?? '');

      window.localStorage.setItem('tapmarrakech:customer-card-token', accessToken);

      try {
        const dbName = 'tapmarrakech-loyalty';
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => {
          try {
            const db = request.result;
            if (db.objectStoreNames.contains('settings')) {
              db.transaction('settings', 'readwrite').objectStore('settings').put(accessToken, 'customer-card-token');
            }
          } catch {
            // localStorage remains the fallback.
          }
        };
      } catch {
        // localStorage remains the fallback.
      }

      setFirstName(name);
      setStatus('success');

      window.setTimeout(() => {
        if (active) window.location.href = `/loyalty/${accessToken}`;
      }, 900);
    };

    void recover();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#050505] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-[32px] border border-[#242424] bg-[#111111] p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,.55)]">
          {status === 'loading' && (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <h1 className="mt-6 text-xl font-semibold">Récupération de votre carte</h1>
              <p className="mt-2 text-sm leading-6 text-white/45">Nous sécurisons votre nouveau lien de carte fidélité.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]">
                <CheckCircle2 size={30} />
              </div>
              <h1 className="mt-6 text-xl font-semibold">Carte récupérée</h1>
              <p className="mt-2 text-sm leading-6 text-white/45">
                {firstName ? `Bonjour ${firstName}, votre carte est prête.` : 'Votre carte est prête.'}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#242424] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C9A45C]">
                <ShieldCheck size={13} /> Lien sécurisé renouvelé
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500/10 text-red-400">
                <XCircle size={30} />
              </div>
              <h1 className="mt-6 text-xl font-semibold">QR code invalide</h1>
              <p className="mt-2 text-sm leading-6 text-white/45">Ce QR code a expiré ou a déjà été utilisé. Demandez au responsable d'en générer un nouveau.</p>
              <Link to="/loyalty" className="mt-6 inline-flex rounded-xl bg-[#C9A45C] px-5 py-3 text-sm font-bold text-[#050505]">Retour</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
