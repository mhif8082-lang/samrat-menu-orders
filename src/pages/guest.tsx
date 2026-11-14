import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, ago, clock, myOrders, npr, rememberOrder, useLiveStream, useMenu, useNow, type Dish, type Order, type Status } from '../api';
import { addToCart, cartKey, cartLines, cartSummary, clearCart, dishCount, getTable, saveTable, setNote, useCart } from '../cart';
import { Link, navigate, useRoute } from '../router';
import { burst, DishArt, Empty, flyToBasket, LiveBadge, Logo, Sheet, toast, VegMark } from '../components/ui';
import { InstallButton } from '../pwa';

function BagIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>; }

export function GuestHeader({ onBasket }: { onBasket?: () => void }) {
  const menu = useMenu(); const cart = useCart();
  const { count } = cartSummary(cart, menu?.items);
  const mine = myOrders().length;
  return <header className="g-header">
    <Link to="/" className="brand"><Logo size={42} /><span><strong>Samrat</strong><small>Menu Orders</small></span></Link>
    <nav className="g-nav">
      <Link to="/menu">Menu</Link>
      {mine > 0 && <Link to="/my-orders">My orders</Link>}
    </nav>
    <button className="bag-btn" data-basket-target onClick={onBasket ?? (() => navigate('/menu?basket=1'))} aria-label={`Basket, ${count} items`}><BagIcon />{count > 0 && <span key={count} className="bag-count">{count}</span>}</button>
  </header>;
}

