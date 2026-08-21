'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Course, Section, PlanId, PlanData, SelectedCourseItem } from '@/types/schedule';
import { TimetableGrid } from '@/components/TimetableGrid';
import { CourseExplorer } from '@/components/CourseExplorer';
import { ActiveCoursesList } from '@/components/ActiveCoursesList';
import { EnrolledCoursesTable } from '@/components/EnrolledCoursesTable';
import { UnselectedCoursesTable } from '@/components/UnselectedCoursesTable';
import { ConflictBanner } from '@/components/ConflictBanner';
import { CopySecModal } from '@/components/CopySecModal';
import { LoginModal } from '@/components/LoginModal';
import { RotatePromptOverlay } from '@/components/RotatePromptOverlay';
import { useUrsaAuth } from '@/hooks/useUrsaAuth';
import { useUrsaSections } from '@/hooks/useUrsaSections';
import { detectConflicts } from '@/utils/scheduleUtils';
import { LogIn } from 'lucide-react';
import { SortOption } from '@/components/FilterSortMenu';

const PLANNER_STORAGE_KEY = 'bu-planer:schedules:v2';

export type SeatFilterKey = 'available' | 'almost-full' | 'full';

export interface SeatFilterMap {
  available: boolean;
  'almost-full': boolean;
  full: boolean;
}

