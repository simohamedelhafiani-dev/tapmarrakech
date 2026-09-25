import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = 'u3k1FqMnjg0lwntFbI4GQTSRuokEiGrMGM1V9lipyQg';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushRegistrationResult =
  | { ok: true; alreadyEnabled: boolean }
  | { ok: false; reason: 'unsupported' | 'not-standalone' | 'denied' | 'failed'; message: string };

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

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const { error } = await supabase.rpc('register_loyalty_push_subscription', {
      p_access_token: accessToken,
      p_subscription: subscription.toJSON(),
      p_card_url: cardUrl,
    });

    if (error) {
      console.error('Impossible d’enregistrer l’abonnement push:', error);
      return {
        ok: false,
        reason: 'failed',
        message: 'Impossible d’activer les notifications pour le moment.',
      };
    }

    try {
      window.localStorage.setItem('tapmarrakech:push-enabled', 'true');
    } catch {
      // Storage is optional.
    }

    return { ok: true, alreadyEnabled: Boolean(subscription) };
  } catch (error) {
    console.error('Web Push registration failed:', error);
    return {
      ok: false,
      reason: 'failed',
      message: 'Impossible d’activer les notifications pour le moment.',
    };
  }
}

export function isLoyaltyPushEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
