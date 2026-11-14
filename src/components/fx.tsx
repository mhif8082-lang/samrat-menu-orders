import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { confetti, haptic, isIOS, isStandalone, reduced, sfx } from '../motion';
import { install, useInstall } from '../pwa';
import { safeGet, safeSet } from '../api';
import { Logo } from './ui';
import { Icon } from './icons';

// ── The tandoor: the app's signature. heat 0 (cold) … 3 (roaring) ────────────
export function Tandoor({ heat = 1.5, size = 180, bell = false, className = '' }: { heat?: number; size?: number; bell?: boolean; className?: string }) {
  return <div className={`tandoor ${className}`} style={{ '--heat': heat, width: size, height: size } as CSSProperties} aria-hidden="true">
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <radialGradient id="tg-glow" cx="50%" cy="40%" r="50%"><stop offset="0" stopColor="#ffd27a" stopOpacity=".9" /><stop offset=".5" stopColor="#e07a3f" stopOpacity=".35" /><stop offset="1" stopColor="#e07a3f" stopOpacity="0" /></radialGradient>
        <linearGradient id="tg-clay" x1="0" x2="1"><stop offset="0" stopColor="#7a2f1c" /><stop offset=".45" stopColor="#c0623a" /><stop offset="1" stopColor="#6a2616" /></linearGradient>
        <linearGradient id="tg-flame1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#e0502a" /><stop offset="1" stopColor="#efb65a" stopOpacity=".2" /></linearGradient>
        <linearGradient id="tg-flame2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#efb65a" /><stop offset="1" stopColor="#fff3d6" stopOpacity=".3" /></linearGradient>
      </defs>
      <circle className="t-glow" cx="100" cy="80" r="90" fill="url(#tg-glow)" />
      <ellipse cx="100" cy="186" rx="64" ry="8" fill="#2a0d15" opacity=".18" />
      <g className="t-flames">
        <path className="f f1" d="M100 82 C 70 60 82 30 92 6 C 96 30 112 22 108 0 C 132 30 132 62 100 82Z" fill="url(#tg-flame1)" />
        <path className="f f2" d="M100 82 C 80 66 88 44 98 26 C 100 44 112 40 112 26 C 122 48 120 68 100 82Z" fill="url(#tg-flame2)" />
        <path className="f f3" d="M100 82 C 90 74 94 62 100 52 C 106 62 110 74 100 82Z" fill="#fff6dc" />
      </g>
      <path d="M44 184 C 34 130 50 92 68 80 L 132 80 C 150 92 166 130 156 184 Z" fill="url(#tg-clay)" />
      <path d="M48 120 C 80 128 120 128 152 120" stroke="#efb65a" strokeOpacity=".55" strokeWidth="3" fill="none" />
      <path d="M44 150 C 80 160 120 160 156 150" stroke="#efb65a" strokeOpacity=".4" strokeWidth="3" fill="none" />
      <ellipse cx="100" cy="80" rx="34" ry="9" fill="#2a0d15" />
      <ellipse className="t-mouth" cx="100" cy="79" rx="26" ry="5" fill="#ff9a3c" />
      <g className="t-sparks">{[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={86 + i * 6} cy="74" r="1.8" fill="#ffd27a" style={{ '--i': i } as CSSProperties} />)}</g>
    </svg>
    {bell && <span className="t-bell"><Icon name="bell" size={44} /></span>}
  </div>;
}

// ── Rising embers on a canvas (pauses when off-screen / tab hidden) ──────────
export function Embers({ density = 26, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || reduced()) return;
    const g = c.getContext('2d')!; let raf = 0; let visible = true; const dpr = Math.min(2, devicePixelRatio || 1);
    type P = { x: number; y: number; r: number; vy: number; vx: number; life: number; hue: number };
    let ps: P[] = [];
    const resize = () => { c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr; };
    const spawn = (): P => ({ x: Math.random() * c.width, y: c.height + Math.random() * 40, r: (1 + Math.random() * 2.4) * dpr, vy: (.4 + Math.random() * 1.1) * dpr, vx: (Math.random() - .5) * .4 * dpr, life: 1, hue: 28 + Math.random() * 22 });
    resize(); ps = Array.from({ length: density }, () => { const p = spawn(); p.y = Math.random() * c.height; return p; });
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      g.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.y -= p.vy; p.x += p.vx + Math.sin((t / 600) + p.y / 40) * .3 * dpr; p.life = Math.min(1, p.y / c.height + .15);
        if (p.y < -10) Object.assign(p, spawn());
        g.beginPath(); g.fillStyle = `hsla(${p.hue},95%,62%,${p.life * .85})`; g.shadowColor = `hsla(${p.hue},100%,60%,.9)`; g.shadowBlur = 8 * dpr;
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      }
    };
    const obs = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); obs.observe(c);
    addEventListener('resize', resize); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); obs.disconnect(); removeEventListener('resize', resize); };
  }, [density]);
  return <canvas ref={ref} className={`embers ${className}`} aria-hidden="true" />;
}

