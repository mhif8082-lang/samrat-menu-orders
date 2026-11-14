import { useSyncExternalStore } from 'react';
import { safeGet, safeSet, type Dish } from './api';

/** Cart keys are the dish id, or "id::Option" for dishes with sizes/styles. */
export interface Line { qty: number; note: string }
export type Cart = Record<string, Line>;
const KEY = 'smo-cart-v2';
const TABLE_KEY = 'smo-table';

let cart: Cart = (() => { try { const v = JSON.parse(safeGet(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
const listeners = new Set<() => void>();
function set(next: Cart) { cart = next; safeSet(KEY, JSON.stringify(cart)); listeners.forEach(l => l()); }

export const cartKey = (id: string, option?: string) => option ? `${id}::${option}` : id;
export const splitKey = (key: string) => { const [id, option] = key.split('::'); return { id, option }; };
export const useCart = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => cart);
export function addToCart(key: string, qty = 1, note?: string) {
  const cur = cart[key] || { qty: 0, note: '' };
  const q = Math.min(50, Math.max(0, cur.qty + qty));
  const next = { ...cart };
  if (q) next[key] = { qty: q, note: note ?? cur.note }; else delete next[key];
  set(next);
}
export const setNote = (key: string, note: string) => cart[key] && set({ ...cart, [key]: { ...cart[key], note: note.slice(0, 140) } });
export const clearCart = () => set({});

/** Resolve the cart against the live menu (drops dishes/options that no longer exist). */
export function cartLines(c: Cart, items: Dish[] | undefined) {
  const out: { key: string; dish: Dish; option?: string; price: number; qty: number; note: string }[] = [];
  for (const [key, line] of Object.entries(c)) {
    const { id, option } = splitKey(key);
    const dish = items?.find(x => x.id === id);
    if (!dish) continue;
    const price = dish.options?.length ? dish.options.find(o => o.label === option)?.price : option ? undefined : dish.price;
    if (price === undefined) continue;
    out.push({ key, dish, option, price, qty: line.qty, note: line.note });
  }
  return out;
}
export function cartSummary(c: Cart, items: Dish[] | undefined) {
  const lines = cartLines(c, items);
  return { count: lines.reduce((t, l) => t + l.qty, 0), total: lines.reduce((t, l) => t + l.price * l.qty, 0) };
}
/** How many of a dish (all options together) are in the cart. */
export const dishCount = (c: Cart, id: string) => Object.entries(c).reduce((t, [k, l]) => t + (splitKey(k).id === id ? l.qty : 0), 0);
export const getTable = () => safeGet(TABLE_KEY) || '';
export const saveTable = (t: string) => safeSet(TABLE_KEY, t);
