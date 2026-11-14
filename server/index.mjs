// Samrat Menu Orders: API, live updates (SSE) and static file server.
// No runtime dependencies: Node 20+ only.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store, hashPin, checkPin } from './store.mjs';
import { SEED_MENU, CATEGORIES } from './menu.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const store = new Store(process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json'));

// ── Seed ────────────────────────────────────────────────────────────────────
const db = store.data;
if (!db.menu) db.menu = SEED_MENU.map(d => ({ available: true, ...d }));
if (!db.categories) db.categories = [...CATEGORIES];
if (!db.settings) db.settings = { restaurantName: 'Samrat Tandoori', tables: 21, ordersOpen: true, serviceChargePct: 0, vatPct: 0, currency: 'NPR' };
// Four built-in accounts. Passwords come from .env (or the defaults below on first run).
const ACCOUNTS = [
  { id: 'admin', username: 'admin', name: 'Admin', role: 'admin', env: 'ADMIN_PASSWORD', fallback: 'admin123' },
  { id: 'waiter', username: 'waiter', name: 'Waiter', role: 'waiter', env: 'WAITER_PASSWORD', fallback: 'waiter123' },
  { id: 'tandoor', username: 'tandoor', name: 'Tandoor Section', role: 'tandoor', env: 'TANDOOR_PASSWORD', fallback: 'tandoor123' },
  { id: 'kitchen', username: 'kitchen', name: 'Kitchen Section', role: 'kitchen', env: 'KITCHEN_PASSWORD', fallback: 'kitchen123' },
];
if (!db.staff || db.staff.some(s => !s.username)) { db.staff = []; db.sessions = {}; }
for (const a of ACCOUNTS) {
  let acc = db.staff.find(s => s.id === a.id);
  if (!acc) { acc = { id: a.id, username: a.username, name: a.name, role: a.role, password: hashPin(process.env[a.env] || a.fallback) }; db.staff.push(acc); }
  else if (process.env[a.env] && !checkPin(process.env[a.env], acc.password)) { acc.password = hashPin(process.env[a.env]); }
}
if (!db.orders) db.orders = [];
if (!db.sessions) db.sessions = {};
if (!db.nextNumber) db.nextNumber = 101;
if (!db.menuVersion) db.menuVersion = 1;
if (process.argv.includes('--reset-menu')) { db.menu = SEED_MENU.map(d => ({ available: true, ...d })); db.categories = [...CATEGORIES]; console.log('Menu reset from server/menu.mjs'); }
store.save();
if (process.argv.includes('--reset-menu') && !process.argv.includes('--serve')) process.exit(0);

// ── Helpers ─────────────────────────────────────────────────────────────────
const now = () => Date.now();
const STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];
const STATIONS = ['tandoor', 'kitchen', 'bar'];
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 64_000) throw new HttpError(413, 'Request too large'); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
}
function session(req, url) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
  const s = token && db.sessions[token];
  if (!s || s.exp < now()) return null;
  const staff = db.staff.find(x => x.id === s.staffId);
  return staff ? { token, staff } : null;
}
function requireRole(req, url, role) {
  const s = session(req, url);
  if (!s) throw new HttpError(401, 'Please sign in');
  if (role === 'admin' && s.staff.role !== 'admin') throw new HttpError(403, 'Admin access only');
  return s;
}
const publicStaff = s => ({ id: s.id, username: s.username, name: s.name, role: s.role });
const ROLES = ['admin', 'waiter', 'tandoor', 'kitchen'];
function totals(items) {
  const subtotal = items.reduce((t, i) => t + i.price * i.qty, 0);
  const service = Math.round(subtotal * (db.settings.serviceChargePct || 0) / 100);
  const vat = Math.round((subtotal + service) * (db.settings.vatPct || 0) / 100);
  return { subtotal, service, vat, total: subtotal + service + vat };
}
// What a guest is allowed to see about their own order.
const guestView = o => ({ id: o.id, number: o.number, table: o.table, name: o.name, note: o.note, items: o.items, status: o.status, paid: o.paid, createdAt: o.createdAt, times: o.times, assist: o.assist, ...pick(o, ['subtotal', 'service', 'vat', 'total']) });
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
const staffView = o => { const { key, ...rest } = o; return rest; };

