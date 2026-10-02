import { useEffect, useMemo, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type EnrollmentResult = {
  establishment_name: string;
  access_token: string;
};

type ReferralResult = {
  access_token: string;
};

export default function LoyaltyJoin() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref')?.trim() ?? '';
  const establishmentId = searchParams.get('est')?.trim() ?? '';
  const isGlobalEnrollment = !referralCode && Boolean(establishmentId);

  const [establishmentName, setEstablishmentName] = useState('');
  const [loadingContext, setLoadingContext] = useState(Boolean(isGlobalEnrollment));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    if (!isGlobalEnrollment) {
      setLoadingContext(false);
      return;
    }

    let active = true;

    const loadContext = async () => {
      setLoadingContext(true);
      setError('');

      const { data, error: contextError } = await supabase.rpc(
        'get_public_loyalty_enrollment_context',
        { p_establishment_id: establishmentId },
      );

      if (!active) return;

      if (contextError) {
        setError(
          contextError.message === 'loyalty_program_disabled'
            ? 'Le programme fidélité est momentanément indisponible.'
            : 'Ce lien d’inscription est invalide.',
        );
        setLoadingContext(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.establishment_name) {
        setError('Ce lien d’inscription est invalide ou le programme est momentanément indisponible.');
        setLoadingContext(false);
        return;
      }

      setEstablishmentName(row.establishment_name);
      setLoadingContext(false);
    };

    void loadContext();

    return () => {
      active = false;
    };
  }, [establishmentId, isGlobalEnrollment]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        !loadingContext &&
        firstName.trim() &&
        lastName.trim() &&
        phone.trim() &&
        (isGlobalEnrollment ? Boolean(establishmentName) : Boolean(referralCode)),
      ),
    [loadingContext, firstName, lastName, phone, isGlobalEnrollment, referralCode],
  );

  async function join() {
    if (!canSubmit || loading) return;

    setLoading(true);
    setError('');

    try {
      if (isGlobalEnrollment) {
        const { data, error: rpcError } = await supabase.rpc(
          'register_public_loyalty_customer_for_enrollment',
          {
            p_establishment_id: establishmentId,
            p_first_name: firstName.trim(),
            p_last_name: lastName.trim(),
            p_phone: phone.trim(),
            p_birth_date: birthDate || null,
          },
        );

        if (rpcError) throw rpcError;

        const row = (Array.isArray(data) ? data[0] : data) as EnrollmentResult | null;
        if (!row?.access_token) throw new Error('Impossible de créer votre carte fidélité.');

        setEstablishmentName(row.establishment_name || establishmentName);
        setAccessToken(String(row.access_token));
        return;
      }

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

      if (rpcError) throw rpcError;

      const row = (Array.isArray(data) ? data[0] : data) as ReferralResult | null;
      if (!row?.access_token) throw new Error('Impossible de créer votre carte fidélité.');

      setAccessToken(String(row.access_token));
    } catch (rpcError) {
      const message = rpcError instanceof Error ? rpcError.message : String(rpcError);
      setError(
        message === 'already_registered'
          ? 'Ce numéro est déjà inscrit dans le programme fidélité.'
          : message === 'loyalty_program_disabled'
            ? 'Le programme fidélité est momentanément indisponible.'
            : message === 'referral_limit_reached'
              ? 'Ce client ne peut plus parrainer de nouveaux membres pour le moment.'
              : message,
      );
      setLoading(false);
    }
  }

  if (accessToken) {
    return <Navigate to={`/loyalty/${accessToken}?welcome=1&referral=1`} replace />;
  }


  if (!referralCode && !establishmentId) {
    return (
      <main className="min-h-screen bg-[#f7f7f3] px-4 py-8">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-7 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e5eee9] text-[#173D32]">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-[#173D32]">Lien d’inscription invalide</h1>
          <p className="mt-2 text-sm leading-6 text-ink/50">
            Scannez le QR Code ou la plaque NFC de l’établissement pour rejoindre son programme fidélité.
          </p>
        </div>
      </main>
    );
  }

  if (loadingContext) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef0ed] px-4">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#173D32] border-t-transparent" />
          <p className="mt-4 text-sm text-[#173D32]/55">Préparation de votre inscription…</p>
        </div>
      </main>
    );
  }

  if (error && isGlobalEnrollment && !establishmentName) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef0ed] px-4 py-8">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-[#173D32]">Inscription indisponible</h1>
          <p className="mt-2 text-sm leading-6 text-ink/50">{error}</p>
        </div>
      </main>
    );
  }

  const title = isGlobalEnrollment ? 'Bienvenue chez vous' : 'Rejoignez le programme fidélité';
  const description = isGlobalEnrollment
    ? 'Créez votre carte fidélité' + (establishmentName ? ' de ' + establishmentName : '') + ' en quelques secondes.'
    : 'Vous avez été invité par un client. Créez votre carte fidélité pour recevoir vos avantages.';

  return (
    <main className="min-h-screen bg-[#eef0ed] px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2rem] bg-white shadow-xl">
          <div className="bg-[#173D32] px-6 py-7 text-white">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#D6B15A] text-[#173D32]">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  Programme fidélité
                </p>
                {establishmentName && (
                  <p className="mt-1 truncate text-sm font-semibold text-white">{establishmentName}</p>
                )}
              </div>
            </div>

            <h1 className="mt-6 font-display text-3xl leading-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-ink/60">
                Prénom *
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  autoFocus
                  className="mt-1.5 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none transition focus:border-[#D3A84C] focus:ring-2 focus:ring-[#D3A84C]/10"
                  placeholder="Prénom"
                />
              </label>
              <label className="block text-xs font-semibold text-ink/60">
                Nom *
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="mt-1.5 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none transition focus:border-[#D3A84C] focus:ring-2 focus:ring-[#D3A84C]/10"
                  placeholder="Nom"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-ink/60">
              Téléphone *
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="done"
                className="mt-1.5 w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none transition focus:border-[#D3A84C] focus:ring-2 focus:ring-[#D3A84C]/10"
                placeholder="+212 6 12 34 56 78"
              />
            </label>

            <details className="rounded-xl border border-ink/10 bg-[#fafaf7]">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-ink/55">
                Ajouter ma date de naissance (facultatif)
              </summary>
              <div className="border-t border-ink/10 px-4 pb-4 pt-3">
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#D3A84C]"
                />
              </div>
            </details>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void join()}
              disabled={!canSubmit || loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173D32] px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Création de votre carte…' : 'Créer ma carte fidélité'}
            </button>

            <p className="text-center text-[10px] leading-4 text-ink/35">
              Inscription gratuite · Votre carte sera disponible immédiatement.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
