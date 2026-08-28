'use client';

import React, { useState, useMemo } from 'react';
import { Course, PlanId } from '@/types/schedule';
import { parseUrsaPresetText, ParsedPresetEntry } from '@/utils/scheduleUtils';
import { X, Check, ArrowRight, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: PlanId;
  planName: string;
  allCourses: Course[];
  onApplyPreset: (planId: PlanId, entries: ParsedPresetEntry[]) => Promise<{ appliedCount: number; missing: string[] }>;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  planId,
  planName,
  allCourses,
  onApplyPreset,
}) => {
  const [inputText, setInputText] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const parsedEntries = useMemo(() => {
    return parseUrsaPresetText(inputText);
  }, [inputText]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (parsedEntries.length === 0) return;
    setIsApplying(true);
    setResultMessage(null);

    try {
      const { appliedCount, missing } = await onApplyPreset(planId, parsedEntries);
      if (appliedCount > 0 && missing.length === 0) {
        setResultMessage({
          type: 'success',
          text: `นำเข้า ${appliedCount} รายวิชาเข้าสู่ ${planName} เรียบร้อยแล้ว`,
        });
        setTimeout(() => {
          onClose();
          setInputText('');
          setResultMessage(null);
        }, 1200);
      } else if (appliedCount > 0 && missing.length > 0) {
        setResultMessage({
          type: 'warning',
          text: `นำเข้า ${appliedCount} วิชาแล้ว (ไม่พบข้อมูล: ${missing.join(', ')})`,
        });
        setTimeout(() => {
          onClose();
          setInputText('');
          setResultMessage(null);
        }, 2200);
      } else {
        setResultMessage({
          type: 'error',
          text: `ไม่พบข้อมูล Section หรือรายวิชาที่ระบุ: ${missing.join(', ')}`,
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err?.message || 'เกิดข้อผิดพลาดในการนำเข้า Preset',
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer select-none"
    >
      <div
        className="bg-white text-[#1D1D1F] w-full max-w-lg rounded-[22px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 cursor-default border border-black/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
          <div>
            <h3 className="apple-headline text-[16px] font-bold text-[#1D1D1F]">
              ใช้ Preset สำหรับ {planName}
            </h3>
            <p className="text-xs text-[#86868B] mt-0.5">
              วางข้อความที่ได้จาก Export รหัสวิชา & Section
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/[0.05] hover:bg-black/[0.1] active:scale-95 flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition-all cursor-pointer"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 bg-white">
          {/* Text Area Input */}
          <div className="space-y-2">
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (resultMessage) setResultMessage(null);
              }}
              placeholder={`วางข้อความ เช่น:\nCS446 Web Application Development : 427A : 08:40-11:00\nEN103 English for Communication : 318B : 12:00-14:20\n\nหรือพิมพ์แบบย่อ:\nCS446 427A\nEN103 318B`}
              className="w-full p-3.5 rounded-xl bg-[#F5F5F7] border border-black/[0.1] text-[#1D1D1F] font-mono text-xs sm:text-[12.5px] leading-relaxed focus:outline-none focus:border-black/30 transition-all placeholder:text-[#86868B]/70 resize-none"
              autoFocus
            />
          </div>

          {/* Real-time Parsed Preview */}
          {parsedEntries.length > 0 && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-[#86868B]">
                <span className="font-medium text-[#1D1D1F]">
                  ตรวจพบ <strong className="text-[#0071E3] font-bold">{parsedEntries.length}</strong> รายวิชา:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#FAFAFC] rounded-lg border border-black/[0.04]">
                {parsedEntries.map((pe, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-black/[0.08] text-[11.5px] font-semibold text-[#1D1D1F] shadow-2xs"
                  >
                    <span>{pe.courseCode}</span>
                    <span className="text-[#86868B] font-normal">·</span>
                    <span className="text-[#0071E3]">{pe.sectionNo}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Message */}
          {resultMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150 ${
                resultMessage.type === 'success'
                  ? 'bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/20'
                  : resultMessage.type === 'warning'
                  ? 'bg-[#FF9500]/10 text-[#C97700] border border-[#FF9500]/20'
                  : 'bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/20'
              }`}
            >
              {resultMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || parsedEntries.length === 0}
              className="px-6 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-none"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังนำเข้า...</span>
                </>
              ) : (
                <>
                  <span>ใช้ Preset นี้</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};