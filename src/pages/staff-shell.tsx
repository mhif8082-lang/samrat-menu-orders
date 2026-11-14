import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, ROLE_INFO, safeGet, safeSet, setAuth, useAuth, useLiveStream, useMenu, type Live, type Order, type Role, type StaffMember } from '../api';
import { Link, navigate, useRoute } from '../router';
import { chime, LiveBadge, Logo, notify, toast } from '../components/ui';
import { InstallButton } from '../pwa';

interface StaffCtx { orders: Order[]; live: Live; update: (id: string, body: object) => Promise<void>; reload: () => void; sound: boolean; setSound: (v: boolean) => void; days: number; setDays: (d: number) => void }
const Ctx = createContext<StaffCtx | null>(null);
export const useStaff = () => useContext(Ctx)!;

const ALL: Role[] = ['admin', 'waiter', 'tandoor', 'kitchen'];
export const NAV: { to: string; label: string; icon: string; roles: Role[] }[] = [
  { to: '/staff', label: 'Home', icon: '⌂', roles: ALL },
  { to: '/staff/orders', label: 'Front desk', icon: '🧾', roles: ['waiter', 'admin'] },
  { to: '/staff/station/tandoor', label: 'Tandoor orders', icon: '🔥', roles: ['tandoor', 'admin'] },
  { to: '/staff/station/kitchen', label: 'Kitchen orders', icon: '🍲', roles: ['kitchen', 'admin'] },
  { to: '/staff/station/bar', label: 'Drinks & bar', icon: '🥤', roles: ['waiter', 'admin'] },
  { to: '/staff/kitchen', label: 'All orders board', icon: '🍳', roles: ALL },
  { to: '/staff/menu', label: 'Menu', icon: '📋', roles: ALL },
  { to: '/staff/dashboard', label: 'Sales dashboard', icon: '📊', roles: ['admin'] },
  { to: '/staff/tables', label: 'Tables & QR', icon: '🔳', roles: ['admin'] },
  { to: '/staff/team', label: 'Team & logins', icon: '👥', roles: ['admin'] },
  { to: '/staff/settings', label: 'Settings', icon: '⚙', roles: ['admin'] },
];
export const canSee = (role: Role | undefined, path: string) => !!role && (NAV.find(n => n.to === path)?.roles.includes(role) ?? true);

