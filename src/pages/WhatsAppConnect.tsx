import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = { id: string; name?: string };
type MetaSignupAssets = { wabaId: string; phoneNumberId: string | null };
type MetaLoginResponse = {
  authResponse?: { code?: string };
  error?: { message?: string };
  status?: string;
};
type MetaSignupMessage = {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    waba_ids?: string[];
    phone_number_id?: string;
    current_step?: string;
    error_message?: string;
  };
};

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: MetaLoginResponse) => void, options: {
        config_id: string;
        response_type: 'code';
        override_default_response_type: true;
        extras: { setup: Record<string, never> };
      }) => void;
    };
  }
}

const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
const configId = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;
let initializedAppId: string | null = null;

function loadFacebookSdk(): Promise<NonNullable<Window['FB']>> {
  if (window.FB) return Promise.resolve(window.FB);

  return new Promise((resolve, reject) => {
    let script = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    const shouldAppend = !script;
    if (!script) {
      script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
    }

    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Délai dépassé pendant le chargement du SDK Meta.')), 15000);
    const poll = window.setInterval(() => {
      if (window.FB) finish();
    }, 100);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
      if (error) reject(error);
      else if (window.FB) resolve(window.FB);
      else reject(new Error('SDK Meta indisponible.'));
    };
    const onLoad = () => finish(window.FB ? undefined : new Error('SDK Meta chargé sans initialiser Facebook.'));
    const onError = () => finish(new Error('Impossible de télécharger le SDK Meta.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (shouldAppend) document.head.appendChild(script);
  });
}

function startEmbeddedSignup(facebook: NonNullable<Window['FB']>, embeddedConfigId: string, signal: AbortSignal) {
  return new Promise<{ code: string; assets: MetaSignupAssets }>((resolve, reject) => {
    let code: string | null = null;
    let assets: MetaSignupAssets | null = null;
    let settled = false;
    let codeTimeout: number | null = null;
    const timeout = window.setTimeout(() => finish(new Error('La connexion Meta a expiré. Relancez le parcours.')), 10 * 60 * 1000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      if (codeTimeout !== null) window.clearTimeout(codeTimeout);
      window.removeEventListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else if (code && assets) resolve({ code, assets });
      else reject(new Error('Meta n’a pas renvoyé toutes les informations de connexion.'));
    };
    const onAbort = () => finish(new Error('Connexion Meta interrompue.'));
    const tryComplete = () => {
      if (code && assets) finish();
    };
    const onMessage = (event: MessageEvent) => {
      let host = '';
      try {
        const origin = new URL(event.origin);
        if (origin.protocol !== 'https:') return;
        host = origin.hostname;
      } catch { return; }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;

      let message: MetaSignupMessage;
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) as MetaSignupMessage : event.data as MetaSignupMessage;
      } catch {
        return;
      }
      if (message?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (message.event === 'CANCEL') {
        finish(new Error(`Connexion Meta annulée${message.data?.current_step ? ` à l’étape ${message.data.current_step}` : ''}.`));
        return;
      }
      if (message.event === 'ERROR') {
        finish(new Error(message.data?.error_message || 'Meta a signalé une erreur pendant la connexion.'));
        return;
      }
      if (!['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', 'FINISH_GRANT_ONLY_API_ACCESS'].includes(message.event || '')) return;

      const wabaId = message.data?.waba_id || message.data?.waba_ids?.[0];
      const phoneNumberId = message.data?.phone_number_id || null;
      if (!wabaId || !/^\d{5,32}$/.test(wabaId) || (phoneNumberId && !/^\d{5,32}$/.test(phoneNumberId))) {
        finish(new Error('Meta a terminé le parcours sans renvoyer un identifiant WhatsApp valide.'));
        return;
      }
      assets = { wabaId, phoneNumberId };
      tryComplete();
    };

    window.addEventListener('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      facebook.login((response) => {
        if (response.error) {
          finish(new Error(response.error.message || 'Meta a refusé la connexion.'));
          return;
        }
        const receivedCode = response.authResponse?.code;
        if (!receivedCode) {
          finish(new Error('Connexion annulée ou code Meta non reçu.'));
          return;
        }
        code = receivedCode;
        codeTimeout = window.setTimeout(() => finish(new Error('Les informations du compte Meta ne sont pas arrivées à temps. Relancez le parcours.')), 20000);
        tryComplete();
      }, {
        config_id: embeddedConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      });
    } catch {
      finish(new Error('Impossible d’ouvrir la fenêtre Meta. Vérifiez les domaines autorisés de l’application.'));
    }
  });
}

