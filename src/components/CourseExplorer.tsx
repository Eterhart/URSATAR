'use client';

import React, { useState, useEffect } from 'react';
import { PlanId } from '@/types/schedule';
import { ChevronDown, Search, Loader2, X } from 'lucide-react';
import { UrsaFormControl } from '@/types/ursa';

interface CourseExplorerProps {
  activePlan: PlanId;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExecuteSearch?: (params: { academicYear: string; semester: string; query: string }) => Promise<{ count: number; missingCodes?: string[] } | null | void> | void;
  onClearSearch?: () => void;
  isLoading?: boolean;
  formControls?: UrsaFormControl[];
}

export const CourseExplorer: React.FC<CourseExplorerProps> = ({
  searchQuery,
  onSearchChange,
  onExecuteSearch,
  onClearSearch,
  isLoading = false,
  formControls = [],
}) => {
  const [academicYear, setAcademicYear] = useState('2569');
  const [semester, setSemester] = useState('1');
  const [localInput, setLocalInput] = useState(searchQuery);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'success' | 'not_found'>('idle');
  const [missingCourses, setMissingCourses] = useState<string[]>([]);

  // Discover Year & Semester options from formControls if available
  const yearControl = formControls.find((c) => /year|acdyr/i.test(c.name));
  const semControl = formControls.find((c) => /sem|term/i.test(c.name));

  useEffect(() => {
    setLocalInput(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!localInput.trim()) return;
    setSearchStatus('loading');

    onSearchChange(localInput);
    if (onExecuteSearch) {
      const res = await onExecuteSearch({
        academicYear,
        semester,
        query: localInput,
      });
      if (res && typeof (res as any).count === 'number') {
        const missing = (res as any).missingCodes || [];
        setMissingCourses(missing);
        if ((res as any).count === 0 || missing.length > 0) {
          setSearchStatus('not_found');
        } else {
          setSearchStatus('success');
        }
      } else {
        setSearchStatus('idle');
        setMissingCourses([]);
      }
    }
  };

  const handleClear = () => {
    setLocalInput('');
    onSearchChange('');
    setSearchStatus('idle');
    setMissingCourses([]);
    if (onClearSearch) {
      onClearSearch();
    }
  };

  return (
    <div className="apple-card-light p-3.5 sm:p-5 space-y-4 relative overflow-hidden rounded-[18px]">
      {/* Component-scoped Loading Overlay: 100% card coverage */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center select-none animate-in fade-in duration-150">
          {/* Authentic Apple iOS 12-bar Activity Indicator */}
          <svg
            className="w-7 h-7 animate-spin text-white animate-in zoom-in-95 duration-150"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {[
              0.08, 0.16, 0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75, 0.83, 0.92, 1.0,
            ].map((op, i) => (
              <rect
                key={i}
                x="11"
                y="1.5"
                width="2"
                height="5.5"
                rx="1"
                fill="currentColor"
                opacity={op}
                transform={`rotate(${i * 30} 12 12)`}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="apple-headline text-base text-[#1D1D1F]">
          ค้นหาและเพิ่ม Section
        </h3>
      </div>

      {/* Dropdowns Row: ปีการศึกษา + ภาคเรียน */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            ปีการศึกษา
          </label>
          <div className="relative">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:border-black/[0.2] appearance-none cursor-pointer pr-8 transition-all"
            >
              {yearControl?.options && yearControl.options.length > 0 ? (
                yearControl.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.text}
                  </option>
                ))
              ) : (
                <>
                  <option value="2569">2026 (B.E. 2569)</option>
                  <option value="2568">2025 (B.E. 2568)</option>
                  <option value="2567">2024 (B.E. 2567)</option>
                </>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            ภาคเรียน
          </label>
          <div className="relative">
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:border-black/[0.2] appearance-none cursor-pointer pr-8 transition-all"
            >
              {semControl?.options && semControl.options.length > 0 ? (
                semControl.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.text}
                  </option>
                ))
              ) : (
                <>
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนฤดูร้อน</option>
                </>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Row 2: รหัสวิชา Textarea */}
      <form onSubmit={handleSearchSubmit} autoComplete="on" className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            รหัสวิชา
          </label>

          <div className="relative">
            <input
              type="text"
              id="courseCodes"
              name="courseCodes"
              autoComplete="on"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="กรอกรหัสวิชา เช่น CS101 CS102 MA101"
              className="w-full h-[108px] pt-[14px] pb-[70px] px-[14px] pr-16 bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08] rounded-xl text-xs placeholder-[#86868B] focus:outline-none focus:border-black/[0.2] transition-all apple-subheadline font-semibold"
            />

            {localInput && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full bg-black/10 hover:bg-black/20 text-[#1D1D1F]/70 hover:text-[#1D1D1F] flex items-center justify-center transition-all cursor-pointer active:scale-90"
                title="ล้างข้อความ"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Status Left + Submit Button Right */}
        <div className="flex items-center justify-between pt-1 gap-3">
          <div className="flex-1 min-w-0">
            {searchStatus === 'success' && (
              <span className="text-[#86868B] text-xs font-medium apple-subheadline animate-in fade-in duration-200 block">
                ค้นหาสำเร็จ!
              </span>
            )}
            {searchStatus === 'not_found' && (
              <span className="text-[#86868B] text-xs font-medium apple-subheadline animate-in fade-in duration-200 leading-relaxed break-words block">
                {missingCourses.length > 0
                  ? `ไม่พบวิชา ${missingCourses.join(', ')}`
                  : 'ไม่พบวิชาที่ค้นหา'}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
              isLoading
                ? 'bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed border border-transparent'
                : 'apple-blue-btn'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-white" />
            <span className="apple-subheadline">ค้นหารายวิชา</span>
          </button>
        </div>
      </form>
    </div>
  );
};
