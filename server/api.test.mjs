import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
process.env.PORT = String(PORT);
process.env.DATA_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'smo-')), 'db.json');
process.env.KITCHEN_PASSWORD = 'kitch-pass'; process.env.ADMIN_PASSWORD = 'admin-pass';
let server;
const B = `http://localhost:${PORT}/api`;
const j = async (p, opts = {}) => { const r = await fetch(B + p, { ...opts, headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) }, body: opts.body && JSON.stringify(opts.body) }); return { status: r.status, body: r.status === 204 ? null : await r.json() }; };
before(async () => { ({ server } = await import('./index.mjs')); await new Promise(r => setTimeout(r, 200)); });
after(() => server.close());

test('order totals come from server prices, not the client', async () => {
  const r = await j('/orders', { method: 'POST', body: { table: '3', items: [{ id: 'garlic-naan', qty: 2, price: 1 }] } });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.total, 240);
});
test('dishes with sizes need a valid option and charge that option', async () => {
  assert.equal((await j('/orders', { method: 'POST', body: { table: '3', items: [{ id: 'tandoori-chicken', qty: 1 }] } })).status, 400);
  const r = await j('/orders', { method: 'POST', body: { table: '3', items: [{ id: 'tandoori-chicken', option: 'Half', qty: 2 }] } });
  assert.equal(r.body.order.total, 1200);
  assert.equal(r.body.order.items[0].name, 'Tandoori Chicken (Half)');
  assert.equal((await j('/orders', { method: 'POST', body: { table: '3', items: [{ id: 'turbo-cone', qty: 1 }] } })).status, 409);
});
test('guests need the order key; staff endpoints need a PIN session', async () => {
  const r = await j('/orders', { method: 'POST', body: { table: '3', items: [{ id: 'plain-naan', qty: 1 }] } });
  assert.equal((await j(`/orders/${r.body.order.id}?key=wrong`)).status, 404);
  assert.equal((await j(`/orders/${r.body.order.id}?key=${r.body.key}`)).status, 200);
  assert.equal((await j('/orders')).status, 401);
  assert.equal((await j('/login', { method: 'POST', body: { username: 'admin', password: 'nope' } })).status, 401);
});
test('station bumps move the order to ready; staff cannot edit prices', async () => {
  const { body: { token } } = await j('/login', { method: 'POST', body: { username: 'kitchen', password: 'kitch-pass' } });
  const { body: { order } } = await j('/orders', { method: 'POST', body: { table: '7', items: [{ id: 'garlic-naan', qty: 1 }, { id: 'butter-chicken', qty: 1 }] } });
  let r = await j(`/orders/${order.id}`, { method: 'PATCH', token, body: { station: 'tandoor', done: true } });
  assert.equal(r.body.order.status, 'preparing');
  r = await j(`/orders/${order.id}`, { method: 'PATCH', token, body: { station: 'kitchen', done: true } });
  assert.equal(r.body.order.status, 'ready');
  assert.equal((await j('/menu/garlic-naan', { method: 'PUT', token, body: { price: 1 } })).status, 403);
  assert.equal((await j('/menu/garlic-naan', { method: 'PATCH', token, body: { available: false } })).status, 200);
  assert.equal((await j('/orders', { method: 'POST', body: { table: '1', items: [{ id: 'garlic-naan', qty: 1 }] } })).status, 409);
});
test('manager can change prices and pause ordering', async () => {
  const { body: { token } } = await j('/login', { method: 'POST', body: { username: 'Admin', password: 'admin-pass' } });
  const r = await j('/menu/plain-naan', { method: 'PUT', token, body: { name: 'Plain Naan', price: 75 } });
  assert.equal(r.body.item.price, 75);
  await j('/settings', { method: 'PUT', token, body: { ordersOpen: false } });
  assert.equal((await j('/orders', { method: 'POST', body: { table: '1', items: [{ id: 'plain-naan', qty: 1 }] } })).status, 409);
});

test('polling fallback returns only changed orders', async () => {
  const { body: { token } } = await j('/login', { method: 'POST', body: { username: 'kitchen', password: 'kitch-pass' } });
  const first = await j('/updates?staff=1&since=0', { token });
  assert.ok(first.body.orders.length > 0);
  const again = await j(`/updates?staff=1&since=${first.body.at}`, { token });
  assert.equal(again.body.orders.length, 0);
  assert.equal((await j('/updates?staff=1&since=0')).body.orders.length, 0); // no token, no orders
});