// ── "Order sent" moment ───────────────────────────────────────────────────────
export function OrderSent({ number, table, images, onDone }: { number: number; table: string; images: string[]; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sfx('send'); haptic([30, 60, 30]);
    const t1 = setTimeout(() => { const r = ref.current?.querySelector('.os-ticket')?.getBoundingClientRect(); confetti(innerWidth / 2, r ? r.top : innerHeight / 2, 56); haptic(40); }, reduced() ? 0 : 1650);
    const t2 = setTimeout(onDone, reduced() ? 1500 : 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return <div className="order-sent" ref={ref} role="alertdialog" aria-label={`Order ${number} sent to the kitchen`}>
    <Embers density={40} />
    <div className="os-stage">
      <div className="os-drops">{images.slice(0, 5).map((src, i) => <img key={i} src={src} alt="" style={{ '--i': i, '--x': `${(i - (Math.min(images.length, 5) - 1) / 2) * 46}px` } as CSSProperties} />)}</div>
      <Tandoor heat={3} size={210} className="os-tandoor" />
    </div>
    <div className="os-ticket">
      <span className="os-stamp">Sent</span>
      <p>Order</p>
      <strong>#{number}</strong>
      <p>is with the kitchen{table ? `, for ${table === 'Takeaway' ? 'takeaway' : `table ${table}`}` : ''}.</p>
      <button className="btn btn-gold btn-lg" onClick={onDone}>Watch it cook</button>
    </div>
  </div>;
}

// ── Rich notifications (cards that stack, swipe away, carry an action) ───────
export type Notice = { id: number; icon: string; title: string; body?: string; tone?: 'wine' | 'gold' | 'green' | 'red'; action?: { label: string; run: () => void }; ms?: number };
let notices: Notice[] = [];
const nl = new Set<() => void>();
const emitN = () => nl.forEach(l => l());
export function notice(n: Omit<Notice, 'id'>) {
  const id = Date.now() + Math.random();
  notices = [{ ...n, id }, ...notices].slice(0, 4); emitN();
  setTimeout(() => dismiss(id), n.ms ?? 7000);
  return id;
}
export function dismiss(id: number) { notices = notices.filter(n => n.id !== id); emitN(); }
export function NoticeStack() {
  const list = useSyncExternalStore(cb => { nl.add(cb); return () => nl.delete(cb); }, () => notices);
  return <div className="notices" aria-live="assertive">{list.map(n => <NoticeCard key={n.id} n={n} />)}</div>;
}
function NoticeCard({ n }: { n: Notice }) {
  const [dx, setDx] = useState(0); const start = useRef<number | null>(null);
  return <div className={`notice tone-${n.tone || 'wine'}`} style={{ '--dx': `${dx}px`, '--ms': `${n.ms ?? 7000}ms` } as CSSProperties} role="status"
    onPointerDown={e => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
    onPointerMove={e => { if (start.current !== null) setDx(e.clientX - start.current); }}
    onPointerUp={() => { if (Math.abs(dx) > 70) dismiss(n.id); else setDx(0); start.current = null; }}>
    <span className="n-icon-big"><Icon name={n.icon} size={22} /></span>
    <div className="n-text"><b>{n.title}</b>{n.body && <small>{n.body}</small>}</div>
    {n.action && <button className="btn btn-sm btn-gold" onClick={() => { n.action!.run(); dismiss(n.id); }}>{n.action.label}</button>}
    <button className="n-close" aria-label="Dismiss" onClick={() => dismiss(n.id)}><Icon name="close" size={16} /></button>
    <i className="n-timer" />
  </div>;
}

// ── First-load splash (once per session) ─────────────────────────────────────
export function Splash() {
  const [show, setShow] = useState(() => { try { return !sessionStorage.getItem('smo-splash') && !reduced(); } catch { return false; } });
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem('smo-splash', '1'); } catch { /* ignore */ }
    const t = setTimeout(() => setShow(false), 1700); return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  return <div className="splash" onClick={() => setShow(false)} aria-hidden="true">
    <div className="splash-logo"><Logo size={96} /><i className="splash-ring" /></div>
    <div className="splash-name">Samrat</div>
  </div>;
}

// ── Install helper: Android gets the real install prompt, iPhone gets a guide ──
const DISMISS_KEY = 'smo-install-dismissed';
export function InstallNudge({ delay = 6000, children }: { delay?: number; children?: ReactNode }) {
  const prompt = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isStandalone() || safeGet(DISMISS_KEY)) return;
    const t = setTimeout(() => setOpen(true), delay); return () => clearTimeout(t);
  }, [delay]);
  const ios = isIOS();
  if (!open || isStandalone() || (!ios && !prompt)) return null;
  const close = () => { safeSet(DISMISS_KEY, String(Date.now())); setOpen(false); };
  return <div className={`install-nudge${ios ? ' ios' : ''}`} role="dialog" aria-label="Install the app">
    <div className="in-icon"><Logo size={44} /></div>
    <div className="in-text">
      <b>Add Samrat to your home screen</b>
      {ios ? <small>Tap <span className="ios-share" aria-label="Share">
        <svg width="14" height="16" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 1v11M3 5l4-4 4 4" /><path d="M1 8v8h12V8" /></svg></span> then <b>Add to Home Screen</b>.</small>
        : <small>{children ?? 'Opens full screen and tells you when your food is ready.'}</small>}
    </div>
    {!ios && <button className="btn btn-sm btn-primary" onClick={async () => { await install(); close(); }}>Install</button>}
    <button className="n-close" aria-label="Not now" onClick={close}><Icon name="close" size={16} /></button>
    {ios && <span className="ios-arrow" aria-hidden="true" />}
  </div>;
}
