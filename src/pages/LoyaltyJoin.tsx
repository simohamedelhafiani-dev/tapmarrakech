import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Gift, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoyaltyJoin() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref')?.trim() ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const canSubmit = useMemo(
    () => Boolean(referralCode && firstName.trim() && lastName.trim() && phone.trim()),
    [referralCode, firstName, lastName, phone],
  );

  async function join() {
    if (!canSubmit || loading) return;

    setLoading(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc(
      'register_public_loyalty_customer_with_referral',
      {
        p_referral_code: referralCode,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_phone: phone.trim(),
        p_birth_date: birthDate || null,
      },
    );

    if (rpcError) {
      setError(
        rpcError.message === 'already_registered'
          ? 'Ce numéro est déjà inscrit dans le programme fidélité.'
          : rpcError.message,
      );
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.access_token) {
      setError('Impossible de créer votre carte fidélité.');
      setLoading(false);
      return;
    }

    setAccessToken(String(row.access_token));
  }

  if (accessToken) {
    return <Navigate to={`/loyalty/${accessToken}`} replace />;
  }

  if (!referralCode) {
    return (
      <main className="min-h-screen bg-[#f7f7f3] px-4 py-8">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-7 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e5eee9] text-[#173D32]">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-[#173D32]">Invitation invalide</h1>
          <p className="mt-2 text-sm leading-6 text-ink/50">
            Ce lien de parrainage est incomplet ou invalide.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef0ed] px-4 py-8">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <div className="bg-[#173D32] px-6 py-7 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D6B15A] text-[#173D32]">
              <Gift className="h-5 w-5" />
            </div>
            <h1 className="mt-5 font-display text-3xl">Rejoignez le programme fidélité</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Vous avez été invité par un client. Créez votre carte fidélité pour recevoir vos avantages.
            </p>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <label className="text-xs font-semibold text-ink/60">Prénom *</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-[#D3A84C]"
                placeholder="Votre prénom"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink/60">Nom *</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                autoComplete="family-name"
                className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-[#D3A84C]"
                placeholder="Votre nom"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink/60">Téléphone *</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-[#D3A84C]"
                placeholder="+212 6..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink/60">Date de naissance</label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-[#D3A84C]"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void join()}
              disabled={!canSubmit || loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173D32] px-5 py-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Création de votre carte…' : 'Rejoindre le programme'}
            </button>

            <p className="text-center text-[10px] leading-4 text-ink/35">
              Votre inscription est liée automatiquement au parrainage de cette invitation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
