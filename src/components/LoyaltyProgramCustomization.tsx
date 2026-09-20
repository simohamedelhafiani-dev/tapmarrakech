import { useEffect, useState } from 'react';
import { Check, Gift, Palette, Plus, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Design = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: number | null;
  discount_max_amount: number | null;
};

const templates = [
  { id: 'luxury', name: 'Signature Luxe', description: 'Club premium, vert profond et or', colors: ['#173D32', '#D3A84C', '#F7F7F3'], style: 'luxury' },
  { id: 'minimal', name: 'Pure', description: 'Minimalisme haut de gamme, très épuré', colors: ['#111827', '#64748B', '#FFFFFF'], style: 'minimal' },
  { id: 'elegant', name: 'Maison', description: 'Crème, chaleureux, inspiration boutique', colors: ['#5B4636', '#B89470', '#F6F0E7'], style: 'elegant' },
  { id: 'modern', name: 'Contemporary', description: 'SaaS premium, frais et contemporain', colors: ['#164E63', '#06B6D4', '#ECFEFF'], style: 'modern' },
  { id: 'bold', name: 'Night Club', description: 'Contrasté, spectaculaire, très visuel', colors: ['#3B1D5A', '#E879F9', '#FAF5FF'], style: 'bold' },
  { id: 'classic', name: 'Heritage', description: 'Intemporel, élégant, maison traditionnelle', colors: ['#1F2937', '#C9A227', '#F9FAFB'], style: 'classic' },
] as const;

const defaultDesign: Design = {
  template_id: 'luxury',
  primary_color: '#173D32',
  secondary_color: '#D3A84C',
  background_color: '#F7F7F3',
  text_color: '#173D32',
  button_color: '#173D32',
  border_radius: 24,
};

