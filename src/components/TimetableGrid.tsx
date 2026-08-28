'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Course, Section, TimeConflict, SelectedCourseItem, PlanId, PlanData } from '@/types/schedule';
import { AlertTriangle, X, Plus, Edit3, Trash2, RotateCcw, ChevronRight, ChevronLeft, Search, Maximize2, Minimize2, Sparkles, Copy } from 'lucide-react';
import { FilterSortMenu, SortOption } from './FilterSortMenu';
import { PresetModal } from './PresetModal';
import { ParsedPresetEntry } from '@/utils/scheduleUtils';

interface TimetableGridProps {
  items: SelectedCourseItem[];
  previewSections: { course: Course; section: Section }[];
  conflicts: TimeConflict[];
  onRemoveItem: (courseId: string, sectionNo: string) => void;
  onAddCourse: (course: Course, section: Section) => void;
  onOpenCopyModal?: () => void;
  onResetPlan?: (id?: PlanId) => void;
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
  onDuplicatePlan?: (id: PlanId) => void;
  onReorderPlans?: (orderedIds: PlanId[]) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
  allCourses?: Course[];
  onApplyPreset?: (planId: PlanId, entries: ParsedPresetEntry[]) => Promise<{ appliedCount: number; missing: string[] }>;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  planId: PlanId;
  planName: string;
}

