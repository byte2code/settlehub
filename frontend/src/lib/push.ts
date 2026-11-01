import { Capacitor } from '@capacitor/core';
import { api } from './api';

const toBytes = (b64url: string): Uint8Array<ArrayBuffer> => {
  const padded = b64url.padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), '=').replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Browser/PWA web push only; the native Android app needs a Firebase project and is set up separately. */
export function webPushSupported(): boolean {
  return !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function webPushState(): Promise<'unsupported' | 'blocked' | 'off' | 'on'> {
  if (!webPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

/** Returns false when the server has web push disabled or the user declines the permission prompt. */
export async function enableWebPush(): Promise<boolean> {
  const { webPushPublicKey } = await api.pushConfig();
  if (!webPushPublicKey || (await Notification.requestPermission()) !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(webPushPublicKey) }));
  const json = sub.toJSON();
  await api.pushSubscribe({ deviceType: 'WEB', deviceToken: sub.endpoint, p256dhKey: json.keys?.p256dh, authKey: json.keys?.auth });
  return true;
}

export async function disableWebPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