export const DEFAULT_SEAT_FILTERS: SeatFilterMap = {
  available: true,
  'almost-full': true,
  full: true,
};

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

  // 3. Plans State & LocalStorage Persistence (Starts 100% empty)
  const [plans, setPlans] = useState<Record<PlanId, PlanData>>({
    planA: { id: 'planA', name: 'Plan A', items: [] },
    planB: { id: 'planB', name: 'Plan B', items: [] },
    planC: { id: 'planC', name: 'Plan C', items: [] },
  });

  const [activePlan, setActivePlan] = useState<PlanId>('planA');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [seatFilters, setSeatFilters] = useState<SeatFilterMap>(DEFAULT_SEAT_FILTERS);
  const [selectedSecLetters, setSelectedSecLetters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('default');

  const timetableGridRef = useRef<HTMLDivElement>(null);

  // Load plans from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLANNER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          // If stored in numeric key format { '1': [...], '2': [...] } -> convert to PlanData
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
      // Keep default plans on storage read failure
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

  // Pending search parameters to resume automatically after successful login
  const pendingSearchRef = useRef<{ academicYear: string; semester: string; query: string } | null>(null);

  // When user successfully logs in, automatically execute the pending search
  useEffect(() => {
    if (connected && (studentId || studentName) && pendingSearchRef.current) {
      const pending = pendingSearchRef.current;
      pendingSearchRef.current = null;

      const tokens = pending.query
        .trim()
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean);

      if (tokens.length > 0) {
        searchSections({
          academicYear: pending.academicYear,
          semester: pending.semester,
          courseCodes: tokens,
          option1: '1',
        });
      }
    }
  }, [connected, studentId, studentName, searchSections]);

  // Execute search query
  const handleExecuteSearch = useCallback(
    async ({
      academicYear,
      semester,
      query,
    }: {
      academicYear: string;
      semester: string;
      query: string;
    }) => {
      // If not logged in -> save pending search parameters and automatically pop up login modal
      if (!connected || (!studentId && !studentName)) {
        pendingSearchRef.current = { academicYear, semester, query };
        setIsLoginModalOpen(true);
        return;
      }

      const tokens = query
        .trim()
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean);

      if (tokens.length === 0) return null;

      const results = await searchSections({
        academicYear,
        semester,
        courseCodes: tokens,
        option1: '1',
      });

      const foundCodes = results.map((c) => c.code.toUpperCase().replace(/\s+/g, ''));
      const missingCodes = tokens.filter((t) => {
        const cleaned = t.toUpperCase().replace(/\s+/g, '');
        return !foundCodes.some((fc) => fc.includes(cleaned) || cleaned.includes(fc));
      });

      return { count: results.length, missingCodes };
    },
    [connected, studentId, studentName, searchSections]
  );

  const currentPlan =
    plans[activePlan] ||
    plans[Object.keys(plans)[0]] || {
      id: 'planA',
      name: 'Plan A',
      items: [],
    };
  const currentItems = currentPlan ? currentPlan.items : [];
  const conflicts = detectConflicts(currentItems);

  // Compute matched courses (Live URSA courses only)
  const searchedCourses = useMemo(() => {
    if (liveUrsaCourses.length === 0) return [];
    if (!searchQuery.trim()) return liveUrsaCourses;

    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    if (tokens.length === 0) return liveUrsaCourses;

    return liveUrsaCourses.filter((c) => {
      const code = c.code.toLowerCase();
      const nameTh = c.nameTh.toLowerCase();
      const nameEn = c.nameEn.toLowerCase();
      return tokens.some((t) => code.includes(t) || nameTh.includes(t) || nameEn.includes(t));
    });
  }, [searchQuery, liveUrsaCourses]);

  // Dynamically extract all section letters present in loaded courses
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    searchedCourses.forEach((c) => {
      c.sections.forEach((s) => {
        const match = s.sectionNo.trim().toUpperCase().match(/[A-Z]+$/);
        if (match) letters.add(match[0]);
      });
    });
    return Array.from(letters).sort();
  }, [searchedCourses]);

  // Toggle hiding sections from timetable
  const handleToggleHideSections = useCallback((keys: string[], hide?: boolean) => {
    setHiddenSections((prev) => {
      const next = { ...prev };
      const shouldHide = hide !== undefined ? hide : !keys.every((k) => prev[k]);
      keys.forEach((k) => {
        if (shouldHide) {
          next[k] = true;
        } else {
          delete next[k];
        }
      });
      return next;
    });
  }, []);

  const handleToggleSeatFilter = useCallback((key: 'all' | SeatFilterKey) => {
    setSeatFilters((prev) => {
      if (key === 'all') {
        const allSelected = prev.available && prev['almost-full'] && prev.full;
        if (allSelected) {
          return prev;
        }
        return { available: true, 'almost-full': true, full: true };
      }
      const next = { ...prev, [key]: !prev[key] };
      const hasAny = next.available || next['almost-full'] || next.full;
      if (!hasAny) {
        return { available: true, 'almost-full': true, full: true };
      }
      return next;
    });
  }, []);

  const handleToggleLetter = useCallback((letter: string) => {
    setSelectedSecLetters((prev) => {
      if (prev.includes(letter)) {
        return prev.filter((l) => l !== letter);
      }
      return [...prev, letter];
    });
  }, []);

  const handleSelectAllLetters = useCallback((all: string[]) => {
    setSelectedSecLetters(all);
  }, []);

  const handleClearLetters = useCallback(() => {
    setSelectedSecLetters([]);
  }, []);

  const handleResetAllFilters = useCallback(() => {
    setSeatFilters(DEFAULT_SEAT_FILTERS);
    setSelectedSecLetters([]);
    setSortOption('default');
  }, []);

  // Compute all matching preview sections (filtering by multi-select seatFilters and SEC letters)
  const previewSections = useMemo(() => {
    const previews: { course: Course; section: Section }[] = [];
    searchedCourses.forEach((course) => {
      course.sections.forEach((sec) => {
        const key = `${course.id}_${sec.sectionNo}`;
        if (hiddenSections[key]) return;

        const isFull = sec.availableSeats === 0 || sec.status === 'Freeze' || sec.status === 'Closed';
        const isAlmostFull = !isFull && sec.availableSeats > 0 && sec.availableSeats <= 5;
        const isAvailable = !isFull && sec.availableSeats > 5;

        if (isAvailable && !seatFilters.available) return;
        if (isAlmostFull && !seatFilters['almost-full']) return;
        if (isFull && !seatFilters.full) return;

        // Section Letter filter (e.g. A, B, C, D, E, F, G, H)
        if (selectedSecLetters.length > 0) {
          const match = sec.sectionNo.trim().toUpperCase().match(/[A-Z]+$/);
          const letter = match ? match[0] : '';
          if (!selectedSecLetters.includes(letter)) return;
        }

        previews.push({ course, section: sec });
      });
    });
    return previews;
  }, [searchedCourses, hiddenSections, seatFilters, selectedSecLetters]);

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

  const handleReorderPlans = (orderedIds: PlanId[]) => {
    const newPlans: Record<PlanId, PlanData> = {};
    orderedIds.forEach((id) => {
      if (plans[id]) {
        newPlans[id] = plans[id];
      }
    });
    Object.keys(plans).forEach((id) => {
      if (!newPlans[id]) {
        newPlans[id] = plans[id];
      }
    });
    setPlans(newPlans);
    savePlansToStorage(newPlans);
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

  const isFullyLoggedIn = Boolean(connected && (studentId || (studentName && studentName !== 'นักศึกษา')));

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F] flex flex-col font-sans selection:bg-[#0071E3] selection:text-white w-full">
      {/* Top Utility Ribbon (Sticky only when NOT logged in, normal scroll when connected) */}
      <div
        className={`${
          isFullyLoggedIn ? 'relative' : 'sticky top-0 z-50'
        } w-full bg-[#EBEBEC]/90 backdrop-blur-md border-b border-black/[0.08] py-2 px-3 sm:px-6 lg:px-8 xl:px-10 text-[11.5px] sm:text-[12px] text-[#6E6E73] select-none transition-all duration-200`}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-center gap-2 text-center">
          {isFullyLoggedIn ? (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <span>คุณกำลังเข้าใช้งานในฐานะ</span>
              <span className="font-semibold text-[#1D1D1F]">{studentName}</span>
              {studentId && (
                <>
                  <span className="ml-1 hidden xs:inline">รหัสนักศึกษา</span>
                  <span className="font-semibold text-[#1D1D1F]">{studentId}</span>
                </>
              )}
              <span className="text-[#C7C7CC] mx-1">|</span>
              <button
                type="button"
                onClick={logout}
                className="underline text-[#0066CC] hover:text-[#0071E3] transition-colors cursor-pointer active:opacity-70"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 justify-center flex-wrap">
              <span>ยังไม่ได้เข้าสู่ระบบ กรุณา</span>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="underline text-[#0066CC] hover:text-[#0071E3] transition-colors cursor-pointer font-medium active:opacity-70"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-width Red Conflict Banner directly attached under the top ribbon */}
      <ConflictBanner conflicts={conflicts} />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden px-2.5 sm:px-5 lg:px-8 xl:px-10 py-3 sm:py-5 space-y-4">
        {/* Main Section: Search at Top (<1280px), 2-Column Side-by-Side (xl+) */}
        <div className="flex flex-col xl:flex-row gap-4 sm:gap-5 items-start w-full max-w-full min-w-0">
          
          {/* Main Left / Timetable Column (order-2 on mobile/tablet, order-1 on xl+) */}
          <div
            className={`order-2 xl:order-1 space-y-4 w-full max-w-full min-w-0 transition-[width,max-width,flex] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              isExpanded
                ? 'xl:w-full xl:max-w-full flex-1'
                : 'xl:w-[72%] 2xl:w-[75%] xl:flex-1'
            }`}
          >
            {/* 1. Timetable Grid */}
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
              onReorderPlans={handleReorderPlans}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              seatFilters={seatFilters}
              onToggleSeatFilter={handleToggleSeatFilter}
              selectedLetters={selectedSecLetters}
              onToggleLetter={handleToggleLetter}
              onSelectAllLetters={handleSelectAllLetters}
              onClearLetters={handleClearLetters}
              availableLetters={availableLetters}
              sortOption={sortOption}
              onSortChange={setSortOption}
              onResetAllFilters={handleResetAllFilters}
            />

            {/* When Expanded: Show the 2 Components smoothly animated directly under Timetable */}
            {isExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-start pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <CourseExplorer
                  activePlan={activePlan}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onExecuteSearch={handleExecuteSearch}
                  isLoading={isSectionsLoading}
                  formControls={form?.controls || []}
                />
                <ActiveCoursesList
                  searchedCourses={searchedCourses}
                  selectedItems={currentItems}
                  hoveredCourseId={hoveredCourseId}
                  onHoverCourse={setHoveredCourseId}
                  onOpenCopyModal={() => setIsCopyModalOpen(true)}
                  onResetPlan={handleResetPlan}
                  hiddenSections={hiddenSections}
                  onToggleHideSections={handleToggleHideSections}
                />
              </div>
            )}

            {/* Enrolled Courses Table */}
            <EnrolledCoursesTable
              searchedCourses={searchedCourses}
              selectedItems={currentItems}
              onOpenCopyModal={() => setIsCopyModalOpen(true)}
            />

            {/* Unselected Courses Table */}
            <UnselectedCoursesTable
              searchedCourses={searchedCourses}
              selectedItems={currentItems}
              hiddenSections={hiddenSections}
              onToggleHideSections={handleToggleHideSections}
              onAddCourse={handleAddCourse}
              seatFilters={seatFilters}
              onToggleSeatFilter={handleToggleSeatFilter}
              selectedLetters={selectedSecLetters}
              onToggleLetter={handleToggleLetter}
              onSelectAllLetters={handleSelectAllLetters}
              onClearLetters={handleClearLetters}
              availableLetters={availableLetters}
              sortOption={sortOption}
              onSortChange={setSortOption}
              onResetAllFilters={handleResetAllFilters}
            />
          </div>

          {/* Right / Search Column (order-1 at TOP on mobile/tablet, order-2 on right on xl+) */}
          <div
            className={`order-1 xl:order-2 space-y-4 w-full max-w-full min-w-0 shrink-0 transition-[width,max-width,opacity,margin] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              isFullyLoggedIn ? 'top-6' : 'top-14'
            } ${
              isExpanded
                ? 'w-0 max-w-0 opacity-0 xl:w-0 xl:max-w-0 -ml-5 pointer-events-none'
                : 'w-full xl:w-[28%] 2xl:w-[25%] opacity-100 xl:pt-[44px] xl:sticky'
            }`}
          >
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
              hiddenSections={hiddenSections}
              onToggleHideSections={handleToggleHideSections}
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

      {/* Mobile Portrait Rotation Prompt (Soft Frosted Grey Overlay) */}
      <RotatePromptOverlay />
    </div>
  );
}