export default function LoyaltyProgramCustomization({ establishmentId }: { establishmentId: string }) {
  const [design, setDesign] = useState<Design>(defaultDesign);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [saving, setSaving] = useState(false);
  const [showNewReward, setShowNewReward] = useState(false);
  const [rewardName, setRewardName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('500');
  const [rewardType, setRewardType] = useState<'GIFT' | 'DISCOUNT'>('GIFT');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [discountMaxAmount, setDiscountMaxAmount] = useState('');
  const [establishment, setEstablishment] = useState<{ name: string; logo_url: string | null }>({ name: 'Votre établissement', logo_url: null });

  async function load() {
    if (!establishmentId) return;

    const [{ data: designData }, { data: rewardsData }, { data: establishmentData }] = await Promise.all([
      supabase.rpc('get_loyalty_card_config', { p_establishment_id: establishmentId }),
      supabase
        .from('loyalty_rewards')
        .select('id,name,description,points_required,reward_type,discount_percent,discount_max_amount')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('points_required', { ascending: true }),
      supabase
        .from('establishments')
        .select('name,logo_url')
        .eq('id', establishmentId)
        .maybeSingle(),
    ]);

    const row = Array.isArray(designData) ? designData[0] : designData;
    if (row) {
      setDesign({
        template_id: row.template_id ?? defaultDesign.template_id,
        primary_color: row.primary_color ?? defaultDesign.primary_color,
        secondary_color: row.secondary_color ?? defaultDesign.secondary_color,
        background_color: row.background_color ?? defaultDesign.background_color,
        text_color: row.text_color ?? defaultDesign.text_color,
        button_color: row.button_color ?? defaultDesign.button_color,
        border_radius: Number(row.border_radius ?? defaultDesign.border_radius),
      });
    }

    if (rewardsData) setRewards(rewardsData as Reward[]);
    if (establishmentData) {
      setEstablishment({
        name: establishmentData.name || 'Votre établissement',
        logo_url: establishmentData.logo_url || null,
      });
    }
  }

  useEffect(() => {
    void load();
  }, [establishmentId]);

  function applyTemplate(templateId: string) {
    const template = templates.find(item => item.id === templateId);
    if (!template) return;

    setDesign(current => ({
      ...current,
      template_id: template.id,
      primary_color: template.colors[0],
      secondary_color: template.colors[1],
      background_color: template.colors[2],
      text_color: template.colors[0],
      button_color: template.colors[0],
    }));
  }

  async function saveDesign() {
    setSaving(true);
    const { error } = await supabase.rpc('save_loyalty_card_design', {
      p_establishment_id: establishmentId,
      p_template_id: design.template_id,
      p_primary_color: design.primary_color,
      p_secondary_color: design.secondary_color,
      p_background_color: design.background_color,
      p_text_color: design.text_color,
      p_button_color: design.button_color,
      p_border_radius: design.border_radius,
    });
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert('Design de la carte enregistré.');
  }

  async function createReward() {
    const points = Number(rewardPoints);
    const percent = Number(discountPercent);
    const maxAmount = discountMaxAmount.trim() ? Number(discountMaxAmount) : null;

    if (!rewardName.trim() || !Number.isInteger(points) || points <= 0) {
      alert('Saisis un nom et un nombre de points valide.');
      return;
    }

    if (rewardType === 'DISCOUNT' && (!Number.isFinite(percent) || percent <= 0 || percent > 20)) {
      alert('La réduction doit être comprise entre 1% et 20%.');
      return;
    }

    const { error } = await supabase.rpc('create_loyalty_reward', {
      p_establishment_id: establishmentId,
      p_name: rewardName.trim(),
      p_description: rewardDescription.trim() || null,
      p_points_required: points,
      p_reward_type: rewardType,
      p_discount_percent: rewardType === 'DISCOUNT' ? percent : null,
      p_discount_max_amount: rewardType === 'DISCOUNT' ? maxAmount : null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setRewardName('');
    setRewardDescription('');
    setRewardPoints('500');
    setRewardType('GIFT');
    setDiscountPercent('10');
    setDiscountMaxAmount('');
    setShowNewReward(false);
    await load();
  }

  async function removeReward(id: string) {
    if (!window.confirm('Désactiver cette récompense ?')) return;

    const { error } = await supabase
      .from('loyalty_rewards')
      .update({ active: false })
      .eq('id', id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Identité de la carte</p>
            <h2 className="mt-1 font-display text-2xl text-forest">Templates & personnalisation</h2>
            <p className="mt-1 text-xs text-ink/45">Chaque établissement peut avoir sa propre identité visuelle.</p>
          </div>
          <span className="rounded-full border border-ink/10 bg-[#fafaf7] px-3 py-2 text-[10px] font-semibold text-ink/45">
            Aperçu avant validation →
          </span>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/40">Choisir un template</p>
                <p className="mt-1 text-xs text-ink/45">Le visuel à droite se met à jour immédiatement.</p>
              </div>
              <span className="rounded-full bg-[#f7f7f3] px-3 py-1 text-[10px] font-semibold text-ink/45">{templates.length} modèles</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${design.template_id === template.id ? 'border-gold ring-2 ring-gold/20' : 'border-ink/10 hover:border-gold/50'}`}
                >
                  <div
                    className="relative mb-3 h-28 overflow-hidden p-4 shadow-md"
                    style={{ background: template.colors[0], borderRadius: 16 }}
                  >
                    <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-20" style={{ background: template.colors[1] }} />
                    <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full opacity-10" style={{ background: template.colors[1] }} />
                    <div className="relative flex items-start justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {establishment.logo_url ? (
                          <img src={establishment.logo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40" />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full border text-[8px] font-bold" style={{ borderColor: template.colors[1], color: template.colors[2] }}>
                            {establishment.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[8px] font-semibold uppercase tracking-[0.14em]" style={{ color: template.colors[2] }}>{establishment.name}</p>
                          <p className="mt-0.5 text-[7px] uppercase tracking-[0.18em]" style={{ color: template.colors[2], opacity: 0.6 }}>Programme fidélité</p>
                        </div>
                      </div>
                      <Gift size={14} style={{ color: template.colors[1] }} />
                    </div>
                    <div className="relative mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-[7px] uppercase tracking-wider" style={{ color: template.colors[2], opacity: 0.55 }}>Solde</p>
                        <p className="mt-0.5 text-xl font-semibold" style={{ color: template.colors[1] }}>250</p>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(step => (
                          <span key={step} className="h-3 w-3 rounded-full border" style={{ borderColor: template.colors[1], background: step < 3 ? template.colors[1] : 'transparent' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-forest">{template.name}</p>
                  <p className="mt-1 text-[11px] text-ink/45">{template.description}</p>
                  {design.template_id === template.id && (
                    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-gold text-white"><Check size={14} /></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-[#f7f7f3] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-forest">
                  <Sparkles size={14} className="text-gold" /> Aperçu en temps réel
                </p>
                <p className="mt-1 text-xs text-ink/45">Ce que le client verra sur sa carte.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-ink/45 shadow-sm">Non publié</span>
            </div>

            <div className="mt-5">
              <div
                className="relative aspect-[1.62/1] w-full overflow-hidden p-6 text-white shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${design.primary_color}, ${design.primary_color}dd)`,
                  borderRadius: Math.min(design.border_radius, 28),
                }}
              >
                <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-20" style={{ background: design.secondary_color }} />
                <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-10" style={{ background: design.secondary_color }} />
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {establishment.logo_url ? (
                        <img
                          src={establishment.logo_url}
                          alt={establishment.name}
                          className="h-14 w-14 rounded-full object-contain bg-white/95 p-1.5 shadow-sm"
                        />
                      ) : (
                        <div
                          className="grid h-14 w-14 shrink-0 place-items-center rounded-full border text-xs font-bold"
                          style={{ borderColor: design.secondary_color, color: design.secondary_color }}
                        >
                          {establishment.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: design.background_color }}>
                          {establishment.name}
                        </p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.2em]" style={{ color: design.background_color, opacity: 0.6 }}>
                          Programme fidélité
                        </p>
                      </div>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border" style={{ borderColor: design.secondary_color, color: design.secondary_color }}>
                      <Gift size={17} />
                    </div>
                  </div>

                  <div>
                    <p className="font-display text-2xl" style={{ color: design.background_color }}>Votre carte</p>
                    <p className="mt-1 text-[10px]" style={{ color: design.background_color, opacity: 0.62 }}>
                      Cumulez vos points et profitez de vos récompenses.
                    </p>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.18em]" style={{ color: design.background_color, opacity: 0.55 }}>Solde</p>
                      <p className="mt-1 text-3xl font-semibold" style={{ color: design.secondary_color }}>250</p>
                    </div>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map(step => (
                        <span
                          key={step}
                          className="h-4 w-4 rounded-full border"
                          style={{
                            borderColor: design.secondary_color,
                            background: step < 3 ? design.secondary_color : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-ink/5 bg-white p-4">
                <div className="flex items-center gap-3">
                  {establishment.logo_url ? (
                    <img src={establishment.logo_url} alt="" className="h-9 w-9 rounded-full object-contain border border-ink/10 bg-white p-1" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-forest text-[10px] font-bold text-white">
                      {establishment.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-forest">{establishment.name}</p>
                    <p className="mt-0.5 text-[10px] text-ink/40">Logo de l'établissement • aperçu uniquement</p>
                  </div>
                </div>
              </div>

              <button
                onClick={saveDesign}
                disabled={saving}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
              >
                <Check size={15} /> {saving ? 'Validation...' : 'Valider ce design'}
              </button>
              <p className="mt-2 text-center text-[10px] text-ink/40">Le design n'est enregistré qu'après validation.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ['primary_color', 'Principale'],
            ['secondary_color', 'Secondaire'],
            ['background_color', 'Fond'],
            ['text_color', 'Texte'],
            ['button_color', 'Bouton'],
          ] as const).map(([key, label]) => (
            <label key={key} className="rounded-xl border border-ink/10 bg-[#fafaf7] p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink/40">{label}</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={design[key]}
                  onChange={e => setDesign(current => ({ ...current, [key]: e.target.value }))}
                  className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                />
                <input
                  value={design[key]}
                  onChange={e => setDesign(current => ({ ...current, [key]: e.target.value }))}
                  className="min-w-0 w-full bg-transparent text-xs font-medium outline-none"
                />
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-ink/50">Arrondi de la carte</label>
          <input type="range" min="8" max="40" value={design.border_radius} onChange={e => setDesign(current => ({ ...current, border_radius: Number(e.target.value) }))} className="mt-3 w-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Récompenses</p>
            <h2 className="mt-1 font-display text-2xl text-forest">Cadeaux ou réductions</h2>
            <p className="mt-1 text-xs text-ink/45">Le client choisit, obtient un QR temporaire, puis le scanner valide l'utilisation.</p>
          </div>
          <button onClick={() => setShowNewReward(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">
            <Plus size={15} /> Ajouter
          </button>
        </div>

        {rewards.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {rewards.map(reward => (
              <div key={reward.id} className="flex items-center justify-between gap-4 rounded-2xl border border-ink/5 bg-[#fafaf7] p-4">
                <div>
                  <p className="text-sm font-semibold text-forest">{reward.name}</p>
                  <p className="mt-1 text-[11px] text-ink/45">{reward.points_required} points · {reward.reward_type === 'DISCOUNT' ? `-${reward.discount_percent}%${reward.discount_max_amount ? ` · max ${reward.discount_max_amount} MAD` : ''}` : 'cadeau'}</p>
                </div>
                <button onClick={() => removeReward(reward.id)} className="rounded-xl p-2 text-ink/30 hover:bg-red-50 hover:text-red-600" title="Désactiver">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-[#fafaf7] p-5 text-center text-xs text-ink/40">Aucune récompense configurée.</div>
        )}

        {showNewReward && (
          <div className="mt-5 rounded-2xl border border-gold/20 bg-[#fdf9ef] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-forest"><Sparkles size={16} /> Nouvelle récompense</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="Ex. Café offert" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none" />
              <input type="number" min="1" value={rewardPoints} onChange={e => setRewardPoints(e.target.value)} placeholder="Points nécessaires" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none" />
              <select value={rewardType} onChange={e => setRewardType(e.target.value as 'GIFT' | 'DISCOUNT')} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none">
                <option value="GIFT">🎁 Récompense / cadeau</option>
                <option value="DISCOUNT">💸 Réduction</option>
              </select>
              {rewardType === 'DISCOUNT' && (
                <>
                  <select value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none">
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                  </select>
                  <input type="number" min="0" value={discountMaxAmount} onChange={e => setDiscountMaxAmount(e.target.value)} placeholder="Plafond en MAD (optionnel)" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none" />
                </>
              )}
              <input value={rewardDescription} onChange={e => setRewardDescription(e.target.value)} placeholder="Description (optionnelle)" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none md:col-span-2" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={createReward} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Créer</button>
              <button onClick={() => setShowNewReward(false)} className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-ink/50">Annuler</button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gold/15 bg-[#fdf9ef] p-5 text-xs leading-5 text-ink/55">
        <div className="flex items-center gap-2 font-semibold text-forest"><Palette size={15} /> Fonctionnement</div>
        <p className="mt-2">Le client choisit une récompense depuis sa carte. TapMarrakech génère un QR à usage unique valable 2 minutes. L'employé le scanne avec le scanner déjà installé et la base déduit les points de façon atomique.</p>
      </div>
    </section>
  );
}
