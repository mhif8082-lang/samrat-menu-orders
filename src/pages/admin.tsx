import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { api, npr, refreshMenu, ROLE_INFO, STATIONS, useAuth, useMenu, type Dish, type Role, type Settings, type StaffMember, type Station } from '../api';
import { CountUp, DishArt, Empty, Sheet, toast, VegMark } from '../components/ui';
import { StaffShell, useStaff } from './staff-shell';

// ── Dashboard ───────────────────────────────────────────────────────────────
export function Dashboard() { return <StaffShell title="Dashboard"><DashInner /></StaffShell>; }
function DashInner() {
  const { orders, days, setDays } = useStaff();
  useEffect(() => { if (days === 1) setDays(7); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [range, setRange] = useState<'today' | '7' | '30'>('today');
  useEffect(() => { const need = range === '30' ? 30 : 7; if (days < need) setDays(need); }, [range, days, setDays]);
  const start = range === 'today' ? new Date(new Date().toDateString()).getTime() : Date.now() - Number(range) * 86400_000;
  const inRange = orders.filter(o => o.createdAt >= start);
  const valid = inRange.filter(o => o.status !== 'cancelled');
  const revenue = valid.reduce((t, o) => t + o.total, 0);
  const paid = valid.filter(o => o.paid).reduce((t, o) => t + o.total, 0);
  const avg = valid.length ? revenue / valid.length : 0;
  const prepTimes = valid.filter(o => o.times.ready).map(o => (o.times.ready! - o.createdAt) / 60000);
  const avgPrep = prepTimes.length ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : 0;

  const buckets = useMemo(() => {
    if (range === 'today') {
      const b = Array.from({ length: 24 }, (_, h) => ({ label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, v: 0, n: 0 }));
      valid.forEach(o => { const h = new Date(o.createdAt).getHours(); b[h].v += o.total; b[h].n++; });
      const first = b.findIndex(x => x.n) ; const last = 23 - [...b].reverse().findIndex(x => x.n);
      return first < 0 ? b.slice(10, 23) : b.slice(Math.max(0, Math.min(first, 10)), Math.max(last + 1, 22));
    }
    const n = Number(range);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i));
      const next = d.getTime() + 86400_000;
      const list = valid.filter(o => o.createdAt >= d.getTime() && o.createdAt < next);
      return { label: n > 7 ? String(d.getDate()) : d.toLocaleDateString([], { weekday: 'short' }), v: list.reduce((t, o) => t + o.total, 0), n: list.length };
    });
  }, [valid, range]);
  const max = Math.max(1, ...buckets.map(b => b.v));

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number }>();
    valid.forEach(o => o.items.forEach(i => { const c = m.get(i.name) || { qty: 0, rev: 0 }; c.qty += i.qty; c.rev += i.qty * i.price; m.set(i.name, c); }));
    return [...m.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6);
  }, [valid]);
  const stationLoad = STATIONS.map(s => ({ ...s, qty: valid.reduce((t, o) => t + o.items.filter(i => i.station === s.id).reduce((a, i) => a + i.qty, 0), 0) }));
  const stationMax = Math.max(1, ...stationLoad.map(s => s.qty));
  const methods = ['Cash', 'Card', 'QR'].map(m => ({ m, v: valid.filter(o => o.paid && o.payMethod === m).reduce((t, o) => t + o.total, 0) }));

  return <>
    <div className="seg range">{([['today', 'Today'], ['7', '7 days'], ['30', '30 days']] as const).map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
    <div className="kpis">
      <div className="kpi reveal" style={{ '--d': 0 } as React.CSSProperties}><small>Revenue</small><b><CountUp value={revenue} format={npr} /></b><span>{npr(paid)} collected</span></div>
      <div className="kpi reveal" style={{ '--d': 1 } as React.CSSProperties}><small>Orders</small><b><CountUp value={valid.length} /></b><span>{inRange.length - valid.length} cancelled</span></div>
      <div className="kpi reveal" style={{ '--d': 2 } as React.CSSProperties}><small>Average order</small><b><CountUp value={avg} format={npr} /></b><span>per table</span></div>
      <div className="kpi reveal" style={{ '--d': 3 } as React.CSSProperties}><small>Avg. time to ready</small><b><CountUp value={avgPrep} format={v => `${v.toFixed(1)}m`} /></b><span>{prepTimes.length} orders timed</span></div>
    </div>
    <div className="dash-grid">
      <section className="card chart-card">
        <h3>{range === 'today' ? 'Sales by hour' : 'Sales by day'}</h3>
        <div className="bars" role="img" aria-label="Sales chart">{buckets.map((b, i) => <div key={i} className="bar-col" title={`${b.label}: ${npr(b.v)} · ${b.n} orders`}>
          <div className="bar" style={{ height: `${(b.v / max) * 100}%`, '--d': i } as React.CSSProperties}>{b.v > 0 && <span>{b.v >= 1000 ? `${(b.v / 1000).toFixed(1)}k` : b.v}</span>}</div><small>{b.label}</small>
        </div>)}</div>
      </section>
      <section className="card">
        <h3>Best sellers</h3>
        {top.length === 0 ? <p className="muted">No sales yet in this period.</p> : <ol className="top-list">{top.map(([n, v], i) => <li key={n} className="reveal" style={{ '--d': i } as React.CSSProperties}><span className="rank">{i + 1}</span><b>{n}</b><span>{v.qty} sold</span><small>{npr(v.rev)}</small></li>)}</ol>}
      </section>
      <section className="card">
        <h3>Station load</h3>
        {stationLoad.map(s => <div key={s.id} className="hbar"><span>{s.icon} {s.id === 'bar' ? 'Drinks' : s.label}</span><div><i style={{ width: `${(s.qty / stationMax) * 100}%` }} /></div><b>{s.qty}</b></div>)}
      </section>
      <section className="card">
        <h3>Payments</h3>
        {methods.map(p => <div key={p.m} className="hbar"><span>{p.m}</span><div><i className="gold" style={{ width: `${paid ? (p.v / paid) * 100 : 0}%` }} /></div><b>{npr(p.v)}</b></div>)}
        <div className="hbar"><span>Unpaid</span><div><i className="muted-bar" style={{ width: `${revenue ? ((revenue - paid) / revenue) * 100 : 0}%` }} /></div><b>{npr(revenue - paid)}</b></div>
      </section>
    </div>
  </>;
}

