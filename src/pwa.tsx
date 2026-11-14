import { useSyncExternalStore } from 'react';
import { Link } from './router';
import { GuestHeader } from './pages/guest';
import { Logo } from './components/ui';
import { Icon } from './components/icons';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach(l => l());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
window.addEventListener('appinstalled', () => { deferred = null; emit(); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function registerSW() {
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker?.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {}));
  }
}
export const useInstall = () => useSyncExternalStore(cb => { ls.add(cb); return () => ls.delete(cb); }, () => deferred);

export async function install() {
  if (!deferred) return false;
  await deferred.prompt(); const r = await deferred.userChoice; deferred = null; emit();
  return r.outcome === 'accepted';
}

export function InstallButton({ className = 'link-btn' }: { className?: string }) {
  const can = useInstall();
  if (standalone()) return null;
  return can ? <button className={className} onClick={install}><Icon name="download" size={16} /> Install app</button> : <Link className={className} to="/install"><Icon name="download" size={16} /> Get the app</Link>;
}

export function InstallPage() {
  const can = useInstall();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return <div className="page">
    <GuestHeader />
    <section className="install">
      <div className="app-icon-big"><Logo size={110} /></div>
      <span className="kicker">Samrat Menu Orders</span>
      <h1>Install the app</h1>
      <p>Get Samrat on your home screen. It opens full-screen, starts instantly, and staff devices get order alerts.</p>
      {standalone() ? <p className="ok-note"><Icon name="check" size={16} /> You're already using the installed app.</p> :
        can ? <button className="btn btn-primary btn-lg" onClick={install}><Icon name="download" size={18} /> Install Samrat Menu Orders</button> :
          <div className="install-steps">
            {ios ? <ol><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button <Icon name="external" size={15} />.</li><li>Choose <b>Add to Home Screen</b>.</li></ol>
              : <ol><li>Open this page in <b>Chrome</b> or <b>Edge</b>.</li><li>Tap the menu <b>⋮</b> (or the install icon in the address bar).</li><li>Choose <b>Install app</b> / <b>Add to Home screen</b>.</li></ol>}
          </div>}
      <div className="install-grid">
        <div className="card"><h3>For guests</h3><p>Browse the menu, order from your table and follow your food live.</p></div>
        <div className="card"><h3>For staff</h3><p>Tandoor, kitchen and drinks screens, alerts, front desk and the sales dashboard. <Link to="/staff">Staff sign in</Link></p></div>
      </div>
    </section>
  </div>;
}
