import { asset } from './base';
// Motion, sound and device helpers shared across the app.
// Everything respects prefers-reduced-motion and degrades quietly on devices
// without the API (e.g. iOS has no navigator.vibrate).

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(navigator.userAgent);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// ── Scroll reveal: any element with .reveal animates in when it enters the viewport ──
let io: IntersectionObserver | null = null;
export function startScrollReveal() {
  const show = (el: Element) => el.classList.add('seen');
  if (!('IntersectionObserver' in window) || reduced()) {
    new MutationObserver(() => document.querySelectorAll('.reveal:not(.seen)').forEach(show)).observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.reveal').forEach(show);
    return;
  }
  io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { show(e.target); io!.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  const scan = () => document.querySelectorAll('.reveal:not(.seen):not([data-io])').forEach(el => { (el as HTMLElement).dataset.io = '1'; io!.observe(el); });
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}

// ── Scroll state: progress bar + header shadow ──
export function startScrollState() {
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--scroll', String(max > 0 ? Math.min(1, scrollY / max) : 0));
    document.documentElement.style.setProperty('--scroll-px', String(scrollY));
    document.body.classList.toggle('scrolled', scrollY > 8);
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}

// ── Ripple on press ──
export function startRipples() {
  addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest('.btn, .add-btn, .chip, .opt, .role-btn, .tile, .float-basket, .bag-btn') as HTMLElement | null;
    if (!el || reduced() || (el as HTMLButtonElement).disabled) return;
    const r = el.getBoundingClientRect(); const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span'); s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(s); setTimeout(() => s.remove(), 650);
  }, { passive: true });
}

// ── Sound (Web Audio). iOS needs a user gesture before audio can play. ──
let ctx: AudioContext | null = null;
let unlocked = false;
const unlockListeners = new Set<() => void>();
export const audioUnlocked = () => unlocked;
export const onAudioUnlock = (f: () => void) => { unlockListeners.add(f); return () => { unlockListeners.delete(f); }; };
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // Play a silent buffer: the reliable way to unlock audio on iOS Safari.
    const b = ctx.createBuffer(1, 1, 22050); const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
    // Notify after the current tap finishes, so UI that reacts to this never shifts under the finger.
    if (!unlocked) { unlocked = true; setTimeout(() => unlockListeners.forEach(f => f()), 400); }
  } catch { /* no audio */ }
}
addEventListener('pointerdown', unlockAudio, { passive: true });
addEventListener('keydown', unlockAudio);

type Note = [freq: number, at: number, dur: number, type?: OscillatorType, vol?: number];
const SOUNDS: Record<string, Note[]> = {
  add: [[880, 0, .08, 'triangle', .12], [1320, .05, .1, 'triangle', .08]],
  remove: [[520, 0, .08, 'triangle', .08]],
  send: [[392, 0, .12, 'sine', .18], [523, .1, .12, 'sine', .18], [659, .2, .12, 'sine', .18], [1047, .32, .35, 'triangle', .14]],
  ready: [[1047, 0, .6, 'sine', .22], [1319, .02, .6, 'sine', .12], [1568, .35, .9, 'sine', .2], [2093, .37, .9, 'sine', .08]],
  newOrder: [[660, 0, .16, 'sine', .24], [880, .14, .16, 'sine', .24], [1320, .28, .4, 'triangle', .2], [660, .7, .16, 'sine', .2], [880, .84, .3, 'sine', .2]],
  assist: [[784, 0, .5, 'sine', .25], [784, .55, .5, 'sine', .25]],
  done: [[988, 0, .07, 'square', .05], [1319, .07, .14, 'triangle', .1]],
};
export function sfx(name: keyof typeof SOUNDS) {
  if (!ctx || !unlocked) return;
  try {
    const t0 = ctx.currentTime + .01;
    for (const [f, at, dur, type = 'sine', vol = .15] of SOUNDS[name]) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol, t0 + at + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + .05);
    }
  } catch { /* ignore */ }
}

export const haptic = (p: number | number[] = 12) => { try { navigator.vibrate?.(p); } catch { /* iOS: not supported */ } };

// ── Tab title flashing + app icon badge for background alerts ──
let flashTimer: number | undefined; let baseTitle = document.title;
export function flashTitle(text: string) {
  if (!document.hidden) return;
  window.clearInterval(flashTimer); baseTitle = document.title.startsWith('●') ? baseTitle : document.title;
  let on = false;
  flashTimer = window.setInterval(() => { document.title = (on = !on) ? text : baseTitle; }, 1000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { window.clearInterval(flashTimer); document.title = baseTitle; } });
export function setBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try { (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {}); } catch { /* unsupported */ }
}

/** System notification (works in the background when the app is installed; iOS 16.4+ home-screen apps too). */
export async function systemNotify(title: string, body: string, opts: { tag?: string; url?: string; force?: boolean } = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden && !opts.force) return;
    // Push is on: the server's push already shows this notification, so don't double up.
    if (!opts.force) { try { if (localStorage.getItem('smo-push-on') === '1') return; } catch { /* ignore */ } }
    const reg = await navigator.serviceWorker?.getRegistration();
    const o = { body, icon: asset('/icons/icon-192.png'), badge: asset('/icons/badge-96.png'), tag: opts.tag || title, data: { url: opts.url || location.pathname + location.search }, vibrate: [200, 100, 200] } as NotificationOptions;
    if (reg) await reg.showNotification(title, o); else new Notification(title, o);
  } catch { /* ignore */ }
}
export async function askNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

/** Fly an image (or a small dot) from an element to the basket along an arc. */
export function flyTo(from: Element | null, image?: string) {
  const target = document.querySelector('[data-basket-target]');
  if (!from || !target || reduced()) return;
  const a = from.getBoundingClientRect(); const b = target.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'fly';
  if (image) el.style.backgroundImage = `url(${asset(image)})`; else el.classList.add('fly-dot');
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  el.style.left = `${x0}px`; el.style.top = `${y0}px`;
  document.body.appendChild(el);
  const dx = x1 - x0, dy = y1 - y0, lift = Math.min(-80, dy / 2 - 120);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.6) rotate(0)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.15) rotate(-8deg)', opacity: 1, offset: .12 },
    { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${lift}px)) scale(.95) rotate(12deg)`, offset: .55 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2) rotate(30deg)`, opacity: .7 },
  ], { duration: 720, easing: 'cubic-bezier(.45,0,.25,1)' }).onfinish = () => {
    el.remove();
    target.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-14deg) scale(1.22)' }, { transform: 'rotate(10deg) scale(1.1)' }, { transform: 'rotate(0) scale(1)' }], { duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    const plus = document.createElement('span'); plus.className = 'plus-one'; plus.textContent = '+1';
    plus.style.left = `${x1}px`; plus.style.top = `${b.top}px`; document.body.appendChild(plus); setTimeout(() => plus.remove(), 900);
  };
}

/** Gold-leaf confetti in the brand colours. */
export function confetti(x = innerWidth / 2, y = innerHeight / 3, count = 50) {
  if (reduced()) return;
  const colors = ['#efb65a', '#f6cf8c', '#d89a3c', '#581d2b', '#fff3d6'];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = i % 3 ? 'confetti' : 'confetti leaf';
    p.style.background = colors[i % colors.length];
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 240;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist - 150}px`);
    p.style.setProperty('--r', `${Math.random() * 900 - 450}deg`);
    p.style.animationDuration = `${1.2 + Math.random() * .9}s`;
    frag.appendChild(p); setTimeout(() => p.remove(), 2300);
  }
  document.body.appendChild(frag);
}
