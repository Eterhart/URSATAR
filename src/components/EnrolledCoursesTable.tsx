'use client';

import React from 'react';
import { Course, SelectedCourseItem } from '@/types/schedule';
import { Copy } from 'lucide-react';

interface EnrolledCoursesTableProps {
  searchedCourses: Course[];
  selectedItems: SelectedCourseItem[];
  onOpenCopyModal?: () => void;
}

export const EnrolledCoursesTable: React.FC<EnrolledCoursesTableProps> = ({
  searchedCourses,
  selectedItems,
  onOpenCopyModal,
}) => {
  // Enrolled courses present in selectedItems
  const enrolledCourses = searchedCourses.filter((c) =>
    selectedItems.some((it) => it.course.id === c.id)
  );

  return (
    <div className="apple-card-light p-3.5 sm:p-5 space-y-4 sm:space-y-5">
      {/* Header (Title + Copy Code & Sec) */}
      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] flex-wrap gap-2">
        <h3 className="apple-headline text-[15px] text-[#1D1D1F] flex items-center gap-2">
          <span>วิชาที่เลือกแล้ว</span>
          <span className="text-xs font-normal text-[#86868B]">
            {enrolledCourses.length} วิชา
          </span>
        </h3>

        {onOpenCopyModal && (
          <button
            type="button"
            onClick={onOpenCopyModal}
            className="flex items-center gap-1.5 text-[#0071E3] hover:text-[#0077ED] active:scale-95 text-xs font-medium transition-all duration-200 cursor-pointer hover:underline px-1 py-1"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="apple-subheadline">Copy Code & Sec</span>
          </button>
        )}
      </div>

      {/* Main Enrolled Courses Table */}
      {enrolledCourses.length > 0 ? (
        <div className="space-y-5">
          {enrolledCourses.map((course) => {
            const selectedItem = selectedItems.find((it) => it.course.id === course.id);
            if (!selectedItem) return null;
            const sec = selectedItem.section;
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

            const courseCredit = course.credits ?? 3;

            return (
              <div key={course.id} className="space-y-2">
                {/* Course Header */}
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-bold text-sm text-[#1D1D1F] apple-headline">
                    {course.code}
                  </span>
                  {course.nameEn && course.nameEn !== course.code && (
                    <span className="apple-subheadline font-semibold text-sm text-[#1D1D1F]">
                      {course.nameEn}
                    </span>
                  )}
                  {course.nameTh && (
                    <span className="text-xs text-[#86868B] font-normal">
                      ({course.nameTh})
                    </span>
                  )}
                  <span className="text-xs font-medium text-[#86868B]">
                    {courseCredit} หน่วยกิต
                  </span>
                </div>

                {/* Table with Pixel-Perfect Matching Column Alignment & Generous Remark Widths */}
                <div className="overflow-x-auto no-scrollbar touch-pan-x rounded-[14px] border border-black/[0.08] bg-white">
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
                    <thead className="bg-[#F5F5F7] text-[#6E6E73] font-semibold border-b border-black/[0.06] text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Section</th>
                        <th className="py-2.5 px-3 text-center">Seat(s)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Type</th>
                        <th className="py-2.5 px-3 text-center">Day</th>
                        <th className="py-2.5 px-3 text-center">Time</th>
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-4">Remark2</th>
                        <th className="py-2.5 px-4">Remark1</th>
                        <th className="py-2.5 px-4">Examination</th>
                        <th className="py-2.5 px-4">Restriction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] text-[11px]">
                      <tr className="bg-white hover:bg-black/[0.02] text-[#1D1D1F] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#1D1D1F]">
                          {sec.sectionNo}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {sec.availableSeats === 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30 text-[10px]">
                              เต็ม (0/{sec.totalSeats})
                            </span>
                          ) : (
                            <span className="text-[#248A3D]">
                              {sec.availableSeats} / {sec.totalSeats}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#6E6E73]">
                          {sec.status || 'On'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#1D1D1F]">
                          {sec.type || type}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#1D1D1F]">
                          {dayFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#1D1D1F]">
                          {sec.startTime}-{sec.endTime}
                        </td>
                        <td className="py-2.5 px-3 text-[#1D1D1F] font-sans">{sec.room}</td>
                        <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark2 || '-'}>{sec.remark2 || '-'}</td>
                        <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.remark1 || '-'}>{sec.remark1 || '-'}</td>
                        <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.examination || sec.midtermDate || '-'}>{sec.examination || sec.midtermDate || '-'}</td>
                        <td className="py-2.5 px-4 text-[#86868B] truncate" title={sec.restriction || '-'}>{sec.restriction || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 px-4 text-xs text-[#86868B] bg-[#F5F5F7] rounded-[14px] border border-black/[0.04] text-center apple-subheadline">
          ยังไม่มีวิชาที่เลือกในแผนนี้ (คลิกเลือกวิชาได้จากตารางเรียนด้านบน)
        </div>
      )}
    </div>
  );
};
