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
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [preferredChannel, setPreferredChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH' | 'NONE'>('WHATSAPP');
  const [visitFrequency, setVisitFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'OCCASIONAL' | ''>('');
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const interestOptions = ['Promotions', 'Nouveautés', 'Événements', 'Récompenses', 'Offres anniversaire', 'Menu & nouveautés', 'Bien-être', 'Sport', 'Beauté'];
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
    [loadingContext, firstName, lastName, phone, isGlobalEnrollment, referralCode, establishmentName],
  );

  async function join() {
    if (!canSubmit || loading) return;

    // Legacy RPCs still accept a date for compatibility, but the DB stores only day/month.
    const birthDate = birthDay && birthMonth
      ? `2000-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : null;

    setLoading(true);
    setError('');

    try {
      if (isGlobalEnrollment) {
        const { data, error: rpcError } = await supabase.rpc(
          'register_public_loyalty_customer_for_enrollment_v2',
          {
            p_establishment_id: establishmentId,
            p_first_name: firstName.trim(),
            p_last_name: lastName.trim(),
            p_phone: phone.trim(),
            p_birth_date: birthDate,
            p_email: email.trim() || null,
            p_interests: interests,
            p_marketing_consent: marketingConsent,
            p_notification_consent: notificationConsent,
            p_preferred_channel: notificationConsent ? preferredChannel : 'NONE',
            p_visit_frequency: visitFrequency || null,
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
          p_birth_date: birthDate,
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
    return <Navigate to={`/loyalty/${accessToken}?welcome=1`} replace />;
  }


  if (!referralCode && !establishmentId) {
    return (
      <main className="min-h-screen bg-[#f7f7f3] px-4 py-8">
        <div className="mx-auto max-w-md rounded-[2rem] bg-[#111111] p-7 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e5eee9] text-[#E1C27A]">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-display text-3xl tracking-tight text-[#E1C27A]">Lien d’inscription invalide</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Scannez le QR Code ou la plaque NFC de l’établissement pour rejoindre son programme fidélité.
          </p>
        </div>
      </main>
    );
  }

  if (loadingContext) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050505] px-4">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
          <p className="mt-4 text-sm text-[#E1C27A]/55">Préparation de votre inscription…</p>
        </div>
      </main>
    );
  }

  if (error && isGlobalEnrollment && !establishmentName) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050505] px-4 py-8">
        <div className="w-full max-w-md rounded-[2rem] bg-[#111111] p-7 text-center shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-[#E1C27A]">Inscription indisponible</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">{error}</p>
        </div>
      </main>
    );
  }

  const title = isGlobalEnrollment ? 'Bienvenue chez vous' : 'Rejoignez le programme fidélité';
  const description = isGlobalEnrollment
    ? 'Créez votre carte fidélité' + (establishmentName ? ' de ' + establishmentName : '') + ' en quelques secondes.'
    : 'Vous avez été invité par un client. Créez votre carte fidélité pour recevoir vos avantages.';

  return (
    <main className="min-h-screen bg-[#050505] px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] shadow-luxury">
          <div className="bg-[#111111] px-6 py-7 text-white">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-[#E1C27A]">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  KELYANI · PROGRAMME FIDÉLITÉ
                </p>
                {establishmentName && (
                  <p className="mt-1 truncate text-sm font-semibold text-white">{establishmentName}</p>
                )}
              </div>
            </div>

            <h1 className="mt-6 font-display text-3xl leading-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Vos coordonnées</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-white/55">Prénom *<input value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" autoFocus className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm outline-none focus:border-[#C9A45C]" placeholder="Prénom" /></label>
                <label className="block text-xs font-semibold text-white/55">Nom *<input value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm outline-none focus:border-[#C9A45C]" placeholder="Nom" /></label>
              </div>
            </div>
            <label className="block text-xs font-semibold text-white/55">Téléphone *<input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm outline-none focus:border-[#C9A45C]" placeholder="+212 6 12 34 56 78" /></label>
            <label className="block text-xs font-semibold text-white/55">Email <span className="font-normal text-white/25">(facultatif)</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm outline-none focus:border-[#C9A45C]" placeholder="vous@exemple.com" /></label>
            <div className="grid grid-cols-2 gap-3">
              <div className="block text-xs font-semibold text-white/55">
                Anniversaire <span className="font-normal text-white/25">(facultatif)</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <select value={birthDay} onChange={e => setBirthDay(e.target.value)} aria-label="Jour de naissance" className="w-full rounded-xl border border-white/10 bg-[#242424] px-3 py-3 text-sm capitalize outline-none focus:border-[#C9A45C]">
                    <option value="">Jour</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option>
                  </select>
                  <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} aria-label="Mois de naissance" className="w-full rounded-xl border border-white/10 bg-[#242424] px-3 py-3 text-sm capitalize outline-none focus:border-[#C9A45C]">
                    <option value="">Mois</option><option value="01">janvier</option><option value="02">février</option><option value="03">mars</option><option value="04">avril</option><option value="05">mai</option><option value="06">juin</option><option value="07">juillet</option><option value="08">août</option><option value="09">septembre</option><option value="10">octobre</option><option value="11">novembre</option><option value="12">décembre</option>
                  </select>
                </div>
              </div>
              <label className="block text-xs font-semibold text-white/55">Fréquence de visite<select value={visitFrequency} onChange={e => setVisitFrequency(e.target.value as typeof visitFrequency)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-3 py-3 text-sm outline-none focus:border-[#C9A45C]"><option value="">Je ne sais pas</option><option value="WEEKLY">Chaque semaine</option><option value="MONTHLY">Chaque mois</option><option value="OCCASIONAL">Occasionnellement</option></select></label>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
              <p className="text-xs font-semibold text-white">Ce qui vous intéresse</p><p className="mt-1 text-[10px] leading-4 text-white/35">Choisissez ce que vous souhaitez recevoir. Cela aide l’établissement à vous envoyer des offres plus pertinentes.</p>
              <div className="mt-3 flex flex-wrap gap-2">{interestOptions.map((interest) => { const active = interests.includes(interest); return <button key={interest} type="button" onClick={() => setInterests(current => active ? current.filter(item => item !== interest) : [...current, interest])} className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition ${active ? 'border-[#C9A45C] bg-[#C9A45C]/15 text-[#E1C27A]' : 'border-white/10 bg-[#242424] text-white/45 hover:border-[#C9A45C]/40'}`}>{interest}</button>; })}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
              <p className="text-xs font-semibold text-white">Notifications</p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-[11px] leading-5 text-white/55"><input type="checkbox" checked={notificationConsent} onChange={e => setNotificationConsent(e.target.checked)} className="mt-1 accent-[#C9A45C]" /><span>J’accepte de recevoir des notifications et offres personnalisées.</span></label>
              {notificationConsent && <label className="mt-3 block text-[10px] font-semibold text-white/45">Canal préféré<select value={preferredChannel} onChange={e => setPreferredChannel(e.target.value as typeof preferredChannel)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#242424] px-3 py-2.5 text-xs text-white outline-none focus:border-[#C9A45C]"><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="PUSH">Notifications téléphone</option></select></label>}
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-[11px] leading-5 text-white/55"><input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-1 accent-[#C9A45C]" /><span>J’accepte les communications commerciales et offres promotionnelles.</span></label>
            </div>
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</div>}
            <button type="button" onClick={() => void join()} disabled={!canSubmit || loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] px-5 py-4 text-sm font-bold text-[#050505] shadow-lg transition hover:bg-[#E1C27A] disabled:cursor-not-allowed disabled:opacity-40">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Création de votre carte…' : 'Créer ma carte fidélité'}</button>
            <p className="text-center text-[10px] leading-4 text-white/25">Les préférences sont facultatives et servent à personnaliser les communications de l’établissement.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
