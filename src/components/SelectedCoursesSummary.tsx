'use client';

import React from 'react';
import { SelectedCourseItem } from '@/types/schedule';
import { calculateTotalCredits, DAYS_ORDER } from '@/utils/scheduleUtils';
import { Trash2, Coins, GraduationCap } from 'lucide-react';

interface SelectedCoursesSummaryProps {
  items: SelectedCourseItem[];
  planName: string;
  onRemoveItem: (courseId: string, sectionNo: string) => void;
  onOpenCopyModal: () => void;
}

export const SelectedCoursesSummary: React.FC<SelectedCoursesSummaryProps> = ({
  items,
  planName,
  onRemoveItem,
  onOpenCopyModal,
}) => {
  const totalCredits = calculateTotalCredits(items);
  const maxCredits = 22;
  const minCredits = 9;
  const creditPercent = Math.min(100, (totalCredits / maxCredits) * 100);

  // Estimating tuition: approx 2,200 THB per credit + 6,500 THB base fee
  const estimatedTuition = totalCredits > 0 ? (totalCredits * 2200 + 6500).toLocaleString() : '0';

  return (
    <div className="bg-[#181B20] border border-white/10 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Header & Credit Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-white" />
            <h4 className="font-bold text-sm text-white">
              สรุปรายวิชาที่เลือกใน {planName} ({items.length} วิชา)
            </h4>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            เกณฑ์ลงทะเบียนปกติ: {minCredits} - {maxCredits} หน่วยกิต / ภาคเรียน
          </p>
        </div>

        {/* Credit Meter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-neutral-400">หน่วยกิตรวม:</span>
            <div className="font-extrabold text-base text-white">
              {totalCredits} <span className="text-xs font-normal text-neutral-400">/ {maxCredits} นก.</span>
            </div>
          </div>
          <div className="w-24 h-3 bg-[#111317] rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-300 ${
                totalCredits > maxCredits
                  ? 'bg-red-500'
                  : totalCredits >= minCredits
                  ? 'bg-white'
                  : 'bg-amber-400'
              }`}
              style={{ width: `${creditPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Selected Items Table / Cards */}
      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-neutral-500">
          ยังไม่มีวิชาที่เลือกในแผนนี้
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map((item) => {
              const dayObj = DAYS_ORDER.find((d) => d.key === item.section.day);

              return (
                <div
                  key={`${item.course.id}-${item.section.sectionNo}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#1C2026] hover:bg-[#222730] hover:border-white/15 transition-all text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: item.course.color }}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{item.course.code}</span>
                        <span className="text-[10px] bg-white/10 text-neutral-300 px-1.5 py-0.2 rounded font-semibold border border-white/10">
                          Sec {item.section.sectionNo}
                        </span>
                        <span className="text-[10px] text-neutral-400">({item.course.credits} นก.)</span>
                      </div>
                      <div className="text-[11px] text-neutral-300 truncate">
                        {item.course.nameTh}
                      </div>
                      <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-neutral-300">{dayObj?.labelTh}</span>
                        <span>{item.section.startTime}-{item.section.endTime}</span>
                        <span>• {item.section.room}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.course.id, item.section.sectionNo)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition-colors shrink-0 ml-2"
                    title="ลบวิชานี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Footer Stats & Copy trigger */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[#14161A] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-neutral-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>ประมาณการค่าธรรมเนียมการศึกษาเทอมนี้:</span>
              <strong className="text-white font-bold">~{estimatedTuition} บาท</strong>
            </div>

            <button
              onClick={onOpenCopyModal}
              className="text-white hover:text-slate-300 font-bold text-xs flex items-center gap-1 hover:underline"
            >
              คัดลอกรหัสวิชา & Section ทั้งหมด →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
