'use client';

import React from 'react';
import { TimeConflict } from '@/types/schedule';
import { AlertCircle } from 'lucide-react';

interface ConflictBannerProps {
  conflicts: TimeConflict[];
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="w-full bg-[#FF3B30]/10 border-b border-[#FF3B30]/20 py-2 px-4 sm:px-6 lg:px-8 xl:px-10 text-[#FF3B30] text-[12px] select-none animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="max-w-[1600px] mx-auto flex items-center justify-center gap-2 flex-wrap text-center">
        <div className="flex items-center gap-1.5 font-bold apple-headline shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#FF3B30]" />
          <span>พบวิชาที่เวลาเรียนซ้อนทับกัน ({conflicts.length} จุด):</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center text-[#FF3B30]/95 font-medium">
          {conflicts.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <strong>{c.courseA.code} (Sec {c.sectionA.sectionNo})</strong> ชนกับ{' '}
              <strong>{c.courseB.code} (Sec {c.sectionB.sectionNo})</strong> ในวัน{c.sectionA.day} เวลา {c.sectionA.startTime}-{c.sectionA.endTime}
              {i < conflicts.length - 1 && <span className="text-[#FF3B30]/30 mx-1.5">|</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
