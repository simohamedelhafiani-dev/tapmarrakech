import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = { id: string; name?: string };

declare global {\n  interface Window { FB?: { init: (options: Record<string, unknown>) => void; login: (callback: (response: any) => void, options: Record<string, unknown>) => void };\n}\n
const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
const configId = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;

export default function WhatsAppConnect() {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_my_establishments');
      if (!active) return;
      if (error) setMessage('Impossible de charger les établissements.');
      else {
        const rows = (data ?? []) as Establishment[];
        setEstablishments(rows);
        setSelectedId(rows[0]?.id ?? '');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  const startSignup = async () => {
    setMessage('');
    if (!selectedId) { setMessage('Sélectionnez un établissement.'); return; }
    if (!appId || !configId) {
      setMessage('Configuration Meta manquante : VITE_META_APP_ID et VITE_META_EMBEDDED_SIGNUP_CONFIG_ID doivent être configurés.');
      return;
    }
    setBusy(true);
    try {
      const sdkReady = await new Promise<boolean>((resolve) => {
        if (window.FB) { resolve(true); return; }
        const existing = document.getElementById('facebook-jssdk');
        if (existing) { existing.addEventListener('load', () => resolve(Boolean(window.FB)), { once: true }); return; }
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.onload = () => resolve(Boolean(window.FB));
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      if (!sdkReady || !window.FB) throw new Error('SDK Meta indisponible.');
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v23.0' });
      window.FB.login((response: any) => {
        const code = response?.authResponse?.code;
        if (!code) { setMessage('Connexion annulée ou code Meta non reçu.'); setBusy(false); return; }
        (async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error('Session KELYANI expirée. Reconnectez-vous.');
          const result = await supabase.functions.invoke('whatsapp-oauth-exchange', {
            body: { code, establishmentId: selectedId },
            headers: { Authorization: `Bearer ${token}` },
          });
          if (result.error) throw result.error;
          setMessage('Autorisation Meta reçue. La finalisation WhatsApp reste à effectuer.');
        })().catch((e) => setMessage(e?.message ?? 'Connexion WhatsApp échouée')).finally(() => setBusy(false));
      }, { config_id: configId, response_type: 'code', override_default_response_type: true, extras: { setup: {} } });
    } catch (e: any) {
      setMessage(e?.message ?? 'Connexion WhatsApp impossible.');
      setBusy(false);
    }
  };

  return <main className="mx-auto w-full max-w-4xl p-4 md:p-8 text-white">
    <section className="rounded-2xl border border-[#686D76] bg-[#121212] p-6 md:p-8">
      <div className="mb-2 text-sm text-blue-400">KELYANI WhatAI</div>
      <h1 className="text-2xl font-semibold">Connecter WhatsApp Business</h1>
      <p className="mt-2 text-sm text-gray-400">Chaque établissement connecte son propre compte WhatsApp Business via Meta. Votre numéro personnel n’est pas utilisé.</p>
      {loading ? <p className="mt-6 text-gray-400">Chargement des établissements…</p> : establishments.length === 0 ? <p className="mt-6 text-gray-400">Aucun établissement trouvé sur ce compte.</p> : <>
      <label className="mt-6 block text-sm font-medium" htmlFor="establishment">Établissement</label>
      <select id="establishment" className="mt-2 w-full rounded-xl border border-[#686D76] bg-[#202020] p-3" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        {establishments.map(e => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
      </select>
      <button onClick={startSignup} disabled={busy || !selectedId} className="mt-5 rounded-xl bg-[#3B82F6] px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Connexion en cours…' : 'Connecter mon WhatsApp via Meta'}</button>
      </>}
      {message && <p role="status" className="mt-4 rounded-lg border border-[#686D76] p-3 text-sm">{message}</p>}
      <p className="mt-6 text-xs text-gray-500">Connexion Meta en préparation. Ne pas activer en production avant configuration et tests de l’application Meta, des variables, de l’échange de code et des webhooks.</p>
    </section>
  </main>;
}
