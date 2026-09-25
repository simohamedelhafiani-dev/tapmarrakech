import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY =
  'BP6npYG0iStFDilI-plhetrxJ6msUZGBVgMDP9u7ytndT4QzjD1A2q9taxeRX5bEHCoDBjRYjOUXtd1t2ZuXCWA';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushRegistrationResult =
  | { ok: true; alreadyEnabled: boolean }
  | { ok: false; reason: 'unsupported' | 'not-standalone' | 'denied' | 'failed'; message: string };

function formatPushError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export async function registerLoyaltyPush(accessToken: string, cardUrl: string): Promise<PushRegistrationResult> {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Les notifications ne sont pas disponibles sur cet appareil.',
    };
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  if (isIOS && !isStandalone) {
    return {
      ok: false,
      reason: 'not-standalone',
      message: 'Sur iPhone, ajoutez d’abord la carte à l’écran d’accueil, puis activez les notifications.',
    };
  }

  try {
    if (Notification.permission === 'denied') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Les notifications sont bloquées dans les réglages du navigateur.',
      };
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Vous n’avez pas autorisé les notifications.',
      };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const alreadySubscribed = Boolean(subscription);

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (error) {
        console.error('Push subscription creation failed:', error);
        return {
          ok: false,
          reason: 'failed',
          message: `Impossible de créer l’abonnement aux notifications : ${formatPushError(error, 'erreur inconnue')}.`,
        };
      }
    }

    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
      return {
        ok: false,
        reason: 'failed',
        message: 'L’abonnement aux notifications est incomplet. Réessayez depuis la carte ajoutée à l’écran d’accueil.',
      };
    }

    const { error } = await supabase.rpc('register_loyalty_push_subscription', {
      p_access_token: accessToken,
      p_subscription: subscriptionJson,
      p_card_url: cardUrl,
    });

    if (error) {
      console.error('Impossible d’enregistrer l’abonnement push:', error);
      return {
        ok: false,
        reason: 'failed',
        message: `L’abonnement a été créé sur l’iPhone, mais son enregistrement a échoué : ${formatPushError(error, 'erreur Supabase')}.`,
      };
    }

    try {
      window.localStorage.setItem('tapmarrakech:push-enabled', 'true');
    } catch {
      // Storage is optional.
    }

    return { ok: true, alreadyEnabled: alreadySubscribed };
  } catch (error) {
    console.error('Web Push registration failed:', error);
    return {
      ok: false,
      reason: 'failed',
      message: `Impossible d’activer les notifications : ${formatPushError(error, 'erreur inconnue')}.`,
    };
  }
}

export async function isLoyaltyPushEnabled() {
  if (
    typeof Notification === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
