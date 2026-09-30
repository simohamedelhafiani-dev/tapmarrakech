import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Edit3,
  Gift,
  Loader2,
  Palette,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  CreateLoyaltyRewardInput,
  LoyaltyCardDesign,
  LoyaltyCustomer,
  LoyaltyReward,
  LoyaltySettings,
  LoyaltySettingsPatch,
  UpdateLoyaltyRewardInput,
} from '@/hooks/useLoyaltyManager';

type Props = {
  activeTab: 'structure' | 'design';
  settings: LoyaltySettings;
  rewards: LoyaltyReward[];
  customers: LoyaltyCustomer[];
  draftDesign: LoyaltyCardDesign | null;
  hasDesignChanges: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  onUpdateSettings: (patch: LoyaltySettingsPatch) => void;
  onSaveSettings: () => Promise<unknown>;
  onCreateReward: (input: CreateLoyaltyRewardInput) => Promise<unknown>;
  onUpdateReward: (rewardId: string, input: UpdateLoyaltyRewardInput) => Promise<unknown>;
  onDeleteReward: (rewardId: string) => Promise<unknown>;
  onUpdateDraftDesign: (patch: Partial<Omit<LoyaltyCardDesign, 'published'>>) => void;
  onResetDraftDesign: () => void;
  onPublishDesign: () => Promise<unknown>;
};

type RewardForm = {
  name: string;
  description: string;
  points_required: string;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: string;
  discount_max_amount: string;
  active: boolean;
};

const emptyReward: RewardForm = {
  name: '',
  description: '',
  points_required: '100',
  reward_type: 'GIFT',
  discount_percent: '10',
  discount_max_amount: '',
  active: true,
};

const templates = [
  { id: 'restaurant-elegant', name: 'Élégance', primary: '#173D32', secondary: '#D3A84C', background: '#F7F7F3', text: '#FFFFFF', button: '#173D32', radius: 28 },
  { id: 'restaurant-gastronomic', name: 'Gastronomique', primary: '#24150E', secondary: '#D7A75A', background: '#F4ECE4', text: '#FFFFFF', button: '#24150E', radius: 24 },
  { id: 'restaurant-modern', name: 'Moderne', primary: '#F0E6D8', secondary: '#173D32', background: '#F7F7F3', text: '#173D32', button: '#173D32', radius: 30 },
  { id: 'restaurant-minimal', name: 'Minimaliste', primary: '#101112', secondary: '#D3A84C', background: '#F7F7F3', text: '#FFFFFF', button: '#101112', radius: 22 },
  { id: 'restaurant-premium', name: 'Premium', primary: '#EEE5D6', secondary: '#B88738', background: '#FBF8F1', text: '#1D211E', button: '#173D32', radius: 32 },
] as const;

export default function LoyaltyConfigurator({
  activeTab,
  settings,
  rewards,
  customers,
  draftDesign,
  hasDesignChanges,
  saving,
  publishing,
  error,
  onUpdateSettings,
  onSaveSettings,
  onCreateReward,
  onUpdateReward,
  onDeleteReward,
  onUpdateDraftDesign,
  onResetDraftDesign,
  onPublishDesign,
}: Props) {
  if (activeTab === 'design') {
    return (
      <DesignSection
        design={draftDesign}
        hasChanges={hasDesignChanges}
        saving={saving}
        publishing={publishing}
        error={error}
        onUpdate={onUpdateDraftDesign}
        onReset={onResetDraftDesign}
        onPublish={onPublishDesign}
      />
    );
  }

  return (
    <StructureSection
      settings={settings}
      rewards={rewards}
      customers={customers}
      saving={saving}
      error={error}
      onUpdateSettings={onUpdateSettings}
      onSaveSettings={onSaveSettings}
      onCreateReward={onCreateReward}
      onUpdateReward={onUpdateReward}
      onDeleteReward={onDeleteReward}
    />
  );
}

