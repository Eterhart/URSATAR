export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface Section {
  sectionNo: string;
  day: DayOfWeek;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "12:00"
  room: string;      // e.g. "C2-304"
  instructor: string;
  campus: string;
  totalSeats: number;
  availableSeats: number;
  takenSeats?: number;
  status?: string;
  type?: string;
  remark1?: string;
  remark2?: string;
  restriction?: string;
  examination?: string;
  midtermDate?: string;
  finalDate?: string;
}

export interface Course {
  id: string;
  code: string;       // e.g. "CS211"
  nameTh: string;     // Thai name
  nameEn: string;     // English name
  credits: number;    // e.g. 3
  category: 'IT_COMPUTING' | 'BU_GE' | 'FREE_ELECTIVE' | 'CORE_MAJOR';
  faculty: string;
  description: string;
  prerequisite?: string;
  color: string;      // Hex color for calendar card
  sections: Section[];
}

export interface SelectedCourseItem {
  course: Course;
  section: Section;
  addedAt: number;
}

export type PlanId = string;

export interface PlanData {
  id: PlanId;
  name: string; // e.g. "Plan A", "Plan B", "Plan D"
  items: SelectedCourseItem[];
}

export interface TimeConflict {
  courseA: Course;
  sectionA: Section;
  courseB: Course;
  sectionB: Section;
  day: DayOfWeek;
  timeRange: string;
}
