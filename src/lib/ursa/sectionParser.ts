/**
 * Bangkok University URSA Section Table & Form Parser
 *
 * Pure DOM / Regex parser for URSA Section Availability (/seat/seat1.cfm).
 * Works in both Node.js (SSR / API Routes) and Browser environments without external dependencies.
 */

import { Course, Section, DayOfWeek } from '@/types/schedule';
import { UrsaForm, UrsaFormControl, UrsaFormControlOption } from '@/types/ursa';
import { MOCK_COURSES } from '@/data/mockCourses';

/**
 * Strips HTML tags and decodes common HTML entities.
 */
export function cleanHtmlText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes day string (Thai or English) to standard DayOfWeek enum ('MON'..'SAT').
 */
export function normalizeDayOfWeek(rawDay: string | null | undefined): DayOfWeek | null {
  if (!rawDay) return null;
  const clean = cleanHtmlText(rawDay).toLowerCase().replace(/[\s.]/g, '');

  if (/^(?:mon|monday|จันทร์|วันจันทร์|จ|mo|m)$/i.test(clean)) return 'MON';
  if (/^(?:tue|tuesday|อังคาร|วันอังคาร|อ|tu|t)$/i.test(clean)) return 'TUE';
  if (/^(?:wed|wednesday|พุธ|วันพุธ|พ|we|w)$/i.test(clean)) return 'WED';
  if (/^(?:thu|thursday|พฤหัส|พฤหัสบดี|วันพฤหัส|วันพฤหัสบดี|พฤ|th)$/i.test(clean)) return 'THU';
  if (/^(?:fri|friday|ศุกร์|วันศุกร์|ศ|fr|f)$/i.test(clean)) return 'FRI';
  if (/^(?:sat|saturday|เสาร์|วันเสาร์|ส|sa|s)$/i.test(clean)) return 'SAT';

  // Substring checks for noisy Thai text
  if (clean.includes('จันทร์')) return 'MON';
  if (clean.includes('อังคาร')) return 'TUE';
  if (clean.includes('พุธ')) return 'WED';
  if (clean.includes('พฤหัส')) return 'THU';
  if (clean.includes('ศุกร์')) return 'FRI';
  if (clean.includes('เสาร์')) return 'SAT';

  return null;
}

/**
 * Parses start and end time from text (e.g. "09:00 - 12:00", "09.00 - 12.00", "13:30-16:30").
 */
export function parseTimeRange(rawTime: string | null | undefined): { startTime: string; endTime: string } | null {
  if (!rawTime) return null;
  const clean = cleanHtmlText(rawTime);
  const match = clean.match(/(\d{1,2})[.:](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[.:](\d{2})/i);
  if (!match) return null;

  const startHour = match[1].padStart(2, '0');
  const startMin = match[2];
  const endHour = match[3].padStart(2, '0');
  const endMin = match[4];

  return {
    startTime: `${startHour}:${startMin}`,
    endTime: `${endHour}:${endMin}`,
  };
}

/**
 * Parses available seats and total seats from cell text (e.g. "12 / 40", "0 / 35", "40", "เต็ม").
 */
export function parseSeatCount(
  rawSeats: string | null | undefined,
  isClosed: boolean = false
): { availableSeats: number; totalSeats: number } {
  if (!rawSeats) return { availableSeats: 0, totalSeats: 0 };
  const clean = cleanHtmlText(rawSeats);

  const ratioMatch = clean.match(/(\d+)\s*\/\s*(\d+)/);
  if (ratioMatch) {
    const available = Math.max(0, parseInt(ratioMatch[1], 10) || 0);
    const total = Math.max(0, parseInt(ratioMatch[2], 10) || 0);
    return { availableSeats: available, totalSeats: total };
  }

  const singleNumMatch = clean.match(/\b\d+\b/);
  if (singleNumMatch) {
    const num = Math.max(0, parseInt(singleNumMatch[0], 10) || 0);
    if (isClosed || /เต็ม|close|full/i.test(clean)) {
      return { availableSeats: 0, totalSeats: num };
    }
    return { availableSeats: num, totalSeats: num };
  }

  return { availableSeats: 0, totalSeats: 0 };
}

/**
 * Parses examination column for midterm and final dates.
 */
export function parseExamDates(rawExam: string | null | undefined): { midtermDate?: string; finalDate?: string } {
  if (!rawExam) return {};
  const clean = cleanHtmlText(rawExam);
  if (!clean || clean === '-') return {};

  const parts = clean.split(/\s*[\/\n]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      midtermDate: parts[0],
      finalDate: parts[1],
    };
  }

  if (parts.length === 1) {
    if (/midterm|กลางภาค/i.test(parts[0])) {
      return { midtermDate: parts[0] };
    }
    if (/final|ปลายภาค/i.test(parts[0])) {
      return { finalDate: parts[0] };
    }
    return { midtermDate: parts[0] };
  }

  return {};
}

