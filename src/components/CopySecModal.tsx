'use client';

import React, { useState } from 'react';
import { SelectedCourseItem } from '@/types/schedule';
import { generateUrsaCopyText } from '@/utils/scheduleUtils';
import { Copy, Check, X } from 'lucide-react';

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
      setTimeout(() => setCopied(false), 2000);
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
        <div className="relative px-6 py-4 border-b border-black/[0.06] flex items-center justify-center bg-[#F5F5F7]">
          <h3 className="apple-headline text-[15px] font-semibold text-[#1D1D1F] text-center">
            Export รหัสวิชา & Section
          </h3>

          <button
            onClick={onClose}
            className="absolute right-4 top-3.5 w-7 h-7 rounded-full bg-black/[0.05] hover:bg-black/[0.1] active:scale-95 flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition-all cursor-pointer"
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

          {/* Action Button: Flat Grey Pill with Blue Text (No Shadow) */}
          <div className="flex justify-center pt-1">
            <button
              onClick={handleCopy}
              disabled={items.length === 0}
              className="w-auto px-6 py-2.5 rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] active:bg-black/[0.12] text-[#0071E3] border border-black/[0.06] text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#0071E3] stroke-[2.5]" />
                  <span className="font-semibold text-[#0071E3]">คัดลอกสำเร็จแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span className="apple-subheadline text-[#0071E3]">คัดลอกข้อความไปใช้งาน</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
