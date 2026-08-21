'use client';

import React, { useState } from 'react';
import { X, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { UrsaLoginCredentials, UrsaProgram } from '@/types/ursa';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (credentials: UrsaLoginCredentials) => Promise<boolean>;
  authError?: string | null;
  isSubmitting?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  authError,
  isSubmitting = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState<UrsaProgram>('regular');
  const [isSuccess, setIsSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLocalError(null);
    setLoading(true);

    const success = await onLogin({
      username: username.trim(),
      password,
      program,
    });

    setLoading(false);
    if (success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setUsername('');
        setPassword('');
        setLocalError(null);
        setIsShaking(false);
        onClose();
      }, 1000);
    } else {
      setLocalError(authError || 'ชื่อผู้ใช้งาน URSA หรือรหัสผ่าน URSA ไม่ถูกต้อง');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const displayedError = localError || authError;
  const activeLoading = loading || isSubmitting;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer select-none"
    >
      {/* Relative wrapper for outer floating close button */}
      <div className="relative max-w-[420px] w-full cursor-default">
        {/* Top Floating Close Button (Directly above card, fine minimal Apple icon) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-7 right-2 sm:right-3 z-10 p-1 text-white/60 hover:text-white transition-all cursor-pointer active:scale-90"
          title="ปิด (หรือคลิกพื้นที่ด้านนอก)"
        >
          <X className="w-4 h-4 stroke-[1.5]" />
        </button>

        {/* Modal Card Content */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white text-[#1D1D1F] rounded-[32px] w-full p-8 sm:p-10 transform animate-in zoom-in-95 duration-200 border border-black/[0.12] text-center"
        >
          {isSuccess ? (
            <div className="py-12 text-center space-y-3">
              {/* Grey Circular Progress Filling Clockwise */}
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  {/* Subtle background track */}
                  <circle
                    cx="28"
                    cy="28"
                    r="25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-black/[0.08]"
                  />
                  {/* Clockwise Progress Stroke Fill */}
                  <circle
                    cx="28"
                    cy="28"
                    r="25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="text-[#86868B] animate-fill-circle"
                  />
                </svg>
                {/* Grey Checkmark in Center */}
                <Check className="w-6 h-6 text-[#86868B] stroke-[2.5] absolute animate-check-pop" />
              </div>
              <h4 className="apple-headline text-xl text-[#1D1D1F]">เข้าสู่ระบบสำเร็จ!</h4>
              <p className="text-xs text-[#86868B]">กำลังเชื่อมต่อข้อมูลนักศึกษามหาวิทยาลัยกรุงเทพ...</p>
            </div>
          ) : (
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Header: Clean Title */}
            <div className="flex flex-col items-center justify-center pt-2">
              <h3 className="apple-headline text-2xl text-[#1D1D1F] font-bold tracking-tight">
                Login with URSA ID
              </h3>
            </div>

            <div className="space-y-3 text-left">
              {/* Clean Input Fields with Shake Animation on Error (Only boxes shake) */}
              <div className={`space-y-3 transition-all ${isShaking ? 'animate-shake' : ''}`}>
                {/* Textbox 1: URSA ID */}
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="URSA ID"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    disabled={activeLoading}
                    className="w-full px-4 py-3.5 bg-white border border-black/15 rounded-2xl text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-[#0071E3] transition-all apple-subheadline font-normal disabled:opacity-50"
                  />
                </div>

                {/* Textbox 2: URSA PASSWORD */}
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="URSA PASSWORD"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    disabled={activeLoading}
                    className="w-full px-4 py-3.5 bg-white border border-black/15 rounded-2xl text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-[#0071E3] transition-all apple-subheadline font-normal disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Centered Error Message under Password Textbox (Static, Does Not Shake) */}
              {displayedError && (
                <div className="pt-0.5 px-1 text-center animate-in fade-in duration-150">
                  <span className="leading-tight font-medium text-[11.5px] sm:text-xs text-[#86868B]">
                    ชื่อผู้ใช้งาน URSA หรือรหัสผ่าน URSA ไม่ถูกต้อง
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={activeLoading || !username || !password}
                className="w-full py-3.5 rounded-2xl bg-[#0071E3] text-white hover:bg-[#0077ED] active:scale-98 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {activeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังเชื่อมต่อ...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Footnote text requested by user */}
            <div className="pt-1">
              <p className="text-[12px] text-[#86868B] font-normal leading-relaxed">
                ใช้ข้อมูลนี้เพื่อส่งต่อไปยัง URSA ผ่าน Backend
              </p>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
