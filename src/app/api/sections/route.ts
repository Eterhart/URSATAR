import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { fetchUrsa } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseUrsaForm } from '@/lib/ursa/sectionParser';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Connect URSA first' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const response = await fetchUrsa('/seat/seat1.cfm', session.cookie);

    if (!response.ok && response.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const html = await decodeUrsaResponse(response);
    const form = parseUrsaForm(html);

    return NextResponse.json(
      {
        ok: true,
        html,
        form: form || {
          action: 'seat1.cfm',
          method: 'GET',
          controls: [],
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[URSA Sections Form Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
