import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Gift,
  Save,
  Settings2,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = {
  id: string;
  name: string;
};

type LoyaltySettings = {
  id?: string;
  establishment_id: string;
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

export default function LoyaltySettings() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');
  const [currency, setCurrency] = useState('MAD');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadSettings(establishmentId);
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setEstablishments(data);

      if (data.length > 0) {
        setEstablishmentId(data[0].id);
      }
    }

    setLoading(false);
  }

  async function loadSettings(id: string) {
    setSaved(false);

    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('establishment_id', id)
      .maybeSingle();

    if (!error && data) {
      setPointsPerCurrency(String(data.points_per_currency ?? 1));
      setCurrency(data.currency ?? 'MAD');
      setEnabled(data.enabled ?? true);
    } else {
      setPointsPerCurrency('1');
      setCurrency('MAD');
      setEnabled(true);
    }
  }

  async function saveSettings() {
    if (!establishmentId) return;

    const points = Number(pointsPerCurrency);

    if (!Number.isFinite(points) || points <= 0) {
      alert('Le nombre de points doit être supérieur à 0.');
      return;
    }

    setSaving(true);
    setSaved(false);

    const payload: LoyaltySettings = {
      establishment_id: establishmentId,
      points_per_currency: points,
      currency,
      enabled,
    };

    const { error } = await supabase
      .from('loyalty_settings')
      .upsert(payload, {
        onConflict: 'establishment_id',
      });

    if (error) {
      console.error(error);
      alert(`Impossible d'enregistrer les paramètres : ${error.message}`);
    } else {
      setSaved(true);
    }

    setSaving(false);
  }

  const selectedEstablishment = establishments.find(
    (item) => item.id === establishmentId
  );

  if (loading) {
    return (
      <div className="h-72 animate-pulse rounded-2xl bg-ink/5" />
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Fidélité
        </p>

        <h1 className="mt-2 font-display text-4xl text-forest">
          Programme fidélité
        </h1>

        <p className="mt-2 text-sm text-ink/50">
          Configurez le programme de fidélité de chaque établissement.
        </p>
      </div>

      {/* ESTABLISHMENT */}
      <section className="rounded-2xl border border-ink/5 bg-white p-6 shadow-soft md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5eee9] text-forest">
            <Settings2 size={20} />
          </div>

          <div>
            <h2 className="font-display text-xl text-forest">
              Établissement
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Choisissez l'établissement à configurer.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <select
            value={establishmentId}
            onChange={(e) => setEstablishmentId(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold"
          >
            {establishments.length === 0 && (
              <option value="">Aucun établissement</option>
            )}

            {establishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* PROGRAM ENABLE */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-soft md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5eee9] text-forest">
              <Star size={20} />
            </div>

            <div>
              <h2 className="font-display text-xl text-forest">
                Programme actif
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Activez ou désactivez le programme de fidélité.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative h-7 w-12 rounded-full transition ${
              enabled ? 'bg-forest' : 'bg-ink/20'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                enabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-[#f7f7f3] p-4 text-xs text-ink/55">
          {enabled
            ? 'Le programme est actuellement actif pour cet établissement.'
            : 'Le programme est désactivé. Aucun nouveau point ne pourra être ajouté.'}
        </div>
      </section>

      {/* POINTS */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-soft md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
            <Coins size={20} />
          </div>

          <div>
            <h2 className="font-display text-xl text-forest">
              Attribution des points
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Définissez combien de points gagne le client selon son achat.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-ink/60">
              Devise
            </label>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-gold"
            >
              <option value="MAD">MAD — Dirham marocain</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollar</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-ink/60">
              Points par unité monétaire
            </label>

            <input
              type="number"
              min="0.1"
              step="0.1"
              value={pointsPerCurrency}
              onChange={(e) => setPointsPerCurrency(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* EXAMPLE */}
        <div className="mt-6 rounded-2xl border border-gold/20 bg-[#fdf9ef] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">
            Exemple
          </p>

          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-gold">
              <Coins size={18} />
            </div>

            <p className="text-sm text-ink/65">
              Pour un achat de{' '}
              <strong className="text-forest">100 {currency}</strong>,
              le client reçoit{' '}
              <strong className="text-forest">
                {Number(pointsPerCurrency || 0) * 100} points
              </strong>.
            </p>
          </div>
        </div>
      </section>

      {/* REWARDS PREVIEW */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-soft md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5eee9] text-forest">
            <Gift size={20} />
          </div>

          <div>
            <h2 className="font-display text-xl text-forest">
              Récompenses
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Les récompenses pourront être créées dans cette section.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[#f7f7f3] p-5">
          <p className="text-sm font-medium text-forest">
            Gestion des récompenses
          </p>

          <p className="mt-1 text-xs leading-5 text-ink/45">
            Créez prochainement vos récompenses : réduction, produit offert,
            dessert, soin, cadeau, etc.
          </p>
        </div>
      </section>

      {/* SAVE */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-forest p-6 text-white md:flex-row md:items-center">
        <div>
          <p className="font-medium">
            {selectedEstablishment?.name || 'Votre établissement'}
          </p>

          <p className="mt-1 text-xs text-white/50">
            Les modifications s'appliqueront à cet établissement uniquement.
          </p>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving || !establishmentId}
          className="flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-xs font-semibold text-forest transition hover:bg-[#d5b878] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} />
              Enregistré
            </>
          ) : (
            <>
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