/**
 * Palette colors for novel / unknown courses.
 */
const COURSE_PALETTES = [
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#7C3AED', // Violet
  '#0284C7', // Sky Blue
  '#EA580C', // Orange
  '#059669', // Emerald Green
  '#D97706', // Amber
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

function getCourseColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_PALETTES.length;
  return COURSE_PALETTES[index];
}

/**
 * Parses form controls from URSA /seat/seat1.cfm HTML.
 */
export function parseUrsaForm(html: string | null | undefined): UrsaForm | null {
  if (!html || typeof html !== 'string' || !html.trim()) return null;

  const formMatches = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/gi) || [];

  for (const formHtml of formMatches) {
    const actionMatch = formHtml.match(/action=["']?([^"'>\s]+)/i);
    const methodMatch = formHtml.match(/method=["']?([^"'>\s]+)/i);

    const action = actionMatch ? actionMatch[1] : 'seat1.cfm';
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

    const controls: UrsaFormControl[] = [];

    // Extract <select> elements
    const selectRegex = /<select\b[^>]*name=["']?([^"'>\s]+)[^>]*>([\s\S]*?)<\/select>/gi;
    let selectMatch: RegExpExecArray | null;

    while ((selectMatch = selectRegex.exec(formHtml)) !== null) {
      const name = selectMatch[1];
      const selectInner = selectMatch[2];
      const options: UrsaFormControlOption[] = [];
      let selectedValue = '';

      const optionRegex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let optMatch: RegExpExecArray | null;

      while ((optMatch = optionRegex.exec(selectInner)) !== null) {
        const optAttrs = optMatch[1];
        const optText = cleanHtmlText(optMatch[2]);
        const valMatch = optAttrs.match(/value=["']?([^"'>\s]*)/i);
        const optValue = valMatch ? valMatch[1] : optText;

        options.push({ value: optValue, text: optText });

        if (/selected/i.test(optAttrs) || (!selectedValue && options.length === 1)) {
          selectedValue = optValue;
        }
      }

      controls.push({
        name,
        type: 'select',
        value: selectedValue,
        options,
      });
    }

    // Extract <input> elements
    const inputRegex = /<input\b([^>]*)>/gi;
    let inputMatch: RegExpExecArray | null;

    while ((inputMatch = inputRegex.exec(formHtml)) !== null) {
      const attrs = inputMatch[1];
      const nameMatch = attrs.match(/name=["']?([^"'>\s]+)/i);
      if (!nameMatch) continue;

      const name = nameMatch[1];
      const typeMatch = attrs.match(/type=["']?([^"'>\s]+)/i);
      const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

      if (['submit', 'button', 'password', 'radio'].includes(type)) {
        continue;
      }

      const valMatch = attrs.match(/value=["']?([^"'>]*)/i);
      const value = valMatch ? valMatch[1] : '';

      controls.push({
        name,
        type,
        value,
      });
    }

    if (controls.some((c) => /year|term|course|section|acd|sem|option/i.test(c.name))) {
      return {
        action,
        method,
        controls,
      };
    }
  }

  return null;
}

/**
 * Pure DOM / Regex parser for URSA Section HTML table (/seat/seat1.cfm).
 */
export function parseSectionsHtml(
  html: string | null | undefined,
  fallbackCourseCode?: string
): Course[] {
  if (!html || typeof html !== 'string' || !html.trim()) {
    return [];
  }

  const sanitizedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tableMatches = sanitizedHtml.match(/<table\b[^>]*>([\s\S]*?)<\/table>/gi) || [];

  // Find all candidate section tables
  const targetTables = tableMatches.filter((table) =>
    /Seat\(s\)|ที่นั่ง/i.test(table) &&
    /Status|สถานะ|Section|ตอนเรียน|กลุ่ม/i.test(table)
  );

  if (targetTables.length === 0 && tableMatches.length > 0) {
    // Check any table with at least 3 rows containing section-like digits
    const heuristicTable = tableMatches.find(
      (t) => (t.match(/<tr\b/gi) || []).length >= 3 && /\b\d{4}\b/.test(t)
    );
    if (heuristicTable) targetTables.push(heuristicTable);
  }

  const courseMap = new Map<string, Course>();

  for (const tableHtml of targetTables) {
    // 1. Detect Course Code and Course Title from the table header row
    let detectedCode = fallbackCourseCode?.trim().toUpperCase() || '';
    let detectedName = '';

    const rowMatches = tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    // Search header rows for [Course Code, Course Name] pair (e.g. <tr><td>CS422</td><td>Operating Systems (for SC.)</td></tr>)
    for (const rowHtml of rowMatches) {
      const cellMatches = rowHtml.match(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
      if (cellMatches.length >= 2) {
        const c1 = cleanHtmlText(cellMatches[0]);
        const c2 = cleanHtmlText(cellMatches[1]);

        const codeRegex = /\b([A-Z]{2,4}\s*\d{3})\b/i;
        const codeInC1 = c1.match(codeRegex);
        if (codeInC1 && c2 && !/Section|Seat|Status|Total|Taken|Left|Day|Time|Type/i.test(c2)) {
          detectedCode = codeInC1[1].replace(/\s+/g, '').toUpperCase();
          detectedName = c2.trim();
          break;
        }
      }
    }

    // Fallback: If not found in row cells, try matching in whole table or surrounding HTML
    if (!detectedCode) {
      const codeMatch =
        tableHtml.match(/\b([A-Z]{2,4}\s*\d{3})\b/i) || sanitizedHtml.match(/\b([A-Z]{2,4}\s*\d{3})\b/i);
      if (codeMatch && codeMatch[1]) {
        detectedCode = codeMatch[1].replace(/\s+/g, '').toUpperCase();
      }
    }

    if (!detectedName) {
      const nameAfterCodeMatch = sanitizedHtml.match(
        new RegExp(`\\b${detectedCode}\\b[\\s:–-]+([A-Za-z][A-Za-z0-9\\s().,&'-]{2,60})`, 'i')
      );
      if (nameAfterCodeMatch && !/Section|Seat|Total|Status|Taken|Left|Type|Day|Time/i.test(nameAfterCodeMatch[1])) {
        detectedName = nameAfterCodeMatch[1].trim();
      }
    }

    if (!detectedCode) {
      detectedCode = 'COURSE';
    }

    const courseDisplayName = detectedName || detectedCode;

    if (!courseMap.has(detectedCode)) {
      courseMap.set(detectedCode, {
        id: detectedCode.toLowerCase(),
        code: detectedCode,
        nameTh: courseDisplayName,
        nameEn: courseDisplayName,
        credits: 3,
        category: 'IT_COMPUTING',
        faculty: 'คณะเทคโนโลยีสารสนเทศและนวัตกรรม',
        description: '',
        color: getCourseColor(detectedCode),
        sections: [],
      });
    }

    const course = courseMap.get(detectedCode)!;

    for (const rowHtml of rowMatches) {
      // Discard header rows
      if (/<th\b/i.test(rowHtml) && !/<td\b/i.test(rowHtml)) continue;
      if (/Section|Seat\(s\)|Status|ประเภท|Total|Taken|Left/i.test(rowHtml) && /Day|Time|เวลา|Status/i.test(rowHtml)) continue;

      const cellMatches = rowHtml.match(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
      if (cellMatches.length < 4) continue;

      const cells = cellMatches.map((c) => cleanHtmlText(c));

      // Discard empty or header text in first cell
      if (!cells[0] || /Section|Total|Taken|Seat|Status|Left/i.test(cells[0])) continue;

      let sectionNo = cells[0].trim();
      let totalSeats = 0;
      let availableSeats = 0;
      let isClosed = false;
      let rawType = 'LECT';
      let rawDay = 'MON';
      let rawTime = '09:00 - 12:00';
      let room = 'TBA';
      let instructor = 'อาจารย์ผู้สอน';
      let rawExam = '';

      let takenSeats = 0;
      let status = 'On';
      let remark1 = '-';
      let remark2 = '-';
      let restriction = '-';
      let examination = '-';

      // Check if format matches seat2.cfm 10-column structure:
      // [0:Section, 1:Total, 2:Taken, 3:Left, 4:Status, 5:Type, 6:Day, 7:Time, 8:Room, 9:Remark]
      if (
        cells.length >= 8 &&
        /^\d+$/.test(cells[1]) &&
        /^\d+$/.test(cells[2]) &&
        /^\d+$/.test(cells[3])
      ) {
        totalSeats = parseInt(cells[1], 10) || 0;
        takenSeats = parseInt(cells[2], 10) || 0;
        availableSeats = parseInt(cells[3], 10) || 0;
        status = cells[4] || 'On';
        isClosed = /close|off|ปิด|freeze/i.test(status);
        rawType = cells[5] || 'LECT';
        rawDay = cells[6] || 'MON';
        rawTime = cells[7] || '09:00 - 12:00';
        room = cells[8] || 'TBA';
        remark1 = cells[9] || '-';
        restriction = cells[10] || cells[9] || '-';
      } else {
        // Standard seat1.cfm order:
        // [0:Section, 1:Seats, 2:Status, 3:Type, 4:Day, 5:Time, 6:Room, 7:Remark2/Instructor, 8:Remark1, 9:Examination, 10:Restriction]
        const rawSeats = cells[1] || '';
        status = cells[2] || 'On';
        isClosed = /close|ปิด|freeze/i.test(status);
        const seats = parseSeatCount(rawSeats, isClosed);
        totalSeats = seats.totalSeats;
        availableSeats = seats.availableSeats;
        takenSeats = Math.max(0, totalSeats - availableSeats);

        rawType = cells[3] || 'LECT';
        rawDay = cells[4] || 'MON';
        rawTime = cells[5] || '09:00 - 12:00';
        room = cells[6] || 'TBA';
        remark2 = cells[7] || '-';
        remark1 = cells[8] || '-';
        examination = cells[9] || '-';
        restriction = cells[10] || '-';
        instructor = cells[7] || '-';
        rawExam = cells[9] || '';
      }

      const normalizedDay = normalizeDayOfWeek(rawDay) || 'MON';
      const timeParsed = parseTimeRange(rawTime) || { startTime: '09:00', endTime: '12:00' };
      const examDates = parseExamDates(rawExam);

      const section: Section = {
        sectionNo,
        day: normalizedDay,
        startTime: timeParsed.startTime,
        endTime: timeParsed.endTime,
        room: room || 'TBA',
        instructor: instructor && instructor !== '-' ? instructor : 'อาจารย์ผู้สอน',
        campus: /City|กล้วยน้ำไท/i.test(room) ? 'City Campus (กล้วยน้ำไท)' : 'Main Campus (รังสิต)',
        totalSeats: totalSeats,
        availableSeats: isClosed ? 0 : availableSeats,
        takenSeats: takenSeats,
        status: status,
        type: rawType,
        remark1: remark1,
        remark2: remark2,
        restriction: restriction,
        examination: examination,
        ...(examDates.midtermDate ? { midtermDate: examDates.midtermDate } : {}),
        ...(examDates.finalDate ? { finalDate: examDates.finalDate } : {}),
      };

      // Deduplicate sections by sectionNo
      const existingSecIndex = course.sections.findIndex((s) => s.sectionNo === section.sectionNo);
      if (existingSecIndex === -1) {
        course.sections.push(section);
      } else {
        course.sections[existingSecIndex] = section;
      }
    }
  }

  return Array.from(courseMap.values()).filter((c) => c.sections.length > 0);
}
