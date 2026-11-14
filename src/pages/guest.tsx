import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, ApiError, ago, clock, myOrders, npr, rememberOrder, useLiveStream, useMenu, useNow, type Dish, type Order, type Status } from '../api';
import { addToCart, cartKey, cartLines, cartSummary, clearCart, dishCount, getTable, saveTable, setNote, useCart } from '../cart';
import { Link, navigate, useRoute } from '../router';
import { CountUp, Empty, LiveBadge, Logo, Sheet, toast, VegMark } from '../components/ui';
import { Embers, InstallNudge, notice, OrderSent, Tandoor } from '../components/fx';
import { askNotifications, confetti, flashTitle, flyTo, haptic, sfx, systemNotify } from '../motion';
import { Icon } from '../components/icons';
import { InstallButton } from '../pwa';

const css = (v: Record<string, string | number>) => v as CSSProperties;
function BagIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></svg>; }

export function GuestHeader({ onBasket }: { onBasket?: () => void }) {
  const menu = useMenu(); const cart = useCart();
  const { count } = cartSummary(cart, menu?.items);
  const mine = myOrders().length;
  return <header className="g-header">
    <i className="scroll-bar" aria-hidden="true" />
    <Link to="/" className="brand"><Logo size={42} /><span><strong>Samrat</strong><small>Menu Orders</small></span></Link>
    <nav className="g-nav">
      <Link to="/menu">Menu</Link>
      {mine > 0 && <Link to="/my-orders">My orders</Link>}
    </nav>
    <button className="bag-btn" data-basket-target onClick={onBasket ?? (() => navigate('/menu?basket=1'))} aria-label={`Basket, ${count} items`}><BagIcon />{count > 0 && <span key={count} className="bag-count">{count}</span>}</button>
  </header>;
}

