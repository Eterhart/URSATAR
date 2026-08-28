'use client';

import React from 'react';
import { Course, SelectedCourseItem } from '@/types/schedule';
import { Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface ActiveCoursesListProps {
  searchedCourses: Course[];
  selectedItems: SelectedCourseItem[];
  hoveredCourseId?: string | null;
  onHoverCourse?: (id: string | null) => void;
  onOpenCopyModal?: () => void;
  onResetPlan?: () => void;
  hiddenSections?: Record<string, boolean>;
  onToggleHideSections?: (keys: string[], hide?: boolean) => void;
}

export const ActiveCoursesList: React.FC<ActiveCoursesListProps> = ({
  searchedCourses,
  selectedItems,
  hoveredCourseId,
  onHoverCourse,
  onOpenCopyModal,
  onResetPlan,
  hiddenSections = {},
  onToggleHideSections,
}) => {
  // Deduplicate courses by course ID
  const uniqueCourses = React.useMemo(() => {
    const map = new Map<string, Course>();
    (searchedCourses || []).forEach((c) => {
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  }, [searchedCourses]);

  const listContainerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const isMouseInsideListRef = React.useRef(false);

  // Auto-scroll hovered course smoothly to the top ONLY when hovering cards on the Calendar
  React.useEffect(() => {
    if (isMouseInsideListRef.current) return;

    if (hoveredCourseId && itemRefs.current[hoveredCourseId] && listContainerRef.current) {
      const container = listContainerRef.current;
      const target = itemRefs.current[hoveredCourseId];
      if (target) {
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        const offset = targetTop - containerTop + container.scrollTop;

        container.scrollTo({
          top: Math.max(0, offset - 12),
          behavior: 'smooth',
        });
      }
    }
  }, [hoveredCourseId]);

  if (uniqueCourses.length === 0) return null;

  return (
    <div className="apple-card-light p-3.5 sm:p-5 space-y-4 relative overflow-hidden rounded-[18px] w-full">
      {/* Header with Title + Reset Button (Left) and Copy Code & Sec (Far Right) */}
      <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="apple-headline text-[15px] text-[#1D1D1F]">
            วิชาที่แสดงอยู่ ณ ขณะนี้
          </h4>
          <span className="text-xs font-normal text-[#86868B]">
            {uniqueCourses.length} วิชา
          </span>
          {onResetPlan && selectedItems.length > 0 && (
            <button
              onClick={onResetPlan}
              className="p-1 text-[#86868B] hover:text-[#1D1D1F] transition-colors duration-150 cursor-pointer active:scale-90 ml-0.5"
              title="ล้างวิชาทั้งหมดในแผนนี้"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Button (Far Right): Copy Code & Sec */}
        <div>
          {onOpenCopyModal && (
            <button
              onClick={onOpenCopyModal}
              className="flex items-center gap-1.5 text-[#0071E3] hover:text-[#0077ED] active:scale-95 text-xs font-medium transition-all duration-200 cursor-pointer hover:underline px-1 py-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="apple-subheadline">Copy Code & Sec</span>
            </button>
          )}
        </div>
      </div>

      {/* List of Courses with Bidirectional Hover Highlight & Hide in Calendar Toggle */}
      <div
        ref={listContainerRef}
        onMouseEnter={() => {
          isMouseInsideListRef.current = true;
        }}
        onMouseLeave={() => {
          isMouseInsideListRef.current = false;
        }}
        onTouchStart={() => {
          isMouseInsideListRef.current = true;
        }}
        className="space-y-2 max-h-[480px] overflow-y-auto py-0.5 scroll-smooth no-scrollbar w-full"
      >
        {uniqueCourses.map((course, index) => {
          const selectedItem = selectedItems.find((it) => it.course.id === course.id);
          const isEnrolled = !!selectedItem;
          const isHighlighted = hoveredCourseId === course.id;

          const courseSectionKeys = course.sections.map((s) => `${course.id}_${s.sectionNo}`);
          const allHidden =
            courseSectionKeys.length > 0 && courseSectionKeys.every((k) => hiddenSections[k]);
          const hiddenCount = courseSectionKeys.filter((k) => hiddenSections[k]).length;

          return (
            <div
              key={`${course.id}-${index}`}
              ref={(el) => {
                itemRefs.current[course.id] = el;
              }}
              onMouseEnter={() => onHoverCourse && onHoverCourse(course.id)}
              onMouseLeave={() => onHoverCourse && onHoverCourse(null)}
              className={`w-full px-3.5 py-3 rounded-xl transition-all duration-150 ease-out flex items-center justify-between gap-3 cursor-pointer select-none ${
                allHidden
                  ? 'bg-black/[0.02] opacity-40'
                  : isHighlighted
                  ? 'bg-[#F5F5F7] shadow-xs'
                  : 'bg-[#F5F5F7] hover:bg-black/[0.03]'
              }`}
            >
              {/* Left: Eye Button + Course Code & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Hide / Unhide Course in Calendar Toggle Button (Leftmost) */}
                {onToggleHideSections && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHideSections(courseSectionKeys, !allHidden);
                    }}
                    title={allHidden ? 'คลิกเพื่อแสดงในปฏิทิน' : 'คลิกเพื่อซ่อนในปฏิทิน'}
                    className={`p-0.5 shrink-0 transition-colors cursor-pointer active:scale-90 ${
                      isEnrolled
                        ? 'text-[#0071E3] hover:text-[#0077ED]'
                        : 'text-[#86868B] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {allHidden || hiddenCount > 0 ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                <span
                  className={`text-xs shrink-0 apple-subheadline font-medium transition-colors ${
                    allHidden
                      ? 'line-through text-[#86868B]'
                      : isEnrolled
                      ? 'text-[#0071E3]'
                      : 'text-[#1D1D1F]'
                  }`}
                >
                  {course.code}
                </span>

                <div className="min-w-0">
                  <p
                    className={`text-xs truncate apple-subheadline font-medium leading-tight transition-colors ${
                      allHidden
                        ? 'line-through text-[#86868B]'
                        : isEnrolled
                        ? 'text-[#0071E3]'
                        : 'text-[#1D1D1F]/80'
                    }`}
                  >
                    {course.nameEn}
                  </p>
                </div>
              </div>

              {/* Right: Status Badge (Transparent with Blue Stroke & Blue Text) */}
              <div className="shrink-0 flex items-center">
                {isEnrolled ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium apple-subheadline bg-transparent border border-[#0071E3] text-[#0071E3] leading-normal">
                    Sec {selectedItem.section.sectionNo}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium apple-subheadline bg-white text-[#86868B] border border-black/[0.06] leading-normal">
                    ยังไม่เลือก
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
