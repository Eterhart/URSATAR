'use client';

import React, { useState } from 'react';
import { SelectedCourseItem } from '@/types/schedule';
import { toPng } from 'html-to-image';
import { Download, X, Image as ImageIcon, Calendar, Check, AlertCircle } from 'lucide-react';
import { calculateTotalCredits } from '@/utils/scheduleUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SelectedCourseItem[];
  planName: string;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  items,
  planName,
  gridRef,
}) => {
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const totalCredits = calculateTotalCredits(items);

  const handleDownloadImage = async () => {
    if (!gridRef.current) return;
    try {
      setIsExportingImage(true);
      const dataUrl = await toPng(gridRef.current, { cacheBust: true, quality: 0.95 });
      const link = document.createElement('a');
      link.download = `BU-Schedule-${planName}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export image: ', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleDownloadIcs = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bangkok University//Course Schedule Planner//TH',
      'CALSCALE:GREGORIAN',
    ];

    items.forEach((it) => {
      const summary = `[${it.course.code}] ${it.course.nameTh} (Sec ${it.section.sectionNo})`;
      const description = `ห้อง: ${it.section.room} | ผู้สอน: ${it.section.instructor} | ${it.course.credits} หน่วยกิต`;
      const location = `${it.section.room}, BU Main Campus`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`SUMMARY:${summary}`);
      icsContent.push(`DESCRIPTION:${description}`);
      icsContent.push(`LOCATION:${location}`);
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `BU-Schedule-${planName}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#181B20] text-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/10 transform animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#121417] p-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide text-white">
                Export ตารางเรียน
              </h3>
              <p className="text-xs text-neutral-400 font-light">
                {planName} • รวม {items.length} วิชา ({totalCredits} นก.)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {items.length === 0 ? (
            <div className="p-6 text-center bg-[#121417] rounded-2xl border border-dashed border-white/10">
              <AlertCircle className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-400">ยังไม่มีรายวิชาในแผนนี้</p>
              <p className="text-xs text-neutral-600 mt-1">เพิ่มวิชาลงในตารางก่อนทำการ Export</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Option 1: Image Export */}
              <div className="p-4 rounded-2xl border border-white/10 bg-[#14161A] hover:border-white/20 transition-all space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/10">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">ดาวน์โหลดเป็นรูปภาพ (PNG)</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      บันทึกภาพตารางเรียนความละเอียดสูง เหมาะสำหรับตั้งเป็นวอลเปเปอร์มือถือหรือส่งให้เพื่อน
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadImage}
                  disabled={isExportingImage}
                  className="bu-silver-btn w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingImage ? (
                    <span>กำลังสร้างรูปภาพ...</span>
                  ) : downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">ดาวน์โหลดสำเร็จ!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#0F172A]" />
                      <span>ดาวน์โหลดภาพ PNG</span>
                    </>
                  )}
                </button>
              </div>

              {/* Option 2: ICS Calendar */}
              <div className="p-4 rounded-2xl border border-white/10 bg-[#14161A] hover:border-white/20 transition-all space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/10">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">เพิ่มเข้าปฏิทิน (.ics)</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      นำเข้าตารางเรียนไปยัง Google Calendar, Apple Calendar, Outlook
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadIcs}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#22262E] hover:bg-[#2C313C] text-white font-bold text-xs transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์ .ics</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-neutral-400 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
