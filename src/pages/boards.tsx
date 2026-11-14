import { useMemo, useState } from 'react';
import { ago, clock, npr, ROLE_INFO, STATIONS, STATUS_LABEL, useAuth, useNow, type Order, type Station, type Status } from '../api';
import { Link, navigate } from '../router';
import { Empty, toast } from '../components/ui';
import { canSee, StaffShell, useStaff } from './staff-shell';

const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();
const urgency = (o: Order, nowTs: number) => { const m = (nowTs - o.createdAt) / 60000; return m > 25 ? 'late' : m > 15 ? 'warm' : 'fresh'; };

// ── Staff home ──────────────────────────────────────────────────────────────
export function StaffHome() {
  return <StaffShell title="Good to see you"><StaffHomeInner /></StaffShell>;
}
function StaffHomeInner() {
  const { orders } = useStaff();
  const auth = useAuth()!;
  const today = orders.filter(o => isToday(o.createdAt) && o.status !== 'cancelled');
  const count = (s: Status) => orders.filter(o => o.status === s).length;
  const stationCount = (st: Station) => orders.filter(o => (o.status === 'new' || o.status === 'preparing') && o.items.some(i => i.station === st && !i.done)).length;
  const tiles = [
    { to: '/staff/orders', icon: '🧾', title: 'Front desk', text: 'Serve, bill and help tables', n: orders.filter(o => o.assist).length + count('ready') },
    { to: '/staff/station/tandoor', icon: '🔥', title: 'Tandoor orders', text: 'Naan, roti, tandoori & grill', n: stationCount('tandoor') },
    { to: '/staff/station/kitchen', icon: '🍲', title: 'Kitchen orders', text: 'Curries, momo, rice & more', n: stationCount('kitchen') },
    { to: '/staff/station/bar', icon: '🥤', title: 'Drinks & bar', text: 'Tea, lassi, beer & spirits', n: stationCount('bar') },
    { to: '/staff/kitchen', icon: '🍳', title: 'All orders board', text: 'Every order from new to served', n: count('new') + count('preparing') },
    { to: '/staff/menu', icon: '📋', title: 'Menu', text: 'Mark dishes sold out', n: 0 },
    { to: '/staff/dashboard', icon: '📊', title: 'Sales dashboard', text: 'Revenue, best sellers, timing', n: 0 },
    { to: '/staff/tables', icon: '🔳', title: 'Tables & QR', text: 'Print table QR codes', n: 0 },
    { to: '/staff/team', icon: '👥', title: 'Team & logins', text: 'Usernames and passwords', n: 0 },
    { to: '/staff/settings', icon: '⚙', title: 'Settings', text: 'Ordering, charges, tables', n: 0 },
  ].filter(t => canSee(auth.staff.role, t.to));
  return <>
    <div className="hello-row">
      <div><span className="kicker">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span><h2>Namaste, {auth.staff.name}.</h2><p className="muted">Signed in as {ROLE_INFO[auth.staff.role].label}</p></div>
      <div className="mini-stats">
        <div><b>{count('new')}</b><small>New</small></div><div><b>{count('preparing')}</b><small>Cooking</small></div><div><b>{count('ready')}</b><small>Ready</small></div><div><b>{today.length}</b><small>Today</small></div>
      </div>
    </div>
    <div className="tile-grid">{tiles.map((t, i) => <Link key={t.to} to={t.to} className="tile reveal" style={{ '--d': i } as React.CSSProperties}>
      <span className="tile-icon">{t.icon}</span><div><b>{t.title}</b><small>{t.text}</small></div>{t.n > 0 && <span className="tile-n">{t.n}</span>}<span className="tile-arrow" aria-hidden="true">→</span>
    </Link>)}</div>
  </>;
}

