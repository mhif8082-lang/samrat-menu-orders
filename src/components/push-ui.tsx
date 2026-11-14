import { useState } from 'react';
import { disablePush, enablePush, testPush, usePushState, type PushState } from '../push';
import { Icon } from './icons';
import { toast } from './ui';

const COPY: Record<Exclude<PushState, 'on' | 'working'>, { title: string; text: string }> = {
  off: { title: 'Get order alerts on this device', text: 'Alerts arrive even when the app is closed or the phone is locked.' },
  'ios-install': { title: 'Add the app to your Home Screen for alerts', text: 'On iPhone and iPad: tap Share, then Add to Home Screen, then open Samrat from your Home Screen and turn alerts on there.' },
  denied: { title: 'Alerts are blocked on this device', text: 'Allow notifications for this app in your phone or browser settings, then reopen it.' },
  unsupported: { title: 'This browser can’t show alerts', text: 'Use Chrome on Android or a computer, or Safari from the Home Screen on iPhone.' },
};

async function turnOn(order?: string) {
  try {
    const r = await enablePush(order);
    if (r === 'on') { toast('Alerts are on for this device'); await testPush().catch(() => {}); }
    else if (r === 'denied') toast('Alerts were blocked. Allow them in your device settings.', 'error');
    return r;
  } catch (e) { toast((e as Error).message || 'Couldn’t turn on alerts', 'error'); return 'off'; }
}

/** Staff banner under the top bar until alerts are on (dismissable for this session). */
export function StaffAlertsBanner() {
  const state = usePushState();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('smo-alerts-banner') === 'hide'; } catch { return false; } });
  const [busy, setBusy] = useState(false);
  if (state === 'on' || state === 'working' || hidden) return null;
  const c = COPY[state];
  const hide = () => { try { sessionStorage.setItem('smo-alerts-banner', 'hide'); } catch { /* ignore */ } setHidden(true); };
  return <div className={`alerts-banner s-${state}`} role="region" aria-label="Order alerts">
    <span className="ab-icon"><Icon name="bell" size={20} /></span>
    <div className="ab-text"><b>{c.title}</b><small>{c.text}</small></div>
    {state === 'off' && <button className="btn btn-sm btn-gold" disabled={busy} onClick={async () => { setBusy(true); await turnOn(); setBusy(false); }}>{busy ? <span className="spinner" /> : 'Turn on alerts'}</button>}
    <button className="n-close" aria-label="Not now" onClick={hide}><Icon name="close" size={16} /></button>
  </div>;
}

/** Top-bar button: shows whether alerts are on; tap to turn on or send a test. */
export function AlertsButton() {
  const state = usePushState();
  const on = state === 'on';
  return <button className={`icon-btn alerts-btn${on ? ' on' : ''}`} title={on ? 'Alerts on. Tap to send a test.' : 'Turn on alerts'} aria-label={on ? 'Alerts on, send a test alert' : 'Turn on alerts'}
    onClick={async () => { if (on) { await testPush().catch(() => {}); toast('Test alert sent'); } else if (state === 'off') await turnOn(); else toast(COPY[state as keyof typeof COPY].text, 'info'); }}>
    <Icon name="bell" size={18} />{!on && <i className="alerts-dot" />}
  </button>;
}

/** Settings card row for this device. */
export function AlertsSetting() {
  const state = usePushState();
  return <div className="setting"><div><b>Alerts on this device</b><small>{state === 'on' ? 'On. New orders, ready food and table calls arrive even when the app is closed.' : COPY[state as keyof typeof COPY]?.text}</small></div>
    {state === 'off' && <button className="btn btn-sm btn-gold" onClick={() => turnOn()}>Turn on</button>}
    {state === 'on' && <span className="setting-actions"><button className="btn btn-sm btn-ghost" onClick={async () => { await testPush(); toast('Test alert sent'); }}>Send test</button><button className="btn btn-sm btn-text" onClick={async () => { await disablePush(); toast('Alerts turned off on this device'); }}>Turn off</button></span>}
  </div>;
}

/** Guest: alert me when my order is ready. */
export function GuestAlerts({ order }: { order: string }) {
  const state = usePushState();
  const [busy, setBusy] = useState(false);
  if (state === 'on') return <p className="guest-alerts on"><Icon name="bell" size={16} /> We’ll send an alert to this phone when it’s ready, even if you close the app.</p>;
  if (state === 'ios-install') return <p className="guest-alerts">On iPhone, add Samrat to your Home Screen to get an alert when your food is ready.</p>;
  if (state !== 'off') return null;
  return <button className="btn btn-gold notify-me" disabled={busy} onClick={async () => { setBusy(true); await turnOn(order); setBusy(false); }}>
    {busy ? <span className="spinner" /> : <><Icon name="bell" size={18} /> Alert me when it’s ready</>}</button>;
}
