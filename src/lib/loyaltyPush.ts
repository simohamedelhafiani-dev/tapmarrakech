import { supabase } from '@/lib/supabase';

export const LOYALTY_VAPID_PUBLIC_KEY =
  'BP6npYG0iStFDilI-plhetrxJ6msUZGBVgMDP9u7ytndT4QzjD1A2q9taxeRX5bEHCoDBjRYjOUXtd1t2ZuXCWA';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

function subscriptionUsesCurrentVapidKey(subscription: PushSubscription) {
  const key = subscription.options?.applicationServerKey;
  if (!key) return false;
  const bytes = new Uint8Array(key);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return encoded === LOYALTY_VAPID_PUBLIC_KEY;
}

export async function getLoyaltyPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription && subscriptionUsesCurrentVapidKey(subscription) ? subscription : null;
}

export async function enableLoyaltyPush(token: string, cardUrl: string) {
  if (!token) throw new Error('Carte fidélité introuvable.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Les notifications push ne sont pas prises en charge sur cet appareil.');
  }
  if (!('Notification' in window)) {
    throw new Error('Les notifications système ne sont pas disponibles ici.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Autorisez les notifications pour recevoir les messages même lorsque votre téléphone est verrouillé.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !subscriptionUsesCurrentVapidKey(subscription)) {
    await subscription.unsubscribe().catch(() => false);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(LOYALTY_VAPID_PUBLIC_KEY),
    });
  }

  const { error } = await supabase.rpc('register_loyalty_push_subscription', {
    p_access_token: token,
    p_subscription: subscription.toJSON(),
    p_card_url: cardUrl,
  });

  if (error) throw error;

  return subscription;
}