// ── Kitchen board (Kanban) ──────────────────────────────────────────────────
const COLS: { s: Status; title: string; next?: Status; action?: string }[] = [
  { s: 'new', title: 'New orders', next: 'preparing', action: 'Start cooking' },
  { s: 'preparing', title: 'Cooking', next: 'ready', action: 'Mark ready' },
  { s: 'ready', title: 'Ready to serve', next: 'served', action: 'Served' },
];
export function KitchenBoard() { return <StaffShell title="Kitchen board" wide><KitchenInner /></StaffShell>; }
function KitchenInner() {
  const { orders, update } = useStaff();
  const nowTs = useNow(5000);
  const [col, setCol] = useState<Status>('new');
  return <>
    <div className="col-tabs" role="tablist">{COLS.map(c => <button key={c.s} role="tab" aria-selected={col === c.s} className={`chip${col === c.s ? ' on' : ''}`} onClick={() => setCol(c.s)}>{c.title} <b>{orders.filter(o => o.status === c.s).length}</b></button>)}</div>
    <div className="kanban">{COLS.map(c => {
      const list = orders.filter(o => o.status === c.s).sort((a, b) => a.createdAt - b.createdAt);
      return <section key={c.s} className={`k-col col-${c.s}${col === c.s ? ' show' : ''}`}>
        <h2><span className={`dot-s ${c.s}`} />{c.title}<b>{list.length}</b></h2>
        <div className="k-list">
          {list.length === 0 && <div className="k-empty">{c.s === 'new' ? 'Waiting for orders…' : 'Nothing here'}</div>}
          {list.map(o => <Ticket key={o.id} o={o} nowTs={nowTs} onItem={(i, done) => update(o.id, { item: i, done })}
            actions={<>
              {c.next && <button className={`btn btn-sm ${c.s === 'new' ? 'btn-gold' : 'btn-primary'}`} onClick={() => update(o.id, { status: c.next })}>{c.action}</button>}
              {c.s === 'new' && <button className="btn btn-sm btn-text danger" onClick={() => confirm(`Cancel order #${o.number}?`) && update(o.id, { status: 'cancelled' })}>Cancel</button>}
              {c.s !== 'new' && <button className="btn btn-sm btn-text" onClick={() => update(o.id, { status: c.s === 'ready' ? 'preparing' : 'new' })}>↶ Back</button>}
            </>} />)}
        </div>
      </section>;
    })}</div>
  </>;
}

function Ticket({ o, nowTs, actions, onItem, station }: { o: Order; nowTs: number; actions: React.ReactNode; onItem?: (i: number, done: boolean) => void; station?: Station }) {
  const items = o.items.map((it, i) => ({ it, i })).filter(x => !station || x.it.station === station);
  return <article className={`ticket ${urgency(o, nowTs)} st-${o.status}`}>
    <header>
      <div><span className="t-no">#{o.number}</span><span className="t-table">{o.table === 'Takeaway' ? 'Takeaway' : `Table ${o.table}`}</span></div>
      <span className="t-time" title={`Ordered ${clock(o.createdAt)}`}>⏱ {ago(o.createdAt, nowTs)}</span>
    </header>
    {o.name && <div className="t-name">for {o.name}{o.source === 'staff' ? ` · by ${o.takenBy}` : ''}</div>}
    <ul className="t-items">{items.map(({ it, i }) => <li key={i} className={it.done ? 'done' : ''}>
      <button onClick={() => onItem?.(i, !it.done)} disabled={!onItem} aria-pressed={it.done} aria-label={`${it.name}: mark ${it.done ? 'not ready' : 'ready'}`}>
        <span className="t-check">{it.done ? '✓' : ''}</span><b>{it.qty}×</b><span>{it.name}{!station && <em className={`st-tag ${it.station}`}>{STATIONS.find(s => s.id === it.station)?.icon}</em>}</span>
      </button>
      {it.note && <small className="t-note">↳ {it.note}</small>}
    </li>)}</ul>
    {o.note && <p className="t-order-note">📝 {o.note}</p>}
    <footer>{actions}</footer>
  </article>;
}

