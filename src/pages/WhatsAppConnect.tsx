import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
        extras: { setup: Record<string, never>; featureType?: 'whatsapp_business_app_onboarding' };
      }) => void;
    };
  }
}

const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
const configId = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;
const graphVersion = (import.meta.env.VITE_META_GRAPH_API_VERSION as string | undefined) || 'v27.0';
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
    // Bind signup session messages to the first accepted popup/frame source.
    // This narrows cross-window spoofing; Meta does not echo our server nonce here.
    let signupMessageSource: MessageEventSource | null = null;
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
      // Accept only the known Meta origins; broad *.facebook.com checks can
      // accidentally trust unrelated subdomains.
      if (!['facebook.com', 'www.facebook.com', 'web.facebook.com', 'business.facebook.com'].includes(host)) return;
      // Signup messages must originate from a separate window/frame, not from
      // arbitrary same-page scripts dispatching synthetic message events.
      if (!event.source || event.source === window) return;
      if (signupMessageSource && event.source !== signupMessageSource) return;

      let message: MetaSignupMessage;
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
        message = parsed as MetaSignupMessage;
      } catch {
        return;
      }
      if (message.type !== 'WA_EMBEDDED_SIGNUP' || typeof message.event !== 'string') return;
      if (message.data && (typeof message.data !== 'object' || Array.isArray(message.data))) return;
      // Pin the sender only after a recognized event; unknown messages must not
      // lock this signup session to an arbitrary source.
      if (!['CANCEL', 'ERROR', 'FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', 'FINISH_GRANT_ONLY_API_ACCESS'].includes(message.event)) return;
      if (!signupMessageSource) signupMessageSource = event.source;

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
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' },
      });
    } catch {
      finish(new Error('Impossible d’ouvrir la fenêtre Meta. Vérifiez les domaines autorisés de l’application.'));
    }
  });
}

export default function WhatsAppConnect() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin/whatsapp');
  const inboxPath = isAdminPath ? '/admin/whatsapp/inbox' : '/dashboard/whatsapp/inbox';
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(false);
  const signupAbortRef = useRef<AbortController | null>(null);
  // Synchronous lock prevents rapid clicks from opening parallel Meta signup flows
  // before React has committed the busy state update.
  const signupInProgressRef = useRef(false);

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
    if (signupInProgressRef.current) return;
    setMessage('');
    const establishmentId = selectedId;
    if (!establishmentId) {
      setMessage('Sélectionnez un établissement.');
      return;
    }
    if (!appId || !configId || !/^v[0-9]{2,3}\.[0-9]+$/.test(graphVersion)) {
      setMessage('Configuration Meta manquante. Configurez les variables Meta requises.');
      return;
    }
    // Acquire the lock only after all synchronous validation passes, so an
    // early return cannot leave the signup flow permanently locked.
    signupInProgressRef.current = true;

    setBusy(true);
    const controller = new AbortController();
    signupAbortRef.current = controller;
    try {
      // Create an authenticated server-side nonce before opening Meta. Keep it
      // only in this in-memory signup attempt; it is never persisted in storage.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Session KELYANI expirée. Reconnectez-vous.');
      const stateResult = await supabase.functions.invoke('whatsapp-oauth-state', {
        body: { establishmentId },
        headers: { Authorization: `Bearer ${token}` },
      });
      const state = typeof stateResult.data?.state === 'string' ? stateResult.data.state : '';
      if (stateResult.error || !/^[a-f0-9]{64}$/.test(state)) {
        throw new Error(stateResult.data?.error || 'Impossible de sécuriser la tentative OAuth.');
      }

      const facebook = await loadFacebookSdk();
      if (!mountedRef.current) return;
      if (initializedAppId !== appId) {
        facebook.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
        initializedAppId = appId;
      }

      const { code, assets } = await startEmbeddedSignup(facebook, configId, controller.signal);
      if (!mountedRef.current) return;
      const result = await supabase.functions.invoke('whatsapp-oauth-exchange', {
        body: {
          code,
          state,
          establishmentId,
          wabaId: assets.wabaId,
          phoneNumberId: assets.phoneNumberId,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.error || !result.data?.success) {
        const failureCode = typeof result.data?.error === 'string' ? result.data.error : '';
        const safeMessages: Record<string, string> = {
          meta_code_exchange_unavailable: 'Meta est temporairement inaccessible. Relancez une nouvelle connexion.',
          meta_code_exchange_failed: 'Le code Meta est invalide ou expiré. Relancez le parcours de connexion.',
          meta_waba_verification_unavailable: 'La vérification du compte WhatsApp a échoué temporairement. Relancez la connexion.',
          meta_waba_verification_failed: 'Le compte WhatsApp n’a pas pu être vérifié avec les autorisations reçues.',
          meta_webhook_subscription_unavailable: 'Meta est temporairement inaccessible pendant l’activation des notifications WhatsApp. Relancez la connexion.',
          meta_webhook_subscription_failed: 'Le compte Meta est accessible, mais l’abonnement aux notifications WhatsApp a échoué. Vérifiez les permissions et la configuration Webhooks de l’application Meta.',
          meta_phone_numbers_verification_unavailable: 'La vérification du numéro a échoué temporairement. Relancez la connexion.',
          meta_phone_numbers_verification_failed: 'Meta n’a pas permis de vérifier la liste des numéros de ce compte.',
          meta_phone_numbers_verification_incomplete: 'La liste des numéros Meta est trop longue pour être vérifiée en une seule tentative. Relancez la connexion.',
          phone_number_not_attached_to_waba: 'Le numéro choisi n’est pas rattaché au compte WhatsApp Business sélectionné.',\n          coexistence_multiple_phone_numbers_require_selection: 'Plusieurs numéros sont associés à ce compte WhatsApp. La sélection explicite du numéro est nécessaire avant de terminer la connexion.',\n          coexistence_phone_number_not_found: 'Aucun numéro WhatsApp n’a été trouvé sur ce compte. Terminez l’ajout du numéro dans Meta puis relancez la connexion.',
          secure_token_storage_failed: 'La connexion Meta est vérifiée, mais le stockage sécurisé a échoué. Contactez le support avant de recommencer.',
          connection_save_failed: 'La connexion Meta est vérifiée, mais son enregistrement a échoué. Contactez le support avant de recommencer.',
          oauth_state_invalid_expired_or_used: 'Cette tentative de connexion a expiré ou a déjà été utilisée. Relancez le parcours Meta.',
        };
        throw new Error(safeMessages[failureCode] || 'La connexion WhatsApp n’a pas été enregistrée. Relancez le parcours si nécessaire.');
      }
      if (mountedRef.current) {
        setMessage(result.data.message || 'Compte WhatsApp enregistré en attente de finalisation.');
      }
    } catch (error) {
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : 'Connexion WhatsApp impossible.');
    } finally {
      if (signupAbortRef.current === controller) signupAbortRef.current = null;
      signupInProgressRef.current = false;
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
        <a href={inboxPath} className="mt-4 inline-flex rounded-xl border border-[#686D76] px-4 py-2 text-sm text-[#60A5FA] hover:border-[#3B82F6]">Ouvrir la boîte WhatsApp →</a>
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

