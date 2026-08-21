# Milestone 4: Frontend UI Integration & State Management — Comprehensive Architecture & Implementation Blueprint

## 1. Observation

### 1.1 Existing Codebase & Artifact Audit
- **Milestones 1–3 Backend Handshake & Endpoints**:
  - `POST /api/auth/login`: Accepts `{ username, password, program? }`, negotiates upstream ColdFusion cookies with `https://ursa2.bu.ac.th/SetFullId.cfm`, decodes binary `windows-874`, detects credential rejections, generates a 32-byte cryptographically secure session ID, and sets the HTTP-only cookie `buplaner_session` (`src/app/api/auth/login/route.ts:44-51`).
  - `GET /api/auth/status`: Verifies active session in `sessionStore` with 1-hour TTL (`src/app/api/auth/status/route.ts:5-16`).
  - `POST /api/auth/logout`: Clears in-memory session and returns `Max-Age=0` cookie (`src/app/api/auth/logout/route.ts:13-20`).
  - `GET /api/profile`: Proxies `/remark/remark.cfm`, decodes `windows-874`, parses student name, student ID, faculty, and department (`src/app/api/profile/route.ts:24-50`).
  - `GET /api/sections`: Proxies `/seat/seat1.cfm` to extract form controls for academic year and semester (`src/app/api/sections/route.ts:24-50`).
  - `POST /api/sections/query`: Accepts `{ academicYear, semester, courseCodes, option1, fields, action, method }`, enforces SSRF whitelist (`isAllowedUrsaHost`), queries URSA, and parses section rows (`src/app/api/sections/query/route.ts:71-115`).

- **Type Discrepancy Found in Build Check**:
  - Executing `npm run build` revealed a TypeScript compilation error in `src/app/api/sections/query/route.ts(40,7)`: `Property 'option1' does not exist on type 'UrsaQueryRequest'`.
  - In `src/types/ursa.ts`, `UrsaQueryRequest` lacked `option1?: string;`. Adding `option1?: string;` resolves the type error.

- **Reference Architecture in ScheduleBU (`C:\Users\Nisha\Downloads\ScheduleBU`)**:
  - `app.js:20-24`: Auto-checks `/api/auth/status` on load; on success, loads profile via `/api/profile` and displays student name/ID.
  - `app.js:23`: Handles login submission to `/api/auth/login`, showing `"กำลังเชื่อมต่อ..."`, handling rejection errors in Thai, and auto-fetching profile.
  - `app.js:30-38`: Form metadata loader querying `/api/sections` and rendering dynamic academic year/semester selectors.
  - `app.js:42-49`: LocalStorage schedule persistence using key `bu-planer:schedules:v1`.
  - `app.js:50-54`: Section table results rendering with selective enrollment into active schedule.

- **Current Frontend State in `src/`**:
  - `src/hooks/`: Directory does not yet exist. Needs `useUrsaAuth.ts` and `useUrsaSections.ts`.
  - `src/components/LoginModal.tsx`: Currently uses simulated timer rather than calling real `/api/auth/login`.
  - `src/components/Header.tsx`: Static header without live connection pill, student name/ID, or connect/disconnect button.
  - `src/components/CourseExplorer.tsx`: Static form with mock delay rather than invoking `POST /api/sections/query`.
  - `src/app/page.tsx`: Uses static `MOCK_COURSES` and local React state without hook integration or `bu-planer:schedules:v1` persistence.

---

## 2. Logic Chain

1. **State Hydration & Authentication Flow**:
   - On initial page load, `useUrsaAuth` triggers `GET /api/auth/status`.
   - If connected, it queries `GET /api/profile` to retrieve `studentId`, `studentName`, and `meta`.
   - `Header` observes `connected`, `studentName`, and `studentId` from `useUrsaAuth`, rendering a pulsing green connection badge (`"เชื่อมต่อ URSA แล้ว"`) with student avatar and name. If disconnected, it renders a gray pill (`"ยังไม่ได้เชื่อม URSA"`) and a `"เชื่อมต่อ URSA"` button.
   - Clicking `"เชื่อมต่อ URSA"` opens `LoginModal`, which forwards credentials to `login()` from `useUrsaAuth`. On error, it displays the Thai error message (`"URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่"`). On success, it displays a green checkmark (`"เข้าสู่ระบบสำเร็จ!"`), auto-dismisses, and updates application state.

