import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Gift,
  Pencil,
  Plus,
  Save,
  Settings2,
  Star,
  Trash2,
  X,
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

type LoyaltyReward = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function LoyaltySettings() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');

  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');
  const [currency, setCurrency] = useState('MAD');
  const [enabled, setEnabled] = useState(true);

  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  const [rewardName, setRewardName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardCost, setRewardCost] = useState('');

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadSettings(establishmentId);
      loadRewards(establishmentId);
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase.rpc('get_my_establishments');

    if (!error && data) {
      const establishmentsData = (data ?? []).map(
        (establishment: { id: string; name: string }) => ({
          id: establishment.id,
          name: establishment.name,
        })
      );

      setEstablishments(establishmentsData);

      if (establishmentsData.length > 0) {
        setEstablishmentId(establishmentsData[0].id);
      } else {
        setEstablishmentId('');
      }
    } else {
      console.error('Erreur chargement établissements:', error);
      setEstablishments([]);
      setEstablishmentId('');
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

  async function loadRewards(id: string) {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('establishment_id', id)
      .order('points_required', { ascending: true });

    if (!error) {
      setRewards((data as LoyaltyReward[]) ?? []);
    } else {
      console.error('Erreur chargement récompenses:', error);
      setRewards([]);
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
      .upsert(payload, { onConflict: 'establishment_id' });

    if (error) {
      console.error(error);
      alert(
        `Impossible d'enregistrer les paramètres : ${error.message}`
      );
    } else {
      setSaved(true);
    }

    setSaving(false);
  }

  function openNewReward() {
    setEditingRewardId(null);
    setRewardName('');
    setRewardDescription('');
    setRewardPoints('');
    setShowRewardForm(true);
  }

  function openEditReward(reward: LoyaltyReward) {
    setEditingRewardId(reward.id);
    setRewardName(reward.name);
    setRewardDescription(reward.description ?? '');
    setRewardPoints(String(reward.points_required));
    setShowRewardForm(true);
  }

  function closeRewardForm() {
    if (savingReward) return;

    setShowRewardForm(false);
    setEditingRewardId(null);
    setRewardName('');
    setRewardDescription('');
    setRewardPoints('');
    setRewardCost('');
  }

  async function saveReward() {
    if (!establishmentId) return;

    const name = rewardName.trim();
    const points = Number(rewardPoints);
    const cost = Number(rewardCost);

    if (!name) {
      alert('Veuillez saisir le nom de la récompense.');
      return;
    }

    if (!Number.isInteger(points) || points <= 0) {
      alert('Le nombre de points doit être un nombre entier supérieur à 0.');
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      alert('Le coût réel doit être un montant supérieur ou égal à 0.');
      return;
    }

    setSavingReward(true);

    const payload = {
      establishment_id: establishmentId,
      name,
      description: rewardDescription.trim() || null,
      points_required: points,
      cost_mad: cost,
      active: true,
    };

    let error;

    if (editingRewardId) {
      const result = await supabase
        .from('loyalty_rewards')
        .update({
          name: payload.name,
          description: payload.description,
          points_required: payload.points_required,
          cost_mad: payload.cost_mad,
        })
        .eq('id', editingRewardId)
        .eq('establishment_id', establishmentId);

      error = result.error;
    } else {
      const result = await supabase
        .from('loyalty_rewards')
        .insert(payload);

      error = result.error;
    }

    if (error) {
      console.error(error);
      alert(
        `Impossible d'enregistrer la récompense : ${error.message}`
      );
      setSavingReward(false);
      return;
    }

    await loadRewards(establishmentId);

    closeRewardForm();
    setSavingReward(false);
  }

  async function toggleReward(reward: LoyaltyReward) {
    const { error } = await supabase
      .from('loyalty_rewards')
      .update({
        active: !reward.active,
      })
      .eq('id', reward.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(
        `Impossible de modifier la récompense : ${error.message}`
      );
      return;
    }

    await loadRewards(establishmentId);
  }

  async function deleteReward(reward: LoyaltyReward) {
    const confirmed = window.confirm(
      `Supprimer la récompense "${reward.name}" ?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('loyalty_rewards')
      .delete()
      .eq('id', reward.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(
        `Impossible de supprimer la récompense : ${error.message}`
      );
      return;
    }

    await loadRewards(establishmentId);
  }

  const selectedEstablishment = establishments.find(
    item => item.id === establishmentId
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

      {/* ÉTABLISSEMENT */}
      {establishments.length > 1 && (
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
            onChange={e => setEstablishmentId(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold"
          >
            {establishments.length === 0 && (
              <option value="">Aucun établissement</option>
            )}

            {establishments.map(establishment => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
        </section>
      )}

      {/* PROGRAMME ACTIF */}
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
            ? "Le programme est actuellement actif pour cet établissement."
            : "Le programme est désactivé. Aucun nouveau point ne pourra être ajouté."}
        </div>
      </section>

      {/* ATTRIBUTION DES POINTS */}
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
              onChange={e => setCurrency(e.target.value)}
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
              onChange={e => setPointsPerCurrency(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
        </div>

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
              <strong className="text-forest">
                100 {currency}
              </strong>
              , le client reçoit{' '}
              <strong className="text-forest">
                {Number(pointsPerCurrency || 0) * 100} points
              </strong>
              .
            </p>
          </div>
        </div>
      </section>

      {/* RÉCOMPENSES */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-soft md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5eee9] text-forest">
              <Gift size={20} />
            </div>

            <div>
              <h2 className="font-display text-xl text-forest">
                Récompenses
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Créez les récompenses que vos clients pourront obtenir
                avec leurs points.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewReward}
            disabled={!establishmentId}
            className="flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} />
            Nouvelle récompense
          </button>
        </div>

        {rewards.length === 0 ? (
          <div className="mt-6 rounded-xl bg-[#f7f7f3] p-6 text-center">
            <Gift
              size={28}
              className="mx-auto text-ink/20"
            />

            <p className="mt-3 text-sm font-medium text-forest">
              Aucune récompense
            </p>

            <p className="mt-1 text-xs text-ink/45">
              Créez votre première récompense pour commencer.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {rewards.map(reward => (
              <div
                key={reward.id}
                className="rounded-2xl border border-ink/5 bg-[#fafaf7] p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                      <Gift size={19} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-forest">
                          {reward.name}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            reward.active
                              ? 'bg-[#e5eee9] text-forest'
                              : 'bg-ink/10 text-ink/40'
                          }`}
                        >
                          {reward.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      {reward.description && (
                        <p className="mt-1 text-xs text-ink/45">
                          {reward.description}
                        </p>
                      )}

                      <p className="mt-2 text-sm font-semibold text-gold">
                        ⭐ {reward.points_required} points
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleReward(reward)}
                      className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-[11px] font-medium text-ink/60 hover:bg-ink/5"
                    >
                      {reward.active ? 'Désactiver' : 'Activer'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditReward(reward)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-ink/10 bg-white text-ink/50 hover:bg-ink/5"
                      title="Modifier"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteReward(reward)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BOUTON ENREGISTRER */}
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

      {/* MODAL RÉCOMPENSE */}
      {showRewardForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-forest">
                  {editingRewardId
                    ? 'Modifier la récompense'
                    : 'Nouvelle récompense'}
                </h2>

                <p className="mt-1 text-xs text-ink/45">
                  Définissez ce que le client peut obtenir avec ses points.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRewardForm}
                disabled={savingReward}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f7f7f3] text-ink/50"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-ink/60">
                  Nom de la récompense *
                </label>

                <input
                  value={rewardName}
                  onChange={e => setRewardName(e.target.value)}
                  placeholder="Dessert offert"
                  className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Description
                </label>

                <textarea
                  value={rewardDescription}
                  onChange={e => setRewardDescription(e.target.value)}
                  placeholder="Un dessert au choix offert."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Coût réel pour l'établissement *
                </label>

                <div className="relative mt-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rewardCost}
                    onChange={e => setRewardCost(e.target.value)}
                    placeholder="20"
                    className="w-full rounded-xl border border-ink/10 px-4 py-3 pr-16 text-sm outline-none focus:border-gold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gold">
                    DH
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-ink/40">
                  Coût estimé réellement supporté par l'établissement quand cette récompense est utilisée.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Points nécessaires *
                </label>

                <div className="relative mt-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={rewardPoints}
                    onChange={e => setRewardPoints(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-xl border border-ink/10 px-4 py-3 pr-20 text-sm outline-none focus:border-gold"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gold">
                    points
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[#f7f7f3] p-4">
                <p className="text-xs text-ink/45">
                  Exemple
                </p>

                <p className="mt-1 text-sm font-medium text-forest">
                  {rewardName.trim() || 'Votre récompense'}
                </p>

                <p className="mt-1 text-xs text-gold">
                  ⭐ {Number(rewardPoints) || 0} points
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  Coût : {Number(rewardCost) || 0} DH
                </p>
              </div>

              <button
                type="button"
                onClick={saveReward}
                disabled={
                  savingReward ||
                  !rewardName.trim() ||
                  Number(rewardPoints) <= 0 ||
                  Number(rewardCost) < 0 ||
                  !Number.isFinite(Number(rewardCost))
                }
                className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingReward
                  ? 'Enregistrement...'
                  : editingRewardId
                    ? 'Enregistrer les modifications'
                    : 'Créer la récompense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
