import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
window.addEventListener('popstate', emit);
let snapshot = location.pathname + location.search;
const read = () => { const cur = location.pathname + location.search; if (cur !== snapshot) snapshot = cur; return snapshot; };

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  const go = () => { history[replace ? 'replaceState' : 'pushState'](null, '', to); emit(); window.scrollTo({ top: 0 }); };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(go);
  else go();
}
export function useRoute() {
  const full = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, read);
  const url = new URL(full, location.origin);
  return { path: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams };
}
export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href={to} {...rest} onClick={(e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); navigate(to);
  }} />;
}