2. **Live Section Query & Fallback Mechanism**:
   - `useUrsaSections` fetches URSA search form controls from `GET /api/sections` on mount or on demand.
   - In `CourseExplorer`, user inputs course codes (space/newline-separated) and selects academic year/semester.
   - Submitting triggers `searchSections()` in `useUrsaSections` via `POST /api/sections/query`.
   - Component-scoped loading overlay (`bg-black/45 backdrop-blur-[2px]`) activates with spinner and `"Loading..."`.
   - When query finishes, `courses` in state is updated. If URSA returns sections, live courses populate `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, and `ActiveCoursesList`. If disconnected or searching mock courses, graceful fallback retains smooth planner interactivity.

3. **Timetable Grid Interaction & Ghost Preview Engine**:
   - **Enrolled Cards**: Solid Apple Action Blue (`bg-[#0071E3] text-white`) with course code, English name, section number badge, type (`LECT`/`LAB`), available seats, and removal button (`X`).
   - **Ghost Preview Cards**: Outlined Apple style (`border-2 border-[#0071E3] bg-white text-[#0071E3]`) representing unselected sections from the search query.
     - *Exclusion Rule 1*: Hidden if any section of the same course is already enrolled.
     - *Exclusion Rule 2*: Hidden if the time slot overlaps with an already enrolled course.
     - *Hover Sync*: Hovering a ghost card sets `hoveredCourseId`, highlighting corresponding items across tables and active list.
     - *Enrollment*: Clicking a ghost card enrolls the section into the active plan.
   - **Clustering & Conflict Detection**:
     - Calculates interval overlaps (`detectConflicts`).
     - Clustered cards compute split widths and left offsets (`leftPercent`, `widthPercent`) to render overlapping cards side-by-side.
     - Conflicting cards pulse red (`bg-[#FF3B30] conflict-pulse ring-2 ring-red-400`).
     - `ConflictBanner` renders at top of page listing specific conflicting courses and slots.

4. **Multi-Plan Persistence & Export**:
   - Schedules are loaded and saved to `localStorage` key `bu-planer:schedules:v1`.
   - Integrated tab bar supports adding plans (`+`), inline renaming (double-click/context menu), and deletion.
   - `CopySecModal` formats selected courses into URSA registration copy text and triggers celebratory confetti (`canvas-confetti`).

---

## 3. Implementation Code Blueprints

### Blueprint 3.1: Fix Type Definition (`src/types/ursa.ts`)
```typescript
import { Course } from './schedule';

export type UrsaProgram = 'regular' | 'buic';

export interface UrsaLoginCredentials {
  username: string;
  password: string;
  program?: UrsaProgram;
}

export interface UrsaSession {
  cookie: string;
  createdAt: number;
}

export interface UrsaLoginResponse {
  ok: boolean;
  connected?: boolean;
  error?: string;
}

export interface UrsaAuthStatusResponse {
  connected: boolean;
}

export interface UrsaLogoutResponse {
  ok: boolean;
  connected: boolean;
}

export interface UrsaProfile {
  studentId: string;
  studentName: string;
  faculty?: string;
  department?: string;
}

export interface UrsaProfileResponse {
  ok: boolean;
  studentId?: string;
  studentName?: string;
  meta?: string;
  faculty?: string;
  department?: string;
  html?: string;
  error?: string;
}

export interface UrsaFormControlOption {
  value: string;
  text: string;
}

export interface UrsaFormControl {
  name: string;
  type: string;
  value?: string;
  options?: UrsaFormControlOption[];
}

export interface UrsaForm {
  action: string;
  method: string;
  controls: UrsaFormControl[];
}

export interface UrsaSectionsResponse {
  ok: boolean;
  form?: UrsaForm;
  html?: string;
  error?: string;
}

export interface UrsaQueryRequest {
  academicYear?: string;
  semester?: string;
  courseCodes?: string[];
  option1?: string;
  action?: string;
  method?: string;
  fields?: Record<string, string>;
}

export interface UrsaQueryResponse {
  ok: boolean;
  courses?: Course[];
  html?: string;
  error?: string;
}
```

---

### Blueprint 3.2: `useUrsaAuth.ts` (`src/hooks/useUrsaAuth.ts`)
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UrsaLoginCredentials,
  UrsaLoginResponse,
  UrsaAuthStatusResponse,
  UrsaProfileResponse,
} from '@/types/ursa';

export interface UseUrsaAuthReturn {
  connected: boolean;
  studentId: string;
  studentName: string;
  meta: string;
  faculty: string;
  department: string;
  isLoading: boolean;
  error: string | null;
  checkStatus: () => Promise<boolean>;
  fetchProfile: () => Promise<UrsaProfileResponse | null>;
  login: (credentials: UrsaLoginCredentials) => Promise<boolean>;
  logout: () => Promise<boolean>;
  clearError: () => void;
}

