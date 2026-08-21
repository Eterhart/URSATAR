'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X, RotateCw } from 'lucide-react';

export const RotatePromptOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if device is small screen portrait
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      const isMobilePortrait =
        window.innerWidth < 768 && window.innerHeight > window.innerWidth;

      // If user rotated to landscape, auto-dismiss
      if (!isMobilePortrait) {
        setIsVisible(false);
      } else if (!isDismissed) {
        setIsVisible(true);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isDismissed]);

  if (!isVisible || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  return (
    <div
      onClick={handleDismiss}
      className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-300 sm:hidden cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white text-[#1D1D1F] rounded-[28px] max-w-[340px] w-full p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-black/[0.08] animate-in zoom-in-95 duration-200 cursor-default"
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Phone Icon */}
        <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-[#F5F5F7] border border-black/[0.06]">
          <Smartphone className="w-8 h-8 text-[#0071E3] animate-rotate-phone stroke-[1.75]" />
          <RotateCw className="w-3.5 h-3.5 text-[#86868B] absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs border border-black/[0.08]" />
        </div>

        {/* Content */}
        <h3 className="apple-headline text-base text-[#1D1D1F] font-bold mb-1.5">
          หมุนโทรศัพท์เป็นแนวนอน
        </h3>
        <p className="text-xs text-[#86868B] leading-relaxed mb-5">
          พลิกอุปกรณ์เป็นแนวนอนเพื่อแสดงตารางเรียนครบทั้งสัปดาห์ (จันทร์ - เสาร์) ได้อย่างเต็มตา
        </p>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full py-2.5 text-xs font-semibold rounded-xl bg-black/[0.06] hover:bg-black/[0.1] text-[#1D1D1F] transition-all cursor-pointer active:scale-98"
        >
          ดูแบบแนวตั้งต่อไป
        </button>
      </div>
    </div>
  );
};