// ── Home ────────────────────────────────────────────────────────────────────
const HEADLINE = ['Good', 'food,', 'straight', 'from', 'the', 'tandoor.'];
export function Home() {
  const menu = useMenu();
  const { query } = useRoute();
  const visual = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = query.get('table'); if (t) saveTable(t); }, [query]);
  // Gentle parallax that follows the pointer.
  useEffect(() => {
    const el = visual.current; if (!el || matchMedia('(pointer: coarse)').matches) return;
    const move = (e: PointerEvent) => { el.style.setProperty('--px', String((e.clientX / innerWidth - .5) * 2)); el.style.setProperty('--py', String((e.clientY / innerHeight - .5) * 2)); };
    addEventListener('pointermove', move); return () => removeEventListener('pointermove', move);
  }, []);
  const featured = (menu?.items.filter(d => d.image && d.available) ?? []).filter((d, i, a) => a.findIndex(x => x.image === d.image) === i).slice(0, 5);
  const table = query.get('table') || getTable();
  return <div className="page home">
    <GuestHeader />
    <section className="hero">
      <div className="hero-copy">
        {table && <p className="table-chip rise" style={css({ '--d': 0 })}>You're at <b>{table === 'Takeaway' ? 'takeaway' : `table ${table}`}</b></p>}
        <h1 aria-label={HEADLINE.join(' ')}>{HEADLINE.map((w, i) => <span key={i} className="word" style={css({ '--d': i })} aria-hidden="true">{w} </span>)}</h1>
        <p className="rise" style={css({ '--d': 6 })}>Pick your dishes, send them to the kitchen, and watch your order cook. No waving for a waiter.</p>
        <div className="hero-actions rise" style={css({ '--d': 7 })}>
          <Link to="/menu" className="btn btn-primary btn-lg btn-glow">Start your order</Link>
          {myOrders().length > 0 && <Link to="/my-orders" className="btn btn-ghost">Track my order</Link>}
        </div>
        {!menu?.settings.ordersOpen && menu && <div className="closed-note rise">The kitchen isn't taking online orders right now. Please ask a member of staff.</div>}
      </div>
      <div className="hero-visual" ref={visual}>
        <Embers density={30} />
        <div className="orbit" aria-hidden="true">{featured.map((d, i) => <img key={d.id} src={d.image} alt="" style={css({ '--i': i })} />)}</div>
        <div className="plate-wrap"><img className="hero-plate" src="/assets/food/butter-chicken.webp" alt="Butter chicken with naan" /></div>
        <div className="seal" aria-hidden="true"><span>Fresh from</span><strong>the tandoor</strong><span>Made with heart</span></div>
        <div className="steam" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </section>
    <section className="how" aria-label="How ordering works">
      {[['scan', 'Scan the table code', 'The menu opens on your phone with your table already filled in.'], ['flame', 'Send it to the kitchen', 'Your order lands on the tandoor and kitchen screens the moment you tap send.'], ['bell', 'Watch it cook', 'Follow it live until it’s ready. Call a waiter or ask for the bill from the same screen.']].map(([i, t, d], n) =>
        <article key={t} className="how-card reveal" style={css({ '--d': n })}><span className="how-step">{n + 1}</span><div className="how-icon"><Icon name={i} size={26} /></div><h3>{t}</h3><p>{d}</p></article>)}
    </section>
    <div className="marquee" aria-hidden="true"><div>{Array.from({ length: 2 }).map((_, k) => <span key={k}>Freshly baked naan ✦ Momo, steamed or fried ✦ Smoky tandoori ✦ Nepali khana set ✦ Fragrant biryani ✦ Cold Gorkha ✦ </span>)}</div></div>
    <footer className="g-footer">
      <div><Logo size={36} /> <span>Samrat Tandoori Restaurant</span></div>
      <div className="g-footer-links"><InstallButton /><Link to="/staff">Staff sign in</Link></div>
    </footer>
    <InstallNudge delay={7000} />
  </div>;
}

// ── Menu ────────────────────────────────────────────────────────────────────
const catId = (c: string) => `cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
export function MenuPage() {
  const menu = useMenu();
  const cart = useCart();
  const { query } = useRoute();
  const [active, setActive] = useState('');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [basketOpen, setBasketOpen] = useState(query.get('basket') === '1');
  const [sent, setSent] = useState<{ order: Order; key: string } | null>(null);
  const chips = useRef<HTMLDivElement>(null);
  const jumping = useRef(false);
  useEffect(() => { const t = query.get('table'); if (t) saveTable(t); }, [query]);
  const { count, total } = cartSummary(cart, menu?.items);

  const visible = useMemo(() => (menu?.items ?? []).filter(d => (!vegOnly || d.veg) &&
    (!search || `${d.name} ${d.description} ${d.category}`.toLowerCase().includes(search.toLowerCase()))), [menu, search, vegOnly]);
  const groups = useMemo(() => (menu?.categories ?? []).map(c => ({ c, items: visible.filter(d => d.category === c) })).filter(g => g.items.length), [menu, visible]);
  const favourites = useMemo(() => (menu?.items ?? []).filter(d => d.image && d.available).filter((d, i, a) => a.findIndex(x => x.image === d.image) === i), [menu]);

  // Scroll-spy: highlight the category you're reading, and keep its chip in view.
  useEffect(() => {
    if (!groups.length) return;
    const obs = new IntersectionObserver(entries => {
      if (jumping.current) return;
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.getAttribute('data-cat') || '');
    }, { rootMargin: '-150px 0px -60% 0px' });
    document.querySelectorAll('.menu-group').forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [groups]);
  useEffect(() => {
    const chip = chips.current?.querySelector(`[data-chip="${CSS.escape(active)}"]`) as HTMLElement | null;
    if (chip && chips.current) chips.current.scrollTo({ left: chip.offsetLeft - chips.current.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [active]);
  const jump = (c: string) => {
    setActive(c); jumping.current = true; haptic(8);
    document.getElementById(catId(c))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { jumping.current = false; }, 900);
  };
  const onPlaced = useCallback((order: Order, key: string) => { setBasketOpen(false); setSent({ order, key }); }, []);

  if (!menu) return <div className="page"><GuestHeader /><MenuSkeleton /></div>;
  return <div className="page menu-page">
    <GuestHeader onBasket={() => setBasketOpen(true)} />
    <section className="menu-hero">
      <h1>What are you hungry for?</h1>
      {getTable() && <p className="table-chip">Ordering for <b>{getTable() === 'Takeaway' ? 'takeaway' : `table ${getTable()}`}</b></p>}
    </section>
    {!search && !vegOnly && favourites.length > 0 && <section className="favs" aria-label="House favourites">
      <h2 className="favs-h">House favourites</h2>
      <div className="fav-rail">{favourites.map((d, i) => <button key={d.id} className="fav reveal" style={css({ '--d': i })} onClick={() => setDetail(d)}>
        <img src={d.image} alt="" loading="lazy" /><span><b>{d.name}</b><small>{priceLabel(d)}</small></span></button>)}</div>
    </section>}
    <div className="menu-sticky">
      <div className="menu-tools">
        <label className="search"><Icon name="search" size={19} /><input type="search" placeholder={`Search ${menu.items.length} dishes`} value={search} onChange={e => setSearch(e.target.value)} aria-label="Search the menu" />{search && <button className="clear" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" size={15} /></button>}</label>
        <button className={`chip veg-chip${vegOnly ? ' on' : ''}`} aria-pressed={vegOnly} onClick={() => { setVegOnly(!vegOnly); haptic(8); }}><VegMark veg /> Veg</button>
      </div>
      <div className="cats" ref={chips} aria-label="Jump to a section">{groups.map(g => <button key={g.c} data-chip={g.c} className={`chip${active === g.c ? ' on' : ''}`} onClick={() => jump(g.c)}>{g.c}<b>{g.items.length}</b></button>)}</div>
    </div>
    {!menu.settings.ordersOpen && <div className="closed-note">Online ordering is paused right now. You can still browse. Please ask a member of staff to order.</div>}
    {groups.length === 0 && <Empty icon="search" title={`Nothing matches “${search}”`}>Try another word, like “momo” or “naan”.</Empty>}
    {groups.map(g => <section key={g.c} id={catId(g.c)} data-cat={g.c} className="menu-group">
      <h2 className="reveal">{g.c}</h2>
      {g.items.some(d => d.image) && <div className="dish-grid">{g.items.filter(d => d.image).map((d, i) => <DishCard key={d.id} dish={d} qty={d.options?.length ? dishCount(cart, d.id) : cart[d.id]?.qty || 0} index={i} onOpen={() => setDetail(d)} />)}</div>}
      {g.items.some(d => !d.image) && <ul className="dish-list">{g.items.filter(d => !d.image).map((d, i) => <DishRow key={d.id} dish={d} qty={d.options?.length ? dishCount(cart, d.id) : cart[d.id]?.qty || 0} index={i} onOpen={() => setDetail(d)} />)}</ul>}
    </section>)}
    <p className="fineprint">Prices in NPR. Food images are illustrative.</p>
    {count > 0 && !basketOpen && <button className="float-basket" onClick={() => setBasketOpen(true)}>
      <span className="fb-count" key={count}>{count}</span><span>View basket</span><strong><CountUp value={total} format={npr} /></strong></button>}
    <Sheet open={!!detail} onClose={() => setDetail(null)} label={detail?.name ?? 'Dish'}>{detail && <DishDetail dish={detail} onDone={() => setDetail(null)} />}</Sheet>
    <Sheet open={basketOpen} onClose={() => setBasketOpen(false)} label="Your basket" side="right"><Basket onClose={() => setBasketOpen(false)} onPlaced={onPlaced} /></Sheet>
    {sent && <OrderSent number={sent.order.number} table={sent.order.table} images={sent.order.items.map(i => menu.items.find(d => d.id === i.id)?.image).filter((x): x is string => !!x)}
      onDone={() => navigate(`/order/${sent.order.id}?key=${sent.key}`)} />}
  </div>;
}

function MenuSkeleton() {
  return <div className="skeleton-wrap" aria-label="Loading the menu"><div className="sk sk-title" /><div className="sk sk-search" />
    <div className="dish-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-card" style={css({ '--d': i })} />)}</div></div>;
}

const askStaff = (d: Dish) => !(d.price > 0);
const priceLabel = (d: Dish) => askStaff(d) ? 'Ask staff' : d.options?.length && new Set(d.options.map(o => o.price)).size > 1 ? `from ${npr(d.price)}` : npr(d.price);

function DishCard({ dish, qty, index, onOpen }: { dish: Dish; qty: number; index: number; onOpen: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const hasOptions = !!dish.options?.length;
  const off = !dish.available;
  const add = () => {
    if (hasOptions) return onOpen();
    addToCart(dish.id, 1); sfx('add'); haptic(10);
    flyTo(card.current?.querySelector('.dish-photo img') ?? btn.current, dish.image);
  };
  return <article ref={card} className={`dish-card reveal${off ? ' sold-out' : ''}${qty > 0 ? ' in-cart' : ''}`} style={css({ '--d': index % 4 })}>
    <button className="dish-photo" onClick={onOpen} aria-label={`About ${dish.name}`}>
      <img src={dish.image} alt="" loading="lazy" width="400" height="300" />
      {dish.badge && !off && <span className="badge">{dish.badge}</span>}
      {off && <span className="badge sold">{askStaff(dish) ? 'Ask staff' : 'Sold out'}</span>}
      {qty > 0 && <span className="in-cart-tag" key={qty}><Icon name="check" size={13} /> {qty}</span>}
    </button>
    <div className="dish-info">
      <button className="dish-title" onClick={onOpen}><h3>{dish.name}</h3><VegMark veg={dish.veg} /></button>
      {dish.description && <p>{dish.description}</p>}
      <div className="dish-foot">
        <strong>{priceLabel(dish)}</strong>
        <AddControl dish={dish} qty={qty} onAdd={add} btn={btn} />
      </div>
    </div>
  </article>;
}

function AddControl({ dish, qty, onAdd, btn }: { dish: Dish; qty: number; onAdd: () => void; btn: React.RefObject<HTMLButtonElement | null> }) {
  const hasOptions = !!dish.options?.length; const off = !dish.available;
  if (qty > 0 && !hasOptions) return <div className="stepper" aria-label={`${dish.name} quantity`}>
    <button onClick={() => { addToCart(dish.id, -1); sfx('remove'); haptic(6); }} aria-label={`Remove one ${dish.name}`}><Icon name="minus" size={16} /></button>
    <span key={qty} className="pop">{qty}</span>
    <button ref={btn} onClick={onAdd} aria-label={`Add one ${dish.name}`} disabled={off}><Icon name="plus" size={16} /></button>
  </div>;
  return <button ref={btn} className="add-btn" disabled={off} onClick={onAdd} aria-label={hasOptions ? `Choose ${dish.name}` : `Add ${dish.name}`}>
    {hasOptions ? (qty > 0 ? `${qty} added` : 'Choose') : 'Add'}<Icon name="plus" size={15} /></button>;
}

/** Dishes without a photo: a typeset menu line with a dotted leader to the price. */
function DishRow({ dish, qty, index, onOpen }: { dish: Dish; qty: number; index: number; onOpen: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const off = !dish.available;
  const add = () => {
    if (dish.options?.length) return onOpen();
    addToCart(dish.id, 1); sfx('add'); haptic(10); flyTo(btn.current);
  };
  return <li className={`dish-row reveal${off ? ' sold-out' : ''}${qty > 0 ? ' in-cart' : ''}`} style={css({ '--d': index % 6 })}>
    <button className="row-main" onClick={onOpen}>
      <span className="row-line"><span className="row-name">{dish.name}<VegMark veg={dish.veg} /></span><i className="leader" aria-hidden="true" /><span className="row-price">{off && !askStaff(dish) ? 'Sold out' : priceLabel(dish)}</span></span>
      {(dish.description || dish.options?.length) && <span className="row-desc">{dish.description}{dish.description && dish.options?.length ? '. ' : ''}{dish.options?.length ? dish.options.map(o => `${o.label} ${o.price}`).join(', ') : ''}</span>}
    </button>
    <AddControl dish={dish} qty={qty} onAdd={add} btn={btn} />
  </li>;
}

function DishDetail({ dish, onDone }: { dish: Dish; onDone: () => void }) {
  const cart = useCart();
  const [option, setOption] = useState(dish.options?.[0]?.label);
  const key = cartKey(dish.id, option);
  const [qty, setQty] = useState(cart[key]?.qty || 1);
  const [note, setN] = useState(cart[key]?.note || '');
  const price = dish.options?.find(o => o.label === option)?.price ?? dish.price;
  return <div className="dish-detail">
    <div className="dd-photo">{dish.image ? <img src={dish.image} alt={dish.name} /> : <div className="dd-type"><Embers density={16} /><Icon name={dish.station === 'bar' ? 'glass' : dish.station === 'tandoor' ? 'tandoor' : 'pot'} size={40} /><span>{dish.category}</span></div>}</div>
    <div className="dd-body">
      {dish.image && <p className="dd-cat">{dish.category}</p>}
      <div className="dish-title"><h2>{dish.name}</h2><VegMark veg={dish.veg} /></div>
      {dish.description && <p>{dish.description}</p>}
      {!!dish.options?.length && <div className="opts" role="radiogroup" aria-label="Choose one">{dish.options.map((o, i) =>
        <button key={o.label} role="radio" aria-checked={option === o.label} className={`opt${option === o.label ? ' on' : ''}`} style={css({ '--d': i })} onClick={() => { setOption(o.label); setQty(cart[cartKey(dish.id, o.label)]?.qty || 1); haptic(8); }}>
          <span>{o.label}</span><b>{npr(o.price)}</b></button>)}</div>}
      <label className="field"><span>Special request <small>(optional)</small></span><input value={note} maxLength={140} onChange={e => setN(e.target.value)} placeholder="e.g. less spicy, no onion" /></label>
      <div className="dd-actions">
        <div className="stepper big"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less"><Icon name="minus" size={18} /></button><span key={qty} className="pop">{qty}</span><button onClick={() => setQty(Math.min(50, qty + 1))} aria-label="More"><Icon name="plus" size={18} /></button></div>
        <button className="btn btn-primary grow" disabled={!dish.available} onClick={e => {
          const cur = cart[key]?.qty || 0; addToCart(key, qty - cur, note); sfx('add'); haptic(12);
          flyTo(e.currentTarget, dish.image); toast(`${dish.name}${option ? ` (${option})` : ''} ×${qty} added`); onDone();
        }}>{dish.available ? <>Add for <CountUp value={price * qty} format={npr} /></> : askStaff(dish) ? 'Ask staff' : 'Sold out'}</button>
      </div>
    </div>
  </div>;
}

function Basket({ onClose, onPlaced }: { onClose: () => void; onPlaced: (o: Order, key: string) => void }) {
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
    if (!table) { setErr('Choose your table number first.'); haptic([40, 40, 40]); document.querySelector('.table-select')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300 }); return; }
    setBusy(true);
    try {
      const r = await api<{ order: Order; key: string }>('/orders', { method: 'POST', body: { table, name, note, items: lines.map(l => ({ id: l.dish.id, option: l.option, qty: l.qty, note: l.note })) } });
      saveTable(table); rememberOrder({ id: r.order.id, key: r.key, number: r.order.number, at: Date.now() });
      clearCart(); onPlaced(r.order, r.key);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Your order didn’t send. Check your connection and try again.'); haptic([60, 40, 60]); }
    finally { setBusy(false); }
  }

  return <div className="basket">
    <div className="sheet-head"><h2>Your basket</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></div>
    {lines.length === 0 ? <Empty icon="bag" title="Your basket is empty">Add a few dishes and they'll show up here.<br /><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Browse the menu</button></Empty> : <>
      <div className="basket-lines">{lines.map((l, i) => <div className="b-line" key={l.key} style={css({ '--d': i })}>
        {l.dish.image ? <img src={l.dish.image} alt="" /> : <span className="b-mono" aria-hidden="true">{l.dish.name.split(/\s+/).filter(w => /[a-z]/i.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
        <div className="b-info"><b>{l.dish.name}{l.option && <small className="b-opt"> {l.option}</small>}</b>{!l.dish.available && <span className="warn">Sold out. Remove it to continue.</span>}
          <input className="b-note" value={l.note} onChange={e => setNote(l.key, e.target.value)} placeholder="Add a request" aria-label={`Request for ${l.dish.name}`} />
          <div className="stepper sm"><button onClick={() => { addToCart(l.key, -1); sfx('remove'); }} aria-label="Less"><Icon name="minus" size={14} /></button><span key={l.qty} className="pop">{l.qty}</span><button onClick={() => { addToCart(l.key, 1); sfx('add'); }} aria-label="More"><Icon name="plus" size={14} /></button></div>
        </div>
        <strong>{npr(l.price * l.qty)}</strong>
      </div>)}</div>
      <div className="checkout">
        <div className="field-row">
          <label className="field table-select"><span>Table</span>
            <select value={table} onChange={e => setTable(e.target.value)} required>
              <option value="">Choose your table</option>
              {Array.from({ length: s?.tables || 12 }, (_, i) => String(i + 1)).map(t => <option key={t} value={t}>Table {t}</option>)}
              <option value="Takeaway">Takeaway</option>
            </select></label>
          <label className="field"><span>Your name <small>(optional)</small></span><input value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="So we can find you" /></label>
        </div>
        <label className="field"><span>Note for the kitchen <small>(optional)</small></span><textarea rows={2} maxLength={240} value={note} onChange={e => setNoteText(e.target.value)} placeholder="Allergies, timing, anything else" /></label>
        <dl className="sums">
          <div><dt>Subtotal</dt><dd>{npr(subtotal)}</dd></div>
          {service > 0 && <div><dt>Service charge ({s?.serviceChargePct}%)</dt><dd>{npr(service)}</dd></div>}
          {vat > 0 && <div><dt>VAT ({s?.vatPct}%)</dt><dd>{npr(vat)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd><CountUp value={subtotal + service + vat} format={npr} /></dd></div>
        </dl>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn btn-primary btn-lg block btn-send" disabled={busy || !s?.ordersOpen || soldOut.length > 0} onClick={place}>{busy ? <><span className="spinner" /> Sending</> : s?.ordersOpen ? <><Icon name="flame" size={19} className="send-flame" /> Send to the kitchen</> : 'Ordering paused'}</button>
        <p className="fineprint">Pay at the counter, or ask for the bill from your order screen.</p>
      </div>
    </>}
  </div>;
}

// ── Order tracking ──────────────────────────────────────────────────────────
const STEPS: { s: Status; label: string; icon: string; text: string; heat: number }[] = [
  { s: 'new', label: 'Received', icon: 'receipt', text: 'The kitchen has your order.', heat: 1 },
  { s: 'preparing', label: 'Cooking', icon: 'flame', text: 'Your food is on the fire.', heat: 2.6 },
  { s: 'ready', label: 'Ready', icon: 'bell', text: 'It’s ready. Coming to your table now.', heat: .7 },
  { s: 'served', label: 'Enjoy', icon: 'sparkle', text: 'Enjoy your meal.', heat: .3 },
];
export function TrackPage({ id }: { id: string }) {
  const { query } = useRoute();
  const key = query.get('key') || myOrders().find(o => o.id === id)?.key || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const prev = useRef<Order | null>(null);
  const nowTs = useNow(1000);
  const load = () => api<{ order: Order }>(`/orders/${id}?key=${encodeURIComponent(key)}`).then(r => setOrder(r.order)).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useLiveStream({ orders: [`${id}.${key}`], onOrder: o => o.id === id && setOrder(o), onHello: load });

  // React to changes: each step gets its own moment.
  useEffect(() => {
    const p = prev.current; prev.current = order;
    if (!order || !p) return;
    if (p.status !== order.status) {
      if (order.status === 'preparing') { sfx('done'); haptic(30); notice({ icon: 'flame', title: 'The chef has started cooking', body: `Order #${order.number}`, tone: 'gold', ms: 4500 }); }
      if (order.status === 'ready') {
        sfx('ready'); haptic([200, 100, 200, 100, 300]); confetti(innerWidth / 2, innerHeight / 3, 80);
        flashTitle('● Your food is ready');
        systemNotify('Your food is ready', `Order #${order.number} is coming to ${order.table === 'Takeaway' ? 'the counter' : `table ${order.table}`}.`, { tag: `order-${order.id}`, url: location.pathname + location.search });
      }
      if (order.status === 'served') { sfx('add'); confetti(innerWidth / 2, innerHeight / 2, 24); }
    } else {
      const newly = order.items.filter((it, i) => it.done && !p.items[i]?.done);
      if (newly.length && order.status !== 'ready') { sfx('done'); haptic(15); notice({ icon: 'check', title: `${newly.map(n => n.name).join(', ')} ${newly.length > 1 ? 'are' : 'is'} ready`, tone: 'green', ms: 3500 }); }
    }
    if (!p.paid && order.paid) notice({ icon: 'check', title: 'Payment received. Thank you.', tone: 'green' });
  }, [order]);

  async function act(path: 'cancel' | 'assist', body: object, msg: string) {
    try { const r = await api<{ order: Order }>(`/orders/${id}/${path}`, { method: 'POST', body: { key, ...body } }); setOrder(r.order); haptic(20); toast(msg); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  if (error) return <div className="page"><GuestHeader /><Empty icon="receipt" title="That order isn't on this phone">{error}. <Link to="/menu">Back to the menu</Link></Empty></div>;
  if (!order) return <div className="page"><GuestHeader /><div className="loader"><Tandoor heat={1.2} size={120} /><span>Finding your order</span></div></div>;
  const idx = order.status === 'cancelled' ? -1 : STEPS.findIndex(s => s.s === order.status);
  const doneItems = order.items.filter(i => i.done).length;
  const pct = order.status === 'served' || order.status === 'ready' ? 100 : Math.max(8, (doneItems / order.items.length) * 100);
  return <div className={`page track st-${order.status}`}>
    <GuestHeader />
    <section className="track-hero">
      <div className="track-top"><LiveBadge state={live} /><span>{order.table === 'Takeaway' ? 'Takeaway' : `Table ${order.table}`}, ordered {clock(order.createdAt)}</span></div>
      <h1 className="order-no"><small>Order</small>#{order.number}</h1>
      {order.status === 'cancelled' ? <p className="track-msg">This order was cancelled.</p> : <>
        <div className="track-stage">
          {order.status === 'preparing' && <Embers density={22} />}
          <Tandoor heat={STEPS[idx].heat} size={190} bell={order.status === 'ready'} className={`track-tandoor s-${order.status}`} />
        </div>
        <p className="track-msg" key={order.status}>{STEPS[idx].text}</p>
        <ol className="steps" style={css({ '--fill': idx / (STEPS.length - 1) })}>{STEPS.map((st, i) => <li key={st.s} className={i < idx ? 'done' : i === idx ? 'current' : ''}><span className="dot"><Icon name={i < idx ? 'check' : st.icon} size={18} /></span><span>{st.label}</span>{order.times[st.s] && <small>{clock(order.times[st.s]!)}</small>}</li>)}</ol>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
        <p className="muted small">{doneItems} of {order.items.length} dishes ready. Ordered {ago(order.createdAt, nowTs)} ago.</p>
        {(order.status === 'new' || order.status === 'preparing') && perm === 'default' && <button className="btn btn-gold notify-me" onClick={async () => { const r = await askNotifications(); setPerm(r); if (r === 'granted') { toast('We’ll tell you when it’s ready'); systemNotify('Notifications are on', `We'll tell you when order #${order.number} is ready.`, { force: true }); } }}><Icon name="bell" size={18} /> Tell me when it's ready</button>}
      </>}
    </section>
    <section className="card receipt reveal">
      <h2>Your order</h2>
      {order.items.map((it, i) => <div key={i} className={`r-line${it.done ? ' done' : ''}`}><span className="r-check" aria-hidden="true">{it.done ? <Icon name="check" size={15} /> : <i />}</span><div><b>{it.qty}× {it.name}</b>{it.note && <small>“{it.note}”</small>}</div><span className="r-state">{it.done ? 'Ready' : order.status === 'cancelled' ? '' : <i className="dots"><i /><i /><i /></i>}</span><strong>{npr(it.price * it.qty)}</strong></div>)}
      <dl className="sums">
        {order.service > 0 && <div><dt>Service charge</dt><dd>{npr(order.service)}</dd></div>}
        {order.vat > 0 && <div><dt>VAT</dt><dd>{npr(order.vat)}</dd></div>}
        <div className="grand"><dt>Total {order.paid && <span className="paid-tag">Paid</span>}</dt><dd>{npr(order.total)}</dd></div>
      </dl>
    </section>
    {order.status !== 'cancelled' && <section className="assist reveal">
      <button className="btn btn-ghost" disabled={order.assist?.type === 'waiter'} onClick={() => act('assist', { type: 'waiter' }, 'A waiter is on the way')}><Icon name="waiter" size={18} className={order.assist?.type === 'waiter' ? 'wave' : ''} /> {order.assist?.type === 'waiter' ? 'Waiter called' : 'Call a waiter'}</button>
      <button className="btn btn-ghost" disabled={order.assist?.type === 'bill' || order.paid} onClick={() => act('assist', { type: 'bill' }, 'Your bill is on its way')}><Icon name="receipt" size={18} /> {order.paid ? 'Paid' : order.assist?.type === 'bill' ? 'Bill requested' : 'Ask for the bill'}</button>
      {order.status === 'new' && <button className="btn btn-text danger" onClick={() => confirm('Cancel this order?') && act('cancel', {}, 'Order cancelled')}>Cancel order</button>}
    </section>}
    <div className="track-more"><Link to="/menu" className="btn btn-primary">Order something else</Link></div>
    <InstallNudge delay={4000}>Install the app so it can ping you when your food is ready.</InstallNudge>
  </div>;
}

export function MyOrders() {
  const refs = myOrders();
  const [orders, setOrders] = useState<Record<string, Order>>({});
  useEffect(() => { refs.forEach(r => api<{ order: Order }>(`/orders/${r.id}?key=${r.key}`).then(x => setOrders(o => ({ ...o, [r.id]: x.order }))).catch(() => {})); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveStream({ orders: refs.map(r => `${r.id}.${r.key}`), onOrder: o => setOrders(cur => ({ ...cur, [o.id]: o })) });
  return <div className="page">
    <GuestHeader />
    <section className="menu-hero"><h1>My orders</h1><p className="muted">Orders placed from this phone in the last two days.</p></section>
    {refs.length === 0 ? <Empty icon="receipt" title="No orders yet"><Link to="/menu">Browse the menu</Link></Empty> :
      <div className="my-list">{refs.map((r, i) => { const o = orders[r.id]; return <Link key={r.id} to={`/order/${r.id}?key=${r.key}`} className="my-card reveal" style={css({ '--d': i })}>
        <span className="order-no sm">#{r.number}</span>
        <div><b>{o ? `${o.items.reduce((t, x) => t + x.qty, 0)} items, ${npr(o.total)}` : 'Loading'}</b><small>{clock(r.at)}{o ? `, ${o.table === 'Takeaway' ? 'takeaway' : `table ${o.table}`}` : ''}</small></div>
        {o && <span className={`status-pill ${o.status}`}>{o.status === 'preparing' ? 'Cooking' : o.status[0].toUpperCase() + o.status.slice(1)}</span>}
      </Link>; })}</div>}
  </div>;
}
