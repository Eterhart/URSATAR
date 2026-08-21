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
  if (searchedCourses.length === 0) return null;

  return (
    <div className="apple-card-light p-3.5 sm:p-5 space-y-4">
      {/* Header with Title + Copy Code & Sec + Reset Button */}
      <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="apple-headline text-[15px] text-[#1D1D1F]">
            วิชาที่แสดงอยู่ ณ ขณะนี้
          </h4>
          <span className="text-xs font-normal text-[#86868B]">
            {searchedCourses.length} วิชา
          </span>
        </div>

        {/* Action Buttons: Copy Code & Sec + Reset Plan */}
        <div className="flex items-center gap-2">
          {onOpenCopyModal && (
            <button
              onClick={onOpenCopyModal}
              className="flex items-center gap-1.5 text-[#0071E3] hover:text-[#0077ED] active:scale-95 text-xs font-medium transition-all duration-200 cursor-pointer hover:underline px-1 py-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="apple-subheadline">Copy Code & Sec</span>
            </button>
          )}

          {onResetPlan && selectedItems.length > 0 && (
            <button
              onClick={onResetPlan}
              className="p-1 text-[#86868B] hover:text-[#1D1D1F] transition-colors duration-150 cursor-pointer active:scale-90"
              title="ล้างวิชาทั้งหมดในแผนนี้"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List of Courses with Bidirectional Hover Highlight & Hide in Calendar Toggle */}
      <div className="space-y-2">
        {searchedCourses.map((course) => {
          const selectedItem = selectedItems.find((it) => it.course.id === course.id);
          const isEnrolled = !!selectedItem;
          const isHighlighted = hoveredCourseId === course.id;

          const courseSectionKeys = course.sections.map((s) => `${course.id}_${s.sectionNo}`);
          const allHidden =
            courseSectionKeys.length > 0 && courseSectionKeys.every((k) => hiddenSections[k]);
          const hiddenCount = courseSectionKeys.filter((k) => hiddenSections[k]).length;

          return (
            <div
              key={course.id}
              onMouseEnter={() => onHoverCourse && onHoverCourse(course.id)}
              onMouseLeave={() => onHoverCourse && onHoverCourse(null)}
              className={`p-3 rounded-[14px] transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer select-none ${
                allHidden
                  ? 'bg-black/[0.02] border border-black/[0.06] opacity-50'
                  : isHighlighted
                  ? 'border-2 border-[#0071E3] bg-[#0071E3]/[0.08] scale-[1.01]'
                  : isEnrolled
                  ? 'bg-white border-2 border-[#0071E3] hover:bg-[#0071E3]/[0.02]'
                  : 'bg-white border border-black/[0.08] hover:border-[#0071E3]/60 hover:bg-[#0071E3]/[0.02]'
              }`}
            >
              {/* Left: Course Code & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`font-bold text-xs shrink-0 transition-colors apple-subheadline ${
                    allHidden
                      ? 'line-through text-[#86868B]'
                      : isHighlighted || isEnrolled
                      ? 'text-[#0071E3]'
                      : 'text-[#1D1D1F]'
                  }`}
                >
                  {course.code}
                </span>

                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold truncate apple-subheadline leading-tight transition-colors ${
                      allHidden
                        ? 'line-through text-[#86868B]'
                        : isHighlighted
                        ? 'text-[#0071E3]'
                        : 'text-[#1D1D1F]'
                    }`}
                  >
                    {course.nameEn}
                  </p>
                </div>
              </div>

              {/* Right: Status Pill & Hide in Calendar Toggle */}
              <div className="shrink-0 flex items-center gap-2">
                {isEnrolled ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0071E3] text-white">
                    Sec {selectedItem.section.sectionNo}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F7] text-[#86868B] border border-[#E5E5EA]">
                    ยังไม่เลือก
                  </span>
                )}

                {/* Hide / Unhide Course in Calendar Toggle Button */}
                {onToggleHideSections && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHideSections(courseSectionKeys, !allHidden);
                    }}
                    title={allHidden ? 'คลิกเพื่อแสดงในปฏิทิน' : 'คลิกเพื่อซ่อนในปฏิทิน'}
                    className="p-1 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer active:scale-90"
                  >
                    {allHidden || hiddenCount > 0 ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
