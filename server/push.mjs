// Web Push: notifications that reach phones and computers even when the app is closed.
// Keys (VAPID) are generated once and kept in the database.
import webpush from 'web-push';

export function createPush(db, store) {
  if (!db.vapid) { db.vapid = webpush.generateVAPIDKeys(); store.save(); }
  if (!db.pushSubs) db.pushSubs = [];
  webpush.setVapidDetails(process.env.PUSH_SUBJECT || 'mailto:noreply@samratmenuorders.app', db.vapid.publicKey, db.vapid.privateKey);
  const sent = []; // last payloads, for tests/diagnostics

  const valid = s => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';

  function add(sub, meta) {
    if (!valid(sub)) throw Object.assign(new Error('Invalid push subscription'), { status: 400 });
    db.pushSubs = db.pushSubs.filter(s => s.sub.endpoint !== sub.endpoint);
    db.pushSubs.push({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, ...meta, at: Date.now() });
    if (db.pushSubs.length > 2000) db.pushSubs = db.pushSubs.slice(-2000);
    store.save();
  }
  function remove(endpoint) {
    const n = db.pushSubs.length;
    db.pushSubs = db.pushSubs.filter(s => s.sub.endpoint !== endpoint);
    if (n !== db.pushSubs.length) store.save();
  }
  function removeWhere(fn) { db.pushSubs = db.pushSubs.filter(s => !fn(s)); store.save(); }

  async function send(filter, payload) {
    const targets = db.pushSubs.filter(filter);
    const body = JSON.stringify(payload);
    sent.push({ payload, count: targets.length }); if (sent.length > 50) sent.shift();
    await Promise.all(targets.map(async t => {
      if (process.env.PUSH_DRY_RUN) return;
      try {
        await webpush.sendNotification(t.sub, body, { TTL: payload.ttl ?? 600, urgency: 'high', topic: payload.tag ? String(payload.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : undefined });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) remove(t.sub.endpoint); // subscription gone
        else console.error('push failed', e.statusCode || '', e.body || e.message);
      }
    }));
  }

  return { publicKey: db.vapid.publicKey, add, remove, removeWhere, send, sent };
}
