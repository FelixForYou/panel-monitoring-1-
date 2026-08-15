import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'fxhl_monitor_session';
const SESSION_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.SESSION_SECRET || '';
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySession(value?: string | null) {
  if (!value || !secret()) return false;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

export function cookieName() {
  return COOKIE_NAME;
}

export function sessionMaxAge() {
  return SESSION_SECONDS;
}