// ── Station screens (Tandoor / Kitchen / Drinks) ────────────────────────────
export function StationBoard({ station }: { station: Station }) {
  const s = STATIONS.find(x => x.id === station);
  if (!s) { navigate('/staff', true); return null; }
  return <StaffShell title={`${s.icon} ${s.id === 'bar' ? 'Drinks' : s.label} orders`} wide><StationInner station={station} /></StaffShell>;
}
function StationInner({ station }: { station: Station }) {
  const { orders, update } = useStaff();
  const nowTs = useNow(5000);
  const [showDone, setShowDone] = useState(false);
  const relevant = orders.filter(o => o.status !== 'cancelled' && o.status !== 'served' && o.items.some(i => i.station === station));
  const todo = relevant.filter(o => o.items.some(i => i.station === station && !i.done)).sort((a, b) => a.createdAt - b.createdAt);
  const done = relevant.filter(o => o.items.filter(i => i.station === station).every(i => i.done)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  // Total pieces to make right now (e.g. "14 × Garlic Naan").
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    todo.forEach(o => o.items.forEach(i => { if (i.station === station && !i.done) m.set(i.name, (m.get(i.name) || 0) + i.qty); }));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [todo, station]);
  return <>
    {tally.length > 0 && <div className="tally" aria-label="To make now">{tally.map(([n, q]) => <span key={n} className="tally-chip"><b>{q}</b> {n}</span>)}</div>}
    <div className="station-head"><p className="muted">{todo.length ? `${todo.length} ticket${todo.length > 1 ? 's' : ''} waiting · oldest first` : ''}</p><button className="chip" aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} recently done ({done.length})</button></div>
    {todo.length === 0 && <Empty icon={STATIONS.find(s => s.id === station)?.icon} title="All caught up">New {station === 'bar' ? 'drink' : station} items will pop up here the moment a guest orders.</Empty>}
    <div className="ticket-grid">{todo.map(o => <Ticket key={o.id} o={o} station={station} nowTs={nowTs} onItem={(i, d) => update(o.id, { item: i, done: d })}
      actions={<button className="btn btn-primary btn-sm block" onClick={() => { update(o.id, { station, done: true }); toast(`#${o.number} ${station} items done`); }}>✓ All done for #{o.number}</button>} />)}</div>
    {showDone && done.length > 0 && <><h3 className="sub-h">Recently done</h3><div className="ticket-grid faded">{done.map(o => <Ticket key={o.id} o={o} station={station} nowTs={nowTs}
      actions={<button className="btn btn-text btn-sm" onClick={() => update(o.id, { station, done: false })}>↶ Not done yet</button>} />)}</div></>}
  </>;
}

// ── Front desk ──────────────────────────────────────────────────────────────
export function FrontDesk() { return <StaffShell title="Front desk"><FrontInner /></StaffShell>; }
function FrontInner() {
  const { orders, update, days, setDays } = useStaff();
  const nowTs = useNow(10000);
  const [filter, setFilter] = useState<'active' | 'unpaid' | 'all'>('active');
  const [q, setQ] = useState('');
  const assists = orders.filter(o => o.assist && o.status !== 'cancelled');
  const list = orders.filter(o =>
    (filter === 'active' ? !['served', 'cancelled'].includes(o.status) || (!o.paid && o.status === 'served') : filter === 'unpaid' ? !o.paid && o.status !== 'cancelled' : true) &&
    (!q || `${o.number} ${o.table} ${o.name}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.createdAt - a.createdAt);
  return <>
    {assists.length > 0 && <div className="assist-bar">{assists.map(o => <div key={o.id} className="assist-alert">
      <span className="ring">{o.assist!.type === 'bill' ? '🧾' : '🙋'}</span>
      <div><b>Table {o.table}</b> {o.assist!.type === 'bill' ? 'wants the bill' : 'is calling a waiter'}<small>{ago(o.assist!.at, nowTs)} ago · order #{o.number}</small></div>
      <button className="btn btn-sm btn-gold" onClick={() => update(o.id, { clearAssist: true })}>On it</button>
    </div>)}</div>}
    <div className="desk-tools">
      <div className="seg">{(['active', 'unpaid', 'all'] as const).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
      <label className="search sm"><span aria-hidden="true">⌕</span><input type="search" placeholder="Order, table or name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search orders" /></label>
      {filter === 'all' && <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Period"><option value={1}>Last 24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option></select>}
      <Link to="/menu" className="btn btn-primary btn-sm">+ Take an order</Link>
    </div>
    {list.length === 0 ? <Empty icon="🧾" title="No orders here">Orders from guests appear instantly.</Empty> :
      <div className="desk-list">{list.map(o => <article key={o.id} className={`desk-row st-${o.status}`}>
        <div className="d-main">
          <span className="t-no">#{o.number}</span>
          <div className="d-info"><b>{o.table === 'Takeaway' ? 'Takeaway' : `Table ${o.table}`}{o.name && ` · ${o.name}`}</b><small>{clock(o.createdAt)} · {o.items.reduce((t, i) => t + i.qty, 0)} items: {o.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</small></div>
          <span className={`status-pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
          <strong className="d-total">{npr(o.total)}</strong>
        </div>
        <div className="d-actions">
          {o.status === 'ready' && <button className="btn btn-sm btn-primary" onClick={() => update(o.id, { status: 'served' })}>Mark served</button>}
          {o.status !== 'cancelled' && (o.paid ? <button className="btn btn-sm btn-text" onClick={() => update(o.id, { paid: false })}>✓ Paid{o.payMethod ? ` (${o.payMethod})` : ''} · undo</button> :
            <>{['Cash', 'Card', 'QR'].map(m => <button key={m} className="btn btn-sm btn-ghost" onClick={() => { update(o.id, { paid: true, method: m }); toast(`#${o.number} paid by ${m}`); }}>Paid · {m}</button>)}</>)}
          {o.status !== 'cancelled' && o.status !== 'served' && <button className="btn btn-sm btn-text danger" onClick={() => confirm(`Cancel order #${o.number}?`) && update(o.id, { status: 'cancelled' })}>Cancel</button>}
          <button className="btn btn-sm btn-text" onClick={() => printBill(o)}>🖨 Bill</button>
        </div>
      </article>)}</div>}
  </>;
}

function printBill(o: Order) {
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) return;
  const rows = o.items.map(i => `<tr><td>${i.qty}× ${escapeHtml(i.name)}</td><td style="text-align:right">${npr(i.price * i.qty)}</td></tr>`).join('');
  w.document.write(`<!doctype html><title>Bill #${o.number}</title><style>body{font:14px/1.5 ui-monospace,monospace;padding:16px;max-width:320px}h1{font:22px Georgia,serif;margin:0;text-align:center}p{text-align:center;margin:4px 0 12px}table{width:100%;border-collapse:collapse}td{padding:3px 0}tfoot td{border-top:1px dashed #000;font-weight:bold;padding-top:8px}</style>
  <h1>Samrat Tandoori</h1><p>Order #${o.number} · ${o.table === 'Takeaway' ? 'Takeaway' : 'Table ' + escapeHtml(o.table)}<br>${new Date(o.createdAt).toLocaleString()}</p>
  <table>${rows}<tr><td>Subtotal</td><td style="text-align:right">${npr(o.subtotal)}</td></tr>${o.service ? `<tr><td>Service charge</td><td style="text-align:right">${npr(o.service)}</td></tr>` : ''}${o.vat ? `<tr><td>VAT</td><td style="text-align:right">${npr(o.vat)}</td></tr>` : ''}<tfoot><tr><td>Total</td><td style="text-align:right">${npr(o.total)}</td></tr></tfoot></table>
  <p style="margin-top:16px">${o.paid ? 'PAID' + (o.payMethod ? ' · ' + o.payMethod : '') : 'Thank you! Please pay at the counter.'}</p><script>print()</script>`);
  w.document.close();
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
