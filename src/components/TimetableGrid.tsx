'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Course, Section, TimeConflict, SelectedCourseItem, PlanId, PlanData } from '@/types/schedule';
import { AlertTriangle, X, Plus, Edit3, Trash2, ChevronRight, ChevronLeft, Search, Maximize2, Minimize2 } from 'lucide-react';
import { FilterSortMenu, SortOption } from './FilterSortMenu';

interface TimetableGridProps {
  items: SelectedCourseItem[];
  previewSections: { course: Course; section: Section }[];
  conflicts: TimeConflict[];
  onRemoveItem: (courseId: string, sectionNo: string) => void;
  onAddCourse: (course: Course, section: Section) => void;
  onOpenCopyModal?: () => void;
  onResetPlan?: () => void;
  hoveredCourseId?: string | null;
  onHoverCourse?: (id: string | null) => void;
  gridRef?: React.RefObject<HTMLDivElement | null>;
  // Integrated Plan Tabs Props
  plans?: Record<PlanId, PlanData>;
  activePlan?: PlanId;
  onSelectPlan?: (id: PlanId) => void;
  onAddPlan?: () => void;
  onDeletePlan?: (id: PlanId, name: string) => void;
  onRenamePlan?: (id: PlanId, newName: string) => void;
  onReorderPlans?: (orderedIds: PlanId[]) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  seatFilters?: {
    available: boolean;
    'almost-full': boolean;
    full: boolean;
  };
  onToggleSeatFilter?: (key: 'all' | 'available' | 'almost-full' | 'full') => void;
  selectedLetters?: string[];
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: (letters: string[]) => void;
  onClearLetters?: () => void;
  availableLetters?: string[];
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  onResetAllFilters?: () => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  planId: PlanId;
  planName: string;
}

