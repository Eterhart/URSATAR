import { Course, Section, DayOfWeek, SelectedCourseItem, TimeConflict } from '@/types/schedule';

export const DAYS_ORDER: { key: DayOfWeek; labelTh: string; short: string; color: string }[] = [
  { key: 'MON', labelTh: 'วันจันทร์', short: 'จันทร์', color: '#EAB308' },
  { key: 'TUE', labelTh: 'วันอังคาร', short: 'อังคาร', color: '#EC4899' },
  { key: 'WED', labelTh: 'วันพุธ', short: 'พุธ', color: '#10B981' },
  { key: 'THU', labelTh: 'วันพฤหัสบดี', short: 'พฤหัสฯ', color: '#F97316' },
  { key: 'FRI', labelTh: 'วันศุกร์', short: 'ศุกร์', color: '#06B6D4' },
  { key: 'SAT', labelTh: 'วันเสาร์', short: 'เสาร์', color: '#8B5CF6' },
];

export const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

export const timeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    return hours * 60 + minutes;
  }
  return 0;
};

export const detectConflicts = (items: SelectedCourseItem[]): TimeConflict[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const conflicts: TimeConflict[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i];
      const itemB = items[j];

      if (!itemA?.section || !itemB?.section) continue;

      // Must be on the same day
      if (itemA.section.day && itemB.section.day && itemA.section.day === itemB.section.day) {
        if (!itemA.section.startTime || !itemA.section.endTime || !itemB.section.startTime || !itemB.section.endTime) {
          continue;
        }

        const startA = timeToMinutes(itemA.section.startTime);
        const endA = timeToMinutes(itemA.section.endTime);
        const startB = timeToMinutes(itemB.section.startTime);
        const endB = timeToMinutes(itemB.section.endTime);

        if (startA === 0 && endA === 0) continue;
        if (startB === 0 && endB === 0) continue;

        // Check time interval overlap
        if (Math.max(startA, startB) < Math.min(endA, endB)) {
          conflicts.push({
            courseA: itemA.course,
            sectionA: itemA.section,
            courseB: itemB.course,
            sectionB: itemB.section,
            day: itemA.section.day,
            timeRange: `${itemA.section.startTime} - ${itemA.section.endTime}`,
          });
        }
      }
    }
  }

  return conflicts;
};

export const calculateTotalCredits = (items: SelectedCourseItem[]): number => {
  const uniqueCourses = new Map<string, Course>();
  items.forEach((it) => {
    uniqueCourses.set(it.course.id, it.course);
  });
  return Array.from(uniqueCourses.values()).reduce((sum, c) => sum + c.credits, 0);
};

export const generateUrsaCopyText = (items: SelectedCourseItem[], planName: string = 'Plan A'): string => {
  if (items.length === 0) return '';

  const header = `+ ${planName}`;
  const lines = items.map(
    (it) =>
      `${it.course.code} ${it.course.nameEn} : ${it.section.sectionNo} : ${it.section.startTime}-${it.section.endTime}`
  );

  return [header, ...lines].join('\n');
};