// ── Menu management ─────────────────────────────────────────────────────────
export function MenuAdmin() { return <StaffShell title="Menu"><MenuInner /></StaffShell>; }
function MenuInner() {
  const menu = useMenu();
  const isManager = useAuth()?.staff.role === 'admin';
  const [edit, setEdit] = useState<Partial<Dish> | null>(null);
  const [bulk, setBulk] = useState(false);
  const [q, setQ] = useState('');
  if (!menu) return null;
  async function toggle(d: Dish) {
    try { await api(`/menu/${d.id}`, { method: 'PATCH', body: { available: !d.available } }); await refreshMenu(); toast(`${d.name} ${d.available ? 'marked sold out' : 'back on the menu'}`); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  const items = menu.items.filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="desk-tools">
      <label className="search sm"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a dish" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a dish" /></label>
      {isManager && <><button className="btn btn-ghost btn-sm" onClick={() => setBulk(true)}>📋 Paste menu</button><button className="btn btn-primary btn-sm" onClick={() => setEdit({ category: menu.categories[0], station: 'kitchen', price: 0, available: true })}>+ Add dish</button></>}
    </div>
    {!isManager && <p className="muted small">Tap a switch to mark a dish sold out. Guests see it instantly. Prices can be changed by the admin.</p>}
    {menu.categories.map(c => { const list = items.filter(d => d.category === c); return list.length ? <section key={c} className="admin-group">
      <h3 className="sub-h">{c} <small>{list.length}</small></h3>
      <div className="admin-list">{list.map(d => <div key={d.id} className={`admin-row${d.available ? '' : ' off'}`}>
        <div className="a-thumb">{d.image ? <img src={d.image} alt="" /> : <DishArt name={d.name} station={d.station} />}</div>
        <div className="a-info"><b>{d.name} <VegMark veg={d.veg} /></b><small>{STATIONS.find(s => s.id === d.station)?.icon} {d.station === 'bar' ? 'Bar' : d.station} · {d.price > 0 ? (d.options?.length ? d.options.map(o => `${o.label} ${o.price}`).join(' · ') : npr(d.price)) : 'No price yet'}</small></div>
        <label className="switch" title={d.available ? 'Available' : 'Sold out'}><input type="checkbox" checked={d.available} onChange={() => toggle(d)} aria-label={`${d.name} available`} /><span /></label>
        {isManager && <button className="btn btn-text btn-sm" onClick={() => setEdit(d)}>Edit</button>}
      </div>)}</div>
    </section> : null; })}
    {items.filter(d => !menu.categories.includes(d.category)).length > 0 && <p className="muted small">Some dishes use a category that isn't listed in Settings.</p>}
    <Sheet open={!!edit} onClose={() => setEdit(null)} label="Edit dish">{edit && <DishForm dish={edit} categories={menu.categories} onDone={() => setEdit(null)} />}</Sheet>
    <Sheet open={bulk} onClose={() => setBulk(false)} label="Paste menu">{bulk && <BulkImport onDone={() => setBulk(false)} />}</Sheet>
  </>;
}

const IMAGES = ['butter-chicken', 'chicken-butter-masala', 'chicken-curry', 'tandoori-chicken', 'garlic-naan', 'cheese-naan', 'butter-naan', 'plain-naan', 'biryani', 'mutton-biryani', 'veg-biryani'];
function DishForm({ dish, categories, onDone }: { dish: Partial<Dish>; categories: string[]; onDone: () => void }) {
  const [d, setD] = useState<Partial<Dish>>(dish);
  const [optText, setOptText] = useState((dish.options || []).map(o => `${o.label} ${o.price}`).join(', '));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Dish, v: unknown) => setD(cur => ({ ...cur, [k]: v }));
  async function save() {
    const options = optText.split(',').map(p => p.trim().match(/^(.+?)\s*[-=:]?\s*(\d+)$/)).filter(Boolean).map(m => ({ label: m![1].trim(), price: Number(m![2]) }));
    if (optText.trim() && !options.length) { toast('Write sizes like “Half 600, Full 1200”', 'error'); return; }
    const body = { ...d, options: options.length ? options : [] };
    setBusy(true);
    try {
      if (dish.id) await api(`/menu/${dish.id}`, { method: 'PUT', body }); else await api('/menu', { method: 'POST', body });
      await refreshMenu(); toast(`${d.name} saved`); onDone();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!dish.id || !confirm(`Delete ${dish.name} from the menu?`)) return;
    try { await api(`/menu/${dish.id}`, { method: 'DELETE' }); await refreshMenu(); toast(`${dish.name} deleted`); onDone(); } catch (e) { toast((e as Error).message, 'error'); }
  }
  return <form className="form" onSubmit={e => { e.preventDefault(); save(); }}>
    <div className="sheet-head"><h2>{dish.id ? 'Edit dish' : 'New dish'}</h2><button type="button" className="icon-btn" onClick={onDone} aria-label="Close">✕</button></div>
    <label className="field"><span>Name</span><input required value={d.name || ''} onChange={e => set('name', e.target.value)} maxLength={60} /></label>
    <label className="field"><span>Sizes / styles <small>(optional: e.g. “Quarter 300, Half 600, Full 1200”)</small></span><input value={optText} onChange={e => setOptText(e.target.value)} placeholder="Leave empty for a single price" /></label>
    <div className="field-row">
      {!optText.trim() && <label className="field"><span>Price (NPR)</span><input required type="number" min={0} inputMode="numeric" value={d.price ?? ''} onChange={e => set('price', Number(e.target.value))} /></label>}
      <label className="field"><span>Station</span><select value={d.station} onChange={e => set('station', e.target.value as Station)}>{STATIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.id === 'bar' ? 'Drinks' : s.label}</option>)}</select></label>
    </div>
    <div className="field-row">
      <label className="field"><span>Category</span><select value={d.category} onChange={e => set('category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="field"><span>Badge <small>(optional)</small></span><input value={d.badge || ''} onChange={e => set('badge', e.target.value)} maxLength={30} placeholder="e.g. Chef’s pick" /></label>
    </div>
    <label className="field"><span>Description</span><textarea rows={2} value={d.description || ''} onChange={e => set('description', e.target.value)} maxLength={200} /></label>
    <label className="field"><span>Photo</span><select value={d.image || ''} onChange={e => set('image', e.target.value || undefined)}><option value="">No photo (illustrated tile)</option>{IMAGES.map(i => <option key={i} value={`/assets/food/${i}.webp`}>{i.replace(/-/g, ' ')}</option>)}</select></label>
    <div className="field-row"><label className="check"><input type="checkbox" checked={!!d.veg} onChange={e => set('veg', e.target.checked)} /> Vegetarian</label><label className="check"><input type="checkbox" checked={d.available !== false} onChange={e => set('available', e.target.checked)} /> Available to order</label></div>
    <div className="form-actions">{dish.id && <button type="button" className="btn btn-text danger" onClick={remove}>Delete</button>}<span className="grow" /><button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Save dish'}</button></div>
  </form>;
}

/** Paste a menu as text. Lines like "Garlic Naan - 100", "## Breads" headers. */
function parseMenu(text: string, fallbackCat: string) {
  let cat = fallbackCat; const out: { name: string; price: number; category: string; station: Station }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const head = line.match(/^(#+\s*|\[)(.+?)\]?:?$/) || (!/\d/.test(line) ? [line, '', line.replace(/:$/, '')] : null);
    if (head) { cat = head[2].trim(); continue; }
    const m = line.match(/^(.*?)[\s.\-–—:|…]*(?:rs\.?|npr|₹)?\s*(\d[\d,]*)(?:\s*\/-)?\s*$/i);
    if (!m || !m[1].trim()) continue;
    const name = m[1].replace(/[\s.\-–—:|…]+$/, '').trim();
    const lc = `${name} ${cat}`.toLowerCase();
    const station: Station = /naan|roti|kulcha|paratha|tandoor|tikka|kebab|kabab|seekh/.test(lc) ? 'tandoor' : /lassi|tea|chai|coffee|juice|drink|soda|coke|water|beer|wine|shake|mocktail|beverage/.test(lc) ? 'bar' : 'kitchen';
    out.push({ name, price: Number(m[2].replace(/,/g, '')), category: cat, station });
  }
  return out;
}
function BulkImport({ onDone }: { onDone: () => void }) {
  const menu = useMenu()!;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = parseMenu(text, menu.categories[0] || 'Menu');
  async function run() {
    setBusy(true);
    try {
      const cats = [...new Set([...menu.categories, ...rows.map(r => r.category)])];
      await api('/categories', { method: 'PUT', body: { categories: cats } });
      let added = 0, updated = 0;
      for (const r of rows) {
        const existing = menu.items.find(d => d.name.toLowerCase() === r.name.toLowerCase());
        if (existing) { await api(`/menu/${existing.id}`, { method: 'PUT', body: { ...existing, price: r.price, category: r.category } }); updated++; }
        else { await api('/menu', { method: 'POST', body: { ...r, description: '', available: true } }); added++; }
      }
      await refreshMenu(); toast(`${added} added, ${updated} updated`); onDone();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return <div className="form">
    <div className="sheet-head"><h2>Paste your menu</h2><button className="icon-btn" onClick={onDone} aria-label="Close">✕</button></div>
    <p className="muted small">One dish per line with its price. Lines without a price become category headings. Existing dishes with the same name get the new price.</p>
    <textarea className="mono" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder={'Breads\nGarlic Naan - 100\nButter Naan - 80\n\nCurries\nButter Chicken - 480'} />
    {rows.length > 0 && <div className="preview"><b>{rows.length} dishes found</b><ul>{rows.slice(0, 40).map((r, i) => <li key={i}><span>{r.name}</span><small>{r.category} · {r.station === 'bar' ? 'Drinks' : r.station}</small><b>{npr(r.price)}</b></li>)}</ul></div>}
    <div className="form-actions"><span className="grow" /><button className="btn btn-primary" disabled={!rows.length || busy} onClick={run}>{busy ? <span className="spinner" /> : `Import ${rows.length || ''} dishes`}</button></div>
  </div>;
}

// ── Tables & QR codes ───────────────────────────────────────────────────────
export function Tables() { return <StaffShell title="Tables & QR codes"><TablesInner /></StaffShell>; }
function TablesInner() {
  const menu = useMenu();
  const { orders } = useStaff();
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const n = menu?.settings.tables || 0;
  useEffect(() => {
    const list = [...Array.from({ length: n }, (_, i) => String(i + 1)), 'Takeaway'];
    Promise.all(list.map(async t => [t, await QRCode.toString(`${location.origin}/menu?table=${encodeURIComponent(t)}`, { type: 'svg', margin: 1, color: { dark: '#401520', light: '#fffaf2' } })] as const))
      .then(e => setQrs(Object.fromEntries(e)));
  }, [n]);
  if (!menu) return null;
  const open = (t: string) => orders.filter(o => o.table === t && !['cancelled'].includes(o.status) && (!o.paid || o.status !== 'served'));
  return <>
    <div className="desk-tools no-print"><p className="muted small grow">Print these and place one on each table. Guests scan → the menu opens with their table already chosen.</p><button className="btn btn-primary btn-sm" onClick={() => print()}>🖨 Print all</button></div>
    <div className="qr-grid">{Object.entries(qrs).map(([t, svg], i) => { const busy = open(t); return <div key={t} className={`qr-card reveal${busy.length ? ' busy' : ''}`} style={{ '--d': Math.min(i, 12) } as React.CSSProperties}>
      <div className="qr-head"><b>{t === 'Takeaway' ? 'Takeaway' : `Table ${t}`}</b>{busy.length > 0 && <span className="status-pill preparing no-print">{busy.length} open</span>}</div>
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <small>Scan to order · Samrat</small>
    </div>; })}</div>
  </>;
}

// ── Team ────────────────────────────────────────────────────────────────────
export function Team() { return <StaffShell title="Team"><TeamInner /></StaffShell>; }
function TeamInner() {
  const me = useAuth()!.staff;
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [name, setName] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<Role>('waiter');
  const load = () => api<{ staff: StaffMember[] }>('/staff').then(r => setStaff(r.staff)).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/staff', { method: 'POST', body: { name, username, password, role } }); toast(`${name} can now sign in as “${username}”`); setName(''); setUsername(''); setPassword(''); load(); } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function resetPw(s: StaffMember) {
    const pw = prompt(`New password for ${s.name} (${s.username}), at least 6 characters:`);
    if (!pw) return;
    try { await api(`/staff/${s.id}`, { method: 'PUT', body: { password: pw } }); toast(`Password changed for ${s.username}. They'll need to sign in again.`); } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function remove(s: StaffMember) {
    if (!confirm(`Remove ${s.name}? Their login stops working immediately.`)) return;
    try { await api(`/staff/${s.id}`, { method: 'DELETE' }); load(); } catch (err) { toast((err as Error).message, 'error'); }
  }
  return <div className="two-col">
    <section className="card"><h3>Logins</h3>
      {!staff ? <p className="muted">Loading…</p> : staff.length === 0 ? <Empty title="No staff yet" /> : <ul className="team-list">{staff.map(s => <li key={s.id}>
        <span className="avatar">{ROLE_INFO[s.role]?.icon || s.name[0]}</span>
        <div><b>{s.name}{s.id === me.id && ' (you)'}</b><small>Username <code>{s.username}</code> · {ROLE_INFO[s.role]?.label}: {ROLE_INFO[s.role]?.text}</small></div>
        <button className="btn btn-text btn-sm" onClick={() => resetPw(s)}>Change password</button>
        {s.id !== me.id && !['admin', 'waiter', 'tandoor', 'kitchen'].includes(s.id) && <button className="btn btn-text btn-sm danger" onClick={() => remove(s)}>Remove</button>}
      </li>)}</ul>}
    </section>
    <form className="card form" onSubmit={add}><h3>Add a login</h3>
      <p className="muted small">E.g. a second waiter. Each person signs in with their own username and lands on their section's screen.</p>
      <label className="field"><span>Name</span><input required value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. Ramesh" /></label>
      <div className="field-row"><label className="field"><span>Username</span><input required value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} maxLength={30} placeholder="e.g. waiter2" autoCapitalize="none" /></label>
        <label className="field"><span>Password</span><input required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6+ characters" /></label></div>
      <label className="field"><span>Section</span><select value={role} onChange={e => setRole(e.target.value as Role)}>{(Object.keys(ROLE_INFO) as Role[]).map(r => <option key={r} value={r}>{ROLE_INFO[r].label}: {ROLE_INFO[r].text}</option>)}</select></label>
      <button className="btn btn-primary">Create login</button>
    </form>
  </div>;
}

// ── Settings ────────────────────────────────────────────────────────────────
export function SettingsPage() { return <StaffShell title="Settings"><SettingsInner /></StaffShell>; }
function SettingsInner() {
  const menu = useMenu();
  const { sound, setSound } = useStaff();
  const [s, setS] = useState<Settings | null>(null);
  const [cats, setCats] = useState('');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  useEffect(() => { if (menu && !s) { setS(menu.settings); setCats(menu.categories.join('\n')); } }, [menu, s]);
  if (!s) return null;
  async function save(patch: Partial<Settings>) {
    const next = { ...s!, ...patch }; setS(next);
    try { await api('/settings', { method: 'PUT', body: patch }); await refreshMenu(); toast('Saved'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function saveCats() {
    try { await api('/categories', { method: 'PUT', body: { categories: cats.split('\n') } }); await refreshMenu(); toast('Categories saved'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  return <div className="two-col">
    <section className="card form"><h3>Ordering</h3>
      <div className="setting"><div><b>Accept online orders</b><small>Turn off when the kitchen is closed or too busy.</small></div><label className="switch"><input type="checkbox" checked={s.ordersOpen} onChange={e => save({ ordersOpen: e.target.checked })} /><span /></label></div>
      <div className="field-row">
        <label className="field"><span>Number of tables</span><input type="number" min={1} max={200} value={s.tables} onChange={e => setS({ ...s, tables: Number(e.target.value) })} onBlur={() => save({ tables: Math.round(s.tables) })} /></label>
        <label className="field"><span>Service charge %</span><input type="number" min={0} max={30} step="0.5" value={s.serviceChargePct} onChange={e => setS({ ...s, serviceChargePct: Number(e.target.value) })} onBlur={() => save({ serviceChargePct: s.serviceChargePct })} /></label>
        <label className="field"><span>VAT %</span><input type="number" min={0} max={30} step="0.5" value={s.vatPct} onChange={e => setS({ ...s, vatPct: Number(e.target.value) })} onBlur={() => save({ vatPct: s.vatPct })} /></label>
      </div>
    </section>
    <section className="card form"><h3>This device</h3>
      <div className="setting"><div><b>Sound alerts</b><small>Chime for new orders and table calls.</small></div><label className="switch"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /><span /></label></div>
      <div className="setting"><div><b>Pop-up notifications</b><small>{perm === 'granted' ? 'On. Alerts show even when the app is in the background.' : perm === 'denied' ? 'Blocked in browser settings.' : 'Get alerts when this screen is in the background.'}</small></div>
        {perm === 'default' && <button className="btn btn-sm btn-gold" onClick={() => Notification.requestPermission().then(setPerm)}>Enable</button>}</div>
    </section>
    <section className="card form"><h3>Menu categories</h3><p className="muted small">One per line, in the order guests see them.</p>
      <textarea rows={6} value={cats} onChange={e => setCats(e.target.value)} /><button className="btn btn-primary btn-sm" onClick={saveCats}>Save categories</button></section>
  </div>;
}
