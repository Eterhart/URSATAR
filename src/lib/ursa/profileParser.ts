/**
 * Bangkok University URSA Student Profile Parser
 *
 * Extracts student profile metadata (Student ID, Name, Faculty, Department)
 * from URSA Grade Report HTML (/remark/remark.cfm).
 */

export interface ParsedProfile {
  studentId: string;
  studentName: string;
  meta: string;
  faculty?: string;
  department?: string;
}

/**
 * Strips HTML tags and decodes common HTML entities.
 */
export function cleanHtmlText(raw: string): string {
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
 * Pure DOM / Regex parser for URSA Grade Report HTML (/remark/remark.cfm).
 *
 * Works in both Node.js (SSR / API Routes) and Browser environments without external dependencies.
 */
export function parseProfileHtml(html: string | null | undefined): ParsedProfile {
  const result: ParsedProfile = {
    studentId: '',
    studentName: '',
    meta: 'ข้อมูลจาก URSA',
  };

  if (!html || typeof html !== 'string' || !html.trim()) {
    return result;
  }

  // Normalize HTML and strip scripts, styles, and comments
  const sanitizedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // 1. Locate Grade Report Table
  const tableMatches = sanitizedHtml.match(/<table\b[^>]*>([\s\S]*?)<\/table>/gi) || [];
  let targetTableHtml = tableMatches.find((table) =>
    /Grade\s*Report/i.test(table) &&
    /Student\s*ID|รหัสนักศึกษา/i.test(table) &&
    /\bName\b|ชื่อ/i.test(table)
  );

  // If specific Grade Report table not found, search in any table containing Student ID and Name
  if (!targetTableHtml) {
    targetTableHtml = tableMatches.find((table) =>
      /Student\s*ID|รหัสนักศึกษา/i.test(table) &&
      /\bName\b|ชื่อ/i.test(table)
    );
  }

  const searchScope = targetTableHtml || sanitizedHtml;

  // 2. Extract Cells from Scope
  const cellRegex = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
  const cells: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(searchScope)) !== null) {
    cells.push(cleanHtmlText(match[1]));
  }

  // 3. Scan Adjacent Cells for ID, Name, Faculty, Department
  if (cells.length > 0) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = cells[i].trim();

      // Check for standalone labels followed by value in next cell
      // Student ID
      if (/^(?:Student\s*ID|รหัสนักศึกษา|Student\s*Code|ID)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.studentId && !/^(?:Name|ชื่อ|Faculty|Department)/i.test(val)) {
          result.studentId = val;
        }
      }

      // Student Name
      if (/^(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name|ชื่อ\s*-\s*สกุล)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.studentName && !/^(?:Student|รหัส|Faculty|Department)/i.test(val)) {
          result.studentName = val;
        }
      }

      // Faculty
      if (/^(?:Faculty|คณะ)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.faculty && !/^(?:Department|สาขา|Name|ชื่อ)/i.test(val)) {
          result.faculty = val;
        }
      }

      // Department
      if (/^(?:Department|สาขาวิชา|สาขา|ภาควิชา|Major)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.department && !/^(?:Faculty|คณะ|Name|ชื่อ)/i.test(val)) {
          result.department = val;
        }
      }

      // Also check if label and value are combined within the same cell
      if (!result.studentId) {
        const singleIdMatch = cellText.match(/^(?:Student\s*ID|รหัสนักศึกษา|Student\s*Code|ID)\s*[:]\s*([0-9]{8,12})/i);
        if (singleIdMatch && singleIdMatch[1]) {
          result.studentId = singleIdMatch[1].trim();
        }
      }

      if (!result.studentName) {
        const singleNameMatch = cellText.match(/^(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name)\s*[:]\s*([^\r\n<>&;]{2,80})/i);
        if (singleNameMatch && singleNameMatch[1]) {
          const val = singleNameMatch[1].trim();
          if (!/^(?:Student\s*ID|Faculty|Department)/i.test(val)) {
            result.studentName = val;
          }
        }
      }

      if (!result.faculty) {
        const singleFacMatch = cellText.match(/^(?:Faculty|คณะ)\s*[:]\s*([^\r\n<>&;]{2,80})/i);
        if (singleFacMatch && singleFacMatch[1]) {
          result.faculty = singleFacMatch[1].trim();
        }
      }

      if (!result.department) {
        const singleDeptMatch = cellText.match(/^(?:Department|สาขาวิชา|สาขา|ภาควิชา|Major)\s*[:]\s*([^\r\n<>&;]{2,80})/i);
        if (singleDeptMatch && singleDeptMatch[1]) {
          result.department = singleDeptMatch[1].trim();
        }
      }
    }
  }

  // 4. Regex Fallback if cells were not cleanly parsed
  if (!result.studentId) {
    const idMatch = searchScope.match(/(?:Student\s*ID|รหัสนักศึกษา|Student\s*Code)[\s:]*([0-9]{8,12})/i);
    if (idMatch && idMatch[1]) {
      result.studentId = idMatch[1].trim();
    } else {
      const buIdMatch = searchScope.match(/\b(1\d{9})\b/);
      if (buIdMatch && buIdMatch[1]) {
        result.studentId = buIdMatch[1].trim();
      }
    }
  }

  if (!result.studentName) {
    const nameMatch = searchScope.match(/(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name)[\s:]*([^\r\n<>&;]{2,80})/i);
    if (nameMatch && nameMatch[1]) {
      const clean = cleanHtmlText(nameMatch[1]).replace(/^[:\s-]+/, '').trim();
      if (clean && !/^(?:Student\s*ID|Faculty|Department|รหัสนักศึกษา|คณะ|สาขา)/i.test(clean)) {
        result.studentName = clean;
      }
    }
  }

  if (!result.faculty) {
    const facMatch = searchScope.match(/(?:Faculty|คณะ)[\s:]*([^\r\n<>&;]{2,80})/i);
    if (facMatch && facMatch[1]) {
      const clean = cleanHtmlText(facMatch[1]).replace(/^[:\s-]+/, '').trim();
      if (clean && !/^(?:Department|สาขา|Name|ชื่อ)/i.test(clean)) {
        result.faculty = clean;
      }
    }
  }

  if (!result.department) {
    const deptMatch = searchScope.match(/(?:Department|สาขาวิชา|สาขา|ภาควิชา|Major)[\s:]*([^\r\n<>&;]{2,80})/i);
    if (deptMatch && deptMatch[1]) {
      const clean = cleanHtmlText(deptMatch[1]).replace(/^[:\s-]+/, '').trim();
      if (clean && !/^(?:Faculty|คณะ|Name|ชื่อ)/i.test(clean)) {
        result.department = clean;
      }
    }
  }

  // 5. Compute Display Meta
  if (result.studentId) {
    result.meta = `Student ID ${result.studentId}`;
  } else {
    result.meta = 'ข้อมูลจาก URSA';
  }

  return result;
}
