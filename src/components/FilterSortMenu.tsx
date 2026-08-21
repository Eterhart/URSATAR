'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ListFilter, RotateCcw, X } from 'lucide-react';
import { SeatFilterMap, SeatFilterKey } from '@/app/page';

export type SortOption =
  | 'default'
  | 'section-asc'
  | 'section-desc'
  | 'seats-desc'
  | 'seats-asc'
  | 'day-time';

interface FilterSortMenuProps {
  seatFilters: SeatFilterMap;
  onToggleSeatFilter: (key: 'all' | SeatFilterKey) => void;
  selectedLetters: string[];
  onToggleLetter: (letter: string) => void;
  onSelectAllLetters: (letters: string[]) => void;
  onClearLetters: () => void;
  availableLetters?: string[];
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  onResetAll?: () => void;
}

const DEFAULT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const FilterSortMenu: React.FC<FilterSortMenuProps> = ({
  seatFilters,
  onToggleSeatFilter,
  selectedLetters,
  onToggleLetter,
  onSelectAllLetters,
  onClearLetters,
  availableLetters = DEFAULT_LETTERS,
  sortOption,
  onSortChange,
  onResetAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Combine default letters and any dynamically discovered letters
  const allLetters = useMemo(() => {
    const set = new Set([...DEFAULT_LETTERS, ...availableLetters]);
    return Array.from(set).sort();
  }, [availableLetters]);

  // Count active filters to display a badge
  const activeCount = useMemo(() => {
    let count = 0;
    const isSeatFiltered = !(seatFilters['not-full'] && seatFilters.full);
    if (isSeatFiltered) count++;
    if (selectedLetters.length > 0 && selectedLetters.length < allLetters.length) count++;
    return count;
  }, [seatFilters, selectedLetters, allLetters]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isAllLettersSelected = selectedLetters.length === allLetters.length;
  const isNoneLettersSelected = selectedLetters.length === 0;

  return (
    <div ref={menuRef} className="relative inline-block text-left select-none z-50">
      {/* Icon-Only Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="ตัวกรอง (Filter)"
        className={`relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-[8px] flex items-center justify-center border transition-all duration-200 cursor-pointer active:scale-90 ${
          isOpen || activeCount > 0
            ? 'bg-black/[0.12] hover:bg-black/[0.16] text-[#1D1D1F] border-black/[0.18] shadow-xs'
            : 'bg-black/[0.04] hover:bg-black/[0.07] text-[#1D1D1F] border-black/[0.08]'
        }`}
      >
        <ListFilter className="w-3.5 h-3.5" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0071E3] text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
            {activeCount}
          </span>
        )}
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] max-w-[324px] bg-white rounded-[16px] shadow-[0_12px_36px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.06)] border border-black/[0.08] p-3.5 z-[9999] animate-in fade-in zoom-in-95 duration-200 space-y-3.5 text-xs">
          
          {/* Section 1: สถานะที่นั่ง (Primary Filter) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-[#1D1D1F] tracking-tight">
                สถานะที่นั่ง
              </span>
              <div className="flex items-center gap-0.5 -mr-1">
                {onResetAll && (
                  <button
                    type="button"
                    onClick={onResetAll}
                    title="รีเซ็ตตัวกรองทั้งหมด"
                    className="p-1 text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[8px] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="ปิด"
                  className="p-1 text-[#86868B] hover:text-[#1D1D1F] rounded-[8px] hover:bg-black/[0.05] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Segmented Control: ทั้งหมด / ที่นั่งยังไม่เต็ม / ที่นั่งเต็ม */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F2F2F7] rounded-[12px] border border-black/[0.04] text-[11px]">
              <button
                type="button"
                onClick={() => onToggleSeatFilter('all')}
                className={`py-1.5 rounded-[8px] text-center transition-all cursor-pointer ${
                  seatFilters['not-full'] && seatFilters.full
                    ? 'bg-white text-[#1D1D1F] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-black/[0.04]'
                    : 'text-[#86868B] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => onToggleSeatFilter('not-full')}
                className={`py-1.5 rounded-[8px] text-center transition-all cursor-pointer truncate px-1 ${
                  seatFilters['not-full'] && !seatFilters.full
                    ? 'bg-white text-[#1D1D1F] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-black/[0.04]'
                    : 'text-[#86868B] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                ที่นั่งยังไม่เต็ม
              </button>
              <button
                type="button"
                onClick={() => onToggleSeatFilter('full')}
                className={`py-1.5 rounded-[8px] text-center transition-all cursor-pointer truncate px-1 ${
                  seatFilters.full && !seatFilters['not-full']
                    ? 'bg-white text-[#1D1D1F] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-black/[0.04]'
                    : 'text-[#86868B] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                ที่นั่งเต็ม
              </button>
            </div>
          </div>

          {/* Section 2: Section (Options Grid) */}
          <div className="space-y-2 pt-1 border-t border-black/[0.06]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-[#1D1D1F] tracking-tight">
                Section
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                {isAllLettersSelected ? (
                  <button
                    type="button"
                    onClick={onClearLetters}
                    className="text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  >
                    ล้าง
                  </button>
                ) : isNoneLettersSelected ? (
                  <button
                    type="button"
                    onClick={() => onSelectAllLetters(allLetters)}
                    className="text-[#0071E3] font-semibold hover:underline cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectAllLetters(allLetters)}
                      className="text-[#0071E3] font-semibold hover:underline cursor-pointer"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-[#86868B]/40">·</span>
                    <button
                      type="button"
                      onClick={onClearLetters}
                      className="text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                    >
                      ล้าง
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Letter Buttons Grid (Compact 6-Column, Letter Only) */}
            <div className="grid grid-cols-6 gap-1.5">
              {allLetters.map((letter) => {
                const isSelected = selectedLetters.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => onToggleLetter(letter)}
                    className={`h-7.5 rounded-[8px] text-center text-xs transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center border ${
                      isSelected
                        ? 'bg-white text-[#1D1D1F] font-bold border-black/20 shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                        : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#636366] border-black/[0.03] font-medium'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
