import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BASE, REMOTE_BACKEND } from './base';

// ── Finding the server ───────────────────────────────────────────────────────
// On GitHub Pages the server is the laptop, reached through a public link that can change.
// The laptop publishes its current link in backend.json; we read it, remember it, and re-read it on failure.
let apiBase = REMOTE_BACKEND ? (() => { try { return localStorage.getItem('smo-api') || ''; } catch { return ''; } })() : '/api';
let resolving: Promise<string> | null = null;
let lastResolve = 0;
export async function resolveApi(force = false): Promise<string> {
  if (!REMOTE_BACKEND) return '/api';
  if (apiBase && !force) return apiBase;
  if (force && Date.now() - lastResolve < 4000 && apiBase) return apiBase;
  resolving ??= (async () => {
    try {
      const r = await fetch(`${BASE}backend.json?t=${Date.now()}`, { cache: 'no-store' });
      const j = await r.json() as { url?: string };
      if (j.url) { apiBase = j.url.replace(/\/$/, '') + '/api'; try { localStorage.setItem('smo-api', apiBase); } catch { /* ignore */ } }
    } catch { /* keep the last known address */ }
    lastResolve = Date.now();
    return apiBase;
  })().finally(() => { resolving = null; });
  return resolving;
}

export type Station = 'tandoor' | 'kitchen' | 'bar';
export type Status = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
export interface DishOption { label: string; price: number }
export interface Dish { id: string; name: string; category: string; station: Station; price: number; options?: DishOption[]; image?: string; description: string; veg?: boolean; badge?: string; available: boolean }
export interface Settings { restaurantName: string; tables: number; ordersOpen: boolean; serviceChargePct: number; vatPct: number; currency: string }
export interface MenuData { items: Dish[]; categories: string[]; settings: Settings; version?: number }
export interface OrderItem { id: string; name: string; option?: string; price: number; qty: number; station: Station; note: string; done: boolean }
export interface Order {
  id: string; number: number; table: string; name: string; note: string; items: OrderItem[];
  status: Status; paid: boolean; payMethod?: string; createdAt: number; times: Partial<Record<Status, number>>;
  assist: { type: 'waiter' | 'bill'; at: number } | null; subtotal: number; service: number; vat: number; total: number;
  source?: 'guest' | 'staff'; takenBy?: string; updatedBy?: string; cancelledBy?: string;
}
export type Role = 'admin' | 'waiter' | 'tandoor' | 'kitchen';
export interface StaffMember { id: string; username: string; name: string; role: Role }
export const ROLE_INFO: Record<Role, { label: string; home: string; icon: string; text: string }> = {
  waiter: { label: 'Waiter', home: '/staff/orders', icon: 'waiter', text: 'Tables, serving, bills & drinks' },
  tandoor: { label: 'Tandoor section', home: '/staff/station/tandoor', icon: 'tandoor', text: 'Naan, roti, tandoori & grill' },
  kitchen: { label: 'Kitchen section', home: '/staff/station/kitchen', icon: 'pot', text: 'Curries, momo, rice & more' },
  admin: { label: 'Admin', home: '/staff/dashboard', icon: 'chart', text: 'Sales, dashboard, menu, team' },
};

export const STATIONS: { id: Station; label: string; icon: string }[] = [
  { id: 'tandoor', label: 'Tandoor', icon: 'tandoor' },
  { id: 'kitchen', label: 'Kitchen', icon: 'pot' },
  { id: 'bar', label: 'Drinks & bar', icon: 'glass' },
];
export const STATUS_LABEL: Record<Status, string> = { new: 'New', preparing: 'Cooking', ready: 'Ready', served: 'Served', cancelled: 'Cancelled' };

