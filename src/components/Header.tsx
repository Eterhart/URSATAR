'use client';

import React from 'react';
import { PlanId } from '@/types/schedule';
import { LogIn, LogOut, User } from 'lucide-react';

interface HeaderProps {
  connected?: boolean;
  studentName?: string;
  studentId?: string;
  meta?: string;
  onConnectClick?: () => void;
  onLogoutClick?: () => void;
  activePlan?: PlanId;
}

export const Header: React.FC<HeaderProps> = ({
  connected = false,
  studentName,
  studentId,
  meta,
  onConnectClick,
  onLogoutClick,
}) => {
  return (
    <header className="bg-[#121417] text-white border-b border-white/10 sticky top-0 z-40 backdrop-blur-md w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* BU Logo and Branding */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Diamond Silver Emblem */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-white via-slate-200 to-slate-400 flex items-center justify-center border border-white/30">
              <span className="text-[#0A0C0E] font-black text-xl sm:text-2xl tracking-tighter">BU</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                BANGKOK UNIVERSITY
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/20">
                SCHEDULE PLANNER
              </span>
            </div>
          </div>

          {/* Right Side: Connection Status & Profile Badge */}
          <div className="flex items-center gap-3 sm:gap-4">
            {connected ? (
              <div className="flex items-center gap-3">
                {/* Live Connected Pill */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>เชื่อมต่อ URSA แล้ว</span>
                </div>

                {/* Profile Card */}
                <div className="flex items-center gap-2.5 pl-2">
                  <div className="w-8 h-8 rounded-full bg-[#0071E3] flex items-center justify-center text-white text-xs font-bold border border-white/20">
                    {studentName ? studentName.slice(0, 2) : <User className="w-4 h-4" />}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-white leading-tight truncate max-w-[160px]">
                      {studentName || 'นักศึกษา BU'}
                    </div>
                    <div className="text-[10px] text-[#86868B] font-mono leading-tight">
                      {studentId ? `ID ${studentId}` : meta || 'URSA Connected'}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                {onLogoutClick && (
                  <button
                    onClick={onLogoutClick}
                    title="ออกจากระบบ URSA"
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Disconnected Pill */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[#86868B] text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#86868B]" />
                  <span>ยังไม่ได้เชื่อม URSA</span>
                </div>

                {/* Connect Button */}
                {onConnectClick && (
                  <button
                    onClick={onConnectClick}
                    className="apple-blue-btn px-4 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-white" />
                    <span>เชื่อม URSA</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