export function useUrsaAuth(): UseUrsaAuthReturn {
  const [connected, setConnected] = useState<boolean>(false);
  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [meta, setMeta] = useState<string>('');
  const [faculty, setFaculty] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchProfile = useCallback(async (): Promise<UrsaProfileResponse | null> => {
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.status === 401) {
        setConnected(false);
        setStudentId('');
        setStudentName('');
        setMeta('');
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data: UrsaProfileResponse = await response.json();
      if (data.ok) {
        if (data.studentId) setStudentId(data.studentId);
        if (data.studentName) setStudentName(data.studentName);
        if (data.meta) setMeta(data.meta);
        else if (data.studentId) setMeta(`Student ID ${data.studentId}`);
        if (data.faculty) setFaculty(data.faculty);
        if (data.department) setDepartment(data.department);
      }
      return data;
    } catch {
      // Profile fetch is non-blocking
      return null;
    }
  }, []);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        setConnected(false);
        setIsLoading(false);
        return false;
      }

      const data: UrsaAuthStatusResponse = await response.json();
      setConnected(Boolean(data.connected));

      if (data.connected) {
        await fetchProfile();
      } else {
        setStudentId('');
        setStudentName('');
        setMeta('');
      }

      setIsLoading(false);
      return Boolean(data.connected);
    } catch {
      setConnected(false);
      setIsLoading(false);
      return false;
    }
  }, [fetchProfile]);

  const login = useCallback(
    async (credentials: UrsaLoginCredentials): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        const data: UrsaLoginResponse = await response.json();

        if (!response.ok || !data.ok) {
          const errMsg = data.error || 'ไม่สามารถเข้าสู่ระบบ URSA ได้';
          setError(errMsg);
          setIsLoading(false);
          return false;
        }

        setConnected(true);
        await fetchProfile();
        setIsLoading(false);
        return true;
      } catch (err: any) {
        const errMsg = err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        setError(errMsg);
        setIsLoading(false);
        return false;
      }
    },
    [fetchProfile]
  );

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      setConnected(false);
      setStudentId('');
      setStudentName('');
      setMeta('');
      setFaculty('');
      setDepartment('');
      setError(null);
      setIsLoading(false);
      return true;
    } catch {
      setConnected(false);
      setIsLoading(false);
      return true;
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    connected,
    studentId,
    studentName,
    meta,
    faculty,
    department,
    isLoading,
    error,
    checkStatus,
    fetchProfile,
    login,
    logout,
    clearError,
  };
}
```

---

### Blueprint 3.3: `useUrsaSections.ts` (`src/hooks/useUrsaSections.ts`)
```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Course } from '@/types/schedule';
import { UrsaForm, UrsaSectionsResponse, UrsaQueryRequest, UrsaQueryResponse } from '@/types/ursa';

export interface UseUrsaSectionsReturn {
  form: UrsaForm | null;
  courses: Course[];
  rawHtml: string;
  isLoading: boolean;
  error: string | null;
  fetchFormControls: () => Promise<UrsaForm | null>;
  searchSections: (params: UrsaQueryRequest) => Promise<Course[]>;
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  clearResults: () => void;
  clearError: () => void;
}

export function useUrsaSections(): UseUrsaSectionsReturn {
  const [form, setForm] = useState<UrsaForm | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rawHtml, setRawHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearResults = useCallback(() => {
    setCourses([]);
    setRawHtml('');
    setError(null);
  }, []);

  const fetchFormControls = useCallback(async (): Promise<UrsaForm | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/sections', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Connect URSA first');
        } else {
          setError('ไม่สามารถดึงข้อมูล Course Sections ได้');
        }
        setIsLoading(false);
        return null;
      }

      const data: UrsaSectionsResponse = await response.json();
      if (data.ok && data.form) {
        setForm(data.form);
        if (data.html) setRawHtml(data.html);
      }
      setIsLoading(false);
      return data.form || null;
    } catch {
      setError('ไม่สามารถดึงข้อมูล Course Sections ได้');
      setIsLoading(false);
      return null;
    }
  }, []);

  const searchSections = useCallback(
    async (params: UrsaQueryRequest): Promise<Course[]> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/sections/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const data: UrsaQueryResponse = await response.json();

        if (!response.ok || !data.ok) {
          const errMsg = data.error || 'ค้นหา Section ไม่สำเร็จ';
          setError(errMsg);
          setIsLoading(false);
          return [];
        }

        const foundCourses = data.courses || [];
        setCourses(foundCourses);
        if (data.html) setRawHtml(data.html);
        setIsLoading(false);
        return foundCourses;
      } catch (err: any) {
        const errMsg = err?.message || 'ค้นหา Section ไม่สำเร็จ';
        setError(errMsg);
        setIsLoading(false);
        return [];
      }
    },
    []
  );

  return {
    form,
    courses,
    rawHtml,
    isLoading,
    error,
    fetchFormControls,
    searchSections,
    setCourses,
    clearResults,
    clearError,
  };
}
```

---

### Blueprint 3.4: `LoginModal.tsx` (`src/components/LoginModal.tsx`)
```typescript
'use client';