export const npr = (v: number) => `NPR ${Math.round(v).toLocaleString('en-IN')}`;
export function ago(ts: number, nowTs = Date.now()) {
  const s = Math.max(0, Math.floor((nowTs - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); return `${h}h ${m % 60}m`;
}
export const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// ── Auth (staff session token) ──────────────────────────────────────────────
const TOKEN_KEY = 'smo-staff-token';
const STAFF_KEY = 'smo-staff';
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

type Auth = { token: string; staff: StaffMember } | null;
let auth: Auth = (() => { const t = safeGet(TOKEN_KEY); const s = safeGet(STAFF_KEY); try { return t && s ? { token: t, staff: JSON.parse(s) } : null; } catch { return null; } })();
const authListeners = new Set<() => void>();
export function setAuth(a: Auth) {
  auth = a; safeSet(TOKEN_KEY, a?.token ?? null); safeSet(STAFF_KEY, a ? JSON.stringify(a.staff) : null);
  authListeners.forEach(l => l());
}
export const useAuth = () => useSyncExternalStore(cb => { authListeners.add(cb); return () => authListeners.delete(cb); }, () => auth);

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${auth.token}`;
  let res: Response | null = null;
  const init = { method: opts.method || 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) };
  // Try the known server address; if it's gone (laptop restarted with a new link), look it up again and retry once.
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    const base = await resolveApi(attempt > 0);
    try {
      const r = await fetch(`${base}${path}`, init);
      if (REMOTE_BACKEND && attempt === 0 && [502, 503, 504, 521, 522, 523, 530].includes(r.status)) continue;
      res = r;
    } catch { if (!REMOTE_BACKEND) break; }
  }
  if (!res) throw new ApiError(0, REMOTE_BACKEND ? 'The restaurant system is offline right now. Please ask a member of staff.' : 'You appear to be offline. Check your connection and try again.');
  if (res.status === 401 && auth && path !== '/login') setAuth(null);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong');
  return data as T;
}

// ── Live menu (shared store, updated over SSE) ──────────────────────────────
let menu: MenuData | null = null;
const menuListeners = new Set<() => void>();
const setMenu = (m: MenuData) => { menu = m; menuListeners.forEach(l => l()); };
let menuLoading: Promise<void> | null = null;
export function loadMenu() {
  menuLoading ??= api<MenuData>('/menu').then(setMenu).catch(() => { menuLoading = null; });
  return menuLoading;
}
export function useMenu() {
  const m = useSyncExternalStore(cb => { menuListeners.add(cb); return () => menuListeners.delete(cb); }, () => menu);
  useEffect(() => { if (!m) loadMenu(); }, [m]);
  return m;
}
export const refreshMenu = () => api<MenuData>('/menu').then(setMenu);

// ── Live connection ─────────────────────────────────────────────────────────
export type Live = 'connecting' | 'live' | 'offline';
/** Live order updates. Uses Server-Sent Events, and falls back to polling every 2s
 *  when a proxy buffers the stream (e.g. free Cloudflare tunnels). */
export function useLiveStream(opts: { staff?: boolean; orders?: string[]; onOrder?: (o: Order) => void; onHello?: () => void; onRemoved?: (id: string) => void }) {
  const [state, setState] = useState<Live>('connecting');
  const handlers = useRef(opts); handlers.current = opts;
  const token = useAuth()?.token;
  const orderKey = (opts.orders || []).join(',');
  useEffect(() => {
    const q = new URLSearchParams();
    if (opts.staff && token) { q.set('token', token); q.set('staff', '1'); }
    orderKey.split(',').filter(Boolean).forEach(o => q.append('order', o));
    let es: EventSource | null = null; let retry: number | undefined; let closed = false;
    let streaming = false; let since = Date.now(); let menuVersion = menu?.version ?? 0; let pollTimer: number | undefined; let fails = 0;
    const poll = async () => {
      if (closed) return;
      if (!streaming && !document.hidden) {
        try {
          const headers: Record<string, string> = auth ? { authorization: `Bearer ${auth.token}` } : {};
          const r = await fetch(`${await resolveApi(fails > 2)}/updates?${q}&since=${since - 3000}`, { headers });
          if (!r.ok) throw new Error();
          const data: { at: number; menuVersion: number; orders: Order[] } = await r.json();
          since = data.at; fails = 0;
          data.orders.forEach(o => handlers.current.onOrder?.(o));
          if (menuVersion && data.menuVersion !== menuVersion) refreshMenu().catch(() => {});
          menuVersion = data.menuVersion;
          setState('live');
        } catch { if (++fails > 1) setState('offline'); }
      }
      pollTimer = window.setTimeout(poll, 2000);
    };
    const connect = async () => {
      const base = await resolveApi(); if (closed) return;
      es = new EventSource(`${base}/stream?${q}`);
      es.addEventListener('hello', () => { streaming = true; setState('live'); handlers.current.onHello?.(); });
      es.addEventListener('order', e => handlers.current.onOrder?.(JSON.parse((e as MessageEvent).data)));
      es.addEventListener('menu', e => setMenu(JSON.parse((e as MessageEvent).data)));
      es.addEventListener('removed', e => handlers.current.onRemoved?.(JSON.parse((e as MessageEvent).data).id));
      es.onerror = () => {
        if (streaming) { streaming = false; since = Date.now() - 10000; }
        if (es?.readyState === EventSource.CLOSED && !closed) retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    pollTimer = window.setTimeout(poll, 1200);
    return () => { closed = true; es?.close(); window.clearTimeout(retry); window.clearTimeout(pollTimer); };
  }, [opts.staff, token, orderKey]);
  return state;
}

/** Re-render every `ms` so timers stay fresh. */
export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setN(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return n;
}

// ── Guest's own orders (remembered on this device) ──────────────────────────
const MINE_KEY = 'smo-my-orders';
export interface MyOrderRef { id: string; key: string; number: number; at: number }
export function myOrders(): MyOrderRef[] {
  try { const v = JSON.parse(safeGet(MINE_KEY) || '[]'); return Array.isArray(v) ? v.filter(o => Date.now() - o.at < 2 * 86400_000) : []; } catch { return []; }
}
export function rememberOrder(ref: MyOrderRef) { safeSet(MINE_KEY, JSON.stringify([ref, ...myOrders().filter(o => o.id !== ref.id)].slice(0, 20))); }
export { safeGet, safeSet };
