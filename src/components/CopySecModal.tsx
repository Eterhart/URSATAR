'use client';

import React, { useState } from 'react';
import { SelectedCourseItem } from '@/types/schedule';
import { generateUrsaCopyText } from '@/utils/scheduleUtils';
import { Copy, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CopySecModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SelectedCourseItem[];
  planName: string;
}

export const CopySecModal: React.FC<CopySecModalProps> = ({
  isOpen,
  onClose,
  items,
  planName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const exportText = generateUrsaCopyText(items, planName);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#0071E3', '#34C759', '#1D1D1F', '#86868B'],
      });

      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        className="bg-white text-[#1D1D1F] w-full max-w-lg rounded-[22px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 cursor-default border border-black/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-white border border-black/[0.08] text-[#0071E3]">
              <Copy className="w-4 h-4" />
            </div>
            <h3 className="apple-headline text-[15px] text-[#1D1D1F]">
              Export รหัสวิชา & Section
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/[0.05] hover:bg-black/[0.1] active:scale-95 flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition-all cursor-pointer"
            title="ปิด"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 bg-white">
          {/* Formatted Text Box */}
          <div className="relative">
            <pre className="p-4 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-[#1D1D1F] font-mono text-xs sm:text-[12.5px] font-semibold leading-relaxed overflow-x-auto select-all whitespace-pre-wrap">
              {exportText || '# ยังไม่มีรายวิชาที่เลือกลงในแผนนี้'}
            </pre>
          </div>

          {/* Action Button: Apple Action Blue Pill */}
          <button
            onClick={handleCopy}
            disabled={items.length === 0}
            className="apple-blue-btn w-full py-3 text-xs tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#34C759]" />
                <span className="text-white font-bold">คัดลอกสำเร็จแล้ว! 🎉</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-white" />
                <span className="apple-subheadline">คัดลอกข้อความไปใช้งาน</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