// 08:00 to 19:00 (11 hourly slots)
const TIME_SLOTS = [
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

const DAYS_ORDER = [
  { key: 'MON', label: 'จันทร์', en: 'MON' },
  { key: 'TUE', label: 'อังคาร', en: 'TUE' },
  { key: 'WED', label: 'พุธ', en: 'WED' },
  { key: 'THU', label: 'พฤหัส', en: 'THU' },
  { key: 'FRI', label: 'ศุกร์', en: 'FRI' },
  { key: 'SAT', label: 'เสาร์', en: 'SAT' },
];

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  items,
  previewSections,
  conflicts,
  onRemoveItem,
  onAddCourse,
  hoveredCourseId: externalHoveredId,
  onHoverCourse,
  gridRef,
  plans,
  activePlan,
  onSelectPlan,
  onAddPlan,
  onDeletePlan,
  onRenamePlan,
  onReorderPlans,
  isExpanded = false,
  onToggleExpand,
  seatFilters = { available: true, 'almost-full': true, full: true },
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
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);
  const hoveredCourseId = externalHoveredId !== undefined ? externalHoveredId : internalHoveredId;

  const planEntries = plans ? Object.values(plans) : [];

  // Chrome-Style Plan Tabs Drag-to-Reorder State (Follows Mouse, 100% Opaque)
  const [dragState, setDragState] = useState<{
    tabId: PlanId;
    startX: number;
    currentX: number;
    isDragging: boolean;
  } | null>(null);

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const tabRefs = useRef<Map<PlanId, HTMLDivElement>>(new Map());

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const deltaX = e.clientX - state.startX;
      if (!state.isDragging) {
        if (Math.abs(deltaX) > 4) {
          setDragState({ ...state, isDragging: true, currentX: e.clientX });
        }
        return;
      }

      setDragState((prev) => (prev ? { ...prev, currentX: e.clientX } : null));

      const currentIds = planEntries.map((p) => p.id);
      const currentIndex = currentIds.indexOf(state.tabId);
      if (currentIndex === -1) return;

      const currentTabEl = tabRefs.current.get(state.tabId);
      const tabWidth = currentTabEl ? currentTabEl.getBoundingClientRect().width : 90;

      // Moving right past next tab
      if (deltaX > tabWidth * 0.55 && currentIndex < currentIds.length - 1) {
        const nextId = currentIds[currentIndex + 1];
        const nextEl = tabRefs.current.get(nextId);
        const shiftDist = nextEl ? nextEl.getBoundingClientRect().width : tabWidth;

        const reordered = [...currentIds];
        const [moved] = reordered.splice(currentIndex, 1);
        reordered.splice(currentIndex + 1, 0, moved);

        if (onReorderPlans) {
          onReorderPlans(reordered);
        }
        setDragState((prev) => (prev ? { ...prev, startX: prev.startX + shiftDist } : null));
      }
      // Moving left past previous tab
      else if (deltaX < -tabWidth * 0.55 && currentIndex > 0) {
        const prevId = currentIds[currentIndex - 1];
        const prevEl = tabRefs.current.get(prevId);
        const shiftDist = prevEl ? prevEl.getBoundingClientRect().width : tabWidth;

        const reordered = [...currentIds];
        const [moved] = reordered.splice(currentIndex, 1);
        reordered.splice(currentIndex - 1, 0, moved);

        if (onReorderPlans) {
          onReorderPlans(reordered);
        }
        setDragState((prev) => (prev ? { ...prev, startX: prev.startX - shiftDist } : null));
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current) {
        setDragState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [planEntries, onReorderPlans]);

  // Search & Font Size Settings
  const [gridSearch, setGridSearch] = useState('');
  const [fontSizeScale, setFontSizeScale] = useState<'sm' | 'md' | 'lg'>('md');

  const searchTokens = useMemo(() => {
    if (!gridSearch.trim()) return [];
    return gridSearch
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);
  }, [gridSearch]);

  const isSearchActive = searchTokens.length > 0;

  const highlightText = (text: string, query: string, isLightOnDark = false) => {
    if (!query.trim() || !text) return text;
    const tokens = query.trim().split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 0) return text;

    const pattern = tokens
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
    if (parts.length === 1) return text;

    return parts.map((part, i) =>
      tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
        <mark
          key={i}
          className={
            isLightOnDark
              ? 'bg-yellow-300 text-[#1D1D1F] px-1 py-0.5 rounded-[3px] font-bold shadow-none'
              : 'bg-yellow-200 text-[#1D1D1F] px-1 py-0.5 rounded-[3px] font-bold shadow-none'
          }
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const fontClasses = useMemo(() => {
    switch (fontSizeScale) {
      case 'sm':
        return {
          code: 'text-[9px] sm:text-[10px]',
          name: 'text-[8px] sm:text-[8.5px]',
          sec: 'text-[8px]',
          seat: 'text-[7.5px]',
          type: 'text-[7.5px]',
        };
      case 'md':
      default:
        return {
          code: 'text-[12px] sm:text-[13px]',
          name: 'text-[10px] sm:text-[11px]',
          sec: 'text-[10.5px]',
          seat: 'text-[10px]',
          type: 'text-[10px]',
        };
      case 'lg':
        return {
          code: 'text-[14px] sm:text-[15px]',
          name: 'text-[12px] sm:text-[13px]',
          sec: 'text-[12px]',
          seat: 'text-[11px]',
          type: 'text-[11px]',
        };
    }
  }, [fontSizeScale]);

  const checkMatch = (course: Course, section: Section) => {
    if (!isSearchActive) return false;
    const secNo = section.sectionNo.toLowerCase();
    const code = course.code.toLowerCase();
    const nameEn = (course.nameEn || '').toLowerCase();
    const nameTh = (course.nameTh || '').toLowerCase();
    const room = (section.room || '').toLowerCase();
    const combined = `${code} ${secNo} ${code}${secNo} ${code.replace(/\s+/g, '')} ${secNo.replace(/\s+/g, '')} sec ${secNo} sec${secNo} ${nameEn} ${nameTh} ${room}`.toLowerCase();

    // Match if every space-separated search token exists in the section information
    return searchTokens.every((token) => combined.includes(token));
  };

  // Plan Tab context menu & renaming state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<PlanId | null>(null);
  const [editingName, setEditingName] = useState('');
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, plan: PlanData) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      planId: plan.id,
      planName: plan.name,
    });
  };

  const handleStartRename = (id: PlanId, currentName: string) => {
    setEditingPlanId(id);
    setEditingName(currentName);
    setContextMenu(null);
  };

  const handleSaveRename = (id: PlanId) => {
    if (editingName.trim() && onRenamePlan) {
      onRenamePlan(id, editingName.trim());
    }
    setEditingPlanId(null);
  };

  const handleSetHovered = (id: string | null) => {
    setInternalHoveredId(id);
    if (onHoverCourse) onHoverCourse(id);
  };

  // Time conversion helper (minutes from 08:00)
  const timeToMinutes = (timeStr?: string | null): number => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
    if (match) {
      const h = Number(match[1]);
      const m = Number(match[2]);
      return (h - 8) * 60 + m;
    }
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      return (h - 8) * 60 + m;
    }
    return 0;
  };

  const totalMinutes = (19 - 8) * 60; // 660 mins

  const isConflict = (item: SelectedCourseItem) => {
    return conflicts.some(
      (c) =>
        (c.courseA.id === item.course.id && c.sectionA.sectionNo === item.section.sectionNo) ||
        (c.courseB.id === item.course.id && c.sectionB.sectionNo === item.section.sectionNo)
    );
  };

  const getType = (room: string) => {
    return room.toLowerCase().includes('lab') ? 'LAB' : 'LECT';
  };

  const getPositionedCardsForDay = (dayKey: string) => {
    interface CardItem {
      id: string;
      course: Course;
      section: Section;
      startTime: string;
      endTime: string;
      startMin: number;
      endMin: number;
      isGhost: boolean;
      topPercent: number;
      heightPercent: number;
      colIndex?: number;
      totalCols?: number;
      leftPercent?: number;
      widthPercent?: number;
    }

    const rawCards: CardItem[] = [];

    // 1. Enrolled Sections (Always rendered)
    items.forEach((it) => {
      if (!it?.section?.startTime || !it?.section?.endTime) return;
      if (it.section.day === dayKey) {
        const startMin = timeToMinutes(it.section.startTime);
        const endMin = timeToMinutes(it.section.endTime);
        if (endMin <= startMin) return;

        rawCards.push({
          id: `enrolled-${it.course.id}-${it.section.sectionNo}-${it.section.startTime}`,
          course: it.course,
          section: it.section,
          startTime: it.section.startTime,
          endTime: it.section.endTime,
          startMin,
          endMin,
          isGhost: false,
          topPercent: (startMin / totalMinutes) * 100,
          heightPercent: ((endMin - startMin) / totalMinutes) * 100,
        });
      }
    });

    // 2. Ghost Preview Sections (Only show unselected courses that don't collide with enrolled items)
    previewSections.forEach(({ course, section }) => {
      if (!section?.startTime || !section?.endTime) return;

      // If ANY section of this course is already enrolled -> don't show ghost previews for it
      const isCourseAlreadyEnrolled = items.some((it) => it.course.id === course.id);
      if (isCourseAlreadyEnrolled) return;

      if (section.day === dayKey) {
        const startMin = timeToMinutes(section.startTime);
        const endMin = timeToMinutes(section.endTime);
        if (endMin <= startMin) return;

        // If an enrolled course is already scheduled in this day & time slot -> show ONLY the enrolled course
        const overlapsWithEnrolled = items.some((it) => {
          if (it.section.day !== dayKey) return false;
          if (!it.section.startTime || !it.section.endTime) return false;
          const itStart = timeToMinutes(it.section.startTime);
          const itEnd = timeToMinutes(it.section.endTime);
          return Math.max(startMin, itStart) < Math.min(endMin, itEnd);
        });

        if (overlapsWithEnrolled) return;

        rawCards.push({
          id: `ghost-${course.id}-${section.sectionNo}-${section.startTime}`,
          course,
          section,
          startTime: section.startTime,
          endTime: section.endTime,
          startMin,
          endMin,
          isGhost: true,
          topPercent: (startMin / totalMinutes) * 100,
          heightPercent: ((endMin - startMin) / totalMinutes) * 100,
        });
      }
    });

    if (rawCards.length === 0) return [];

    rawCards.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

    // Overlap clustering algorithm
    const clusters: Array<typeof rawCards> = [];
    let currentCluster: typeof rawCards = [];
    let clusterEnd = -1;

    rawCards.forEach((card) => {
      if (currentCluster.length === 0) {
        currentCluster.push(card);
        clusterEnd = card.endMin;
      } else if (card.startMin < clusterEnd) {
        currentCluster.push(card);
        clusterEnd = Math.max(clusterEnd, card.endMin);
      } else {
        clusters.push(currentCluster);
        currentCluster = [card];
        clusterEnd = card.endMin;
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    clusters.forEach((cluster) => {
      const columns: Array<typeof rawCards> = [];

      cluster.forEach((card) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const lastCard = columns[i][columns[i].length - 1];
          if (lastCard.endMin <= card.startMin) {
            columns[i].push(card);
            card.colIndex = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([card]);
          card.colIndex = columns.length - 1;
        }
      });

      const totalCols = columns.length;
      cluster.forEach((card) => {
        card.totalCols = totalCols;
        card.leftPercent = ((card.colIndex || 0) / totalCols) * 100;
        card.widthPercent = (1 / totalCols) * 100;
      });
    });

    return rawCards;
  };

  const totalSlotsCount = TIME_SLOTS.length - 1; // 11 segments
  return (
    <div
      ref={gridRef}
      className="flex flex-col min-h-[calc(100vh-190px)] relative w-full max-w-full min-w-0"
    >
      {/* Browser Tab Bar Header */}
      <div className="bg-transparent px-2 pt-2 flex items-end justify-between shrink-0 gap-2 sm:gap-3 relative min-h-[44px] -mb-[1px] z-20">
        {/* Left: Browser Tabs */}
        <div
          ref={tabsScrollRef}
          className="flex items-end gap-1 overflow-x-auto no-scrollbar relative z-10 flex-1 min-w-0 pb-0"
        >
          {planEntries.map((plan) => {
            const isActive = plan.id === activePlan;
            const isEditing = editingPlanId === plan.id;
            const isThisTabDragging = dragState?.tabId === plan.id && dragState.isDragging;
            const dragOffset = isThisTabDragging ? dragState.currentX - dragState.startX : 0;

            return (
              <div
                key={plan.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(plan.id, el);
                  else tabRefs.current.delete(plan.id);
                }}
                onMouseDown={(e) => {
                  if (e.button === 0 && !isEditing) {
                    setDragState({
                      tabId: plan.id,
                      startX: e.clientX,
                      currentX: e.clientX,
                      isDragging: false,
                    });
                  }
                }}
                onClick={() => {
                  if (!isEditing && (!dragState || !dragState.isDragging)) {
                    if (onSelectPlan) onSelectPlan(plan.id);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, plan)}
                onDoubleClick={() => handleStartRename(plan.id, plan.name)}
                style={{
                  transform: isThisTabDragging ? `translateX(${dragOffset}px)` : undefined,
                  zIndex: isThisTabDragging ? 50 : isActive ? 20 : 10,
                  transition: isThisTabDragging
                    ? 'none'
                    : 'transform 180ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms',
                }}
                className={`group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold select-none shrink-0 ${
                  dragState?.isDragging ? 'cursor-grabbing' : 'cursor-grab'
                } ${
                  isActive
                    ? 'text-[#1D1D1F] font-bold opacity-100'
                    : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] rounded-t-[10px] mb-1 opacity-100'
                } ${
                  isThisTabDragging ? 'rounded-t-[12px] bg-[#F5F5F7] text-[#1D1D1F]' : ''
                }`}
              >
                {/* Active Tab Soft Grey Background with True Inverted Curved Fillets */}
                {isActive && (
                  <>
                    <div className="absolute inset-0 -bottom-[1.5px] bg-[#F5F5F7] rounded-t-[12px] z-10" />
                    
                    {/* Left Inverted Corner SVG Fillet */}
                    <svg
                      className="absolute -left-[10px] -bottom-[1px] w-[10px] h-[10px] text-[#F5F5F7] fill-[#F5F5F7] pointer-events-none z-10"
                      viewBox="0 0 10 10"
                      preserveAspectRatio="none"
                    >
                      <path d="M10 0 C10 6 6 10 0 10 L10 10 Z" />
                    </svg>

                    {/* Right Inverted Corner SVG Fillet */}
                    <svg
                      className="absolute -right-[10px] -bottom-[1px] w-[10px] h-[10px] text-[#F5F5F7] fill-[#F5F5F7] pointer-events-none z-10"
                      viewBox="0 0 10 10"
                      preserveAspectRatio="none"
                    >
                      <path d="M0 0 C0 6 4 10 10 10 L0 10 Z" />
                    </svg>
                  </>
                )}

                {/* Tab Label / Edit Input */}
                <div className="relative z-20 flex items-center gap-1.5">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleSaveRename(plan.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(plan.id);
                        if (e.key === 'Escape') setEditingPlanId(null);
                      }}
                      autoFocus
                      className="w-20 px-1 py-0.5 text-xs bg-white text-[#1D1D1F] border border-[#0071E3] rounded-sm outline-none font-bold shadow-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate max-w-[90px] sm:max-w-[120px] font-semibold">{plan.name}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Plan '+' Button */}
          {onAddPlan && (
            <button
              type="button"
              onClick={onAddPlan}
              title="เพิ่ม Plan ใหม่"
              className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-full transition-colors cursor-pointer mb-1 shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Side: Quick Grid Search (Left) + Sort/Filter Icon Button (Right) */}
        <div className="flex items-center gap-1.5 sm:gap-2 pb-2 shrink-0 relative z-30 flex-wrap justify-end">
          {/* Quick Search Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              placeholder="ค้นหา Sec, วิชา, ห้อง..."
              className="pl-8 pr-7 py-1 text-xs rounded-full bg-black/[0.04] border border-black/[0.08] focus:border-[#0071E3] focus:bg-white text-[#1D1D1F] placeholder:text-[#86868B] outline-none w-28 xs:w-36 sm:w-44 transition-all font-medium"
            />
            {gridSearch && (
              <button
                type="button"
                onClick={() => setGridSearch('')}
                className="absolute right-2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter & Sort Icon Button */}
          {onToggleSeatFilter && onToggleLetter && onSelectAllLetters && onClearLetters && onSortChange && (
            <FilterSortMenu
              seatFilters={seatFilters}
              onToggleSeatFilter={onToggleSeatFilter}
              selectedLetters={selectedLetters}
              onToggleLetter={onToggleLetter}
              onSelectAllLetters={onSelectAllLetters}
              onClearLetters={onClearLetters}
              availableLetters={availableLetters}
              sortOption={sortOption}
              onSortChange={onSortChange}
              onResetAll={onResetAllFilters}
            />
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 flex flex-col p-2 sm:p-4 bg-[#F5F5F7] overflow-x-auto no-scrollbar min-w-[540px] sm:min-w-full select-none rounded-b-[18px] sm:rounded-b-[20px] rounded-tr-[18px] sm:rounded-tr-[20px] relative z-0 touch-pan-x">
        
        {/* Row 1: Day Column Headers */}
        <div className="grid grid-cols-[44px_repeat(6,1fr)] gap-0 pb-3 mb-2 border-b border-black/[0.06] shrink-0">
          <div className="sticky left-0 bg-[#F5F5F7] z-20 flex items-center justify-center font-semibold text-[9.5px] sm:text-[10px] text-[#86868B] uppercase tracking-wider">
            TIME
          </div>
          {DAYS_ORDER.map((day) => (
            <div
              key={day.key}
              className="py-1 text-center select-none border-l border-black/[0.06] first:border-l-0"
            >
              <div className="font-bold text-xs text-[#1D1D1F] apple-subheadline">
                {day.label}
              </div>
              <div className="text-[10px] font-semibold text-[#86868B] tracking-wider uppercase">
                {day.en}
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Timetable Main Area */}
        <div className="flex-1 min-h-[580px] grid grid-cols-[44px_repeat(6,1fr)] gap-0 relative">
          
          {/* Time Labels Column (Sticky on Mobile) */}
          <div className="sticky left-0 bg-[#F5F5F7] z-20 h-full flex flex-col justify-between py-4 text-[9px] sm:text-[9.5px] font-semibold text-[#86868B] select-none font-mono">
            {TIME_SLOTS.map((time) => (
              <div key={time} className="h-0 flex items-center justify-center -translate-y-1/2">
                <span className="bg-white/90 backdrop-blur-xs px-0.5 py-0.2 rounded border border-black/[0.06]">
                  {time}
                </span>
              </div>
            ))}
          </div>

          {/* 6 Day Columns */}
          {DAYS_ORDER.map((day) => {
            const positionedCards = getPositionedCardsForDay(day.key);

            return (
              <div
                key={day.key}
                className="relative h-full border-l border-black/[0.06] first:border-l-0"
              >
                {/* Horizontal Segment Lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none">
                  {TIME_SLOTS.slice(0, -1).map((time) => (
                    <div
                      key={time}
                      className="border-b border-dashed border-black/[0.06] w-full h-0"
                    />
                  ))}
                </div>

                {/* Cards Container */}
                <div className="absolute inset-0 top-4 bottom-4">
                  <div className="relative w-full h-full">
                    {/* Render positioned cards */}
                    {positionedCards.map((card) => {
                      const isMatch = checkMatch(card.course, card.section);
                      const isHighlighted = hoveredCourseId === card.course.id || isMatch;
                      const isDimmed =
                        (hoveredCourseId !== null && hoveredCourseId !== card.course.id) ||
                        (isSearchActive && !isMatch);
                      const type = getType(card.section.room);
                      const isFull = card.section.availableSeats === 0;

                      const isSingleCol = (card.totalCols || 1) === 1;
                      const leftStyle = isSingleCol ? '4px' : `calc(${card.leftPercent}% + 2px)`;
                      const widthStyle = isSingleCol ? 'calc(100% - 8px)' : `calc(${card.widthPercent}% - 4px)`;

                      if (card.isGhost) {
                        // GHOST PREVIEW CARD (Apple Store Clean Hairline Card)
                        return (
                          <div
                            key={card.id}
                            onMouseEnter={() => handleSetHovered(card.course.id)}
                            onMouseLeave={() => handleSetHovered(null)}
                            onClick={() => onAddCourse(card.course, card.section)}
                            style={{
                              top: `${card.topPercent}%`,
                              height: `${card.heightPercent}%`,
                              left: leftStyle,
                              width: widthStyle,
                            }}
                            className={`absolute min-h-[105px] rounded-[14px] p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-98 bg-white border ${
                              isMatch
                                ? 'border-[#1D1D1F] ring-2 ring-black/10 scale-[1.02] z-30 opacity-100'
                                : isHighlighted
                                ? 'border-[#1D1D1F] bg-black/[0.02] scale-[1.01] z-30 opacity-100'
                                : isDimmed
                                ? 'border-[#E5E7EB] opacity-20 z-10'
                                : 'border-[#E5E7EB] hover:border-[#86868B] hover:bg-black/[0.015] hover:scale-[1.01] z-10 opacity-95 hover:opacity-100'
                            }`}
                          >
                            <div className="space-y-0.5 overflow-hidden">
                              {/* 1. Hierarchy Level 1: Course Code Identifier (Bold, Prominent) */}
                              <div className={`font-bold ${fontClasses.code} text-[#1D1D1F] tracking-tight leading-tight apple-subheadline`}>
                                {highlightText(card.course.code, gridSearch, false)}
                              </div>

                              {/* 1. Hierarchy Level 2: Course Name (Regular, Clean, Softer Ink) */}
                              {card.course.nameEn && card.course.nameEn !== card.course.code && (
                                <div className={`font-normal ${fontClasses.name} text-[#1D1D1F]/75 leading-snug line-clamp-2`}>
                                  {highlightText(card.course.nameEn, gridSearch, false)}
                                </div>
                              )}

                              {/* 2. Structured Metadata: 327B · LECT */}
                              <div className={`pt-1 flex items-center gap-1.5 ${fontClasses.sec} text-[#6B7280]`}>
                                <span className="font-semibold text-[#1D1D1F]">
                                  {highlightText(card.section.sectionNo, gridSearch, false)}
                                </span>
                                <span className="text-[#86868B]/40 select-none">·</span>
                                <span className="uppercase text-[#86868B] font-medium tracking-wide">
                                  {type}
                                </span>
                              </div>
                            </div>

                            {/* 3. Bottom Row: Semantic Status Dot + Room Label */}
                            <div className="pt-2 flex items-center justify-between text-[11px] border-t border-black/[0.04]">
                              {/* Semantic Status Dot (No bulky pill button) */}
                              {isFull ? (
                                <div className="flex items-center gap-1.5 font-semibold text-[#FF3B30]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shrink-0" />
                                  <span className={fontClasses.seat}>เต็ม</span>
                                </div>
                              ) : card.section.availableSeats <= 5 ? (
                                <div className="flex items-center gap-1.5 font-semibold text-[#FF9500]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] shrink-0" />
                                  <span className={fontClasses.seat}>ว่าง {card.section.availableSeats}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 font-medium text-[#34C759]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] shrink-0" />
                                  <span className={fontClasses.seat}>ว่าง {card.section.availableSeats}</span>
                                </div>
                              )}

                              {/* Room with Clear Context */}
                              {card.section.room && (
                                <span className={`${fontClasses.seat} text-[#86868B] font-mono truncate max-w-[75px]`} title={`ห้องเรียน ${card.section.room}`}>
                                  {card.section.room.toLowerCase().startsWith('r') || card.section.room.toLowerCase().startsWith('b') || card.section.room.toLowerCase().startsWith('c')
                                    ? highlightText(card.section.room, gridSearch, false)
                                    : `Room ${highlightText(card.section.room, gridSearch, false)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        // SOLID ENROLLED CARD (Apple Action Blue Solid Background)
                        const solidItem = items.find(
                          (it) => it.course.id === card.course.id && it.section.sectionNo === card.section.sectionNo
                        );
                        const conflicting = solidItem ? isConflict(solidItem) : false;

                        return (
                          <div
                            key={card.id}
                            onMouseEnter={() => handleSetHovered(card.course.id)}
                            onMouseLeave={() => handleSetHovered(null)}
                            onClick={() => onRemoveItem(card.course.id, card.section.sectionNo)}
                            title="คลิกอีกครั้งเพื่อยกเลิกการเลือกวิชานี้"
                            style={{
                              top: `${card.topPercent}%`,
                              height: `${card.heightPercent}%`,
                              left: leftStyle,
                              width: widthStyle,
                            }}
                            className={`absolute min-h-[105px] rounded-[14px] p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer z-20 text-white active:scale-98 ${
                              conflicting
                                ? 'bg-[#FF3B30] border-2 border-red-600'
                                : 'bg-[#0071E3] hover:bg-[#0077ED]'
                            } ${
                              isMatch
                                ? 'border-2 border-yellow-300 ring-2 ring-yellow-400/60 scale-[1.02] z-30 opacity-100'
                                : isHighlighted
                                ? 'scale-[1.01] z-30 opacity-100'
                                : isDimmed
                                ? 'opacity-20'
                                : 'hover:scale-[1.01]'
                            }`}
                          >
                            <div className="space-y-0.5 overflow-hidden">
                              {/* Top: Code + English Name + Remove Button */}
                              <div className="flex items-start justify-between gap-1">
                                <div className="space-y-0.5 overflow-hidden flex-1 min-w-0">
                                  {/* 1. Hierarchy Level 1: Course Code Identifier */}
                                  <div className={`font-bold ${fontClasses.code} text-white tracking-tight leading-tight apple-subheadline`}>
                                    {highlightText(card.course.code, gridSearch, true)}
                                  </div>

                                  {/* 1. Hierarchy Level 2: Course Name */}
                                  {card.course.nameEn && card.course.nameEn !== card.course.code && (
                                    <div className={`font-normal ${fontClasses.name} text-white/90 leading-snug line-clamp-2`}>
                                      {highlightText(card.course.nameEn, gridSearch, true)}
                                    </div>
                                  )}

                                  {/* 2. Structured Metadata: 327B · LECT */}
                                  <div className={`pt-1 flex items-center gap-1.5 ${fontClasses.sec} text-white/80`}>
                                    <span className="font-semibold text-white">
                                      {highlightText(card.section.sectionNo, gridSearch, true)}
                                    </span>
                                    <span className="text-white/40 select-none">·</span>
                                    <span className="uppercase text-white/80 font-medium tracking-wide">
                                      {type}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveItem(card.course.id, card.section.sectionNo);
                                  }}
                                  title="ลบวิชานี้ออกจากตาราง"
                                  className="w-5 h-5 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-90"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            </div>

                            {/* 3. Bottom Row: Semantic Status Dot + Room Label */}
                            <div className="pt-2 flex items-center justify-between text-[11px] border-t border-white/10">
                              {/* Semantic Status Dot */}
                              {isFull ? (
                                <div className="flex items-center gap-1.5 font-semibold text-white">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                  <span className={fontClasses.seat}>เต็ม</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 font-medium text-white/90">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                                  <span className={fontClasses.seat}>ว่าง {card.section.availableSeats}</span>
                                </div>
                              )}

                              {card.section.room && (
                                <span className={`${fontClasses.seat} text-white/80 font-mono truncate max-w-[75px]`}>
                                  {card.section.room.toLowerCase().startsWith('r') || card.section.room.toLowerCase().startsWith('b') || card.section.room.toLowerCase().startsWith('c')
                                    ? highlightText(card.section.room, gridSearch, true)
                                    : `Room ${highlightText(card.section.room, gridSearch, true)}`}
                                </span>
                              )}

                              {conflicting && (
                                <span className="bg-white text-[#FF3B30] text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">
                                  ชนกัน!
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Bottom-Right Corner Controls (Pure White Background) */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto select-none">
          {/* Font Size Adjust Segmented Control (กลุ่มเลือก 3 ระดับ) */}
          <div className="flex items-center bg-white p-0.5 rounded-full border border-black/[0.08] shadow-xs text-xs">
            <button
              type="button"
              onClick={() => setFontSizeScale('sm')}
              title="ขนาดตัวอักษรเล็กพิเศษ"
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                fontSizeScale === 'sm'
                  ? 'bg-black/[0.06] text-[#1D1D1F] border border-black/[0.04]'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSizeScale('md')}
              title="ขนาดตัวอักษรปกติ"
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                fontSizeScale === 'md'
                  ? 'bg-black/[0.06] text-[#1D1D1F] border border-black/[0.04]'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSizeScale('lg')}
              title="ขนาดตัวอักษรใหญ่"
              className={`px-2.5 py-0.5 rounded-full text-[12px] font-bold transition-all cursor-pointer ${
                fontSizeScale === 'lg'
                  ? 'bg-black/[0.06] text-[#1D1D1F] border border-black/[0.04]'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              A+
            </button>
          </div>

          {/* Expand / Collapse Calendar Button */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              title={isExpanded ? 'ย่อตารางกลับ' : 'ขยายตารางเต็มจอ'}
              className="w-7 h-7 rounded-full bg-white hover:bg-black/[0.04] text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.08] hover:border-black/[0.15] shadow-xs flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 shrink-0 group"
            >
              <div className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Right-click Context Menu on Tab */}
      {contextMenu && contextMenu.isOpen && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[150px] bg-white/95 backdrop-blur-md rounded-[12px] border border-black/[0.08] py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleStartRename(contextMenu.planId, contextMenu.planName)}
            className="w-full px-3 py-2 text-left text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>เปลี่ยนชื่อแผน</span>
          </button>
          {planEntries.length > 1 && (
            <button
              onClick={() => {
                if (onDeletePlan) onDeletePlan(contextMenu.planId, contextMenu.planName);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบแผนนี้</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