// ── Live updates (Server-Sent Events) ───────────────────────────────────────
const clients = new Set();
function broadcast(event, payload, filter = () => true) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) if (filter(c)) c.res.write(msg);
}
function pushOrder(o) {
  o.updatedAt = now();
  for (const c of clients) {
    if (c.staff) c.res.write(`event: order\ndata: ${JSON.stringify(staffView(o))}\n\n`);
    else if (c.orderIds.has(o.id)) c.res.write(`event: order\ndata: ${JSON.stringify(guestView(o))}\n\n`);
  }
}
setInterval(() => { for (const c of clients) c.res.write(`: ping ${now()}\n\n`); }, 20_000).unref();

function openStream(req, res, url) {
  const s = session(req, url);
  const orderIds = new Set();
  for (const pair of url.searchParams.getAll('order')) {
    const [id, key] = pair.split('.');
    const o = db.orders.find(x => x.id === id);
    if (o && o.key === key) orderIds.add(id);
  }
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-store, no-transform', 'content-encoding': 'identity', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.flushHeaders?.();
  // A 2 KB comment pushes proxies (e.g. Cloudflare tunnels) to start streaming straight away.
  res.write(`:${' '.repeat(2048)}\nretry: 3000\nevent: hello\ndata: ${JSON.stringify({ at: now(), staff: !!s })}\n\n`);
  const client = { res, staff: !!s, orderIds };
  clients.add(client);
  req.on('close', () => clients.delete(client));
}

// ── Login throttling ────────────────────────────────────────────────────────
const failures = new Map();
function ipOf(req) { return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(); }
function checkThrottle(ip) {
  const f = failures.get(ip);
  if (f && f.count >= 5 && now() - f.at < 60_000) throw new HttpError(429, 'Too many attempts. Wait a minute and try again.');
}
const orderRate = new Map();

// ── Orders ──────────────────────────────────────────────────────────────────
function createOrder(body, ip) {
  if (!db.settings.ordersOpen) throw new HttpError(409, 'The kitchen is not taking online orders right now. Please ask a member of staff.');
  const r = orderRate.get(ip) || []; const recent = r.filter(t => now() - t < 10 * 60_000);
  if (recent.length >= 8) throw new HttpError(429, 'Too many orders from this device. Please ask a member of staff.');
  const table = str(String(body.table ?? ''), 12);
  if (!table) throw new HttpError(400, 'Please choose your table');
  if (!Array.isArray(body.items) || !body.items.length) throw new HttpError(400, 'Your basket is empty');
  if (body.items.length > 40) throw new HttpError(400, 'Too many different items');
  const items = body.items.map(line => {
    const dish = db.menu.find(d => d.id === line?.id);
    if (!dish) throw new HttpError(400, 'A dish in your basket is no longer on the menu');
    if (!dish.available) throw new HttpError(409, `Sorry, ${dish.name} has just sold out`);
    const qty = Math.floor(Number(line.qty));
    if (!(qty >= 1 && qty <= 50)) throw new HttpError(400, 'Invalid quantity');
    let price = dish.price; let option;
    if (dish.options?.length) {
      const opt = dish.options.find(o => o.label === line.option);
      if (!opt) throw new HttpError(400, `Please choose an option for ${dish.name}`);
      price = opt.price; option = opt.label;
    }
    if (!(price > 0)) throw new HttpError(409, `${dish.name} can’t be ordered online yet. Please ask staff.`);
    return { id: dish.id, name: option ? `${dish.name} (${option})` : dish.name, option, price, qty, station: dish.station, note: str(line.note, 140), done: false };
  });
  const order = {
    id: randomUUID().slice(0, 8), key: randomBytes(12).toString('hex'), number: db.nextNumber++,
    table, name: str(body.name, 40), note: str(body.note, 240), items, ...totals(items),
    status: 'new', paid: false, source: 'guest', createdAt: now(), times: { new: now() }, assist: null,
  };
  db.orders.push(order);
  recent.push(now()); orderRate.set(ip, recent);
  store.save(); pushOrder(order);
  return order;
}
function setStatus(o, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');
  o.status = status; o.times[status] = now();
  if (status === 'ready' || status === 'served') o.items.forEach(i => { i.done = true; });
  if (status === 'new') { o.items.forEach(i => { i.done = false; }); o.times = { new: o.times.new }; }
  if (status === 'preparing') o.items.forEach(i => { i.done = false; });
}
function bumpStation(o, station, done) {
  o.items.forEach(i => { if (i.station === station) i.done = done; });
  if (o.status === 'new' && done) { o.status = 'preparing'; o.times.preparing = now(); }
  if (o.items.every(i => i.done) && (o.status === 'new' || o.status === 'preparing')) { o.status = 'ready'; o.times.ready = now(); }
  if (!done && o.status === 'ready') { o.status = 'preparing'; delete o.times.ready; }
}
function pruneOrders() {
  const cutoff = now() - 90 * 86400_000;
  db.orders = db.orders.filter(o => o.createdAt > cutoff);
  for (const [t, s] of Object.entries(db.sessions)) if (s.exp < now()) delete db.sessions[t];
}
setInterval(() => { pruneOrders(); store.save(); }, 3600_000).unref();

