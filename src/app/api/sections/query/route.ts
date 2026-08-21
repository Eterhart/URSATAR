import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { URSA_BASE_URL, fetchUrsa, isAllowedUrsaHost } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseSectionsHtml } from '@/lib/ursa/sectionParser';
import { Course } from '@/types/schedule';
import { UrsaQueryRequest } from '@/types/ursa';

export async function POST(request: NextRequest) {
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

    let body: UrsaQueryRequest;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const {
      action = 'seat1.cfm',
      method = 'GET',
      fields = {},
      courseCodes,
      academicYear,
      semester,
      option1 = '1',
    } = body;

    // SSRF & Whitelist Target URL validation
    let targetUrl: URL;
    try {
      targetUrl = new URL(action || 'seat1.cfm', `${URSA_BASE_URL}/seat/seat1.cfm`);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URSA form target' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    if (!isAllowedUrsaHost(targetUrl.hostname) || !targetUrl.pathname.startsWith('/seat/')) {
      return NextResponse.json(
        { error: 'Invalid URSA form target' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // Branch A: Structured Multi-Course Query
    if (Array.isArray(courseCodes) && courseCodes.length > 0) {
      const allCourses: Course[] = [];
      const htmlSnippets: string[] = [];

      for (const rawCode of courseCodes) {
        const code = rawCode.trim();
        if (!code) continue;

        const rawYear = String(academicYear || fields.acdyr || fields.year || '2569');
        const yearCode = rawYear.length === 4 ? rawYear.slice(-2) : rawYear;
        const termCode = String(semester || fields.semcode || fields.sem || fields.term || '1');

        const queryPayload = new URLSearchParams({
          option1: option1 || fields.option1 || '1',
          acdyr: yearCode,
          semcode: termCode,
          coursecode: code,
          section: '',
          grdqry_op: '     GO     ',
        });

        let response = await fetchUrsa(`${URSA_BASE_URL}/seat/seat2.cfm`, session.cookie, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
          },
          body: queryPayload.toString(),
        });

        if (!response.ok) {
          // Fallback to seat1.cfm
          const queryParams = new URLSearchParams({
            acdyr: yearCode,
            sem: termCode,
            course_code: code,
            option1: option1 || '1',
          });
          response = await fetchUrsa(`${URSA_BASE_URL}/seat/seat1.cfm?${queryParams.toString()}`, session.cookie, {
            method: 'GET',
            headers: {
              Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
            },
          });
        }

        if (response.ok) {
          const html = await decodeUrsaResponse(response);
          htmlSnippets.push(html);
          const parsedCourses = parseSectionsHtml(html, code);
          allCourses.push(...parsedCourses);
        }
      }

      return NextResponse.json(
        {
          ok: true,
          courses: allCourses,
          html: htmlSnippets.join('\n\n'),
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // Normalize fields (Support both ScheduleBU aliases and URSA native parameter names)
    const normalizedFields: Record<string, string> = {};
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        normalizedFields[k] = String(v);
      }
    });

    if (normalizedFields.year && !normalizedFields.acdyr) normalizedFields.acdyr = normalizedFields.year;
    if (normalizedFields.term && !normalizedFields.sem) normalizedFields.sem = normalizedFields.term;
    if (normalizedFields.course && !normalizedFields.course_code) normalizedFields.course_code = normalizedFields.course;

    // Branch B: Raw Form Proxy Submission
    const httpMethod = (method || 'GET').toUpperCase();
    let queryResponse: Response;

    if (httpMethod === 'GET') {
      Object.entries(normalizedFields).forEach(([key, value]) => {
        targetUrl.searchParams.set(key, value);
      });

      queryResponse = await fetchUrsa(targetUrl.toString(), session.cookie, {
        method: 'GET',
        headers: {
          Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
        },
      });
    } else {
      const formParams = new URLSearchParams();
      Object.entries(normalizedFields).forEach(([key, value]) => {
        formParams.set(key, value);
      });

      queryResponse = await fetchUrsa(targetUrl.toString(), session.cookie, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
        },
        body: formParams.toString(),
      });
    }

    if (!queryResponse.ok && queryResponse.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถค้นหา Section ได้ในขณะนี้' },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const html = await decodeUrsaResponse(queryResponse);
    const fallbackCode =
      fields.course_code || fields.coursecode || fields.course || fields.subject;
    const courses = parseSectionsHtml(html, fallbackCode);

    return NextResponse.json(
      {
        ok: true,
        courses,
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
    console.error('[URSA Sections Query Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถค้นหา Section ได้ในขณะนี้' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
