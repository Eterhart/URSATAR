import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { fetchUrsa } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseProfileHtml } from '@/lib/ursa/profileParser';

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

    const response = await fetchUrsa('/remark/remark.cfm', session.cookie);

    if (!response.ok && response.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const html = await decodeUrsaResponse(response);
    const parsed = parseProfileHtml(html);

    return NextResponse.json(
      {
        ok: true,
        studentId: parsed.studentId,
        studentName: parsed.studentName,
        meta: parsed.meta,
        faculty: parsed.faculty,
        department: parsed.department,
        html,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[URSA Profile Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