export interface ScheduleGroupCard {
  id: string;
  course: Course;
  day: string;
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
  isGhost: boolean;
  topPercent: number;
  heightPercent: number;
  sections: Section[];
  enrolledSection?: Section;
  totalAvailableSeats: number;
  maxTotalSeats: number;
  colIndex?: number;
  totalCols?: number;
  leftPercent?: number;
  widthPercent?: number;
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
  items = [],
  previewSections = [],
  conflicts,
  onRemoveItem,
  onAddCourse,
  onResetPlan,
  hoveredCourseId: externalHoveredId,
  onHoverCourse,
  gridRef,
  plans,
  activePlan,
  onSelectPlan,
  onAddPlan,
  onDeletePlan,
  onRenamePlan,
  onDuplicatePlan,
  onReorderPlans,
  isExpanded = false,
  onToggleExpand,
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
  allCourses = [],
  onApplyPreset,
}) => {
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);
  const hoveredCourseId = externalHoveredId !== undefined ? externalHoveredId : internalHoveredId;

  // Preset Modal State
  const [presetModalPlan, setPresetModalPlan] = useState<{ planId: PlanId; planName: string } | null>(null);

  // Floating Remark text outside card component on hover (Black text, no background, no border, centered)
  const [hoveredRemark, setHoveredRemark] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // Active Section Picker Popover/Modal for Multi-Section Schedule Group
  const [activeSectionPickerGroup, setActiveSectionPickerGroup] = useState<ScheduleGroupCard | null>(null);

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

  // Search Settings
  const [gridSearch, setGridSearch] = useState('');

  const searchTokens = useMemo(() => {
    if (!gridSearch.trim()) return [];
    return gridSearch
      .trim()
      .toLowerCase()
      .split(/[\s,/\-|:;\\._]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !/^[\s,/\-|:;\\._]+$/.test(t));
  }, [gridSearch]);

  const isSearchActive = searchTokens.length > 0;

  const highlightText = (text: string, query: string, isLightOnDark = false) => {
    if (!query.trim() || !text) return text;
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/[\s,/\-|:;\\._]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !/^[\s,/\-|:;\\._]+$/.test(t));
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


  const checkMatch = (course: Course, section: Section) => {
    if (!isSearchActive) return false;
    const secNo = (section.sectionNo || '').toLowerCase();
    const code = (course.code || '').toLowerCase();
    const nameEn = (course.nameEn || '').toLowerCase();
    const nameTh = (course.nameTh || '').toLowerCase();
    const room = (section.room || '').toLowerCase();
    const instructor = (section.instructor || '').toLowerCase();
    const rawRemark = `${section.remark1 || ''} ${section.remark2 || ''}`.toLowerCase();

    // Create rich searchable target string with variations
    const cleanCode = code.replace(/[^a-z0-9]/g, '');
    const cleanSec = secNo.replace(/[^a-z0-9]/g, '');
    const combined = `${code} ${cleanCode} ${secNo} ${cleanSec} ${code}${secNo} ${cleanCode}${cleanSec} ${code}/${secNo} ${code}-${secNo} sec ${secNo} sec${secNo} ${nameEn} ${nameTh} ${room} ${instructor} ${rawRemark}`.toLowerCase();

    // Match if every space/delimiter-separated search token exists in the section information
    return searchTokens.every((token) => {
      const cleanToken = token.replace(/[^a-z0-9]/g, '');
      return combined.includes(token) || (cleanToken.length > 0 && combined.includes(cleanToken));
    });
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
      planId: plan.id || 'planA',
      planName: plan.name || 'Plan',
    });
  };

  const handleStartRename = (id: PlanId, currentName: string) => {
    setEditingPlanId(id);
    setEditingName(currentName || '');
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
    const clean = timeStr.trim();
    const match = clean.match(/(\d{1,2})[.:](\d{2})/);
    if (match) {
      const h = Number(match[1]);
      const m = Number(match[2]);
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

  const getPositionedCardsForDay = (dayKey: string): ScheduleGroupCard[] => {
    const rawCards: ScheduleGroupCard[] = [];
    const safeItems = Array.isArray(items) ? items : [];
    const safePreviewSections = Array.isArray(previewSections) ? previewSections : [];
    const seenCardKeys = new Set<string>();

    // 1. Enrolled Sections (Always rendered as solid cards)
    safeItems.forEach((it, index) => {
      if (!it?.section?.startTime || !it?.section?.endTime) return;
      const itemDay = (it.section.day || '').trim().toUpperCase();
      if (itemDay === dayKey) {
        const startMin = timeToMinutes(it.section.startTime);
        const endMin = timeToMinutes(it.section.endTime);
        if (endMin <= startMin) return;

        const uniqueKey = `enrolled-${it.course.id}-${it.section.sectionNo}-${it.section.startTime}-${it.section.room || ''}`;
        if (seenCardKeys.has(uniqueKey)) return;
        seenCardKeys.add(uniqueKey);

        rawCards.push({
          id: `${uniqueKey}-${index}`,
          course: it.course,
          day: itemDay,
          startTime: it.section.startTime,
          endTime: it.section.endTime,
          startMin,
          endMin,
          isGhost: false,
          topPercent: (startMin / totalMinutes) * 100,
          heightPercent: ((endMin - startMin) / totalMinutes) * 100,
          sections: [it.section],
          enrolledSection: it.section,
          totalAvailableSeats: it.section.availableSeats || 0,
          maxTotalSeats: it.section.totalSeats || 0,
        });
      }
    });

    // 2. Ghost Preview Sections — Group by Schedule Slot (Course + Day + StartTime + EndTime)
    const ghostGroupsMap = new Map<
      string,
      {
        course: Course;
        sections: Section[];
        startMin: number;
        endMin: number;
        startTime: string;
        endTime: string;
      }
    >();

    safePreviewSections.forEach(({ course, section }) => {
      if (!section?.startTime || !section?.endTime) return;

      // If ANY section of this course is already enrolled -> don't show ghost previews for it
      const isCourseAlreadyEnrolled = safeItems.some((it) => it?.course?.id === course?.id);
      if (isCourseAlreadyEnrolled) return;

      const secDay = (section.day || '').trim().toUpperCase();
      if (secDay === dayKey) {
        const startMin = timeToMinutes(section.startTime);
        const endMin = timeToMinutes(section.endTime);
        if (endMin <= startMin) return;

        // If an enrolled course is already in this day & time slot -> that slot belongs EXCLUSIVELY to that enrolled course
        const overlapsWithEnrolled = safeItems.some((it) => {
          const itDay = (it?.section?.day || '').trim().toUpperCase();
          if (itDay !== dayKey) return false;
          if (!it?.section?.startTime || !it?.section?.endTime) return false;
          const itStart = timeToMinutes(it.section.startTime);
          const itEnd = timeToMinutes(it.section.endTime);
          return Math.max(startMin, itStart) < Math.min(endMin, itEnd);
        });

        if (overlapsWithEnrolled) return;

        const slotKey = `${course.id}_${section.startTime}_${section.endTime}`;
        const existing = ghostGroupsMap.get(slotKey);
        if (existing) {
          if (!existing.sections.some((s) => s.sectionNo === section.sectionNo)) {
            existing.sections.push(section);
          }
        } else {
          ghostGroupsMap.set(slotKey, {
            course,
            sections: [section],
            startMin,
            endMin,
            startTime: section.startTime,
            endTime: section.endTime,
          });
        }
      }
    });

    // Convert grouped ghost slots into ScheduleGroupCards
    let groupIndex = 0;
    ghostGroupsMap.forEach((group, slotKey) => {
      const totalAvailable = group.sections.reduce((sum, s) => sum + (s.availableSeats || 0), 0);
      const totalMax = group.sections.reduce((sum, s) => sum + (s.totalSeats || 0), 0);

      rawCards.push({
        id: `ghost-group-${slotKey}-${groupIndex++}`,
        course: group.course,
        day: dayKey,
        startTime: group.startTime,
        endTime: group.endTime,
        startMin: group.startMin,
        endMin: group.endMin,
        isGhost: true,
        topPercent: (group.startMin / totalMinutes) * 100,
        heightPercent: ((group.endMin - group.startMin) / totalMinutes) * 100,
        sections: group.sections,
        totalAvailableSeats: totalAvailable,
        maxTotalSeats: totalMax,
      });
    });

    if (rawCards.length === 0) return [];

    // Sort cards by start time ascending, then by duration descending
    rawCards.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // 1. Group overlapping cards into connected components (clusters)
    const clusters: Array<ScheduleGroupCard[]> = [];
    let currentCluster: ScheduleGroupCard[] = [];
    let clusterMaxEnd = -1;

    rawCards.forEach((card) => {
      if (currentCluster.length === 0) {
        currentCluster.push(card);
        clusterMaxEnd = card.endMin;
      } else if (card.startMin < clusterMaxEnd) {
        // Overlaps with current cluster
        currentCluster.push(card);
        clusterMaxEnd = Math.max(clusterMaxEnd, card.endMin);
      } else {
        // Starts a new cluster
        clusters.push(currentCluster);
        currentCluster = [card];
        clusterMaxEnd = card.endMin;
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // 2. Assign each card to the first available non-overlapping column in its cluster
    clusters.forEach((cluster) => {
      const columns: Array<ScheduleGroupCard[]> = [];

      cluster.forEach((card) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          // A column is free for `card` if NO card in that column overlaps in time with `card`
          const hasOverlap = columns[i].some(
            (c) => Math.max(c.startMin, card.startMin) < Math.min(c.endMin, card.endMin)
          );
          if (!hasOverlap) {
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

      // Check if any card in this cluster is currently hovered
      let hoveredColIndex: number | null = null;
      if (hoveredCourseId && totalCols >= 2) {
        for (let i = 0; i < totalCols; i++) {
          if (columns[i].some((c) => c.course.id === hoveredCourseId)) {
            hoveredColIndex = i;
            break;
          }
        }
      }

      if (hoveredColIndex !== null && totalCols >= 2) {
        // Accordion Push: Hovered column expands to 55%-65%, remaining columns share remaining space evenly
        const activeWidth =
          totalCols === 2 ? 65 : totalCols === 3 ? 60 : Math.min(65, Math.max(45, 100 - (totalCols - 1) * 9));
        const compressedWidth = (100 - activeWidth) / (totalCols - 1);

        const colWidths: number[] = [];
        const colLefts: number[] = [];
        let accumulatedLeft = 0;

        for (let i = 0; i < totalCols; i++) {
          const w = i === hoveredColIndex ? activeWidth : compressedWidth;
          colWidths.push(w);
          colLefts.push(accumulatedLeft);
          accumulatedLeft += w;
        }

        cluster.forEach((card) => {
          card.totalCols = totalCols;
          const colIdx = typeof card.colIndex === 'number' ? card.colIndex : 0;
          card.leftPercent = colLefts[colIdx];
          card.widthPercent = colWidths[colIdx];
        });
      } else {
        // Uniform distribution when no card in this cluster is hovered
        cluster.forEach((card) => {
          card.totalCols = totalCols;
          const colIdx = typeof card.colIndex === 'number' ? card.colIndex : 0;
          card.leftPercent = (colIdx / totalCols) * 100;
          card.widthPercent = (1 / totalCols) * 100;
        });
      }
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
          {planEntries.map((plan, index) => {
            const isActive = plan.id === activePlan;
            const isEditing = editingPlanId === plan.id;
            const isThisTabDragging = Boolean(dragState && dragState.isDragging && dragState.tabId === plan.id);
            const dragOffset = isThisTabDragging && dragState ? dragState.currentX - dragState.startX : 0;
            const tabUniqueKey = `tab-${plan.id || 'plan'}-${index}`;

            return (
              <div
                key={tabUniqueKey}
                ref={(el) => {
                  if (el && plan.id) tabRefs.current.set(plan.id, el);
                  else if (plan.id) tabRefs.current.delete(plan.id);
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

                {/* Tab Label / Edit Input / Close Button */}
                <div className="relative z-20 flex items-center gap-1 sm:gap-1.5">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName || ''}
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

                  {/* Close Tab 'X' Button (Only when more than 1 plan exists) */}
                  {planEntries.length > 1 && !isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeletePlan) onDeletePlan(plan.id, plan.name);
                      }}
                      title="ปิดแผนนี้"
                      className="w-4 h-4 rounded-full hover:bg-black/10 flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-all cursor-pointer opacity-60 hover:opacity-100 shrink-0 -mr-1"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
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
              name="gridSearch"
              id="gridSearch"
              autoComplete="on"
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              placeholder="ค้นหา Sec, วิชา, ห้อง..."
              className="pl-8 pr-7 py-1 text-xs rounded-full bg-black/[0.04] border border-black/[0.08] focus:border-black/30 focus:bg-white text-[#1D1D1F] placeholder:text-[#86868B] outline-none w-28 xs:w-36 sm:w-44 transition-all font-medium"
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
      <div className="flex-1 flex flex-col p-2 sm:p-4 bg-[#F5F5F7] overflow-x-auto no-scrollbar min-w-[660px] sm:min-w-full select-none rounded-b-[18px] sm:rounded-b-[20px] rounded-tr-[18px] sm:rounded-tr-[20px] relative z-0 touch-pan-x">
        
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

        {/* Row 2: Timetable Main Body */}
        <div className="grid grid-cols-[44px_repeat(6,1fr)] gap-0 relative">
          
          {/* Time Gutter (Sticky Left Column) */}
          <div className="sticky left-0 bg-[#F5F5F7] z-20 flex flex-col border-r border-black/[0.06] select-none">
            {TIME_SLOTS.map((time) => (
              <div
                key={time}
                className="h-16 flex items-start justify-center pt-1 font-semibold text-[9.5px] sm:text-[10px] text-[#86868B] border-b border-black/[0.04] last:border-b-0"
              >
                {time}
              </div>
            ))}
          </div>

          {/* 6 Day Columns */}
          {DAYS_ORDER.map((day) => {
            const positionedCards = getPositionedCardsForDay(day.key);

            return (
              <div
                key={day.key}
                className="relative flex flex-col border-l border-black/[0.06] first:border-l-0 min-h-[768px]"
              >
                {/* 12 Hour Slot Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                  {TIME_SLOTS.slice(0, -1).map((time) => (
                    <div
                      key={time}
                      className="h-16 border-b border-black/[0.04] last:border-b-0"
                    />
                  ))}
                </div>

                {/* Cards Container */}
                <div className="absolute inset-0 top-4 bottom-4">
                  <div className="relative w-full h-full">
                    {/* Render positioned cards */}
                    {positionedCards.map((card, cardIndex) => {
                      const enrolledSec = card.enrolledSection || card.sections[0];
                      const isMultiSecGroup = card.isGhost && card.sections.length > 1;
                      const isSingleSec = card.isGhost && card.sections.length === 1;

                      const isMatch = card.sections.some((s) => checkMatch(card.course, s));
                      const isHighlighted = hoveredCourseId === card.course.id || isMatch;
                      const isDimmed =
                        (hoveredCourseId !== null && hoveredCourseId !== card.course.id) ||
                        (isSearchActive && !isMatch);

                      const isFull = card.isGhost
                        ? card.totalAvailableSeats === 0
                        : enrolledSec.availableSeats === 0 ||
                          enrolledSec.status === 'Freeze' ||
                          enrolledSec.status === 'Closed';

                      const isSingleCol = (card.totalCols || 1) === 1;
                      const isTripleCol = (card.totalCols || 1) >= 3;
                      const isNarrow = (card.widthPercent || 100) < 18 && !isHighlighted;

                      const leftStyle = isSingleCol ? '3px' : `calc(${card.leftPercent}% + 1.5px)`;
                      const widthStyle = isSingleCol ? 'calc(100% - 6px)' : `calc(${card.widthPercent}% - 3px)`;

                      // Collect remarks for tooltip
                      const remarkText = card.sections
                        .map((s) => [s.remark1, s.remark2].filter((r) => r && r !== '-').join(' • '))
                        .filter(Boolean)
                        .filter((val, idx, arr) => arr.indexOf(val) === idx)
                        .join('\n');
                      const hasRemark = Boolean(remarkText);

                      const durationMinutes = card.endMin - card.startMin;
                      const isTallCard = durationMinutes >= 140;

                      if (card.isGhost) {
                        // GHOST PREVIEW: SINGLE SECTION OR MULTI-SECTION GROUP
                        return (
                          <div
                            key={card.id || `ghost-${cardIndex}`}
                            onMouseEnter={(e) => {
                              handleSetHovered(card.course.id);
                              if (hasRemark) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredRemark({
                                  text: remarkText,
                                  x: rect.left + rect.width / 2,
                                  y: Math.max(8, rect.top - 6),
                                });
                              }
                            }}
                            onMouseLeave={() => {
                              handleSetHovered(null);
                              setHoveredRemark(null);
                            }}
                            onClick={() => {
                              if (isMultiSecGroup) {
                                setActiveSectionPickerGroup(card);
                              } else if (card.sections[0]) {
                                onAddCourse(card.course, card.sections[0]);
                              }
                            }}
                            style={{
                              top: `${card.topPercent}%`,
                              height: `${card.heightPercent}%`,
                              left: leftStyle,
                              width: widthStyle,
                            }}
                            className={`group absolute min-h-[50px] overflow-hidden rounded-[13px] sm:rounded-[15px] ${
                              isNarrow ? 'p-1' : isTripleCol ? 'p-2 sm:p-2.5' : 'p-3'
                            } transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between cursor-pointer active:scale-98 bg-white ${
                              isMatch
                                ? 'ring-2 ring-black/10 scale-[1.02] z-30 opacity-100 shadow-md'
                                : isHighlighted
                                ? 'bg-black/[0.02] scale-[1.01] z-30 opacity-100 shadow-md'
                                : isDimmed
                                ? 'opacity-20 z-10'
                                : 'hover:bg-black/[0.015] hover:scale-[1.01] z-10 opacity-95 hover:opacity-100 shadow-2xs'
                            }`}
                          >
                            {isNarrow ? (
                              /* Compressed Vertical View for Narrow Columns */
                              <div className="flex flex-col justify-between items-center h-full w-full py-1 overflow-hidden select-none">
                                <div className="font-bold text-[11px] sm:text-[12px] text-[#1D1D1F] [writing-mode:vertical-rl] -rotate-180 tracking-tight leading-none truncate max-h-[85%]">
                                  {highlightText(card.course.code, gridSearch, false)}
                                </div>
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isFull ? 'bg-[#FF3B30]' : 'bg-[#34C759]'
                                  }`}
                                />
                              </div>
                            ) : (
                              /* Standard Full Horizontal Layout */
                              <>
                                <div className={`${isTallCard ? 'space-y-1.5' : 'space-y-0.5'} overflow-hidden`}>
                                  {/* 1. Course Code Identifier */}
                                  <div className={`font-bold ${isTripleCol ? 'text-[13px]' : 'text-[14px] sm:text-[15px]'} text-[#1D1D1F] tracking-tight leading-tight apple-subheadline truncate`}>
                                    {highlightText(card.course.code, gridSearch, false)}
                                  </div>

                                  {/* 2. Course Name */}
                                  {card.course.nameEn && card.course.nameEn !== card.course.code && (
                                    <div className={`font-normal ${isTripleCol ? 'text-[10.5px] line-clamp-2' : 'text-[11px] sm:text-[12px] line-clamp-2'} text-[#1D1D1F]/80 leading-snug`}>
                                      {highlightText(card.course.nameEn, gridSearch, false)}
                                    </div>
                                  )}

                                  {/* 3. Section Info / Multi-Section Badge */}
                                  {isMultiSecGroup ? (
                                    <div className="pt-0.5 space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#0071E3]/10 text-[#0071E3]">
                                          {card.sections.length} Sections
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-[#86868B] font-mono truncate leading-tight">
                                        {card.sections.map((s) => s.sectionNo).join(' · ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`pt-0.5 flex items-center gap-1 ${isTripleCol ? 'text-[11.5px]' : 'text-[12.5px] sm:text-[13px]'} text-[#6B7280]`}>
                                      <span className="font-bold text-[#1D1D1F]">
                                        {highlightText(card.sections[0]?.sectionNo || '', gridSearch, false)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* 4. Bottom Row: Semantic Status Dot + Room/Action Label */}
                                <div className={`pt-2 ${isTripleCol ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-1.5'} text-[11px] sm:text-[12px] min-w-0 overflow-hidden`}>
                                  <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isFull ? 'bg-[#FF3B30]' : card.totalAvailableSeats <= 5 ? 'bg-[#FF9500]' : 'bg-[#34C759]'}`} />
                                    <span className={`font-bold ${isFull ? 'text-[#FF3B30]' : card.totalAvailableSeats <= 5 ? 'text-[#FF9500]' : 'text-[#34C759]'}`}>
                                      {isFull ? 'เต็ม' : isMultiSecGroup ? `ว่าง ${card.totalAvailableSeats}` : `ว่าง ${card.sections[0]?.availableSeats ?? ''}`}
                                    </span>
                                  </div>

                                  {isMultiSecGroup ? (
                                    <span className="text-[#0071E3] font-medium truncate text-[10.5px] sm:text-[11px]">
                                      เลือก Sec →
                                    </span>
                                  ) : card.sections[0]?.room ? (
                                    <span className="text-[#86868B] font-mono truncate font-medium leading-tight text-[11px] sm:text-[11.5px]">
                                      {highlightText(card.sections[0].room, gridSearch, false)}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      } else {
                        // SOLID ENROLLED CARD (Level 3)
                        const solidItem = items.find(
                          (it) =>
                            it.course.id === card.course.id &&
                            it.section.sectionNo === enrolledSec.sectionNo
                        );
                        const conflicting = solidItem ? isConflict(solidItem) : false;

                        return (
                          <div
                            key={card.id || `solid-${cardIndex}`}
                            onMouseEnter={(e) => {
                              handleSetHovered(card.course.id);
                              if (hasRemark) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredRemark({
                                  text: remarkText,
                                  x: rect.left + rect.width / 2,
                                  y: Math.max(8, rect.top - 6),
                                });
                              }
                            }}
                            onMouseLeave={() => {
                              handleSetHovered(null);
                              setHoveredRemark(null);
                            }}
                            onClick={() => onRemoveItem(card.course.id, enrolledSec.sectionNo)}
                            style={{
                              top: `${card.topPercent}%`,
                              height: `${card.heightPercent}%`,
                              left: leftStyle,
                              width: widthStyle,
                            }}
                            className={`group absolute min-h-[50px] overflow-hidden rounded-[13px] sm:rounded-[15px] ${
                              isNarrow ? 'p-1' : isTripleCol ? 'p-2 sm:p-2.5' : 'p-3'
                            } transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between cursor-pointer z-20 text-white active:scale-98 ${
                              conflicting
                                ? 'bg-[#FF3B30]'
                                : 'bg-[#0071E3] hover:bg-[#0077ED]'
                            } ${
                              isMatch
                                ? 'ring-2 ring-yellow-400/60 scale-[1.02] z-30 opacity-100 shadow-md'
                                : isHighlighted
                                ? 'scale-[1.01] z-30 opacity-100 shadow-md'
                                : isDimmed
                                ? 'opacity-20'
                                : 'hover:scale-[1.01] shadow-2xs'
                            }`}
                          >
                            {isNarrow ? (
                              /* Compressed Vertical Enrolled View */
                              <div className="flex flex-col justify-between items-center h-full w-full py-1 overflow-hidden select-none">
                                <div className="font-bold text-[11px] sm:text-[12px] text-white [writing-mode:vertical-rl] -rotate-180 tracking-tight leading-none truncate max-h-[85%]">
                                  {highlightText(card.course.code, gridSearch, true)}
                                </div>
                                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                              </div>
                            ) : (
                              /* Standard Full Horizontal Enrolled View */
                              <>
                                <div className={`${isTallCard ? 'space-y-1.5' : 'space-y-0.5'} overflow-hidden`}>
                                  {/* Top: Code + English Name + Remove Button */}
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="space-y-0.5 overflow-hidden flex-1 min-w-0">
                                      {/* 1. Hierarchy Level 1: Course Code Identifier */}
                                      <div className={`font-bold ${isTripleCol ? 'text-[13px]' : 'text-[14px] sm:text-[15px]'} text-white tracking-tight leading-tight apple-subheadline truncate`}>
                                        {highlightText(card.course.code, gridSearch, true)}
                                      </div>

                                      {/* 1. Hierarchy Level 2: Course Name */}
                                      {card.course.nameEn && card.course.nameEn !== card.course.code && (
                                        <div className={`font-normal ${isTripleCol ? 'text-[10.5px] line-clamp-2' : 'text-[11px] sm:text-[12px] line-clamp-2'} text-white/90 leading-snug`}>
                                          {highlightText(card.course.nameEn, gridSearch, true)}
                                        </div>
                                      )}

                                      {/* 2. Structured Metadata: Section No */}
                                      <div className={`pt-0.5 flex items-center gap-1 ${isTripleCol ? 'text-[11.5px]' : 'text-[12.5px] sm:text-[13px]'} text-white/80`}>
                                        <span className="font-bold text-white">
                                          {highlightText(enrolledSec.sectionNo, gridSearch, true)}
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveItem(card.course.id, enrolledSec.sectionNo);
                                      }}
                                      title="ลบวิชานี้ออกจากตาราง"
                                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-90"
                                    >
                                      <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                    </button>
                                  </div>
                                </div>

                                {/* 3. Bottom Row: Semantic Status Dot + Room Label */}
                                <div className={`pt-2 ${isTripleCol ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-1.5'} text-[11px] sm:text-[12px] min-w-0 overflow-hidden`}>
                                  {/* Semantic Status Dot */}
                                  <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                    <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                                    <span className="font-bold text-white">
                                      {isFull ? 'เต็ม' : `ว่าง ${enrolledSec.availableSeats}`}
                                    </span>
                                  </div>

                                  {enrolledSec.room && (
                                    <span className="text-white/90 font-mono truncate font-medium leading-tight text-[11px] sm:text-[11.5px]">
                                      {highlightText(enrolledSec.room, gridSearch, true)}
                                    </span>
                                  )}

                                  {conflicting && (
                                    <span className="bg-white text-[#FF3B30] text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase w-fit">
                                      ชนกัน!
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
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

        {/* Floating Bottom-Right Corner Controls */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto select-none">
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
          className="fixed z-50 min-w-[150px] bg-white/95 backdrop-blur-md rounded-[12px] border border-black/[0.08] py-1 text-xs animate-in fade-in zoom-in-95 duration-100 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleStartRename(contextMenu.planId, contextMenu.planName)}
            className="w-full px-3 py-2 text-left text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>เปลี่ยนชื่อแผน</span>
          </button>
          {onDuplicatePlan && (
            <button
              onClick={() => {
                onDuplicatePlan(contextMenu.planId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white flex items-center gap-2 transition-colors cursor-pointer group"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>
          )}
          {onResetPlan && (
            <button
              onClick={() => {
                onResetPlan(contextMenu.planId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ตแผนนี้</span>
            </button>
          )}
          {onApplyPreset && (
            <button
              onClick={() => {
                setPresetModalPlan({ planId: contextMenu.planId, planName: contextMenu.planName });
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ใช้ Preset</span>
            </button>
          )}
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

      {/* Floating Remark Text outside card component (Black text, no background, no border, floating above card) */}
      {hoveredRemark && (
        <div
          style={{
            left: `${hoveredRemark.x}px`,
            top: `${hoveredRemark.y}px`,
          }}
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full text-center animate-in fade-in zoom-in-95 duration-100 max-w-[280px] px-2"
        >
          <div className="text-[11.5px] sm:text-[12px] font-normal text-[#1D1D1F] select-none whitespace-pre-line text-center leading-snug drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]">
            {hoveredRemark.text}
          </div>
        </div>
      )}

      {/* Level 2: Interactive Section Picker Popover / Modal */}
      {activeSectionPickerGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveSectionPickerGroup(null)}
        >
          <div
            className="bg-white rounded-[20px] shadow-2xl border border-black/[0.08] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-start justify-between gap-3 bg-[#F5F5F7]/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-[#1D1D1F] apple-headline tracking-tight">
                    {activeSectionPickerGroup.course.code}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-semibold border border-[#0071E3]/20">
                    {activeSectionPickerGroup.sections.length} Sections Available
                  </span>
                </div>
                <p className="text-xs text-[#1D1D1F]/80 font-normal apple-subheadline mt-0.5">
                  {activeSectionPickerGroup.course.nameEn}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[11.5px] font-medium text-[#86868B]">
                  <span>
                    {DAYS_ORDER.find((d) => d.key === activeSectionPickerGroup.day)?.label ||
                      activeSectionPickerGroup.day}
                  </span>
                  <span>·</span>
                  <span>
                    {activeSectionPickerGroup.startTime} – {activeSectionPickerGroup.endTime} น.
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveSectionPickerGroup(null)}
                className="w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-all cursor-pointer active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sections Options List */}
            <div className="px-5 max-h-[60vh] overflow-y-auto divide-y divide-black/[0.06]">
              {[...activeSectionPickerGroup.sections]
                .sort((a, b) => {
                  const availA = a.availableSeats ?? 0;
                  const availB = b.availableSeats ?? 0;
                  if (availA !== availB) {
                    return availB - availA; // Remaining seats first
                  }
                  const totalA = a.totalSeats ?? 0;
                  const totalB = b.totalSeats ?? 0;
                  if (totalA !== totalB) {
                    return totalA - totalB; // เต็มน้อยสุดขึ้นก่อน (เช่น 37, 38, 39, 40, 41)
                  }
                  return (a.sectionNo || '').localeCompare(b.sectionNo || '', undefined, { numeric: true });
                })
                .map((sec) => {
                const isSecFull =
                  sec.availableSeats === 0 || sec.status === 'Freeze' || sec.status === 'Closed';
                const cleanRemark = [sec.remark1, sec.remark2]
                  .filter((r): r is string => Boolean(r && r !== '-'))
                  .map((r) => r.replace(/^[-•\s]+/, '').trim())
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    key={sec.sectionNo}
                    className="py-3.5 flex items-center justify-between gap-3 group hover:bg-black/[0.015] -mx-5 px-5 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[13.5px] text-[#1D1D1F] apple-subheadline">
                          Sec {sec.sectionNo}
                        </span>
                        <span className="text-[11px] font-medium text-[#86868B] bg-black/[0.04] px-2 py-0.5 rounded-md">
                          ห้อง {sec.room || '-'}
                        </span>
                      </div>

                      {/* Seat Status & Remarks */}
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            isSecFull
                              ? 'text-[#FF3B30]'
                              : sec.availableSeats <= 5
                              ? 'text-[#FF9500]'
                              : 'text-[#34C759]'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSecFull
                                ? 'bg-[#FF3B30]'
                                : sec.availableSeats <= 5
                                ? 'bg-[#FF9500]'
                                : 'bg-[#34C759]'
                            }`}
                          />
                          {isSecFull
                            ? 'ที่นั่งเต็ม'
                            : `ว่าง ${sec.availableSeats} / ${sec.totalSeats || '-'}`}
                        </span>

                        {cleanRemark && (
                          <span className="text-[11px] text-[#86868B] font-normal">
                            · {cleanRemark}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => {
                        onAddCourse(activeSectionPickerGroup.course, sec);
                        setActiveSectionPickerGroup(null);
                      }}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold apple-blue-btn shrink-0 transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                    >
                      <span>เลือก Section</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Preset Modal */}
      {presetModalPlan && onApplyPreset && (
        <PresetModal
          isOpen={Boolean(presetModalPlan)}
          onClose={() => setPresetModalPlan(null)}
          planId={presetModalPlan.planId}
          planName={presetModalPlan.planName}
          allCourses={allCourses || []}
          onApplyPreset={onApplyPreset}
        />
      )}
    </div>
  );
};
