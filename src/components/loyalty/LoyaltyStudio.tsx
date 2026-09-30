import { useState } from 'react';
import { Eye, Settings2, Palette, Users, Gift, Sparkles } from 'lucide-react';
import { useLoyaltyManager } from '@/hooks/useLoyaltyManager';
import LoyaltyConfigurator from '@/components/loyalty/LoyaltyConfigurator';
import LoyaltyPreview from '@/components/loyalty/LoyaltyPreview';

type Props = {
  establishmentId: string;
};

type Tab = 'structure' | 'design';

export default function LoyaltyStudio({ establishmentId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('structure');

  const loyalty = useLoyaltyManager(establishmentId);

  if (loyalty.loading && !loyalty.draftDesign) {
    return (
      <section className="grid min-h-[620px] place-items-center rounded-[28px] bg-white p-8 shadow-soft ring-1 ring-ink/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4ead3] text-gold">
            <Sparkles size={20} />
          </div>
          <p className="text-sm font-semibold text-forest">Chargement du Loyalty Studio…</p>
          <p className="text-xs text-ink/40">Préparation du programme et de son aperçu.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-ink/5">
      <header className="border-b border-ink/6 px-4 py-5 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
              Fidélité
            </p>
            <h2 className="mt-1 font-display text-3xl text-forest">Loyalty Studio</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/45">
              Configurez le programme, personnalisez la carte et contrôlez immédiatement le rendu côté client.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-[#f7f7f3] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('structure')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'structure'
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-ink/45 hover:text-forest'
              }`}
            >
              <Settings2 size={15} />
              <span>Structure</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('design')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'design'
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-ink/45 hover:text-forest'
              }`}
            >
              <Palette size={15} />
              <span>Design</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="min-w-0 border-b border-ink/6 p-4 md:p-6 xl:border-b-0 xl:border-r">
          <LoyaltyConfigurator
            activeTab={activeTab}
            settings={loyalty.settings}
            rewards={loyalty.rewards}
            customers={loyalty.customers}
            draftDesign={loyalty.draftDesign}
            hasDesignChanges={loyalty.hasDesignChanges}
            saving={loyalty.saving}
            publishing={loyalty.publishing}
            error={loyalty.error}
            onUpdateSettings={loyalty.updateSettings}
            onSaveSettings={loyalty.saveSettings}
            onCreateReward={loyalty.createReward}
            onUpdateReward={loyalty.updateReward}
            onDeleteReward={loyalty.deleteReward}
            onUpdateDraftDesign={loyalty.updateDraftDesign}
            onResetDraftDesign={loyalty.resetDraftDesign}
            onPublishDesign={loyalty.publishDesign}
          />
        </div>

        <aside className="min-w-0 bg-[#f7f7f3] p-4 md:p-6 xl:sticky xl:top-0 xl:h-fit xl:self-start">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                Miroir live
              </p>
              <p className="mt-1 text-sm font-semibold text-forest">Aperçu côté client</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-forest shadow-sm ring-1 ring-ink/5">
              <Eye size={17} />
            </div>
          </div>

          <LoyaltyPreview
            settings={loyalty.settings}
            rewards={loyalty.rewards}
            customers={loyalty.customers}
            design={loyalty.draftDesign}
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/5">
              <div className="flex items-center gap-2 text-ink/40">
                <Users size={14} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Clients</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-forest">{loyalty.customers.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/5">
              <div className="flex items-center gap-2 text-ink/40">
                <Gift size={14} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Récompenses</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-forest">
                {loyalty.rewards.filter(reward => reward.active).length}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