// ── Home ────────────────────────────────────────────────────────────────────
export function Home() {
  const menu = useMenu();
  const { query } = useRoute();
  useEffect(() => { const t = query.get('table'); if (t) saveTable(t); }, [query]);
  const featured = menu?.items.filter(d => d.image && d.available).slice(0, 6) ?? [];
  return <div className="page home">
    <GuestHeader />
    <section className="hero">
      <div className="hero-copy">
        <span className="kicker rise" style={{ '--d': 0 } as React.CSSProperties}><span className="flame" aria-hidden="true">♨</span> Order from your table</span>
        <h1 className="rise" style={{ '--d': 1 } as React.CSSProperties}>Good food.<br /><em>Straight</em> from<br />the tandoor.</h1>
        <p className="rise" style={{ '--d': 2 } as React.CSSProperties}>Pick your dishes, send them to the kitchen, and watch your order come to life. No waiting to catch a waiter.</p>
        <div className="hero-actions rise" style={{ '--d': 3 } as React.CSSProperties}>
          <Link to="/menu" className="btn btn-primary btn-lg">Start your order <span aria-hidden="true">→</span></Link>
          {myOrders().length > 0 && <Link to="/my-orders" className="btn btn-ghost">Track my order</Link>}
        </div>
        {!menu?.settings.ordersOpen && menu && <div className="closed-note rise">The kitchen isn't taking online orders right now. Please ask a member of staff.</div>}
      </div>
      <div className="hero-visual">
        <div className="orbit" aria-hidden="true">{featured.slice(0, 5).map((d, i) => <img key={d.id} src={d.image} alt="" style={{ '--i': i } as React.CSSProperties} />)}</div>
        <img className="hero-plate" src="/assets/food/butter-chicken.webp" alt="Butter chicken with naan" />
        <div className="seal" aria-hidden="true"><span>Fresh from</span><strong>the tandoor</strong><span>Made with heart</span></div>
        <div className="steam" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </section>
    <section className="how">
      {[['📱', 'Scan & browse', 'Open the menu on your phone. Your table is filled in from the QR code.'], ['🔥', 'Kitchen gets it instantly', 'Your order appears on the tandoor and kitchen screens straight away.'], ['🔔', 'Watch it happen', 'See live progress from cooking to ready. Call a waiter or ask for the bill.']].map(([i, t, d], n) =>
        <article key={t} className="how-card reveal" style={{ '--d': n } as React.CSSProperties}><div className="how-icon">{i}</div><h3>{t}</h3><p>{d}</p></article>)}
    </section>
    <div className="marquee" aria-hidden="true"><div>{Array.from({ length: 2 }).map((_, k) => <span key={k}>Freshly baked naan ✦ Rich, slow-cooked curries ✦ Smoky tandoori ✦ Fragrant biryani ✦ </span>)}</div></div>
    <footer className="g-footer">
      <div><Logo size={36} /> <span>Samrat Tandoori Restaurant</span></div>
      <div className="g-footer-links"><InstallButton /><Link to="/staff">Staff sign in</Link></div>
    </footer>
  </div>;
}

// ── Menu ────────────────────────────────────────────────────────────────────
export function MenuPage() {
  const menu = useMenu();
  const cart = useCart();
  const { query } = useRoute();
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [basketOpen, setBasketOpen] = useState(query.get('basket') === '1');
  useEffect(() => { const t = query.get('table'); if (t) saveTable(t); }, [query]);
  const { count, total } = cartSummary(cart, menu?.items);

  const visible = useMemo(() => (menu?.items ?? []).filter(d =>
    (cat === 'All' || d.category === cat) && (!vegOnly || d.veg) &&
    (!search || `${d.name} ${d.description} ${d.category}`.toLowerCase().includes(search.toLowerCase()))), [menu, cat, search, vegOnly]);
  const groups = useMemo(() => (menu?.categories ?? []).map(c => ({ c, items: visible.filter(d => d.category === c) })).filter(g => g.items.length), [menu, visible]);

  if (!menu) return <div className="page"><GuestHeader /><div className="loader"><Logo size={64} /><span>Warming up the tandoor…</span></div></div>;
  return <div className="page menu-page">
    <GuestHeader onBasket={() => setBasketOpen(true)} />
    <section className="menu-hero">
      <span className="kicker">Something for every craving</span>
      <h1>Pull up a chair.</h1>
      {getTable() && <p className="table-chip">Ordering for <b>Table {getTable()}</b></p>}
    </section>
    <div className="menu-tools">
      <label className="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search dishes" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search the menu" /></label>
      <button className={`chip veg-chip${vegOnly ? ' on' : ''}`} aria-pressed={vegOnly} onClick={() => setVegOnly(!vegOnly)}><VegMark veg /> Veg only</button>
    </div>
    <div className="cats" role="tablist" aria-label="Categories">{['All', ...menu.categories].map(c => <button key={c} role="tab" aria-selected={cat === c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
    {!menu.settings.ordersOpen && <div className="closed-note">Online ordering is paused right now. You can still browse. Please ask a member of staff to order.</div>}
    {groups.length === 0 && <Empty icon="🔍" title="No dishes match">Try a different search or category.</Empty>}
    {groups.map(g => <section key={g.c} className="menu-group">
      <h2>{g.c}</h2>
      <div className="dish-grid">{g.items.map((d, i) => <DishCard key={d.id} dish={d} qty={d.options?.length ? dishCount(cart, d.id) : cart[d.id]?.qty || 0} index={i} onOpen={() => setDetail(d)} />)}</div>
    </section>)}
    <p className="fineprint">Prices in NPR. Food images are illustrative.</p>
    {count > 0 && !basketOpen && <button className="float-basket" onClick={() => setBasketOpen(true)}><span className="fb-count" key={count}>{count}</span><span>View basket</span><strong>{npr(total)}</strong></button>}
    <Sheet open={!!detail} onClose={() => setDetail(null)} label={detail?.name ?? 'Dish'}>{detail && <DishDetail dish={detail} onDone={() => setDetail(null)} />}</Sheet>
    <Sheet open={basketOpen} onClose={() => setBasketOpen(false)} label="Your basket" side="right"><Basket onClose={() => setBasketOpen(false)} /></Sheet>
  </div>;
}

const askStaff = (d: Dish) => !(d.price > 0);
const priceLabel = (d: Dish) => askStaff(d) ? 'Ask staff' : d.options?.length && new Set(d.options.map(o => o.price)).size > 1 ? `from ${npr(d.price)}` : npr(d.price);

function DishCard({ dish, qty, index, onOpen }: { dish: Dish; qty: number; index: number; onOpen: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const hasOptions = !!dish.options?.length;
  const off = !dish.available;
  const compact = !dish.image;
  const add = () => { if (hasOptions) return onOpen(); addToCart(dish.id, 1); flyToBasket(btn.current); };
  return <article className={`dish-card reveal${off ? ' sold-out' : ''}${compact ? ' compact' : ''}`} style={{ '--d': Math.min(index, 8) } as React.CSSProperties}>
    {!compact && <button className="dish-photo" onClick={onOpen} aria-label={`About ${dish.name}`}>
      <img src={dish.image} alt="" loading="lazy" width="400" height="300" />
      {dish.badge && !off && <span className="badge">{dish.badge}</span>}
      {off && <span className="badge sold">{askStaff(dish) ? 'Ask staff' : 'Sold out'}</span>}
    </button>}
    <div className="dish-info">
      <button className="dish-title" onClick={onOpen}><h3>{dish.name}</h3><VegMark veg={dish.veg} /></button>
      {dish.description && <p>{dish.description}</p>}
      {hasOptions && <div className="opt-hint">{dish.options!.map(o => o.label).join(' · ')}</div>}
      <div className="dish-foot">
        <strong>{priceLabel(dish)}{compact && off && !askStaff(dish) && <em className="so"> · Sold out</em>}</strong>
        {qty > 0 && !hasOptions ? <div className="stepper" aria-label={`${dish.name} quantity`}>
          <button onClick={() => addToCart(dish.id, -1)} aria-label={`Remove one ${dish.name}`}>−</button>
          <span key={qty} className="pop">{qty}</span>
          <button ref={btn} onClick={add} aria-label={`Add one ${dish.name}`} disabled={off}>+</button>
        </div> : <button ref={btn} className="add-btn" disabled={off} onClick={add} aria-label={`Add ${dish.name}`}>{hasOptions ? (qty > 0 ? <>{qty} added · <span aria-hidden="true">+</span></> : <>Choose <span aria-hidden="true">+</span></>) : <>Add <span aria-hidden="true">+</span></>}</button>}
      </div>
    </div>
  </article>;
}

function DishDetail({ dish, onDone }: { dish: Dish; onDone: () => void }) {
  const cart = useCart();
  const [option, setOption] = useState(dish.options?.[0]?.label);
  const key = cartKey(dish.id, option);
  const [qty, setQty] = useState(cart[key]?.qty || 1);
  const [note, setN] = useState(cart[key]?.note || '');
  const price = dish.options?.find(o => o.label === option)?.price ?? dish.price;
  return <div className="dish-detail">
    <div className="dd-photo">{dish.image ? <img src={dish.image} alt={dish.name} /> : <DishArt name={dish.name} station={dish.station} />}</div>
    <div className="dd-body">
      <span className="kicker">{dish.category}</span>
      <div className="dish-title"><h2>{dish.name}</h2><VegMark veg={dish.veg} /></div>
      {dish.description && <p>{dish.description}</p>}
      {!!dish.options?.length && <div className="opts" role="radiogroup" aria-label="Choose one">{dish.options.map(o =>
        <button key={o.label} role="radio" aria-checked={option === o.label} className={`opt${option === o.label ? ' on' : ''}`} onClick={() => { setOption(o.label); setQty(cart[cartKey(dish.id, o.label)]?.qty || 1); }}>
          <span>{o.label}</span><b>{npr(o.price)}</b></button>)}</div>}
      <label className="field"><span>Special request <small>(optional)</small></span><input value={note} maxLength={140} onChange={e => setN(e.target.value)} placeholder="e.g. less spicy, no onion" /></label>
      <div className="dd-actions">
        <div className="stepper big"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less">−</button><span key={qty} className="pop">{qty}</span><button onClick={() => setQty(Math.min(50, qty + 1))} aria-label="More">+</button></div>
        <button className="btn btn-primary grow" disabled={!dish.available} onClick={e => {
          const cur = cart[key]?.qty || 0; addToCart(key, qty - cur, note); flyToBasket(e.currentTarget); toast(`${dish.name}${option ? ` (${option})` : ''} ×${qty} in your basket`); onDone();
        }}>{dish.available ? <>Add · {npr(price * qty)}</> : askStaff(dish) ? 'Ask staff' : 'Sold out'}</button>
      </div>
    </div>
  </div>;
}

function Basket({ onClose }: { onClose: () => void }) {
  const menu = useMenu(); const cart = useCart();
  const [table, setTable] = useState(getTable());
  const [name, setName] = useState('');
  const [note, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lines = cartLines(cart, menu?.items);
  const s = menu?.settings;
  const subtotal = lines.reduce((t, l) => t + l.price * l.qty, 0);
  const service = Math.round(subtotal * (s?.serviceChargePct || 0) / 100);
  const vat = Math.round((subtotal + service) * (s?.vatPct || 0) / 100);
  const soldOut = lines.filter(l => !l.dish.available);

  async function place() {
    setErr('');
    if (!table) { setErr('Please choose your table number.'); return; }
    setBusy(true);
    try {
      const r = await api<{ order: Order; key: string }>('/orders', { method: 'POST', body: { table, name, note, items: lines.map(l => ({ id: l.dish.id, option: l.option, qty: l.qty, note: l.note })) } });
      saveTable(table); rememberOrder({ id: r.order.id, key: r.key, number: r.order.number, at: Date.now() });
      clearCart(); onClose(); burst();
      navigate(`/order/${r.order.id}?key=${r.key}&new=1`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not place your order'); }
    finally { setBusy(false); }
  }

  return <div className="basket">
    <div className="sheet-head"><div><span className="kicker">A good meal starts here</span><h2>Your basket</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
    {lines.length === 0 ? <Empty icon="🛍️" title="Something delicious awaits">Add a few dishes to get started.<br /><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Browse the menu</button></Empty> : <>
      <div className="basket-lines">{lines.map(l => <div className="b-line" key={l.key}>
        {l.dish.image ? <img src={l.dish.image} alt="" /> : <DishArt name={l.dish.name} station={l.dish.station} />}
        <div className="b-info"><b>{l.dish.name}{l.option && <small className="b-opt"> {l.option}</small>}</b>{!l.dish.available && <span className="warn">Sold out, please remove</span>}
          <input className="b-note" value={l.note} onChange={e => setNote(l.key, e.target.value)} placeholder="Add a request…" aria-label={`Request for ${l.dish.name}`} />
          <div className="stepper sm"><button onClick={() => addToCart(l.key, -1)} aria-label="Less">−</button><span>{l.qty}</span><button onClick={() => addToCart(l.key, 1)} aria-label="More">+</button></div>
        </div>
        <strong>{npr(l.price * l.qty)}</strong>
      </div>)}</div>
      <div className="checkout">
        <div className="field-row">
          <label className="field"><span>Table</span>
            <select value={table} onChange={e => setTable(e.target.value)} required>
              <option value="">Choose…</option>
              {Array.from({ length: s?.tables || 12 }, (_, i) => String(i + 1)).map(t => <option key={t} value={t}>Table {t}</option>)}
              <option value="Takeaway">Takeaway</option>
            </select></label>
          <label className="field"><span>Your name <small>(optional)</small></span><input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="So we can call you" /></label>
        </div>
        <label className="field"><span>Note for the kitchen <small>(optional)</small></span><textarea rows={2} maxLength={240} value={note} onChange={e => setNoteText(e.target.value)} placeholder="Allergies, timing, anything else" /></label>
        <dl className="sums">
          <div><dt>Subtotal</dt><dd>{npr(subtotal)}</dd></div>
          {service > 0 && <div><dt>Service charge ({s?.serviceChargePct}%)</dt><dd>{npr(service)}</dd></div>}
          {vat > 0 && <div><dt>VAT ({s?.vatPct}%)</dt><dd>{npr(vat)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd>{npr(subtotal + service + vat)}</dd></div>
        </dl>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn btn-primary btn-lg block" disabled={busy || !s?.ordersOpen || soldOut.length > 0} onClick={place}>{busy ? <span className="spinner" /> : s?.ordersOpen ? <>Send to kitchen <span aria-hidden="true">→</span></> : 'Ordering paused'}</button>
        <p className="fineprint">Pay at the counter or ask for the bill from your order page.</p>
      </div>
    </>}
  </div>;
}

// ── Order tracking ──────────────────────────────────────────────────────────
const STEPS: { s: Status; label: string; icon: string; text: string }[] = [
  { s: 'new', label: 'Received', icon: '📝', text: 'The kitchen has your order.' },
  { s: 'preparing', label: 'Cooking', icon: '🔥', text: 'Your food is on the fire.' },
  { s: 'ready', label: 'Ready', icon: '🛎️', text: 'Coming to your table now!' },
  { s: 'served', label: 'Enjoy', icon: '😋', text: 'Enjoy your meal!' },
];
export function TrackPage({ id }: { id: string }) {
  const { query } = useRoute();
  const key = query.get('key') || myOrders().find(o => o.id === id)?.key || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const prev = useRef<Status | null>(null);
  const nowTs = useNow(1000);
  const load = () => api<{ order: Order }>(`/orders/${id}?key=${encodeURIComponent(key)}`).then(r => setOrder(r.order)).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useLiveStream({ orders: [`${id}.${key}`], onOrder: o => o.id === id && setOrder(o), onHello: load });
  useEffect(() => {
    if (!order) return;
    if (prev.current && prev.current !== order.status && order.status === 'ready') { burst(); navigator.vibrate?.([200, 100, 200]); toast('Your order is ready!', 'info'); }
    prev.current = order.status;
  }, [order]);

  async function act(path: 'cancel' | 'assist', body: object, msg: string) {
    try { const r = await api<{ order: Order }>(`/orders/${id}/${path}`, { method: 'POST', body: { key, ...body } }); setOrder(r.order); toast(msg); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  if (error) return <div className="page"><GuestHeader /><Empty icon="🧾" title="We couldn't find that order">{error}. <Link to="/menu">Back to the menu</Link></Empty></div>;
  if (!order) return <div className="page"><GuestHeader /><div className="loader"><Logo size={64} /><span>Finding your order…</span></div></div>;
  const idx = order.status === 'cancelled' ? -1 : STEPS.findIndex(s => s.s === order.status);
  const doneItems = order.items.filter(i => i.done).length;
  return <div className="page track">
    <GuestHeader />
    <section className="track-hero">
      <div className="track-top"><LiveBadge state={live} /><span>Table {order.table} · {clock(order.createdAt)}</span></div>
      <span className="kicker">Order</span>
      <h1 className="order-no">#{order.number}</h1>
      {order.status === 'cancelled' ? <p className="track-msg">This order was cancelled.</p> : <>
        <div className={`flame-stage s-${order.status}`} aria-hidden="true"><div className="pot"><span>{STEPS[idx].icon}</span></div><i /><i /><i /></div>
        <p className="track-msg" key={order.status}>{STEPS[idx].text}</p>
        <ol className="steps">{STEPS.map((st, i) => <li key={st.s} className={i < idx ? 'done' : i === idx ? 'current' : ''}><span className="dot">{i < idx ? '✓' : st.icon}</span><span>{st.label}</span>{order.times[st.s] && <small>{clock(order.times[st.s]!)}</small>}</li>)}</ol>
        <div className="progress"><i style={{ width: `${Math.max(6, (doneItems / order.items.length) * 100)}%` }} /></div>
        <p className="muted small">{doneItems} of {order.items.length} dishes ready · ordered {ago(order.createdAt, nowTs)} ago</p>
      </>}
    </section>
    <section className="card receipt">
      <h2>Your order</h2>
      {order.items.map((it, i) => <div key={i} className={`r-line${it.done ? ' done' : ''}`}><span>{it.qty}×</span><div><b>{it.name}</b>{it.note && <small>“{it.note}”</small>}</div><span className="r-state">{it.done ? '✓ ready' : order.status === 'cancelled' ? '' : '…'}</span><strong>{npr(it.price * it.qty)}</strong></div>)}
      <dl className="sums">
        {order.service > 0 && <div><dt>Service charge</dt><dd>{npr(order.service)}</dd></div>}
        {order.vat > 0 && <div><dt>VAT</dt><dd>{npr(order.vat)}</dd></div>}
        <div className="grand"><dt>Total {order.paid && <span className="paid-tag">Paid</span>}</dt><dd>{npr(order.total)}</dd></div>
      </dl>
    </section>
    {order.status !== 'cancelled' && <section className="assist">
      <button className="btn btn-ghost" disabled={order.assist?.type === 'waiter'} onClick={() => act('assist', { type: 'waiter' }, 'A waiter is on the way')}>🙋 {order.assist?.type === 'waiter' ? 'Waiter called' : 'Call a waiter'}</button>
      <button className="btn btn-ghost" disabled={order.assist?.type === 'bill' || order.paid} onClick={() => act('assist', { type: 'bill' }, 'We’ll bring your bill')}>🧾 {order.paid ? 'Paid' : order.assist?.type === 'bill' ? 'Bill requested' : 'Ask for the bill'}</button>
      {order.status === 'new' && <button className="btn btn-text danger" onClick={() => confirm('Cancel this order?') && act('cancel', {}, 'Order cancelled')}>Cancel order</button>}
    </section>}
    <div className="track-more"><Link to="/menu" className="btn btn-primary">Order something else</Link></div>
  </div>;
}

export function MyOrders() {
  const refs = myOrders();
  const [orders, setOrders] = useState<Record<string, Order>>({});
  useEffect(() => { refs.forEach(r => api<{ order: Order }>(`/orders/${r.id}?key=${r.key}`).then(x => setOrders(o => ({ ...o, [r.id]: x.order }))).catch(() => {})); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveStream({ orders: refs.map(r => `${r.id}.${r.key}`), onOrder: o => setOrders(cur => ({ ...cur, [o.id]: o })) });
  return <div className="page">
    <GuestHeader />
    <section className="menu-hero"><span className="kicker">On this device</span><h1>My orders</h1></section>
    {refs.length === 0 ? <Empty icon="🧾" title="No orders yet"><Link to="/menu">Browse the menu</Link></Empty> :
      <div className="my-list">{refs.map((r, i) => { const o = orders[r.id]; return <Link key={r.id} to={`/order/${r.id}?key=${r.key}`} className="my-card reveal" style={{ '--d': i } as React.CSSProperties}>
        <span className="order-no sm">#{r.number}</span>
        <div><b>{o ? `${o.items.reduce((t, x) => t + x.qty, 0)} items · ${npr(o.total)}` : 'Loading…'}</b><small>{clock(r.at)}{o ? ` · Table ${o.table}` : ''}</small></div>
        {o && <span className={`status-pill ${o.status}`}>{o.status === 'preparing' ? 'Cooking' : o.status[0].toUpperCase() + o.status.slice(1)}</span>}
      </Link>; })}</div>}
  </div>;
}
