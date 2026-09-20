import { useEffect, useState } from 'react';
import { Check, Palette, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
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
  { id: 'luxury', name: 'Luxury', description: 'Sombre, premium, doré', colors: ['#173D32', '#D3A84C', '#F7F7F3'] },
  { id: 'minimal', name: 'Minimal', description: 'Clair, propre, discret', colors: ['#111827', '#64748B', '#FFFFFF'] },
  { id: 'elegant', name: 'Elegant', description: 'Crème, chaleureux, chic', colors: ['#5B4636', '#B89470', '#F6F0E7'] },
  { id: 'modern', name: 'Modern', description: 'Frais, contemporain', colors: ['#164E63', '#06B6D4', '#ECFEFF'] },
  { id: 'bold', name: 'Bold', description: 'Contrasté, énergique', colors: ['#3B1D5A', '#E879F9', '#FAF5FF'] },
  { id: 'classic', name: 'Classic', description: 'Sobre, intemporel', colors: ['#1F2937', '#C9A227', '#F9FAFB'] },
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

  async function load() {
    if (!establishmentId) return;

    const [{ data: designData }, { data: rewardsData }] = await Promise.all([
      supabase.rpc('get_loyalty_card_config', { p_establishment_id: establishmentId }),
      supabase
        .from('loyalty_rewards')
        .select('id,name,description,points_required,reward_type,discount_percent,discount_max_amount')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('points_required', { ascending: true }),
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
          <button onClick={saveDesign} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${design.template_id === template.id ? 'border-gold ring-2 ring-gold/20' : 'border-ink/10 hover:border-gold/50'}`}
            >
              <div className="mb-4 h-20 rounded-xl p-3" style={{ background: template.colors[0] }}>
                <div className="flex justify-between">
                  <span className="h-3 w-12 rounded-full" style={{ background: template.colors[1] }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: template.colors[2] }} />
                </div>
                <div className="mt-7 h-2 w-20 rounded-full" style={{ background: template.colors[1] }} />
              </div>
              <p className="text-sm font-semibold text-forest">{template.name}</p>
              <p className="mt-1 text-[11px] text-ink/45">{template.description}</p>
              {design.template_id === template.id && (
                <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-gold text-white"><Check size={14} /></span>
              )}
            </button>
          ))}
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
