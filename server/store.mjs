// Tiny JSON-file database with debounced, atomic writes.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export class Store {
  constructor(file) {
    this.file = file;
    mkdirSync(path.dirname(file), { recursive: true });
    this.data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    this.timer = null;
  }
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.saveNow(); }, 150);
  }
  saveNow() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }
}

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(pin), salt, 32).toString('hex')}`;
}
export function checkPin(pin, stored) {
  if (!pin || !stored) return false;
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(String(pin), salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