export function StaffShell({ children, title, wide }: { children: ReactNode; title: string; wide?: boolean }) {
  const auth = useAuth();
  const { path } = useRoute();
  useMenu();
  const [orders, setOrders] = useState<Order[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [sound, setSoundState] = useState(safeGet('smo-sound') !== 'off');
  const [days, setDays] = useState(1);
  const soundRef = useRef(sound); soundRef.current = sound;
  const seen = useRef(new Set<string>());
  const assistSeen = useRef(new Map<string, number>());
  const first = useRef(true);

  const reload = useCallback(() => {
    api<{ orders: Order[] }>(`/orders?days=${days}`).then(r => {
      r.orders.forEach(o => { seen.current.add(o.id); if (o.assist) assistSeen.current.set(o.id, o.assist.at); });
      setOrders(r.orders); first.current = false;
    }).catch(e => { if (e instanceof ApiError && e.status === 401) navigate('/staff/login', true); });
  }, [days]);
  useEffect(() => { if (auth) reload(); }, [auth, reload]);

  const live = useLiveStream({
    staff: true, onHello: reload,
    onOrder: o => {
      setOrders(cur => { const i = cur.findIndex(x => x.id === o.id); if (i < 0) return [...cur, o]; const n = cur.slice(); n[i] = o; return n; });
      if (!seen.current.has(o.id)) {
        seen.current.add(o.id);
        if (!first.current) { if (soundRef.current) chime('new'); notify(`New order #${o.number}`, `Table ${o.table} · ${o.items.map(i => `${i.qty}× ${i.name}`).join(', ')}`); toast(`New order #${o.number} · Table ${o.table}`, 'info'); }
      }
      if (o.assist && assistSeen.current.get(o.id) !== o.assist.at) {
        assistSeen.current.set(o.id, o.assist.at);
        const what = o.assist.type === 'bill' ? 'wants the bill' : 'is calling a waiter';
        if (soundRef.current) chime('assist'); notify(`Table ${o.table} ${what}`, `Order #${o.number}`); toast(`Table ${o.table} ${what}`, 'info');
      }
    },
  });

  const update = useCallback(async (id: string, body: object) => {
    try { const r = await api<{ order: Order }>(`/orders/${id}`, { method: 'PATCH', body }); setOrders(cur => cur.map(o => o.id === id ? r.order : o)); }
    catch (e) { toast((e as Error).message, 'error'); }
  }, []);
  const setSound = (v: boolean) => { setSoundState(v); safeSet('smo-sound', v ? 'on' : 'off'); if (v) chime('new'); };

  useEffect(() => { if (!auth) navigate('/staff/login', true); }, [auth]);
  if (!auth) return null;
  const role = auth.staff.role;
  const alerts = orders.filter(o => o.assist && o.status !== 'cancelled').length;
  const active = orders.filter(o => o.status === 'new').length;

  return <Ctx.Provider value={{ orders, live, update, reload, sound, setSound, days, setDays }}>
    <div className={`staff${navOpen ? ' nav-open' : ''}`}>
      <aside className="s-side">
        <Link to="/staff" className="brand light"><Logo size={38} /><span><strong>Samrat</strong><small>Staff</small></span></Link>
        <nav>{NAV.filter(n => n.roles.includes(role)).map(n => <Link key={n.to} to={n.to} onClick={() => setNavOpen(false)} className={path === n.to ? 'active' : ''}>
          <span className="n-icon" aria-hidden="true">{n.icon}</span>{n.label}
          {n.to === '/staff/kitchen' && active > 0 && <span className="n-badge">{active}</span>}
          {n.to === '/staff/orders' && alerts > 0 && <span className="n-badge alert">{alerts}</span>}
        </Link>)}</nav>
        <div className="s-side-foot">
          <InstallButton className="side-link" />
          <Link to="/" className="side-link">↗ Guest view</Link>
          <div className="who"><span className="avatar">{auth.staff.name[0]}</span><div><b>{auth.staff.name}</b><small>{ROLE_INFO[role]?.label}</small></div>
            <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => { api('/logout', { method: 'POST' }).catch(() => {}); setAuth(null); }}>⎋</button></div>
        </div>
      </aside>
      <div className="s-scrim" onClick={() => setNavOpen(false)} />
      <main className={`s-main${wide ? ' wide' : ''}`}>
        <header className="s-top">
          <button className="icon-btn menu-toggle" onClick={() => setNavOpen(!navOpen)} aria-label="Open navigation">☰</button>
          <h1>{title}</h1>
          <div className="s-top-right">
            <button className={`icon-btn${sound ? ' on' : ''}`} onClick={() => setSound(!sound)} aria-pressed={sound} title={sound ? 'Sound on' : 'Sound off'} aria-label="Toggle sound">{sound ? '🔔' : '🔕'}</button>
            <LiveBadge state={live} />
          </div>
        </header>
        <div className="s-content" key={path}>{children}</div>
      </main>
      <nav className="s-tabs" aria-label="Quick navigation">
        {NAV.filter(n => n.to !== '/staff' && n.roles.includes(role)).slice(0, 4).map(n => <Link key={n.to} to={n.to} className={path === n.to ? 'active' : ''}><span aria-hidden="true">{n.icon}</span><small>{n.label.replace(' orders', '').replace('All orders board', 'Board').replace('Sales dashboard', 'Sales').replace(' & bar', '').replace(' & logins', '')}</small>
          {n.to === '/staff/kitchen' && active > 0 && <i className="n-badge">{active}</i>}{n.to === '/staff/orders' && alerts > 0 && <i className="n-badge alert">{alerts}</i>}</Link>)}
        <button onClick={() => setNavOpen(true)}><span aria-hidden="true">☰</span><small>More</small></button>
      </nav>
    </div>
  </Ctx.Provider>;
}

export function StaffLogin() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const pw = useRef<HTMLInputElement>(null);
  useEffect(() => { if (auth) navigate(ROLE_INFO[auth.staff.role]?.home || '/staff', true); }, [auth]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try { const r = await api<{ token: string; staff: StaffMember }>('/login', { method: 'POST', body: { username, password } }); setAuth(r); toast(`Welcome, ${r.staff.name}`); }
    catch (e) { setErr((e as Error).message); setPassword(''); setShake(s => s + 1); navigator.vibrate?.(200); }
    finally { setBusy(false); }
  }
  return <div className="login-page">
    <div className="login-glow" aria-hidden="true" />
    <form className="login-card" onSubmit={submit} key={shake} data-shake={shake > 0}>
      <Logo size={68} />
      <h1>Staff sign in</h1>
      <p>Choose your section, then enter your password.</p>
      <div className="role-pick" role="radiogroup" aria-label="Section">{(Object.keys(ROLE_INFO) as Role[]).map(r =>
        <button type="button" key={r} role="radio" aria-checked={username === r} className={`role-btn${username === r ? ' on' : ''}`} onClick={() => { setUsername(r); setErr(''); setTimeout(() => pw.current?.focus(), 50); }}>
          <span aria-hidden="true">{ROLE_INFO[r].icon}</span><b>{ROLE_INFO[r].label}</b></button>)}</div>
      <label className="field"><span>Username</span><input value={username} onChange={e => setUsername(e.target.value.toLowerCase().trim())} autoComplete="username" autoCapitalize="none" required placeholder="e.g. waiter" /></label>
      <label className="field"><span>Password</span><div className="pw-wrap"><input ref={pw} aria-label="Password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? '🙈' : '👁'}</button></div></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn btn-primary btn-lg block" disabled={busy}>{busy ? <span className="spinner" /> : <>Sign in <span aria-hidden="true">→</span></>}</button>
      <Link to="/" className="muted small">← Back to guest menu</Link>
    </form>
  </div>;
}
