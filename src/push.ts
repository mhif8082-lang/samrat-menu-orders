// Device notifications via Web Push. Works on Android/desktop browsers, and on iPhone/iPad
// once the app is added to the Home Screen (iOS 16.4+).
import { useEffect, useState } from 'react';
import { api, safeGet, safeSet } from './api';
import { isIOS, isStandalone } from './motion';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'working';
const FLAG = 'smo-push-on';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
export const pushIsOn = () => safeGet(FLAG) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function registration() {
  const ready = navigator.serviceWorker.ready;
  return await Promise.race([ready, new Promise<never>((_, no) => setTimeout(() => no(new Error('Service worker not ready')), 8000))]);
}
async function subscription() {
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const { publicKey } = await api<{ publicKey: string }>('/push/key');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

export function currentState(): PushState {
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return pushIsOn() ? 'on' : 'off';
}
export function usePushState() {
  const [s, setS] = useState<PushState>(currentState);
  useEffect(() => { const f = () => setS(currentState()); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return s;
}

/** Ask permission (must run from a tap) and register this device. `order` = "id.key" for a guest. */
export async function enablePush(order?: string): Promise<PushState> {
  if (currentState() === 'ios-install' || !pushSupported()) return currentState();
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { emit(); return perm === 'denied' ? 'denied' : 'off'; }
  const sub = await subscription();
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), order } });
  safeSet(FLAG, '1'); emit();
  return 'on';
}
/** Re-register silently (after sign-in, or if the browser rotated the subscription). */
export async function syncPush(order?: string) {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const sub = await subscription();
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), order } });
    safeSet(FLAG, '1'); emit();
  } catch { /* offline; try next time */ }
}
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* ignore */ }
  safeSet(FLAG, null); emit();
}
export async function testPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api('/push/test', { method: 'POST', body: { endpoint: sub.endpoint } });
}