function StructureSection({
  settings,
  rewards,
  customers,
  saving,
  error,
  onUpdateSettings,
  onSaveSettings,
  onCreateReward,
  onUpdateReward,
  onDeleteReward,
}: {
  settings: LoyaltySettings;
  rewards: LoyaltyReward[];
  customers: LoyaltyCustomer[];
  saving: boolean;
  error: string | null;
  onUpdateSettings: Props['onUpdateSettings'];
  onSaveSettings: Props['onSaveSettings'];
  onCreateReward: Props['onCreateReward'];
  onUpdateReward: Props['onUpdateReward'];
  onDeleteReward: Props['onDeleteReward'];
}) {
  const [rewardForm, setRewardForm] = useState<RewardForm>(emptyReward);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(customer =>
      [customer.first_name, customer.last_name, customer.phone, customer.loyalty_number]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [customers, customerSearch]);

  const submitReward = async () => {
    const input: CreateLoyaltyRewardInput = {
      name: rewardForm.name.trim(),
      description: rewardForm.description.trim() || null,
      points_required: Number(rewardForm.points_required),
      reward_type: rewardForm.reward_type,
      discount_percent: rewardForm.reward_type === 'DISCOUNT' ? Number(rewardForm.discount_percent) : null,
      discount_max_amount:
        rewardForm.reward_type === 'DISCOUNT' && rewardForm.discount_max_amount
          ? Number(rewardForm.discount_max_amount)
          : null,
    };

    try {
      if (editingId) {
        await onUpdateReward(editingId, { ...input, active: rewardForm.active });
      } else {
        await onCreateReward(input);
      }
      setRewardForm(emptyReward);
      setEditingId(null);
    } catch {
      // The hook exposes the error to the studio; keep the form intact for correction.
    }
  };

  const editReward = (reward: LoyaltyReward) => {
    setEditingId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? '',
      points_required: String(reward.points_required),
      reward_type: reward.reward_type === 'DISCOUNT' ? 'DISCOUNT' : 'GIFT',
      discount_percent: String(reward.discount_percent ?? 10),
      discount_max_amount: reward.discount_max_amount == null ? '' : String(reward.discount_max_amount),
      active: reward.active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRewardForm(emptyReward);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Programme</p>
            <h3 className="mt-1 text-base font-semibold text-forest">Règle d’accumulation</h3>
            <p className="mt-1 text-xs leading-5 text-ink/45">
              Les points réellement attribués restent calculés par le moteur serveur.
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ead3] text-gold">
            <Palette size={17} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="block">
            <span className="text-[11px] font-semibold text-ink/50">Points par MAD</span>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-ink/10 bg-[#fafaf8] px-3 py-2.5 focus-within:border-gold">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={settings.points_per_currency}
                onChange={event => onUpdateSettings({ points_per_currency: Math.max(0.01, Number(event.target.value) || 0.01) })}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-forest outline-none"
              />
              <span className="text-[10px] font-semibold text-ink/35">{settings.currency}</span>
            </div>
          </label>

          <div className="rounded-xl bg-[#f7f7f3] p-3">
            <p className="text-[10px] text-ink/40">Exemple</p>
            <p className="mt-1 text-sm font-semibold text-forest">
              250 MAD → {Math.floor(250 * settings.points_per_currency)} pts
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-[#fdf9ef] px-3 py-2.5">
          <span className="text-[11px] text-ink/50">Programme actif</span>
          <button
            type="button"
            onClick={() => onUpdateSettings({ enabled: !settings.enabled })}
            className={`relative h-6 w-11 rounded-full transition ${settings.enabled ? 'bg-forest' : 'bg-ink/15'}`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${settings.enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void onSaveSettings()}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer le programme
        </button>
      </section>

      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Récompenses</p>
            <h3 className="mt-1 text-base font-semibold text-forest">Catalogue de récompenses</h3>
          </div>
          <div className="rounded-full bg-[#f4ead3] px-3 py-1.5 text-[10px] font-bold text-gold">
            {rewards.filter(reward => reward.active).length} actives
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {rewards.map(reward => (
            <div key={reward.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${reward.active ? 'border-ink/8 bg-[#fafaf8]' : 'border-ink/5 bg-ink/[0.02] opacity-60'}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                <Gift size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-forest">{reward.name}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-ink/40 ring-1 ring-ink/5">
                    {reward.points_required} pts
                  </span>
                  {reward.reward_type === 'DISCOUNT' && (
                    <span className="rounded-full bg-forest/5 px-2 py-1 text-[9px] font-semibold text-forest">
                      -{reward.discount_percent ?? 0}%
                    </span>
                  )}
                </div>
                {reward.description && <p className="mt-1 truncate text-[11px] text-ink/40">{reward.description}</p>}
              </div>
              <button type="button" onClick={() => editReward(reward)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/35 hover:bg-white hover:text-forest" title="Modifier">
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(reward.active ? 'Désactiver cette récompense ?' : 'Réactiver cette récompense ?')) {
                    void onDeleteReward(reward.id);
                  }
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink/35 hover:bg-red-50 hover:text-red-500"
                title="Désactiver"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {!rewards.length && (
            <div className="rounded-2xl border border-dashed border-ink/10 p-8 text-center">
              <Gift className="mx-auto text-ink/20" size={24} />
              <p className="mt-2 text-sm font-semibold text-forest">Aucune récompense</p>
              <p className="mt-1 text-xs text-ink/40">Créez votre première récompense ci-dessous.</p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-[#f7f7f3] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
              {editingId ? 'Modifier la récompense' : 'Nouvelle récompense'}
            </p>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-[10px] font-semibold text-ink/40 hover:text-forest">
                Annuler
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nom" value={rewardForm.name} onChange={value => setRewardForm(current => ({ ...current, name: value }))} />
            <NumberField label="Points requis" value={rewardForm.points_required} onChange={value => setRewardForm(current => ({ ...current, points_required: value }))} />
          </div>
          <label className="mt-3 block text-[10px] font-semibold text-ink/45">
            Description
            <textarea value={rewardForm.description} onChange={event => setRewardForm(current => ({ ...current, description: event.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-gold" />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-[10px] font-semibold text-ink/45">
              Type
              <select value={rewardForm.reward_type} onChange={event => setRewardForm(current => ({ ...current, reward_type: event.target.value as RewardForm['reward_type'] }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs text-ink outline-none focus:border-gold">
                <option value="GIFT">Cadeau</option>
                <option value="DISCOUNT">Réduction</option>
              </select>
            </label>
            {rewardForm.reward_type === 'DISCOUNT' ? (
              <>
                <NumberField label="Réduction %" value={rewardForm.discount_percent} onChange={value => setRewardForm(current => ({ ...current, discount_percent: value }))} />
                <NumberField label="Plafond MAD (optionnel)" value={rewardForm.discount_max_amount} onChange={value => setRewardForm(current => ({ ...current, discount_max_amount: value }))} />
              </>
            ) : (
              <div className="sm:col-span-2 rounded-xl border border-ink/5 bg-white px-3 py-2.5 text-[11px] leading-5 text-ink/40">
                Le cadeau consomme les points lors de son utilisation. Le calcul monétaire de la réduction reste géré par le moteur serveur.
              </div>
            )}
          </div>

          {editingId && (
            <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-ink/50">
              <input type="checkbox" checked={rewardForm.active} onChange={event => setRewardForm(current => ({ ...current, active: event.target.checked }))} className="rounded border-ink/20 text-forest focus:ring-forest" />
              Récompense active
            </label>
          )}

          <button
            type="button"
            onClick={() => void submitReward()}
            disabled={saving || !rewardForm.name.trim() || Number(rewardForm.points_required) <= 0}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Check size={14} /> : <Plus size={14} />}
            {editingId ? 'Enregistrer la récompense' : 'Ajouter la récompense'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Clients</p>
            <h3 className="mt-1 text-base font-semibold text-forest">Membres du programme</h3>
          </div>
          <span className="rounded-full bg-[#f7f7f3] px-3 py-1.5 text-[10px] font-semibold text-ink/45">{customers.length} clients</span>
        </div>

        <input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Rechercher un client…" className="mt-4 w-full rounded-xl border border-ink/10 bg-[#fafaf8] px-3 py-2.5 text-xs outline-none focus:border-gold" />

        <div className="mt-3 max-h-[280px] overflow-auto rounded-2xl border border-ink/6">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="flex items-center gap-3 border-b border-ink/5 px-3 py-3 last:border-b-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-bold text-white">
                {(customer.first_name || customer.phone || 'C').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-forest">{[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client'}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink/40">{customer.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gold">{customer.points_balance} pts</p>
                <p className="mt-0.5 text-[9px] text-ink/35">{customer.visit_count} visite{customer.visit_count > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
          {!filteredCustomers.length && <div className="p-8 text-center text-xs text-ink/35">Aucun client trouvé.</div>}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
          <X size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function DesignSection({
  design,
  hasChanges,
  saving,
  publishing,
  error,
  onUpdate,
  onReset,
  onPublish,
}: {
  design: LoyaltyCardDesign | null;
  hasChanges: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  onUpdate: Props['onUpdateDraftDesign'];
  onReset: Props['onResetDraftDesign'];
  onPublish: Props['onPublishDesign'];
}) {
  const current = design ?? {
    template_id: 'restaurant-elegant',
    primary_color: '#173D32',
    secondary_color: '#D3A84C',
    background_color: '#F7F7F3',
    text_color: '#FFFFFF',
    button_color: '#173D32',
    border_radius: 28,
    design_config: {},
    published: false,
  };

  const applyTemplate = (template: typeof templates[number]) => {
    onUpdate({
      template_id: template.id,
      primary_color: template.primary,
      secondary_color: template.secondary,
      background_color: template.background,
      text_color: template.text,
      button_color: template.button,
      border_radius: template.radius,
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Design</p>
            <h3 className="mt-1 text-base font-semibold text-forest">Apparence de la carte</h3>
            <p className="mt-1 text-xs leading-5 text-ink/45">Chaque changement reste en brouillon et se reflète immédiatement dans le miroir.</p>
          </div>
          {hasChanges && <span className="rounded-full bg-[#fdf9ef] px-2.5 py-1 text-[9px] font-bold text-gold ring-1 ring-gold/20">Brouillon modifié</span>}
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Modèles</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map(template => {
              const active = current.template_id === template.id;
              return (
                <button key={template.id} type="button" onClick={() => applyTemplate(template)} className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${active ? 'border-forest ring-2 ring-forest/10' : 'border-ink/8'}`}>
                  <div className="relative h-20 p-3" style={{ background: template.primary }}>
                    <div className="absolute right-2 top-2 h-5 w-5 rounded-full" style={{ background: template.secondary }} />
                    <div className="relative text-[9px] font-bold uppercase tracking-widest" style={{ color: template.text }}>
                      {template.name}
                    </div>
                    <div className="relative mt-4 h-1.5 w-2/3 rounded-full" style={{ background: template.secondary, opacity: 0.85 }} />
                  </div>
                  <div className="flex items-center justify-between bg-white px-3 py-2">
                    <span className="text-[10px] font-semibold text-forest">{template.name}</span>
                    {active && <Check size={13} className="text-gold" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-gold" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Couleurs</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ['Primaire', 'primary_color'],
            ['Secondaire', 'secondary_color'],
            ['Fond', 'background_color'],
            ['Texte', 'text_color'],
            ['Bouton', 'button_color'],
          ] as const).map(([label, key]) => (
            <label key={key} className="block text-[10px] font-semibold text-ink/45">
              {label}
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-ink/10 bg-[#fafaf8] p-2">
                <input type="color" value={current[key]} onChange={event => onUpdate({ [key]: event.target.value })} className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <input value={current[key]} onChange={event => onUpdate({ [key]: event.target.value })} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-forest outline-none" />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-ink/8 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Arrondis</p>
            <p className="mt-1 text-xs text-ink/45">Rayon des angles de la carte</p>
          </div>
          <span className="rounded-full bg-[#f7f7f3] px-3 py-1.5 text-[10px] font-bold text-forest">{current.border_radius}px</span>
        </div>
        <input type="range" min="8" max="40" value={current.border_radius} onChange={event => onUpdate({ border_radius: Number(event.target.value) })} className="mt-4 w-full accent-[#173D32]" />
        <div className="mt-1 flex justify-between text-[9px] text-ink/30"><span>8px</span><span>40px</span></div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</div>
      )}

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-ink/8 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-forest">{hasChanges ? 'Modifications non publiées' : 'Design synchronisé'}</p>
          <p className="mt-0.5 truncate text-[10px] text-ink/40">
            {hasChanges ? 'Le miroir affiche déjà votre brouillon.' : 'La version affichée correspond à la version publiée.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onReset} disabled={!hasChanges || publishing} className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 px-3 py-2.5 text-[10px] font-semibold text-ink/55 disabled:cursor-not-allowed disabled:opacity-40">
            <X size={13} /> Réinitialiser
          </button>
          <button type="button" onClick={() => void onPublish()} disabled={!hasChanges || publishing || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {publishing ? 'Publication…' : 'Publier le design'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-semibold text-ink/45">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs font-normal text-ink outline-none focus:border-gold" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-semibold text-ink/45">
      {label}
      <input type="number" min="1" value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs font-normal text-ink outline-none focus:border-gold" />
    </label>
  );
}
