'use client';

import React from 'react';
import { Course, Section, SelectedCourseItem } from '@/types/schedule';
import { CheckCircle2, ListFilter } from 'lucide-react';

interface UrsaSectionTableProps {
  searchedCourses: Course[];
  selectedItems: SelectedCourseItem[];
}

export const UrsaSectionTable: React.FC<UrsaSectionTableProps> = ({
  searchedCourses,
  selectedItems,
}) => {
  if (searchedCourses.length === 0) return null;

  // Split into 2 categories: Enrolled vs Unselected
  const enrolledCourses = searchedCourses.filter((course) =>
    selectedItems.some((it) => it.course.id === course.id)
  );

  const unselectedCourses = searchedCourses.filter(
    (course) => !selectedItems.some((it) => it.course.id === course.id)
  );

  const renderCourseTable = (course: Course, isEnrolled: boolean) => {
    const selectedItem = selectedItems.find((it) => it.course.id === course.id);
    const displayedSections: Section[] = isEnrolled && selectedItem
      ? [selectedItem.section]
      : course.sections;

    return (
      <div key={course.id} className="space-y-2">
        {/* Header: CS446 Cloud Computing */}
        <div className="flex items-center gap-3 py-1">
          <span
            className="font-bold text-sm text-white px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${course.color}33`, border: `1px solid ${course.color}88` }}
          >
            {course.code}
          </span>
          <span className="font-semibold text-sm text-neutral-200">
            {course.nameEn}
          </span>
        </div>

        {/* URSA Exact Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#121417]">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#16181D] text-neutral-300 font-bold border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Section</th>
                <th className="py-2.5 px-3 text-center">Seat(s)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Type</th>
                <th className="py-2.5 px-3 text-center">Day</th>
                <th className="py-2.5 px-3 text-center">Time</th>
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Remark2</th>
                <th className="py-2.5 px-3">Remark1</th>
                <th className="py-2.5 px-3">Examination</th>
                <th className="py-2.5 px-3">Restriction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {displayedSections.map((sec) => {
                const isThisSelected = isEnrolled && selectedItem?.section.sectionNo === sec.sectionNo;
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
                    className={`transition-colors ${
                      isThisSelected
                        ? 'bg-emerald-950/20 text-white font-bold'
                        : 'text-neutral-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-white">
                      {sec.sectionNo}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {sec.availableSeats === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800 text-[10px]">
                          เต็ม (0/{sec.totalSeats})
                        </span>
                      ) : (
                        <span className="text-emerald-400">
                          {sec.availableSeats} / {sec.totalSeats}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-300">
                      On
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-neutral-200">
                      {type}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">
                      {dayFormatted}
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-200">
                      {sec.startTime}-{sec.endTime}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300">{sec.room}</td>
                    <td className="py-2.5 px-3 text-neutral-400">-</td>
                    <td className="py-2.5 px-3 text-neutral-400">-</td>
                    <td className="py-2.5 px-3 text-neutral-400">-</td>
                    <td className="py-2.5 px-3 text-neutral-400">- R All All TP Both</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#181B20] border border-white/10 rounded-2xl shadow-xl overflow-hidden p-4 sm:p-5 space-y-8">
      {/* Category 1: วิชาที่เลือกแล้ว */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide flex items-center gap-2">
            <span>วิชาที่เลือกแล้ว</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-700">
              {enrolledCourses.length} วิชา
            </span>
          </h3>
        </div>

        {enrolledCourses.length > 0 ? (
          <div className="space-y-5">
            {enrolledCourses.map((course) => renderCourseTable(course, true))}
          </div>
        ) : (
          <div className="py-4 px-4 text-xs text-neutral-400 bg-[#121417] rounded-xl border border-white/5 text-center">
            ยังไม่มีวิชาที่เลือกในแผนนี้ (คลิกเลือกวิชาได้จากตารางเรียนด้านบน)
          </div>
        )}
      </div>

      {/* Category 2: วิชาที่ยังไม่ได้เลือก */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide flex items-center gap-2">
            <span>วิชาที่ยังไม่ได้เลือก</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-white/10 text-neutral-300 border border-white/15">
              {unselectedCourses.length} วิชา
            </span>
          </h3>
        </div>

        {unselectedCourses.length > 0 ? (
          <div className="space-y-5">
            {unselectedCourses.map((course) => renderCourseTable(course, false))}
          </div>
        ) : (
          <div className="py-4 px-4 text-xs text-emerald-400 bg-emerald-950/20 rounded-xl border border-emerald-800/30 text-center font-bold">
            ✓ คุณเลือกครบทุกวิชาในรายการค้นหาแล้ว
          </div>
        )}
      </div>
    </div>
  );
};