export default function WhatsAppConnect() {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(false);
  const signupAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      signupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadEstablishments() {
      setLoading(true);
      setMessage('');
      try {
        const { data, error } = await supabase.rpc('get_my_establishments');
        if (!active) return;
        if (error) throw error;
        const rows = (data ?? []) as Establishment[];
        setEstablishments(rows);
        setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
      } catch {
        if (active) {
          setMessage('Impossible de charger les établissements accessibles à ce compte.');
          setEstablishments([]);
          setSelectedId('');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEstablishments();
    return () => { active = false; };
  }, [user?.id]);

  async function startSignup() {
    setMessage('');
    const establishmentId = selectedId;
    if (!establishmentId) {
      setMessage('Sélectionnez un établissement.');
      return;
    }
    if (!appId || !configId) {
      setMessage('Configuration Meta manquante. Configurez les variables Meta requises.');
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    signupAbortRef.current = controller;
    try {
      const facebook = await loadFacebookSdk();
      if (!mountedRef.current) return;
      if (initializedAppId !== appId) {
        facebook.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v27.0' });
        initializedAppId = appId;
      }

      const { code, assets } = await startEmbeddedSignup(facebook, configId, controller.signal);
      if (!mountedRef.current) return;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Session KELYANI expirée. Reconnectez-vous.');

      const result = await supabase.functions.invoke('whatsapp-oauth-exchange', {
        body: {
          code,
          establishmentId,
          wabaId: assets.wabaId,
          phoneNumberId: assets.phoneNumberId,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.error || !result.data?.success) {
        throw new Error(result.data?.error || result.error?.message || 'La connexion WhatsApp n’a pas été enregistrée.');
      }
      if (mountedRef.current) {
        setMessage(result.data.message || 'Compte WhatsApp enregistré en attente de finalisation.');
      }
    } catch (error) {
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : 'Connexion WhatsApp impossible.');
    } finally {
      if (signupAbortRef.current === controller) signupAbortRef.current = null;
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 text-white md:p-8">
      <section className="rounded-2xl border border-[#686D76] bg-[#121212] p-6 md:p-8">
        <div className="mb-2 text-sm bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">KELYANI WhatAI</div>
        <h1 className="text-2xl font-semibold">Connecter WhatsApp Business</h1>
        <p className="mt-2 text-sm text-gray-400">
          Chaque établissement connecte son propre compte WhatsApp Business via Meta. Votre numéro personnel n’est pas utilisé.
        </p>
        {loading ? (
          <p className="mt-6 text-gray-400">Chargement des établissements…</p>
        ) : establishments.length === 0 ? (
          <p className="mt-6 text-gray-400">Aucun établissement accessible sur ce compte.</p>
        ) : (
          <>
            <label className="mt-6 block text-sm font-medium" htmlFor="establishment">Établissement</label>
            <select
              id="establishment"
              className="mt-2 w-full rounded-xl border border-[#686D76] bg-[#202020] p-3"
              value={selectedId}
              disabled={busy}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {establishments.map((establishment) => (
                <option key={establishment.id} value={establishment.id}>
                  {establishment.name || establishment.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void startSignup()}
              disabled={busy || !selectedId}
              className="mt-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-5 py-3 font-semibold text-[#050505] disabled:opacity-50"
            >
              {busy ? 'Connexion en cours…' : 'Connecter mon WhatsApp via Meta'}
            </button>
          </>
        )}
        {message && <p role="status" className="mt-4 rounded-lg border border-[#686D76] p-3 text-sm">{message}</p>}
        <p className="mt-6 text-xs text-gray-500">
          Le compte et ses identifiants sont enregistrés côté serveur. L’activation de l’envoi de messages nécessite encore la configuration Meta et les étapes d’onboarding requises.
        </p>
      </section>
    </main>
  );
}

