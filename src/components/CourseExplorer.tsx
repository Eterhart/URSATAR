'use client';

import React, { useState, useEffect } from 'react';
import { PlanId } from '@/types/schedule';
import { ChevronDown, Search, Loader2 } from 'lucide-react';
import { UrsaFormControl } from '@/types/ursa';

interface CourseExplorerProps {
  activePlan: PlanId;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExecuteSearch?: (params: { academicYear: string; semester: string; query: string }) => Promise<{ count: number; missingCodes?: string[] } | null | void> | void;
  isLoading?: boolean;
  formControls?: UrsaFormControl[];
}

export const CourseExplorer: React.FC<CourseExplorerProps> = ({
  searchQuery,
  onSearchChange,
  onExecuteSearch,
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
  };

  return (
    <div className="apple-card-light p-3.5 sm:p-5 space-y-4 relative overflow-hidden rounded-[18px]">
      {/* Component-scoped Loading Overlay: 100% card coverage */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center select-none animate-in fade-in duration-150">
          <div className="flex items-center gap-3 text-white animate-in zoom-in-95 duration-150">
            <Loader2 className="w-6 h-6 animate-spin text-[#2997FF]" />
            <span className="apple-headline text-lg font-semibold tracking-wider text-white">
              Loading...
            </span>
          </div>
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
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:border-[#0071E3] appearance-none cursor-pointer pr-8 transition-all"
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
              className="w-full bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] focus:outline-none focus:border-[#0071E3] appearance-none cursor-pointer pr-8 transition-all"
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
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#86868B] block apple-subheadline">
            รหัสวิชา
          </label>

          <div className="relative">
            <textarea
              rows={4}
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder={"กรอกรหัสวิชา (รองรับหลายบรรทัด / เว้นวรรค) เช่น:\nCS101 CS102\nMA101"}
              className="w-full p-3.5 bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08] rounded-xl text-xs placeholder-[#86868B] focus:outline-none focus:border-[#0071E3] transition-all apple-subheadline font-medium leading-relaxed resize-y"
            />

            {localInput && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-2.5 text-[11px] text-[#86868B] hover:text-[#1D1D1F] bg-white hover:bg-black/[0.05] border border-black/10 px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer active:scale-95"
                title="ล้างข้อความ"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Status Left + Submit Button Right */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center min-h-[28px] max-w-[200px] truncate">
            {searchStatus === 'success' && (
              <span className="text-[#86868B] text-xs font-medium apple-subheadline animate-in fade-in duration-200">
                ค้นหาสำเร็จ!
              </span>
            )}
            {searchStatus === 'not_found' && (
              <span
                className="text-[#86868B] text-xs font-medium apple-subheadline animate-in fade-in duration-200 truncate"
                title={missingCourses.length > 0 ? `ไม่พบวิชา ${missingCourses.join(', ')}` : 'ไม่พบวิชาที่ค้นหา'}
              >
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
