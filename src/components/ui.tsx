import { useEffect, useRef, useState, type ReactNode } from 'react';
import { asset } from '../base';
import { Icon } from './icons';
import { useSyncExternalStore } from 'react';
import type { Live } from '../api';

export function Logo({ size = 44 }: { size?: number }) {
  return <img src={asset('/assets/samrat-logo.svg')} alt="" width={size} height={size} className="logo-mark" />;
}

/** Number that counts up when it changes. */
export function CountUp({ value, format = (v: number) => String(Math.round(v)) }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(); const a = from.current; const b = value; let raf = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(b); from.current = b; return; }
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700); const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value]);
  return <>{format(shown)}</>;
}

export function LiveBadge({ state }: { state: Live }) {
  return <span className={`live-badge ${state}`} role="status"><i />{state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</span>;
}

export function Empty({ icon = 'menu', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return <div className="empty"><div className="empty-icon" aria-hidden="true"><Icon name={icon} size={30} /></div><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function VegMark({ veg }: { veg?: boolean }) {
  if (veg === undefined) return null;
  return <span className={`veg-mark${veg ? ' veg' : ''}`} title={veg ? 'Vegetarian' : 'Non-vegetarian'} aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}><span /></span>;
}

/** Tile shown when a dish has no photo. */
export function DishArt({ name, station }: { name: string; station: string }) {
  return <div className={`dish-art ${station}`} aria-hidden="true"><Icon name={station === 'bar' ? 'glass' : station === 'tandoor' ? 'tandoor' : 'pot'} size={34} /><b>{name.split(' ').map(w => w[0]).join('').slice(0, 2)}</b></div>;
}

// ── Toasts ──────────────────────────────────────────────────────────────────
type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
let toasts: Toast[] = [];
const tl = new Set<() => void>();
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, tone }].slice(-3); tl.forEach(l => l());
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); tl.forEach(l => l()); }, 3200);
}
export function Toasts() {
  const list = useSyncExternalStore(cb => { tl.add(cb); return () => tl.delete(cb); }, () => toasts);
  return <div className="toasts" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={`toast ${t.tone}`}><Icon name={t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'bell' : 'check'} size={18} /> {t.text}</div>)}</div>;
}

export function Sheet({ open, onClose, children, label, side = 'bottom' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; side?: 'bottom' | 'right' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { d.showModal(); document.body.classList.add('locked'); }
    if (!open && d.open) d.close();
    return () => document.body.classList.remove('locked');
  }, [open]);
  return <dialog ref={ref} className={`sheet sheet-${side}`} aria-label={label} onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {open && <div className="sheet-body">{children}</div>}
  </dialog>;
}

/** Confetti burst for happy moments. */
export function burst(x = innerWidth / 2, y = innerHeight / 2) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#efb65a', '#581d2b', '#e07a3f', '#fff3d6', '#9b3b4e'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    const ang = Math.random() * Math.PI * 2; const dist = 90 + Math.random() * 220;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist - 120}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
}

/** Animate a little dot flying from an element to the basket button. */
export function flyToBasket(from: HTMLElement | null) {
  const target = document.querySelector('[data-basket-target]');
  if (!from || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.getBoundingClientRect(); const b = target.getBoundingClientRect();
  const dot = document.createElement('i'); dot.className = 'fly-dot';
  dot.style.left = `${a.left + a.width / 2}px`; dot.style.top = `${a.top + a.height / 2}px`;
  document.body.appendChild(dot);
  dot.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${(b.left + b.width / 2 - a.left - a.width / 2) / 2}px), calc(-50% + ${(b.top - a.top) / 2 - 80}px)) scale(1.3)`, opacity: 1, offset: .5 },
    { transform: `translate(calc(-50% + ${b.left + b.width / 2 - a.left - a.width / 2}px), calc(-50% + ${b.top + b.height / 2 - a.top - a.height / 2}px)) scale(.4)`, opacity: .6 },
  ], { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
    dot.remove(); target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
  };
}

// ── Sound + notifications for staff ─────────────────────────────────────────
let audio: AudioContext | null = null;
export function chime(kind: 'new' | 'assist' = 'new') {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const notes = kind === 'new' ? [660, 880, 1320] : [520, 520, 780];
    notes.forEach((f, i) => {
      const o = audio!.createOscillator(); const g = audio!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = audio!.currentTime + i * .16;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .45);
      o.connect(g).connect(audio!.destination); o.start(t); o.stop(t + .5);
    });
  } catch { /* audio unavailable */ }
}
export function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: asset('/icons/icon-192.png'), badge: asset('/icons/badge-96.png'), tag: title })).catch(() => new Notification(title, { body }));
    }
    navigator.vibrate?.([120, 60, 120]);
  } catch { /* notifications unavailable */ }
}