import React, { useState } from 'react';
import { X, User, Lock, LogIn, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { UrsaLoginCredentials, UrsaProgram } from '@/types/ursa';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (credentials: UrsaLoginCredentials) => Promise<boolean>;
  authError?: string | null;
  isSubmitting?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  authError,
  isSubmitting = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState<UrsaProgram>('regular');
  const [isSuccess, setIsSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLoading(true);

    const success = await onLogin({
      username: username.trim(),
      password,
      program,
    });

    setLoading(false);
    if (success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setUsername('');
        setPassword('');
        setLocalError(null);
        onClose();
      }, 1200);
    } else {
      setLocalError(authError || 'URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่');
    }
  };

  const displayedError = localError || authError;
  const activeLoading = loading || isSubmitting;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-[#1D1D1F] rounded-[24px] shadow-2xl max-w-md w-full overflow-hidden transform animate-in zoom-in-95 duration-200 cursor-default border border-black/10"
      >
        {/* Header */}
        <div className="bg-[#F5F5F7] p-5 text-[#1D1D1F] flex items-center justify-between border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-black/[0.08] shadow-2xs">
              <LogIn className="w-4 h-4 text-[#0071E3]" />
            </div>
            <div>
              <h3 className="apple-headline text-base text-[#1D1D1F]">
                เข้าสู่ระบบนักศึกษา BU
              </h3>
              <p className="text-[11px] text-[#86868B] apple-subheadline">
                Bangkok University Single Sign-On
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/[0.05] hover:bg-black/[0.1] active:scale-95 flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 bg-white">
          {isSuccess ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-[#34C759] mx-auto animate-bounce" />
              <h4 className="apple-headline text-lg text-[#1D1D1F]">เข้าสู่ระบบสำเร็จ!</h4>
              <p className="text-xs text-[#86868B]">กำลังเชื่อมต่อข้อมูลนักศึกษามหาวิทยาลัยกรุงเทพ...</p>
            </div>
          ) : (
            <>
              {displayedError && (
                <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl flex items-start gap-2.5 text-[#FF3B30] text-xs animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug font-medium">{displayedError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] apple-subheadline">
                  User Name URSA
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="เช่น nuchnicha.roon"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={activeLoading}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#F5F5F7] border border-black/[0.08] rounded-xl text-xs sm:text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 transition-all apple-subheadline font-medium disabled:opacity-50"
                  />
                  <User className="w-4 h-4 text-[#86868B] absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] apple-subheadline">
                  Password URSA
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={activeLoading}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#F5F5F7] border border-black/[0.08] rounded-xl text-xs sm:text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 transition-all disabled:opacity-50"
                  />
                  <Lock className="w-4 h-4 text-[#86868B] absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] apple-subheadline">
                  หลักสูตร (Program)
                </label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value as UrsaProgram)}
                  disabled={activeLoading}
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.08] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 transition-all font-medium disabled:opacity-50"
                >
                  <option value="regular">ภาคปกติ (Thai Program)</option>
                  <option value="buic">นานาชาติ (BU International)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={activeLoading}
                  className="apple-blue-btn w-full py-3 font-medium text-xs sm:text-sm shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {activeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>กำลังเชื่อมต่อ...</span>
                    </>
                  ) : (
                    <span>เข้าสู่ระบบ (Sign In)</span>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <span className="text-[11px] text-[#86868B] font-light apple-subheadline">
                  ข้อมูลจะถูกส่งตรงไปยัง URSA และไม่ถูกบันทึกรหัสผ่านลงระบบ
                </span>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
```

---

### Blueprint 3.5: `Header.tsx` (`src/components/Header.tsx`)
```typescript
'use client';

import React from 'react';
import { PlanId } from '@/types/schedule';
import { LogIn, LogOut, CheckCircle2, User } from 'lucide-react';

interface HeaderProps {
  connected?: boolean;
  studentName?: string;
  studentId?: string;
  meta?: string;
  onConnectClick?: () => void;
  onLogoutClick?: () => void;
  activePlan?: PlanId;
}

export const Header: React.FC<HeaderProps> = ({
  connected = false,
  studentName,
  studentId,
  meta,
  onConnectClick,
  onLogoutClick,
}) => {
  return (
    <header className="bg-[#121417] text-white border-b border-white/10 sticky top-0 z-40 shadow-xl backdrop-blur-md w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* BU Logo and Branding */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Diamond Silver Emblem */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-white via-slate-200 to-slate-400 flex items-center justify-center shadow-lg shadow-white/10 border border-white/40">
              <span className="text-[#0A0C0E] font-black text-xl sm:text-2xl tracking-tighter">BU</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                BANGKOK UNIVERSITY
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/20">
                SCHEDULE PLANNER
              </span>
            </div>
          </div>

          {/* Right Side: Connection Status & Profile Badge */}
          <div className="flex items-center gap-3 sm:gap-4">
            {connected ? (
              <div className="flex items-center gap-3">
                {/* Live Connected Pill */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>เชื่อมต่อ URSA แล้ว</span>
                </div>

                {/* Profile Card */}
                <div className="flex items-center gap-2.5 pl-2">
                  <div className="w-8 h-8 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {studentName ? studentName.slice(0, 2) : <User className="w-4 h-4" />}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-white leading-tight truncate max-w-[160px]">
                      {studentName || 'นักศึกษา BU'}
                    </div>
                    <div className="text-[10px] text-[#86868B] font-mono leading-tight">
                      {studentId ? `ID ${studentId}` : meta || 'URSA Connected'}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                {onLogoutClick && (
                  <button
                    onClick={onLogoutClick}
                    title="ออกจากระบบ URSA"
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Disconnected Pill */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[#86868B] text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#86868B]" />
                  <span>ยังไม่ได้เชื่อม URSA</span>
                </div>

                {/* Connect Button */}
                {onConnectClick && (
                  <button
                    onClick={onConnectClick}
                    className="apple-blue-btn px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-white" />
                    <span>เชื่อม URSA</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
```

---

### Blueprint 3.6: `CourseExplorer.tsx` (`src/components/CourseExplorer.tsx`)
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { PlanId } from '@/types/schedule';
import { ChevronDown, Search, Loader2 } from 'lucide-react';
import { UrsaFormControl } from '@/types/ursa';

interface CourseExplorerProps {
  activePlan: PlanId;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExecuteSearch?: (params: { academicYear: string; semester: string; query: string }) => Promise<void> | void;
  isLoading?: boolean;
  formControls?: UrsaFormControl[];
}

export const CourseExplorer: React.FC<CourseExplorerProps> = ({
  searchQuery,
  onSearchChange,
  onExecuteSearch,
  isLoading = false,
  formControls = [],
}) => {
  const [academicYear, setAcademicYear] = useState('2569');
  const [semester, setSemester] = useState('1');
  const [localInput, setLocalInput] = useState(searchQuery);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'success'>('success');

  // Discover Year & Semester options from formControls if available
  const yearControl = formControls.find((c) => /year|acdyr/i.test(c.name));
  const semControl = formControls.find((c) => /sem|term/i.test(c.name));

  useEffect(() => {
    setLocalInput(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchStatus('loading');

    onSearchChange(localInput);
    if (onExecuteSearch) {
      await onExecuteSearch({
        academicYear,
        semester,
        query: localInput,
      });
    }
    setSearchStatus('success');
  };

  const handleClear = () => {
    setLocalInput('');
    onSearchChange('');
    setSearchStatus('idle');
  };

  return (
    <div className="apple-card-light p-5 space-y-4 shadow-sm relative overflow-hidden rounded-[18px]">
      {/* Component-scoped Loading Overlay: 100% card coverage */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center select-none animate-in fade-in duration-150">
          <div className="flex items-center gap-3 text-white drop-shadow-xl animate-in zoom-in-95 duration-150">
            <Loader2 className="w-6 h-6 animate-spin text-[#2997FF]" />
            <span className="apple-headline text-lg font-semibold tracking-wider text-white">
              Loading...
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="apple-headline text-base text-[#1D1D1F]">
          ค้นหาและเพิ่ม Section
        </h3>
      </div>

      {/* Dropdowns Row: ปีการศึกษา + ภาคเรียน */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            ปีการศึกษา
          </label>
          <div className="relative">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 appearance-none cursor-pointer pr-8 transition-all"
            >
              {yearControl?.options && yearControl.options.length > 0 ? (
                yearControl.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.text}
                  </option>
                ))
              ) : (
                <>
                  <option value="2569">2026 (B.E. 2569)</option>
                  <option value="2568">2025 (B.E. 2568)</option>
                  <option value="2567">2024 (B.E. 2567)</option>
                </>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            ภาคเรียน
          </label>
          <div className="relative">
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 appearance-none cursor-pointer pr-8 transition-all"
            >
              {semControl?.options && semControl.options.length > 0 ? (
                semControl.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.text}
                  </option>
                ))
              ) : (
                <>
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนฤดูร้อน</option>
                </>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Row 2: รหัสวิชา Textarea */}
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            รหัสวิชา
          </label>

          <div className="relative">
            <textarea
              rows={4}
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder={"กรอกรหัสวิชา (รองรับหลายบรรทัด / เว้นวรรค) เช่น:\nCS422 CS430 CS441\nCS446\nCS448\nEN103"}
              className="w-full p-3.5 bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08] rounded-xl text-xs placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 focus:border-[#0071E3]/50 transition-all apple-subheadline font-medium leading-relaxed resize-y"
            />

            {localInput && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 text-[11px] text-[#86868B] hover:text-[#1D1D1F] bg-white hover:bg-black/[0.05] border border-black/10 px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer active:scale-95 shadow-2xs"
                title="ล้างข้อความ"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Status Left + Submit Button Right */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center min-h-[28px]">
            {searchStatus === 'success' && (
              <span className="text-[#86868B] text-xs font-medium apple-subheadline animate-in fade-in duration-200">
                ค้นหาสำเร็จ!
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-full text-xs font-medium tracking-wide transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95 shadow-xs ${
              isLoading
                ? 'bg-[#E5E5EA] text-[#8E8E93] ring-2 ring-[#E5E5EA] ring-offset-2 ring-offset-white cursor-not-allowed'
                : 'bg-[#0071E3] text-white ring-2 ring-[#0071E3] ring-offset-2 ring-offset-white hover:bg-[#0077ED] hover:ring-[#0077ED]'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-white" />
            <span className="apple-subheadline">ค้นหารายวิชา</span>
          </button>
        </div>
      </form>
    </div>
  );
};
```

---

### Blueprint 3.7: `page.tsx` (`src/app/page.tsx`)
```typescript
'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Course, Section, PlanId, PlanData, SelectedCourseItem } from '@/types/schedule';
import { MOCK_COURSES } from '@/data/mockCourses';
import { Header } from '@/components/Header';
import { TimetableGrid } from '@/components/TimetableGrid';
import { CourseExplorer } from '@/components/CourseExplorer';
import { ActiveCoursesList } from '@/components/ActiveCoursesList';
import { EnrolledCoursesTable } from '@/components/EnrolledCoursesTable';
import { UnselectedCoursesTable } from '@/components/UnselectedCoursesTable';
import { ConflictBanner } from '@/components/ConflictBanner';
import { CopySecModal } from '@/components/CopySecModal';
import { LoginModal } from '@/components/LoginModal';
import { useUrsaAuth } from '@/hooks/useUrsaAuth';
import { useUrsaSections } from '@/hooks/useUrsaSections';
import { detectConflicts } from '@/utils/scheduleUtils';
import { LogIn } from 'lucide-react';

const PLANNER_STORAGE_KEY = 'bu-planer:schedules:v1';

export default function HomePage() {
  // 1. Auth Hook Integration
  const {
    connected,
    studentName,
    studentId,
    meta,
    isLoading: isAuthLoading,
    error: authError,
    login,
    logout,
  } = useUrsaAuth();

  // 2. Sections Query Hook Integration
  const {
    form,
    courses: liveUrsaCourses,
    isLoading: isSectionsLoading,
    fetchFormControls,
    searchSections,
  } = useUrsaSections();

  // 3. Plans State & LocalStorage Persistence
  const initialPlanA: SelectedCourseItem[] = [
    {
      course: MOCK_COURSES[0], // CS441
      section: MOCK_COURSES[0].sections[0], // Sec 3271 (Mon 09:00 - 12:00)
      addedAt: Date.now() - 2000,
    },
    {
      course: MOCK_COURSES[1], // CS446
      section: MOCK_COURSES[1].sections[0], // Sec 4461 (Tue 09:00 - 12:00)
      addedAt: Date.now() - 1000,
    },
  ];

  const [plans, setPlans] = useState<Record<PlanId, PlanData>>({
    planA: { id: 'planA', name: 'Plan A', items: initialPlanA },
    planB: { id: 'planB', name: 'Plan B', items: [] },
    planC: { id: 'planC', name: 'Plan C', items: [] },
  });

  const [activePlan, setActivePlan] = useState<PlanId>('planA');
  const [searchQuery, setSearchQuery] = useState<string>('CS422 CS430 CS441 CS446 CS448 EN103');
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const timetableGridRef = useRef<HTMLDivElement>(null);

  // Load plans from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          // If stored as { '1': [...], '2': [...] } ScheduleBU format -> convert to PlanData
          if (parsed['1'] && Array.isArray(parsed['1'])) {
            const converted: Record<PlanId, PlanData> = {};
            Object.entries(parsed).forEach(([k, items]) => {
              const planKey = `plan${String.fromCharCode(65 + Number(k) - 1)}`;
              converted[planKey] = {
                id: planKey,
                name: `Plan ${String.fromCharCode(65 + Number(k) - 1)}`,
                items: (items as SelectedCourseItem[]) || [],
              };
            });
            setPlans(converted);
          } else {
            setPlans(parsed);
          }
        }
      }
    } catch {
      // Keep default plans
    }
  }, []);

  // Save plans to localStorage on update
  const savePlansToStorage = useCallback((updated: Record<PlanId, PlanData>) => {
    try {
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  // Fetch form metadata if authenticated
  useEffect(() => {
    if (connected) {
      fetchFormControls();
    }
  }, [connected, fetchFormControls]);

  // Execute search query
  const handleExecuteSearch = useCallback(
    async ({ academicYear, semester, query }: { academicYear: string; semester: string; query: string }) => {
      const tokens = query
        .trim()
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean);

      if (tokens.length === 0) return;

      if (connected) {
        await searchSections({
          academicYear,
          semester,
          courseCodes: tokens,
          option1: '1',
        });
      }
    },
    [connected, searchSections]
  );

  const currentPlan = plans[activePlan] || plans[Object.keys(plans)[0]] || {
    id: 'planA',
    name: 'Plan A',
    items: [],
  };
  const currentItems = currentPlan ? currentPlan.items : [];
  const conflicts = detectConflicts(currentItems);

  // Compute matched courses (Live URSA courses take priority, fallback to MOCK_COURSES)
  const searchedCourses = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    if (tokens.length === 0) return [];

    const sourcePool = liveUrsaCourses.length > 0 ? liveUrsaCourses : MOCK_COURSES;

    return sourcePool.filter((c) => {
      const code = c.code.toLowerCase();
      const nameTh = c.nameTh.toLowerCase();
      const nameEn = c.nameEn.toLowerCase();
      return tokens.some((t) => code.includes(t) || nameTh.includes(t) || nameEn.includes(t));
    });
  }, [searchQuery, liveUrsaCourses]);

  // Compute all matching preview sections
  const previewSections = useMemo(() => {
    const previews: { course: Course; section: Section }[] = [];
    searchedCourses.forEach((course) => {
      course.sections.forEach((sec) => {
        previews.push({ course, section: sec });
      });
    });
    return previews;
  }, [searchedCourses]);

  const handleAddPlan = () => {
    const planKeys = Object.keys(plans);
    const nextLetter = String.fromCharCode(65 + planKeys.length);
    const nextId = `plan${nextLetter}`;
    const updated = {
      ...plans,
      [nextId]: {
        id: nextId,
        name: `Plan ${nextLetter}`,
        items: [],
      },
    };
    setPlans(updated);
    savePlansToStorage(updated);
    setActivePlan(nextId);
  };

  const handleDeletePlan = (id: PlanId, name: string) => {
    if (Object.keys(plans).length <= 1) {
      alert('ต้องมีอย่างน้อย 1 แผนในระบบ');
      return;
    }

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${name}?`)) {
      const copy = { ...plans };
      delete copy[id];
      setPlans(copy);
      savePlansToStorage(copy);

      if (activePlan === id) {
        const remainingKeys = Object.keys(copy);
        setActivePlan(remainingKeys[0] || 'planA');
      }
    }
  };

  const handleRenamePlan = (id: PlanId, newName: string) => {
    if (!newName.trim()) return;
    const updated = {
      ...plans,
      [id]: {
        ...plans[id],
        name: newName.trim(),
      },
    };
    setPlans(updated);
    savePlansToStorage(updated);
  };

  const handleAddCourse = (course: Course, section: Section) => {
    const existingItems = plans[activePlan]?.items || [];
    const filtered = existingItems.filter((it) => it.course.id !== course.id);
    const updated = {
      ...plans,
      [activePlan]: {
        ...plans[activePlan],
        items: [...filtered, { course, section, addedAt: Date.now() }],
      },
    };
    setPlans(updated);
    savePlansToStorage(updated);
  };

  const handleRemoveCourse = (courseId: string, sectionNo: string) => {
    const updated = {
      ...plans,
      [activePlan]: {
        ...plans[activePlan],
        items: (plans[activePlan]?.items || []).filter(
          (it) => !(it.course.id === courseId && it.section.sectionNo === sectionNo)
        ),
      },
    };
    setPlans(updated);
    savePlansToStorage(updated);
  };

  const handleResetPlan = () => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการล้างวิชาทั้งหมดใน ${currentPlan.name}?`)) {
      const updated = {
        ...plans,
        [activePlan]: {
          ...plans[activePlan],
          items: [],
        },
      };
      setPlans(updated);
      savePlansToStorage(updated);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans selection:bg-[#0071E3] selection:text-white w-full">
      {/* Header with Live Connection Status & User Profile */}
      <Header
        connected={connected}
        studentName={studentName}
        studentId={studentId}
        meta={meta}
        onConnectClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={logout}
        activePlan={activePlan}
      />

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-5 space-y-4">
        {/* Time Conflict Alert (if any) */}
        <ConflictBanner conflicts={conflicts} />

        {/* 2-Column Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
          {/* Left Column: Timetable Grid with Integrated Tabs + Enrolled & Unselected Tables */}
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-4">
            <TimetableGrid
              items={currentItems}
              previewSections={previewSections}
              conflicts={conflicts}
              onRemoveItem={handleRemoveCourse}
              onAddCourse={handleAddCourse}
              hoveredCourseId={hoveredCourseId}
              onHoverCourse={setHoveredCourseId}
              gridRef={timetableGridRef}
              plans={plans}
              activePlan={activePlan}
              onSelectPlan={(id) => setActivePlan(id)}
              onAddPlan={handleAddPlan}
              onDeletePlan={handleDeletePlan}
              onRenamePlan={handleRenamePlan}
            />

            {/* Enrolled Courses Table */}
            <EnrolledCoursesTable
              searchedCourses={searchedCourses}
              selectedItems={currentItems}
            />

            {/* Unselected Courses Table */}
            <UnselectedCoursesTable
              searchedCourses={searchedCourses}
              selectedItems={currentItems}
            />
          </div>

          {/* Right Column: Connection CTA / Search Box & Active Courses List */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-4 sticky top-24">
            {!connected && (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="apple-blue-btn w-full h-[46px] rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm font-medium cursor-pointer active:scale-95 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-white" />
                <span className="apple-subheadline">เข้าสู่ระบบ URSA</span>
              </button>
            )}

            {/* Course Explorer */}
            <CourseExplorer
              activePlan={activePlan}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onExecuteSearch={handleExecuteSearch}
              isLoading={isSectionsLoading}
              formControls={form?.controls || []}
            />

            {/* Active Courses List */}
            <ActiveCoursesList
              searchedCourses={searchedCourses}
              selectedItems={currentItems}
              hoveredCourseId={hoveredCourseId}
              onHoverCourse={setHoveredCourseId}
              onOpenCopyModal={() => setIsCopyModalOpen(true)}
              onResetPlan={handleResetPlan}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <CopySecModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        items={currentItems}
        planName={currentPlan?.name || 'Plan A'}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={login}
        authError={authError}
        isSubmitting={isAuthLoading}
      />
    </div>
  );
}
```

---

## 4. Caveats & Assumptions

1. **URSA ColdFusion Upstream Session Expiration**:
   - Upstream ColdFusion sessions typically expire in 60 minutes. The Next.js session store sets `Max-Age: 3600`. If an upstream session is terminated earlier by URSA, protected calls return HTTP 401, causing `useUrsaAuth` to set `connected = false` and prompt the user to re-authenticate.
2. **Offline & Fallback Planning**:
   - When not connected to URSA, the application gracefully operates using `MOCK_COURSES`, allowing students to draft schedules without active internet or URSA server availability.
3. **SSRF and Form Whitelisting**:
   - Upstream form action URLs are validated to strictly match `https://ursa2.bu.ac.th/seat/` to protect against SSRF.
4. **LocalStorage Compatibility**:
   - Handles both rich `PlanData` objects (`Record<PlanId, PlanData>`) and backward-compatible array-based maps (`{ 1: [], 2: [] }`).

---

## 5. Conclusion & Implementation Checklist

The architecture for Milestone 4 (Frontend UI Integration & State Management) is fully specified and ready for implementation.

### Implementation Action Plan:
1. **Types**: Add `option1?: string;` to `UrsaQueryRequest` in `src/types/ursa.ts`.
2. **Hooks**:
   - Create `src/hooks/useUrsaAuth.ts` with connection polling, profile loading, login, and logout.
   - Create `src/hooks/useUrsaSections.ts` with form metadata fetching and multi-course query execution.
3. **Components**:
   - Update `src/components/LoginModal.tsx` to handle live `login()` submission with spinner and Thai error banner.
   - Update `src/components/Header.tsx` to render live connection indicator, student name/ID, and connect/disconnect actions.
   - Update `src/components/CourseExplorer.tsx` to bind year/semester selectors and execute queries with loading overlay.
   - Update `src/components/TimetableGrid.tsx` with ghost cards, solid enrolled cards, and conflict pulse.
   - Update `src/components/EnrolledCoursesTable.tsx` and `src/components/UnselectedCoursesTable.tsx` to present live URSA sections.
   - Update `src/components/CopySecModal.tsx` for clipboard export and confetti.
   - Update `src/components/PlanSwitcher.tsx` and `src/app/page.tsx` for `bu-planer:schedules:v1` persistence.
4. **Build & Quality Assurance**:
   - Run `npm run build` to confirm 0 TypeScript / Turbopack build errors.

---

## 6. Verification Method

To independently verify Milestone 4 implementation:
1. **Type & Production Build Verification**:
   ```powershell
   npm run build
   ```
   *Expected Result*: Exit code 0, Turbopack compiles successfully with 0 errors.

2. **Auth & Profile Integration Test**:
   - Launch app: `npm run dev`
   - Open `http://localhost:3000`
   - Verify Header shows gray pill `"ยังไม่ได้เชื่อม URSA"` and `"เชื่อม URSA"` button.
   - Click `"เชื่อม URSA"`, enter credentials, click submit -> Verify spinner `"กำลังเชื่อมต่อ..."`.
   - On success -> Verify Header changes to green pulsing pill `"เชื่อมต่อ URSA แล้ว"` with Student Name and Student ID.

3. **Section Search & Ghost Previews**:
   - In Course Explorer, search for `"CS441 CS446"`.
   - Verify loading overlay covers explorer during fetch.
   - Verify unselected sections appear as outlined ghost preview cards on the calendar grid.
   - Click a ghost preview card -> Verify card transforms to solid blue enrolled card and moves into Enrolled Courses Table.

4. **Time Conflict Detection**:
   - Enroll two courses with identical day & time (e.g. Mon 09:00 - 12:00).
   - Verify `ConflictBanner` appears and cards pulse with red conflict animation.

5. **Multi-Plan Persistence**:
   - Switch to Plan B, add a course.
   - Refresh the browser page.
   - Verify Plan A and Plan B retain their respective courses from `localStorage` (`bu-planer:schedules:v1`).
