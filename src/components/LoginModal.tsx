'use client';

import React, { useState } from 'react';
import { X, ArrowRight, Check, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [program, setProgram] = useState<UrsaProgram>('regular');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
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
      setIsFadingOut(false);
      // Wait for Welcome text to rise, hold, and slide down (~1.5s), then start unblurring:
      setTimeout(() => {
        setIsFadingOut(true);
      }, 1500);

      // Clean up and close at exactly 2.0s as the background turns completely sharp:
      setTimeout(() => {
        setIsSuccess(false);
        setIsFadingOut(false);
        setUsername('');
        setPassword('');
        setLocalError(null);
        setIsShaking(false);
        onClose();
      }, 2000);
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer select-none transition-all duration-500 ease-out ${
        isFadingOut
          ? 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
          : 'bg-black/40 backdrop-blur-md opacity-100'
      }`}
    >
      {/* Modal Container */}
      <div className="relative max-w-[440px] w-full cursor-default">
        {/* Floating Welcome Message Layer */}
        {isSuccess && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <h2 className="text-3xl sm:text-4xl text-white font-light tracking-wide animate-welcome-sequence select-none">
              Welcome
            </h2>
          </div>
        )}

        {/* Modal Card Content (Gently dissolves and fades out without shape jumping) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`bg-[#F8F8FA] text-[#1D1D1F] border border-black/[0.12] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.06)] rounded-[22px] w-full overflow-hidden transition-all duration-400 ease-out text-center ${
            isSuccess ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          {/* macOS Header Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.08] bg-white/70 backdrop-blur-md">
            <h3 className="font-bold text-[15.5px] text-[#1D1D1F] tracking-tight">
              Sign In
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-white hover:bg-[#F2F2F7] active:bg-[#E5E5EA] border border-black/15 rounded-[7px] text-xs font-normal text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>

              {/* Form Body */}
              <form onSubmit={handleFormSubmit} autoComplete="on" className="p-6 sm:p-7 space-y-5">
                {/* Apple Blue Profile Silhouette Icon */}
                <div className="flex justify-center pt-1 pb-0.5">
                  <div className="w-12 h-12 rounded-full bg-[#0071E3]/12 flex items-center justify-center text-[#0071E3]">
                    <svg className="w-6.5 h-6.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-1">
                  <h4 className="apple-headline text-[17px] font-bold text-[#1D1D1F] tracking-tight">
                    Login with URSA ID
                  </h4>
                  <p className="text-xs text-[#86868B] max-w-[300px] mx-auto leading-relaxed">
                    กรอกชื่อผู้ใช้และรหัสผ่าน URSA เพื่อเชื่อมต่อข้อมูลตารางเรียน
                  </p>
                </div>

                {/* Input Fields */}
                <div className="space-y-2.5 text-left max-w-[340px] mx-auto w-full">
                  <div className={`space-y-2.5 transition-all ${isShaking ? 'animate-shake' : ''}`}>
                    {/* Textbox 1: URSA ID */}
                    <div className="relative">
                      <input
                        type="text"
                        name="username"
                        id="username"
                        autoComplete="username"
                        required
                        placeholder="URSA ID"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (localError) setLocalError(null);
                        }}
                        disabled={activeLoading}
                        className="w-full px-3.5 py-2.5 bg-white border border-black/15 rounded-xl text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-black/30 transition-all font-normal disabled:opacity-50"
                      />
                    </div>

                    {/* Textbox 2: URSA PASSWORD */}
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        id="password"
                        autoComplete="current-password"
                        required
                        placeholder="URSA PASSWORD"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (localError) setLocalError(null);
                        }}
                        disabled={activeLoading}
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-black/15 rounded-xl text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-black/30 transition-all font-normal disabled:opacity-50"
                      />
                      {password && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1 cursor-pointer"
                          title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Centered Error Message */}
                  {displayedError && (
                    <div className="pt-0.5 text-center animate-in fade-in duration-150">
                      <span className="leading-tight font-medium text-[11.5px] text-[#86868B]">
                        ชื่อผู้ใช้งาน URSA หรือรหัสผ่าน URSA ไม่ถูกต้อง
                      </span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-center pt-1">
                  <button
                    type="submit"
                    disabled={activeLoading || !username || !password}
                    className="w-auto min-w-[160px] px-8 py-2.5 rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED] active:scale-[0.98] font-semibold text-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-none"
                  >
                    {activeLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-4 h-4 animate-spin text-white"
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
                        <span>กำลังเชื่อมต่อ...</span>
                      </div>
                    ) : (
                      <span>เข้าสู่ระบบ</span>
                    )}
                  </button>
                </div>

                {/* Footnote */}
                <div className="pt-0.5">
                  <p className="text-[11.5px] text-[#86868B] font-normal leading-relaxed">
                    ใช้ข้อมูลนี้เพื่อส่งต่อไปยัง URSA ผ่าน Backend
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      );
    };
