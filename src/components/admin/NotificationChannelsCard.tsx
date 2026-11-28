import { useEffect, useState } from 'react';
import { Apple, Bell, Lock, Smartphone, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationChannels = {
  kelyani_card: boolean;
  google_wallet: boolean;
  apple_wallet: boolean;
  wallet_included: boolean;
  plan_name: string | null;
};

const DEFAULT_CHANNELS: NotificationChannels = { kelyani_card: true, google_wallet: false, apple_wallet: false, wallet_included: false, plan_name: null };

/** Loads the establishment's notification channels (KELYANI card, Google Wallet, Apple Wallet). */
export function useNotificationChannels(establishmentId: string) {
  const [channels, setChannels] = useState<NotificationChannels>(DEFAULT_CHANNELS);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_loyalty_notification_channels', { p_establishment_id: establishmentId });
    if (!error && data) setChannels({ ...DEFAULT_CHANNELS, ...(data as Partial<NotificationChannels>) });
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [establishmentId]);
  return { channels, setChannels, loading, reload };
}

type Status = { label: string; tone: 'on' | 'off' | 'locked' | 'soon' };

export default function NotificationChannelsCard({ establishmentId, state }: { establishmentId: string; state: ReturnType<typeof useNotificationChannels> }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { channels, setChannels, loading } = state;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (next: Pick<NotificationChannels, 'kelyani_card' | 'google_wallet' | 'apple_wallet'>) => {
    setSaving(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('set_loyalty_notification_channels', {
      p_establishment_id: establishmentId,
      p_kelyani_card: next.kelyani_card,
      p_google_wallet: next.google_wallet,
      p_apple_wallet: next.apple_wallet,
    });
    if (rpcError) setError(rpcError.message);
    else if (data) setChannels(current => ({ ...current, ...(data as Partial<NotificationChannels>) }));
    setSaving(false);
  };

  const walletLocked = !channels.wallet_included;
  const rows: { id: 'kelyani_card' | 'google_wallet' | 'apple_wallet'; title: string; detail: string; icon: typeof Bell; status: Status; canToggle: boolean }[] = [
    {
      id: 'kelyani_card',
      title: 'Carte KELYANI',
      detail: 'Cloche sur la carte + notification sur l’écran du téléphone (si le client l’a autorisé). Tous les packs.',
      icon: Smartphone,
      status: { label: 'Toujours actif', tone: 'on' },
      canToggle: false,
    },
    {
      id: 'google_wallet',
      title: 'Google Wallet',
      detail: 'Message affiché sur la carte Google Wallet du client, avec notification Android.',
      icon: Wallet,
      status: walletLocked ? { label: 'Pack Enterprise', tone: 'locked' } : channels.google_wallet ? { label: 'Actif', tone: 'on' } : { label: 'Désactivé', tone: 'off' },
      canToggle: !walletLocked,
    },
    {
      id: 'apple_wallet',
      title: 'Apple Wallet',
      detail: 'Notification sur la carte Apple Wallet de l’iPhone.',
      icon: Apple,
      status: walletLocked ? { label: 'Pack Enterprise', tone: 'locked' } : { label: 'Bientôt disponible', tone: 'soon' },
      canToggle: false,
    },
  ];

  const toneClass: Record<Status['tone'], string> = {
    on: 'bg-[#10B981]/15 text-[#10B981]',
    off: 'bg-white/[0.06] text-white/50',
    locked: 'bg-white/[0.06] text-white/45',
    soon: 'bg-[#06B6D4]/10 text-[#06B6D4]',
  };

  return (
    <div className="mb-4 rounded-3xl border border-[#242424] bg-[#111111] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#10B981]">Canaux de notification</p>
      <h3 className="mt-1 text-lg font-semibold text-white">Où partent vos messages</h3>
      <p className="mt-1 text-xs leading-5 text-white/45">
        Chaque notification part en même temps sur tous les canaux actifs. {isAdmin ? 'Vous activez les canaux selon le pack du client.' : 'Les canaux sont activés par KELYANI selon votre pack.'}
        {channels.plan_name ? <> Pack actuel : <span className="font-semibold text-white/70">{channels.plan_name}</span>.</> : null}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map(row => {
          const Icon = row.icon;
          const active = row.id === 'apple_wallet' ? false : channels[row.id];
          return (
            <div key={row.id} className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0B0C0C] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-white/80"><Icon size={16} /></span>
                  <p className="text-sm font-semibold text-white">{row.title}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClass[row.status.tone]}`}>
                  {row.status.tone === 'locked' && <Lock size={10} />}
                  {row.status.label}
                </span>
              </div>
              <p className="mt-3 flex-1 text-[11px] leading-5 text-white/45">{row.detail}</p>
              {isAdmin && row.canToggle && (
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void save({
                    kelyani_card: row.id === 'kelyani_card' ? !channels.kelyani_card : channels.kelyani_card,
                    google_wallet: row.id === 'google_wallet' ? !channels.google_wallet : channels.google_wallet,
                    apple_wallet: false,
                  })}
                  className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-semibold transition disabled:opacity-40 ${active ? 'border-white/[0.1] text-white/70 hover:border-white/25' : 'border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/10'}`}
                >
                  {active ? 'Désactiver' : 'Activer'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
