import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Course, Section, SelectedCourseItem } from '@/types/schedule';
import { EyeOff, Eye, X, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { FilterSortMenu, SortOption } from './FilterSortMenu';

type SortKey =
  | 'section'
  | 'seat'
  | 'status'
  | 'type'
  | 'day'
  | 'time'
  | 'room'
  | 'remark2'
  | 'remark1'
  | 'examination'
  | 'restriction';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

const DAY_WEIGHTS: Record<string, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

const sortSections = (sections: Section[], sortState: SortState): Section[] => {
  if (!sortState.key) return sections;

  return [...sections].sort((a, b) => {
    switch (sortState.key) {
      case 'section': {
        const secA = a.sectionNo || '';
        const secB = b.sectionNo || '';
        const comp = secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'seat': {
        const availA = a.availableSeats ?? 0;
        const availB = b.availableSeats ?? 0;
        const totalA = a.totalSeats ?? 0;
        const totalB = b.totalSeats ?? 0;

        if (availA !== availB) {
          return sortState.direction === 'asc' ? availA - availB : availB - availA;
        }
        // เมื่อที่นั่งเหลือเท่ากัน (เช่น เต็ม 0 ที่นั่งทั้งคู่): เรียงตามความจุจากน้อยไปมากเสมอ (เอาเต็มน้อยสุดขึ้นก่อน เช่น 37, 38, 39, 40, 41)
        if (totalA !== totalB) {
          return totalA - totalB;
        }
        return (a.sectionNo || '').localeCompare(b.sectionNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      case 'status': {
        const comp = (a.status || '').localeCompare(b.status || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'type': {
        const typeA = a.room.toLowerCase().includes('lab') ? 'LAB' : 'LECT';
        const typeB = b.room.toLowerCase().includes('lab') ? 'LAB' : 'LECT';
        const comp = typeA.localeCompare(typeB);
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'day': {
        const dayA = DAY_WEIGHTS[a.day] || 99;
        const dayB = DAY_WEIGHTS[b.day] || 99;
        const comp = dayA - dayB;
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'time': {
        const comp = (a.startTime || '').localeCompare(b.startTime || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'room': {
        const comp = (a.room || '').localeCompare(b.room || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'remark2': {
        const comp = (a.remark2 || '').localeCompare(b.remark2 || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'remark1': {
        const comp = (a.remark1 || '').localeCompare(b.remark1 || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'examination': {
        const comp = (a.examination || '').localeCompare(b.examination || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      case 'restriction': {
        const comp = (a.restriction || '').localeCompare(b.restriction || '');
        return sortState.direction === 'asc' ? comp : -comp;
      }
      default:
        return 0;
    }
  });
};

interface UnselectedCoursesTableProps {
  searchedCourses: Course[];
  selectedItems: SelectedCourseItem[];
  hiddenSections?: Record<string, boolean>;
  onToggleHideSections?: (keys: string[], hide?: boolean) => void;
  onAddCourse?: (course: Course, section: Section) => void;
  seatFilters?: {
    'not-full': boolean;
    full: boolean;
  };
  onToggleSeatFilter?: (key: 'all' | 'not-full' | 'full') => void;
  selectedLetters?: string[];
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: (letters: string[]) => void;
  onClearLetters?: () => void;
  availableLetters?: string[];
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  onResetAllFilters?: () => void;
}

export const UnselectedCoursesTable: React.FC<UnselectedCoursesTableProps> = ({
  searchedCourses,
  selectedItems,
  hiddenSections = {},
  onToggleHideSections,
  onAddCourse,
  seatFilters = { 'not-full': true, full: true },
  onToggleSeatFilter,
  selectedLetters = [],
  onToggleLetter,
  onSelectAllLetters,
  onClearLetters,
  availableLetters,
  sortOption = 'default',
  onSortChange,
  onResetAllFilters,
}) => {
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: 'asc' });
  // Courses matching search query that have NOT yet been selected in the active plan (deduplicated by course ID)
  const unselectedCourses = useMemo(() => {
    const map = new Map<string, Course>();
    (searchedCourses || []).forEach((c) => {
      if (c?.id && !map.has(c.id) && !selectedItems.some((it) => it.course.id === c.id)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  }, [searchedCourses, selectedItems]);

  // Main table drag to select state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    courseId: string;
    index: number;
    secKey: string;
    dragMode: 'select' | 'deselect';
    sections: Section[];
  } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<{ courseId: string; index: number; secKey: string } | null>(null);
  const initialKeysRef = useRef<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Modal details state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [modalSelectedKeys, setModalSelectedKeys] = useState<Set<string>>(new Set());
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [modalDragStart, setModalDragStart] = useState<{
    courseId: string;
    index: number;
    secKey: string;
    dragMode: 'select' | 'deselect';
  } | null>(null);
  const [modalLastSelectedKey, setModalLastSelectedKey] = useState<{ courseId: string; index: number; secKey: string } | null>(null);
  const modalInitialKeysRef = useRef<Set<string>>(new Set());

  // Right-Click Context Menu State
  interface ContextMenuState {
    isOpen: boolean;
    x: number;
    y: number;
    course: Course;
    section: Section;
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Close context menu on click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleRowContextMenu = (course: Course, section: Section, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      course,
      section,
    });
  };

  const handleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else {
          return { key: null, direction: 'asc' };
        }
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortHeader = (title: string, key: SortKey, align: 'left' | 'center' = 'left', px = 'px-3') => {
    const isCurrent = sortState.key === key;
    return (
      <th
        onClick={() => handleSort(key)}
        className={`py-2.5 ${px} ${align === 'center' ? 'text-center' : 'text-left'} cursor-pointer hover:bg-black/[0.04] hover:text-[#1D1D1F] transition-colors select-none group`}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{title}</span>
          <span className="text-[10px] transition-colors">
            {isCurrent ? (
              sortState.direction === 'asc' ? (
                <ChevronUp className="w-3 h-3 text-[#0071E3]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[#0071E3]" />
              )
            ) : (
              <ChevronsUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 text-[#86868B]" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Get total hidden sections count
  const hiddenCount = Object.values(hiddenSections).filter(Boolean).length;

  // Flatten hidden sections with course info for the details modal
  const hiddenSectionsList = useMemo(() => {
    const list: { course: Course; section: Section }[] = [];
    searchedCourses.forEach((course) => {
      course.sections.forEach((sec) => {
        const key = `${course.id}_${sec.sectionNo}`;
        if (hiddenSections[key]) {
          list.push({ course, section: sec });
        }
      });
    });
    return list;
  }, [searchedCourses, hiddenSections]);

  // Group hidden sections by course for full table rendering inside modal
  const hiddenCoursesGrouped = useMemo(() => {
    const map = new Map<string, { course: Course; sections: Section[] }>();
    searchedCourses.forEach((course) => {
      const hiddenSecs = course.sections.filter((s) => hiddenSections[`${course.id}_${s.sectionNo}`]);
      if (hiddenSecs.length > 0) {
        map.set(course.id, { course, sections: hiddenSecs });
      }
    });
    return Array.from(map.values());
  }, [searchedCourses, hiddenSections]);

  // Global mouse up listener for both main table and modal drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStart(null);
      }
      if (isModalDragging) {
        setIsModalDragging(false);
        setModalDragStart(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isModalDragging]);

  // --- Main Table Drag Selection Handlers ---
  const handleRowMouseDown = (
    courseId: string,
    index: number,
    secKey: string,
    e: React.MouseEvent,
    displayedSections: Section[]
  ) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    if (e.shiftKey && lastSelectedKey && lastSelectedKey.courseId === courseId) {
      const minIdx = Math.min(lastSelectedKey.index, index);
      const maxIdx = Math.max(lastSelectedKey.index, index);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (let i = minIdx; i <= maxIdx; i++) {
          if (displayedSections[i]) {
            next.add(`${courseId}_${displayedSections[i].sectionNo}`);
          }
        }
        return next;
      });
      return;
    }

    const isAlreadySelected = selectedKeys.has(secKey);
    const mode: 'select' | 'deselect' = isAlreadySelected ? 'deselect' : 'select';

    setIsDragging(true);
    setDragStart({ courseId, index, secKey, dragMode: mode, sections: displayedSections });
    initialKeysRef.current = new Set(selectedKeys);
    setLastSelectedKey({ courseId, index, secKey });

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (mode === 'select') {
        next.add(secKey);
      } else {
        next.delete(secKey);
      }
      return next;
    });
  };

  const handleRowMouseEnter = (courseId: string, index: number) => {
    if (!isDragging || !dragStart) return;
    // Strictly forbid drag selection from crossing over to other courses
    if (dragStart.courseId !== courseId) return;

    const minIdx = Math.min(dragStart.index, index);
    const maxIdx = Math.max(dragStart.index, index);
    const mode = dragStart.dragMode;
    const sections = dragStart.sections;

    const next = new Set(initialKeysRef.current);
    for (let i = minIdx; i <= maxIdx; i++) {
      if (sections && sections[i]) {
        const k = `${courseId}_${sections[i].sectionNo}`;
        if (mode === 'select') {
          next.add(k);
        } else {
          next.delete(k);
        }
      }
    }
    setSelectedKeys(next);
  };

  // --- Modal Table Drag Selection Handlers ---
  const handleModalRowMouseDown = (courseId: string, index: number, secKey: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    if (e.shiftKey && modalLastSelectedKey && modalLastSelectedKey.courseId === courseId) {
      const group = hiddenCoursesGrouped.find((g) => g.course.id === courseId);
      if (group) {
        const minIdx = Math.min(modalLastSelectedKey.index, index);
        const maxIdx = Math.max(modalLastSelectedKey.index, index);
        setModalSelectedKeys((prev) => {
          const next = new Set(prev);
          for (let i = minIdx; i <= maxIdx; i++) {
            if (group.sections[i]) {
              next.add(`${courseId}_${group.sections[i].sectionNo}`);
            }
          }
          return next;
        });
      }
      return;
    }

    const isAlreadySelected = modalSelectedKeys.has(secKey);
    const mode: 'select' | 'deselect' = isAlreadySelected ? 'deselect' : 'select';

    setIsModalDragging(true);
    setModalDragStart({ courseId, index, secKey, dragMode: mode });
    modalInitialKeysRef.current = new Set(modalSelectedKeys);
    setModalLastSelectedKey({ courseId, index, secKey });

    setModalSelectedKeys((prev) => {
      const next = new Set(prev);
      if (mode === 'select') {
        next.add(secKey);
      } else {
        next.delete(secKey);
      }
      return next;
    });
  };

  const handleModalRowMouseEnter = (courseId: string, index: number) => {
    if (!isModalDragging || !modalDragStart || modalDragStart.courseId !== courseId) return;

    const group = hiddenCoursesGrouped.find((g) => g.course.id === courseId);
    if (!group) return;

    const minIdx = Math.min(modalDragStart.index, index);
    const maxIdx = Math.max(modalDragStart.index, index);
    const mode = modalDragStart.dragMode;

    const next = new Set(modalInitialKeysRef.current);
    for (let i = minIdx; i <= maxIdx; i++) {
      if (group.sections[i]) {
        const k = `${courseId}_${group.sections[i].sectionNo}`;
        if (mode === 'select') {
          next.add(k);
        } else {
          next.delete(k);
        }
      }
    }
    setModalSelectedKeys(next);
  };

  const handleModalUnhideSelected = () => {
    if (onToggleHideSections && modalSelectedKeys.size > 0) {
      onToggleHideSections(Array.from(modalSelectedKeys), false);
      setModalSelectedKeys(new Set());
    }
  };

  const handleHideSelected = (hide: boolean) => {
    if (onToggleHideSections && selectedKeys.size > 0) {
      onToggleHideSections(Array.from(selectedKeys), hide);
      setSelectedKeys(new Set());
    }
  };

  const handleUnhideAll = () => {
    if (onToggleHideSections && hiddenSectionsList.length > 0) {
      const allHiddenKeys = hiddenSectionsList.map(
        (item) => `${item.course.id}_${item.section.sectionNo}`
      );
      onToggleHideSections(allHiddenKeys, false);
      setIsDetailsModalOpen(false);
      setModalSelectedKeys(new Set());
    }
  };

  const selectedKeysArray = Array.from(selectedKeys);
  const hiddenSelectedCount = selectedKeysArray.filter((k) => hiddenSections[k]).length;
  const allSelectedAreHidden = selectedKeys.size > 0 && hiddenSelectedCount === selectedKeys.size;

  return (
    <div
      ref={tableContainerRef}
      className="apple-card-light p-3.5 sm:p-5 space-y-4 sm:space-y-5 relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] flex-wrap gap-2 relative z-20">
        <h3 className="apple-headline text-[15px] text-[#86868B] flex items-center gap-2">
          <span>วิชาที่ยังไม่ได้เลือก</span>
          <span className="text-xs font-normal text-[#86868B]">
            {unselectedCourses.length} วิชา
          </span>
        </h3>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[11px] text-[#86868B] font-medium hidden sm:flex items-center gap-1.5 select-none">
            <Eye className="w-3.5 h-3.5 text-[#86868B]" />
            <span>คลิกหรือลากเมาส์เพื่อซ่อน/แสดง Section</span>
          </div>
        </div>
      </div>

      {/* Main Unselected Courses Table */}
      {unselectedCourses.length > 0 ? (
        <div className="space-y-5">
          {unselectedCourses.map((course, index) => {
            const courseHiddenCount = course.sections.filter(
              (s) => hiddenSections[`${course.id}_${s.sectionNo}`]
            ).length;

            return (
              <div key={`${course.id}-${index}`} className="space-y-2">
                {/* Course Header */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#86868B] apple-subheadline">
                      {course.code}
                    </span>
                    {course.nameEn && course.nameEn !== course.code && (
                      <span className="apple-subheadline font-medium text-sm text-[#86868B]">
                        {course.nameEn}
                      </span>
                    )}
                  </div>

                  {courseHiddenCount > 0 && onToggleHideSections && (
                    <button
                      type="button"
                      onClick={() => {
                        const allCourseKeys = course.sections.map(
                          (s) => `${course.id}_${s.sectionNo}`
                        );
                        onToggleHideSections(allCourseKeys, false);
                      }}
                      className="text-[11px] text-[#0071E3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>แสดงทั้งหมด ({courseHiddenCount} Section ที่ซ่อนอยู่)</span>
                    </button>
                  )}
                </div>

                {/* Table with Equal Column Alignment & Drag Selection */}
                <div className="overflow-x-auto no-scrollbar touch-pan-x rounded-[14px] border border-black/[0.08] bg-white select-none">
                  <table className="w-full text-left text-xs whitespace-nowrap table-fixed min-w-[1405px]">
                    <colgroup>
                      <col className="w-[90px]" />
                      <col className="w-[90px]" />
                      <col className="w-[65px]" />
                      <col className="w-[65px]" />
                      <col className="w-[65px]" />
                      <col className="w-[110px]" />
                      <col className="w-[100px]" />
                      <col className="w-[200px]" />
                      <col className="w-[200px]" />
                      <col className="w-[180px]" />
                      <col className="w-[240px]" />
                    </colgroup>
                    <thead className="bg-[#F5F5F7] text-[#86868B] font-medium border-b border-black/[0.06] text-[11px]">
                      <tr>
                        {renderSortHeader('Section', 'section')}
                        {renderSortHeader('Seat(s)', 'seat', 'center')}
                        {renderSortHeader('Status', 'status', 'center')}
                        {renderSortHeader('Type', 'type', 'center')}
                        {renderSortHeader('Day', 'day', 'center')}
                        {renderSortHeader('Time', 'time', 'center')}
                        {renderSortHeader('Room', 'room')}
                        {renderSortHeader('Remark2', 'remark2', 'left', 'px-4')}
                        {renderSortHeader('Remark1', 'remark1', 'left', 'px-4')}
                        {renderSortHeader('Examination', 'examination', 'left', 'px-4')}
                        {renderSortHeader('Restriction', 'restriction', 'left', 'px-4')}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] text-[11px] text-[#86868B]">
                      {(() => {
                        const filtered = course.sections.filter((s) => {
                          const isFull = s.availableSeats === 0 || s.status === 'Freeze' || s.status === 'Closed';
                          const isNotFull = !isFull;

                          if (isNotFull && !seatFilters['not-full']) return false;
                          if (isFull && !seatFilters.full) return false;

                          if (selectedLetters.length > 0) {
                            const match = s.sectionNo.trim().toUpperCase().match(/[A-Z]+$/);
                            const letter = match ? match[0] : '';
                            if (!selectedLetters.includes(letter)) return false;
                          }

                          return true;
                        });
                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={11} className="py-4 px-3 text-center text-[#86868B]">
                                ไม่มี Section ที่ตรงกับตัวกรองที่เลือก
                              </td>
                            </tr>
                          );
                        }
                        let displayedSections = sortSections(filtered, sortState);
                        if (sortOption === 'section-asc') {
                          displayedSections = [...displayedSections].sort((a, b) =>
                            (a.sectionNo || '').localeCompare(b.sectionNo || '', undefined, { numeric: true })
                          );
                        } else if (sortOption === 'section-desc') {
                          displayedSections = [...displayedSections].sort((a, b) =>
                            (b.sectionNo || '').localeCompare(a.sectionNo || '', undefined, { numeric: true })
                          );
                        } else if (sortOption === 'seats-desc') {
                          displayedSections = [...displayedSections].sort((a, b) => {
                            const diff = (b.availableSeats ?? 0) - (a.availableSeats ?? 0);
                            if (diff !== 0) return diff;
                            const totalDiff = (a.totalSeats ?? 0) - (b.totalSeats ?? 0);
                            if (totalDiff !== 0) return totalDiff;
                            return (a.sectionNo || '').localeCompare(b.sectionNo || '', undefined, { numeric: true });
                          });
                        } else if (sortOption === 'seats-asc') {
                          displayedSections = [...displayedSections].sort((a, b) => {
                            const diff = (a.availableSeats ?? 0) - (b.availableSeats ?? 0);
                            if (diff !== 0) return diff;
                            const totalDiff = (a.totalSeats ?? 0) - (b.totalSeats ?? 0);
                            if (totalDiff !== 0) return totalDiff;
                            return (a.sectionNo || '').localeCompare(b.sectionNo || '', undefined, { numeric: true });
                          });
                        } else if (sortOption === 'day-time') {
                          displayedSections = [...displayedSections].sort((a, b) => {
                            const dDiff = (DAY_WEIGHTS[a.day] || 99) - (DAY_WEIGHTS[b.day] || 99);
                            if (dDiff !== 0) return dDiff;
                            return (a.startTime || '').localeCompare(b.startTime || '');
                          });
                        }
                        return displayedSections.map((sec, idx) => {
                          const secKey = `${course.id}_${sec.sectionNo}`;
                          const isSelected = selectedKeys.has(secKey);
                          const isHidden = !!hiddenSections[secKey];
                          const type = sec.room.toLowerCase().includes('lab') ? 'LAB' : 'LECT';

                          const dayFormatted =
                            sec.day === 'MON'
                              ? 'Mon'
                              : sec.day === 'TUE'
                              ? 'Tue'
                              : sec.day === 'WED'
                              ? 'Wed'
                              : sec.day === 'THU'
                              ? 'Thu'
                              : sec.day === 'FRI'
                              ? 'Fri'
                              : 'Sat';

                          return (
                            <tr
                              key={sec.sectionNo}
                              onMouseDown={(e) => handleRowMouseDown(course.id, idx, secKey, e, displayedSections)}
                              onMouseEnter={() => handleRowMouseEnter(course.id, idx)}
                              onContextMenu={(e) => handleRowContextMenu(course, sec, e)}
                            className={`transition-colors cursor-pointer select-none ${
                              isSelected
                                ? 'bg-[#0071E3]/10 text-[#1D1D1F]'
                                : isHidden
                                ? 'opacity-40 bg-black/[0.02] hover:bg-black/[0.04]'
                                : 'hover:bg-[#F5F5F7]'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleHideSections) {
                                      onToggleHideSections([secKey], !isHidden);
                                    }
                                  }}
                                  title={isHidden ? 'คลิกเพื่อแสดงในปฏิทิน' : 'คลิกเพื่อซ่อนจากปฏิทิน'}
                                  className="p-1 rounded hover:bg-black/10 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                                >
                                  {isHidden ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                                  )}
                                </button>

                                <span className={isHidden ? 'line-through text-[#86868B]' : 'text-[#1D1D1F]'}>
                                  {sec.sectionNo}
                                </span>

                                {isHidden && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/[0.06] text-[#86868B] font-normal">
                                    ซ่อน
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                              {sec.availableSeats === 0 ? (
                                <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-[#86868B] border border-black/10 text-[10px]">
                                  เต็ม (0/{sec.totalSeats})
                                </span>
                              ) : (
                                <span>
                                  {sec.availableSeats} / {sec.totalSeats}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#86868B]">
                              {sec.status || 'On'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                              {sec.type || type}
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                              {dayFormatted}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#86868B]">
                              {sec.startTime}-{sec.endTime}
                            </td>
                            <td className="py-2.5 px-3 text-[#86868B]">{sec.room}</td>
                            <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark2 || '-'}>{sec.remark2 || '-'}</td>
                            <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark1 || '-'}>{sec.remark1 || '-'}</td>
                            <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.examination || sec.midtermDate || '-'}>{sec.examination || sec.midtermDate || '-'}</td>
                            <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.restriction || '-'}>{sec.restriction || '-'}</td>
                          </tr>
                        );
                      });
                    })()}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 px-4 text-xs text-[#86868B] text-center apple-subheadline">
          ✓ คุณเลือกครบทุกวิชาในรายการค้นหาแล้ว
        </div>
      )}

      {/* Floating Action Pill Bar: Active Selection Mode (Fixed on viewport) */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 select-none pointer-events-none">
          <div className="pointer-events-auto bg-[#EBEBEC]/95 backdrop-blur-md text-[#1D1D1F] px-5 py-2.5 rounded-full border border-black/[0.1] flex items-center justify-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
            <span className="font-normal text-[#1D1D1F]">
              คุณกำลังเลือก <strong className="font-semibold">{selectedKeys.size}</strong> วิชา
            </span>

            <span className="text-[#C7C7CC] mx-0.5">|</span>

            {!allSelectedAreHidden && (
              <button
                type="button"
                onClick={() => handleHideSelected(true)}
                className="underline text-[#0066CC] hover:text-[#0071E3] font-medium transition-colors cursor-pointer active:opacity-70"
              >
                ซ่อนวิชา
              </button>
            )}

            {hiddenSelectedCount > 0 && (
              <>
                {!allSelectedAreHidden && <span className="text-[#C7C7CC] mx-0.5">|</span>}
                <button
                  type="button"
                  onClick={() => handleHideSelected(false)}
                  className="underline text-[#0066CC] hover:text-[#0071E3] font-medium transition-colors cursor-pointer active:opacity-70"
                >
                  ยกเลิกการซ่อน
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedKeys(new Set())}
              className="ml-1 p-1 rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              title="ยกเลิกการเลือก"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Pill Bar: Persistent Hidden Courses Notification (Fixed on viewport always visible) */}
      {selectedKeys.size === 0 && hiddenSectionsList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 select-none pointer-events-none">
          <div className="pointer-events-auto bg-[#EBEBEC]/95 backdrop-blur-md text-[#1D1D1F] px-5 py-2.5 rounded-full border border-black/[0.1] flex items-center justify-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
            <span className="font-normal text-[#1D1D1F]">
              คุณกำลังซ่อน <strong className="font-semibold">{hiddenSectionsList.length}</strong> วิชา
            </span>

            <span className="text-[#C7C7CC] mx-0.5">|</span>

            <button
              type="button"
              onClick={handleUnhideAll}
              className="underline text-[#0066CC] hover:text-[#0071E3] font-medium transition-colors cursor-pointer active:opacity-70"
            >
              ยกเลิกการซ่อน
            </button>

            <span className="text-[#C7C7CC] mx-0.5">|</span>

            <button
              type="button"
              onClick={() => {
                setIsDetailsModalOpen(true);
                setModalSelectedKeys(new Set());
              }}
              className="underline text-[#0066CC] hover:text-[#0071E3] font-medium transition-colors cursor-pointer active:opacity-70"
            >
              แสดงรายละเอียดวิชาที่ซ่อน
            </button>
          </div>
        </div>
      )}

      {/* Hidden Courses Details Modal (Frosted Blur Backdrop with Full Section Tables & Drag-to-Select) */}
      {isDetailsModalOpen && (
        <div
          onClick={() => setIsDetailsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer select-none"
        >
          <div className="relative max-w-[95vw] xl:max-w-[1520px] w-full cursor-default">
            {/* Top Floating Close Button */}
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute -top-7 right-2 sm:right-3 z-10 p-1 text-white/60 hover:text-white transition-all cursor-pointer active:scale-90"
              title="ปิด"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>

            {/* Modal Card Content */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white text-[#1D1D1F] rounded-[28px] w-full p-6 sm:p-8 transform animate-in zoom-in-95 duration-200 border border-black/[0.12] space-y-5 max-h-[90vh] flex flex-col relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] flex-wrap gap-2 shrink-0">
                <div>
                  <h3 className="apple-headline text-xl text-[#1D1D1F] font-bold">
                    รายละเอียดวิชาที่ซ่อนอยู่
                  </h3>
                  <p className="text-xs text-[#86868B] font-normal">
                    ซ่อนอยู่ทั้งหมด {hiddenSectionsList.length} Section (ไม่แสดงในตารางเรียนปฏิทิน)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-[#86868B] font-medium hidden sm:flex items-center gap-1.5 select-none">
                    <Eye className="w-3.5 h-3.5 text-[#86868B]" />
                    <span>คลิกหรือลากเมาส์เพื่อเลือกและยกเลิกการซ่อน</span>
                  </div>

                  {onToggleHideSections && hiddenSectionsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUnhideAll}
                      className="apple-blue-btn px-4 py-2 text-xs font-semibold active:scale-95 cursor-pointer"
                    >
                      ยกเลิกการซ่อนทั้งหมด
                    </button>
                  )}
                </div>
              </div>

              {/* Grouped Hidden Section Tables (with full columns and drag-to-select support) */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {hiddenCoursesGrouped.length > 0 ? (
                  hiddenCoursesGrouped.map(({ course, sections }) => (
                    <div key={course.id} className="space-y-2">
                      {/* Course Header */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#0071E3] apple-subheadline">
                            {course.code}
                          </span>
                          <span className="apple-subheadline font-semibold text-sm text-[#1D1D1F]">
                            {course.nameEn || course.nameTh}
                          </span>
                        </div>

                        {onToggleHideSections && (
                          <button
                            type="button"
                            onClick={() => {
                              const allCourseHiddenKeys = sections.map((s) => `${course.id}_${s.sectionNo}`);
                              onToggleHideSections(allCourseHiddenKeys, false);
                            }}
                            className="text-[11px] text-[#0066CC] hover:underline font-medium cursor-pointer"
                          >
                            ยกเลิกการซ่อนวิชานี้ทั้งหมด ({sections.length} Section)
                          </button>
                        )}
                      </div>

                      {/* Full Section Table inside Modal with Pixel-Perfect Matching Alignment */}
                      <div className="overflow-x-auto no-scrollbar touch-pan-x rounded-[14px] border border-black/[0.08] bg-white select-none">
                        <table className="w-full text-left text-xs whitespace-nowrap table-fixed min-w-[1405px]">
                          <colgroup>
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[65px]" />
                            <col className="w-[65px]" />
                            <col className="w-[65px]" />
                            <col className="w-[110px]" />
                            <col className="w-[100px]" />
                            <col className="w-[200px]" />
                            <col className="w-[200px]" />
                            <col className="w-[180px]" />
                            <col className="w-[240px]" />
                          </colgroup>
                          <thead className="bg-[#F5F5F7] text-[#86868B] font-medium border-b border-black/[0.06] text-[11px]">
                            <tr>
                              {renderSortHeader('Section', 'section')}
                              {renderSortHeader('Seat(s)', 'seat', 'center')}
                              {renderSortHeader('Status', 'status', 'center')}
                              {renderSortHeader('Type', 'type', 'center')}
                              {renderSortHeader('Day', 'day', 'center')}
                              {renderSortHeader('Time', 'time', 'center')}
                              {renderSortHeader('Room', 'room')}
                              {renderSortHeader('Remark2', 'remark2', 'left', 'px-4')}
                              {renderSortHeader('Remark1', 'remark1', 'left', 'px-4')}
                              {renderSortHeader('Examination', 'examination', 'left', 'px-4')}
                              {renderSortHeader('Restriction', 'restriction', 'left', 'px-4')}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.04] text-[11px] text-[#86868B]">
                            {sortSections(sections, sortState).map((sec, idx) => {
                              const secKey = `${course.id}_${sec.sectionNo}`;
                              const isSelected = modalSelectedKeys.has(secKey);
                              const type = sec.room.toLowerCase().includes('lab') ? 'LAB' : 'LECT';

                              const dayFormatted =
                                sec.day === 'MON'
                                  ? 'Mon'
                                  : sec.day === 'TUE'
                                  ? 'Tue'
                                  : sec.day === 'WED'
                                  ? 'Wed'
                                  : sec.day === 'THU'
                                  ? 'Thu'
                                  : sec.day === 'FRI'
                                  ? 'Fri'
                                  : 'Sat';

                              return (
                                <tr
                                  key={sec.sectionNo}
                                  onMouseDown={(e) => handleModalRowMouseDown(course.id, idx, secKey, e)}
                                  onMouseEnter={() => handleModalRowMouseEnter(course.id, idx)}
                                  className={`transition-colors cursor-pointer select-none ${
                                    isSelected
                                      ? 'bg-[#0071E3]/10 text-[#1D1D1F]'
                                      : 'hover:bg-[#F5F5F7]'
                                  }`}
                                >
                                  <td className="py-2.5 px-3 font-semibold">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onToggleHideSections) {
                                            onToggleHideSections([secKey], false);
                                          }
                                        }}
                                        title="คลิกเพื่อยกเลิกการซ่อน"
                                        className="p-1 rounded hover:bg-black/10 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="text-[#1D1D1F]">{sec.sectionNo}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                                    {sec.availableSeats === 0 ? (
                                      <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-[#86868B] border border-black/10 text-[10px]">
                                        เต็ม (0/{sec.totalSeats})
                                      </span>
                                    ) : (
                                      <span>{sec.availableSeats} / {sec.totalSeats}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-[#86868B]">
                                    {sec.status || 'On'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                                    {sec.type || type}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-medium text-[#86868B]">
                                    {dayFormatted}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-[#86868B]">
                                    {sec.startTime}-{sec.endTime}
                                  </td>
                                  <td className="py-2.5 px-3 text-[#86868B]">{sec.room}</td>
                                  <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark2 || '-'}>{sec.remark2 || '-'}</td>
                                  <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark1 || '-'}>{sec.remark1 || '-'}</td>
                                  <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.examination || sec.midtermDate || '-'}>{sec.examination || sec.midtermDate || '-'}</td>
                                  <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.restriction || '-'}>{sec.restriction || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-xs text-[#86868B] apple-subheadline">
                    ✓ ไม่มีวิชาที่ซ่อนอยู่ในขณะนี้ (ทุก Section แสดงในตารางเรียนปฏิทินครบแล้ว)
                  </div>
                )}
              </div>

              {/* Floating Action Pill Bar inside Modal (When rows in modal are selected) */}
              {modalSelectedKeys.size > 0 && (
                <div className="sticky bottom-0 z-40 flex justify-center pt-2 select-none">
                  <div className="bg-[#EBEBEC]/95 backdrop-blur-md text-[#1D1D1F] px-5 py-2.5 rounded-full border border-black/[0.1] flex items-center justify-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <span className="font-normal text-[#1D1D1F]">
                      คุณกำลังเลือก <strong className="font-semibold">{modalSelectedKeys.size}</strong> วิชา
                    </span>

                    <span className="text-[#C7C7CC] mx-0.5">|</span>

                    <button
                      type="button"
                      onClick={handleModalUnhideSelected}
                      className="underline text-[#0066CC] hover:text-[#0071E3] font-medium transition-colors cursor-pointer active:opacity-70"
                    >
                      ยกเลิกการซ่อน
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalSelectedKeys(new Set())}
                      className="ml-1 p-1 rounded-full hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                      title="ยกเลิกการเลือก"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenu && contextMenu.isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 150),
            left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
          }}
          className="fixed z-50 bg-white text-[#1D1D1F] rounded-2xl p-1.5 shadow-2xl border border-black/[0.12] text-xs min-w-[200px] animate-in fade-in zoom-in-95 duration-150 select-none cursor-default"
        >
          <div className="px-3 py-2 border-b border-black/[0.06] mb-1 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[#1D1D1F] truncate text-[11.5px] apple-subheadline">
                {contextMenu.course.code} ({contextMenu.section.sectionNo})
              </p>
              {contextMenu.section.day && contextMenu.section.startTime && (
                <span className="text-[10px] font-semibold text-[#1D1D1F]/80 shrink-0 font-mono">
                  {contextMenu.section.day === 'MON'
                    ? 'Mon'
                    : contextMenu.section.day === 'TUE'
                    ? 'Tue'
                    : contextMenu.section.day === 'WED'
                    ? 'Wed'
                    : contextMenu.section.day === 'THU'
                    ? 'Thu'
                    : contextMenu.section.day === 'FRI'
                    ? 'Fri'
                    : contextMenu.section.day === 'SAT'
                    ? 'Sat'
                    : contextMenu.section.day}{' '}
                  {contextMenu.section.startTime} - {contextMenu.section.endTime}
                </span>
              )}
            </div>
            {contextMenu.course.nameEn && (
              <p className="text-[10px] text-[#86868B] truncate font-normal">
                {contextMenu.course.nameEn}
              </p>
            )}
          </div>

          <div className="space-y-0.5">
            {onAddCourse && (
              <button
                type="button"
                onClick={() => {
                  onAddCourse(contextMenu.course, contextMenu.section);
                  setContextMenu(null);
                  if (isDetailsModalOpen) {
                    setIsDetailsModalOpen(false);
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-black/[0.05] text-[#1D1D1F] transition-colors cursor-pointer group font-medium"
              >
                <Plus className="w-4 h-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors" />
                <span>เพิ่มลงในปฏิทิน</span>
              </button>
            )}

            {onToggleHideSections && (
              <button
                type="button"
                onClick={() => {
                  const secKey = `${contextMenu.course.id}_${contextMenu.section.sectionNo}`;
                  const isHidden = Boolean(hiddenSections[secKey]);
                  onToggleHideSections([secKey], !isHidden);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-black/[0.05] text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              >
                {hiddenSections[`${contextMenu.course.id}_${contextMenu.section.sectionNo}`] ? (
                  <>
                    <Eye className="w-4 h-4 text-[#86868B]" />
                    <span>ยกเลิกการซ่อน</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 text-[#86868B]" />
                    <span>ซ่อนจากปฏิทิน</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