// ── Router ──────────────────────────────────────────────────────────────────
async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, '');
  const m = req.method;
  const seg = p.split('/').filter(Boolean);

  if (p === '/health') return send(res, 200, { ok: true, at: now() });
  // Polling fallback for networks that buffer the live stream.
  if (p === '/updates' && m === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0;
    const s = session(req, url);
    let orders = [];
    if (s && url.searchParams.get('staff') === '1') orders = db.orders.filter(o => (o.updatedAt || o.createdAt) > since).map(staffView);
    else for (const pair of url.searchParams.getAll('order')) {
      const [id, key] = pair.split('.'); const o = db.orders.find(x => x.id === id);
      if (o && o.key === key && (o.updatedAt || o.createdAt) > since) orders.push(guestView(o));
    }
    return send(res, 200, { at: now(), menuVersion: db.menuVersion, orders });
  }
  if (p === '/stream' && m === 'GET') return openStream(req, res, url);

  if (p === '/menu' && m === 'GET') return send(res, 200, { items: db.menu, categories: db.categories, settings: db.settings, version: db.menuVersion });

  if (p === '/login' && m === 'POST') {
    const ip = ipOf(req); checkThrottle(ip);
    const b = await readJson(req);
    const username = str(b.username, 40).toLowerCase();
    const cand = db.staff.find(s => s.username === username);
    const staff = cand && checkPin(String(b.password || ''), cand.password) ? cand : null;
    if (!staff) { const f = failures.get(ip) || { count: 0, at: 0 }; failures.set(ip, { count: (now() - f.at > 60_000 ? 0 : f.count) + 1, at: now() }); throw new HttpError(401, 'Wrong username or password. Try again.'); }
    failures.delete(ip);
    const token = randomBytes(24).toString('hex');
    db.sessions[token] = { staffId: staff.id, exp: now() + 14 * 86400_000 };
    store.save();
    return send(res, 200, { token, staff: publicStaff(staff) });
  }
  if (p === '/session' && m === 'GET') { const s = requireRole(req, url); return send(res, 200, { staff: publicStaff(s.staff) }); }
  if (p === '/logout' && m === 'POST') { const s = session(req, url); if (s) { delete db.sessions[s.token]; store.save(); } return send(res, 204); }

  // Guest order endpoints
  if (p === '/orders' && m === 'POST') {
    const body = await readJson(req);
    const staffSession = session(req, url);
    const order = createOrder(body, staffSession ? `staff:${staffSession.staff.id}:${now()}` : ipOf(req));
    if (staffSession) { order.source = 'staff'; order.takenBy = staffSession.staff.name; store.save(); }
    return send(res, 201, { order: guestView(order), key: order.key });
  }
  if (seg[0] === 'orders' && seg[1] && m === 'GET' && url.searchParams.has('key')) {
    const o = db.orders.find(x => x.id === seg[1]);
    if (!o || o.key !== url.searchParams.get('key')) throw new HttpError(404, 'Order not found');
    return send(res, 200, { order: guestView(o) });
  }
  if (seg[0] === 'orders' && seg[1] && (seg[2] === 'cancel' || seg[2] === 'assist') && m === 'POST' && !session(req, url)) {
    const body = await readJson(req);
    const o = db.orders.find(x => x.id === seg[1]);
    if (!o || o.key !== body.key) throw new HttpError(404, 'Order not found');
    if (seg[2] === 'cancel') {
      if (o.status !== 'new') throw new HttpError(409, 'The kitchen has already started on your order. Please ask a member of staff.');
      setStatus(o, 'cancelled'); o.cancelledBy = 'guest';
    } else {
      const type = body.type === 'bill' ? 'bill' : 'waiter';
      o.assist = { type, at: now() };
    }
    store.save(); pushOrder(o);
    return send(res, 200, { order: guestView(o) });
  }

  // Staff endpoints
  if (p === '/orders' && m === 'GET') {
    requireRole(req, url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 2));
    const since = now() - days * 86400_000;
    return send(res, 200, { orders: db.orders.filter(o => o.createdAt >= since).map(staffView) });
  }
  if (seg[0] === 'orders' && seg[1] && m === 'PATCH') {
    const s = requireRole(req, url);
    const o = db.orders.find(x => x.id === seg[1]);
    if (!o) throw new HttpError(404, 'Order not found');
    const b = await readJson(req);
    if (b.status) { setStatus(o, b.status); if (b.status === 'cancelled') o.cancelledBy = s.staff.name; }
    if (b.station && STATIONS.includes(b.station)) bumpStation(o, b.station, b.done !== false);
    if (Number.isInteger(b.item) && o.items[b.item]) { o.items[b.item].done = !!b.done; bumpStation(o, '__none__', true); if (!b.done && o.status === 'ready') { o.status = 'preparing'; delete o.times.ready; } }
    if (typeof b.paid === 'boolean') { o.paid = b.paid; o.paidAt = b.paid ? now() : undefined; if (b.method) o.payMethod = str(b.method, 20); }
    if (b.clearAssist) o.assist = null;
    o.updatedBy = s.staff.name; o.updatedAt = now();
    store.save(); pushOrder(o);
    return send(res, 200, { order: staffView(o) });
  }

  if (seg[0] === 'orders' && seg[1] && m === 'DELETE') {
    requireRole(req, url, 'admin');
    const before = db.orders.length;
    db.orders = db.orders.filter(o => o.id !== seg[1]);
    if (db.orders.length === before) throw new HttpError(404, 'Order not found');
    store.save(); broadcast('removed', { id: seg[1] }, c => c.staff);
    return send(res, 204);
  }

  // Admin: menu, settings, staff
  if (p === '/menu' && m === 'POST') {
    requireRole(req, url, 'admin');
    const b = await readJson(req);
    const dish = cleanDish(b, null);
    if (db.menu.some(d => d.id === dish.id)) dish.id += '-' + randomBytes(2).toString('hex');
    db.menu.push(dish); store.save(); db.menuVersion++; broadcast('menu', { items: db.menu, categories: db.categories, settings: db.settings });
    return send(res, 201, { item: dish });
  }
  if (seg[0] === 'menu' && seg[1] && (m === 'PUT' || m === 'PATCH')) {
    requireRole(req, url, m === 'PATCH' ? undefined : 'admin'); // staff may mark sold out (PATCH available only)
    const dish = db.menu.find(d => d.id === seg[1]);
    if (!dish) throw new HttpError(404, 'Dish not found');
    const b = await readJson(req);
    if (m === 'PATCH') {
      if (b.available === true && !(dish.price > 0)) throw new HttpError(409, `Set a price for ${dish.name} first (admin)`);
      if (typeof b.available === 'boolean') dish.available = b.available;
    }
    else Object.assign(dish, cleanDish({ ...dish, ...b }, dish.id));
    store.save(); db.menuVersion++; broadcast('menu', { items: db.menu, categories: db.categories, settings: db.settings });
    return send(res, 200, { item: dish });
  }
  if (seg[0] === 'menu' && seg[1] && m === 'DELETE') {
    requireRole(req, url, 'admin');
    db.menu = db.menu.filter(d => d.id !== seg[1]);
    store.save(); db.menuVersion++; broadcast('menu', { items: db.menu, categories: db.categories, settings: db.settings });
    return send(res, 204);
  }
  if (p === '/categories' && m === 'PUT') {
    requireRole(req, url, 'admin');
    const b = await readJson(req);
    if (!Array.isArray(b.categories)) throw new HttpError(400, 'categories must be a list');
    db.categories = [...new Set(b.categories.map(c => str(c, 40)).filter(Boolean))].slice(0, 30);
    store.save(); db.menuVersion++; broadcast('menu', { items: db.menu, categories: db.categories, settings: db.settings });
    return send(res, 200, { categories: db.categories });
  }
  if (p === '/settings' && m === 'PUT') {
    requireRole(req, url, 'admin');
    const b = await readJson(req);
    const s = db.settings;
    if (typeof b.restaurantName === 'string') s.restaurantName = str(b.restaurantName, 60) || s.restaurantName;
    if (Number.isInteger(b.tables) && b.tables >= 1 && b.tables <= 200) s.tables = b.tables;
    if (typeof b.ordersOpen === 'boolean') s.ordersOpen = b.ordersOpen;
    for (const k of ['serviceChargePct', 'vatPct']) if (typeof b[k] === 'number' && b[k] >= 0 && b[k] <= 30) s[k] = b[k];
    store.save(); db.menuVersion++; broadcast('menu', { items: db.menu, categories: db.categories, settings: db.settings });
    return send(res, 200, { settings: s });
  }
  if (p === '/staff' && m === 'GET') { requireRole(req, url, 'admin'); return send(res, 200, { staff: db.staff.map(publicStaff) }); }
  if (p === '/staff' && m === 'POST') {
    requireRole(req, url, 'admin');
    const b = await readJson(req);
    const name = str(b.name, 40); const username = str(b.username, 30).toLowerCase(); const password = String(b.password || '');
    if (!name) throw new HttpError(400, 'Name is required');
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, 'Username: 3–30 letters/numbers, no spaces');
    if (db.staff.some(s => s.username === username)) throw new HttpError(409, 'That username is taken');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    const member = { id: randomUUID().slice(0, 8), username, name, role: ROLES.includes(b.role) ? b.role : 'waiter', password: hashPin(password) };
    db.staff.push(member); store.save();
    return send(res, 201, { staff: publicStaff(member) });
  }
  if (seg[0] === 'staff' && seg[1] && m === 'PUT') {
    requireRole(req, url, 'admin');
    const target = db.staff.find(x => x.id === seg[1]);
    if (!target) throw new HttpError(404, 'Not found');
    const b = await readJson(req);
    if (b.password !== undefined) {
      if (String(b.password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      target.password = hashPin(String(b.password));
      for (const [t, v] of Object.entries(db.sessions)) if (v.staffId === target.id) delete db.sessions[t];
    }
    if (typeof b.name === 'string' && b.name.trim()) target.name = str(b.name, 40);
    store.save();
    return send(res, 200, { staff: publicStaff(target) });
  }
  if (seg[0] === 'staff' && seg[1] && m === 'DELETE') {
    const s = requireRole(req, url, 'admin');
    if (seg[1] === s.staff.id) throw new HttpError(400, 'You can’t remove yourself');
    const target = db.staff.find(x => x.id === seg[1]);
    if (target?.role === 'admin' && db.staff.filter(x => x.role === 'admin').length < 2) throw new HttpError(400, 'Keep at least one admin');
    db.staff = db.staff.filter(x => x.id !== seg[1]);
    for (const [t, v] of Object.entries(db.sessions)) if (v.staffId === seg[1]) delete db.sessions[t];
    store.save();
    return send(res, 204);
  }
  throw new HttpError(404, 'Not found');
}

function cleanDish(b, id) {
  const name = str(b.name, 60);
  if (!name) throw new HttpError(400, 'Dish name is required');
  let options;
  if (Array.isArray(b.options) && b.options.length) {
    options = b.options.slice(0, 12).map(o => ({ label: str(o?.label, 30), price: Math.round(Number(o?.price)) }))
      .filter(o => o.label && o.price > 0 && o.price <= 1_000_000);
    if (!options.length) options = undefined;
  }
  const price = options ? Math.min(...options.map(o => o.price)) : Math.round(Number(b.price));
  if (!(price >= 0 && price <= 1_000_000)) throw new HttpError(400, 'Enter a valid price');
  const slug = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || randomBytes(3).toString('hex');
  const image = typeof b.image === 'string' && /^\/assets\/food\/[\w-]+\.(webp|png|jpe?g)$/.test(b.image) ? b.image : undefined;
  return {
    id: slug, name, price, options, image,
    category: str(b.category, 40) || db.categories[0] || 'Menu',
    station: STATIONS.includes(b.station) ? b.station : 'kitchen',
    description: str(b.description, 200), badge: str(b.badge, 30) || undefined,
    veg: b.veg === undefined || b.veg === null ? undefined : !!b.veg, available: b.available !== false && price > 0,
  };
}

// ── Static files ────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA fallback
  if (!existsSync(file)) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('App not built yet. Run: npm run build'); }
  const ext = path.extname(file);
  const immutable = rel.startsWith('/assets/') && /-[\w-]{8,}\.(js|css)$/.test(rel);
  const noCache = ext === '.html' || rel === '/sw.js' || ext === '.webmanifest';
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : noCache ? 'no-cache' : 'public, max-age=86400',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    serveStatic(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong. Please try again.' : err.message });
    else res.end();
  }
});
server.requestTimeout = 0; // SSE connections stay open
server.listen(PORT, HOST, () => console.log(`Samrat Menu Orders running on http://localhost:${PORT}`));
const shutdown = () => { store.saveNow(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
export { server };
