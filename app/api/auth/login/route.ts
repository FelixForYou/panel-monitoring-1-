import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookieName, makeSession, sessionMaxAge } from '@/lib/auth';

export async function POST(req: Request) {
  const configured = process.env.ADMIN_PASSWORD || '';
  const sessionSecret = process.env.SESSION_SECRET || '';
  if (!configured || sessionSecret.length < 16) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD atau SESSION_SECRET belum dikonfigurasi.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || '');
  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: 'Password salah.' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), makeSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: sessionMaxAge(),
  });
  return res;
}
