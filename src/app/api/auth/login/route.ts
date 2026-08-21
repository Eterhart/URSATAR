import { NextRequest, NextResponse } from 'next/server';
import { loginUrsa } from '@/lib/ursa/client';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { UrsaLoginCredentials } from '@/types/ursa';

export async function POST(request: NextRequest) {
  try {
    let body: Partial<UrsaLoginCredentials> = {};
    try {
      body = (await request.json()) as Partial<UrsaLoginCredentials>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { username, password, program = 'regular' } = body;

    if (
      !username ||
      typeof username !== 'string' ||
      !username.trim() ||
      !password ||
      typeof password !== 'string'
    ) {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    const upstreamCookie = await loginUrsa({
      username: username.trim(),
      password,
      program: program === 'buic' ? 'buic' : 'regular',
    });

    const sessionId = createSession(upstreamCookie);

    const response = NextResponse.json({ ok: true, connected: true }, { status: 200 });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error: any) {
    if (error?.message === 'URSA_REJECTED_CREDENTIALS') {
      return NextResponse.json(
        { error: 'URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่' },
        { status: 401 }
      );
    }

    console.error('[URSA Login Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถเชื่อมต่อ URSA ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
      { status: 502 }
    );
  }
}
