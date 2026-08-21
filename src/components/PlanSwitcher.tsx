'use client';

import React, { useRef, useEffect, useState } from 'react';
import { PlanId, PlanData } from '@/types/schedule';
import { Plus, X, Edit3, Trash2 } from 'lucide-react';

interface PlanSwitcherProps {
  plans: Record<PlanId, PlanData>;
  activePlan: PlanId;
  onSelectPlan: (id: PlanId) => void;
  onAddPlan?: () => void;
  onDeletePlan?: (id: PlanId, name: string) => void;
  onRenamePlan?: (id: PlanId, newName: string) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  planId: PlanId;
  planName: string;
}

export const PlanSwitcher: React.FC<PlanSwitcherProps> = ({
  plans,
  activePlan,
  onSelectPlan,
  onAddPlan,
  onDeletePlan,
  onRenamePlan,
}) => {
  const planEntries = Object.values(plans);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // State for inline renaming
  const [editingPlanId, setEditingPlanId] = useState<PlanId | null>(null);
  const [editingName, setEditingName] = useState('');

  // Auto-scroll active plan tab into view
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(`[data-active="true"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activePlan, planEntries.length]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, plan: PlanData) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      planId: plan.id,
      planName: plan.name,
    });
  };

  const handleStartRename = (id: PlanId, currentName: string) => {
    setEditingPlanId(id);
    setEditingName(currentName);
    setContextMenu(null);
  };

  const handleSaveRename = (id: PlanId) => {
    if (editingName.trim() && onRenamePlan) {
      onRenamePlan(id, editingName.trim());
    }
    setEditingPlanId(null);
  };

  return (
    <>
      <div className="bg-white px-3 py-1.5 rounded-full border border-black/[0.08] flex items-center justify-between gap-3 max-w-full overflow-hidden h-[54px] relative">
        {/* Scrollable Plan Tabs Container with proper concentric padding */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pl-0.5 pr-1"
        >
          {planEntries.map((plan) => {
            const isActive = plan.id === activePlan;
            const isEditing = editingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => !isEditing && onSelectPlan(plan.id)}
                onContextMenu={(e) => handleContextMenu(e, plan)}
                onDoubleClick={() => handleStartRename(plan.id, plan.name)}
                title="คลิกขวาเพื่อเปลี่ยนชื่อ หรือจัดการแผน"
                className={`h-[40px] pl-4 pr-3 rounded-full text-xs sm:text-[13px] font-medium tracking-tight transition-all duration-200 cursor-pointer select-none flex items-center gap-2 group shrink-0 whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-[#1D1D1F] text-white font-semibold'
                    : 'bg-black/[0.04] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.08]'
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(plan.id);
                      if (e.key === 'Escape') setEditingPlanId(null);
                    }}
                    onBlur={() => handleSaveRename(plan.id)}
                    className="bg-white text-[#1D1D1F] px-2 py-0.5 rounded-md text-xs font-semibold outline-none w-24 border border-[#0071E3]"
                  />
                ) : (
                  <span>{plan.name}</span>
                )}

                {/* Close Button on Tab */}
                {planEntries.length > 1 && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeletePlan) onDeletePlan(plan.id, plan.name);
                    }}
                    title="ลบแผนนี้"
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isActive
                        ? 'hover:bg-white/20 text-white/60 hover:text-white'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-black/10 text-[#86868B] hover:text-[#FF3B30]'
                    }`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Plan Action Button */}
          {onAddPlan && (
            <button
              onClick={onAddPlan}
              title="เพิ่มแผนใหม่"
              className="h-[36px] w-[36px] rounded-full bg-black/[0.04] hover:bg-black/[0.08] active:scale-90 text-[#86868B] hover:text-[#1D1D1F] transition-all flex items-center justify-center cursor-pointer shrink-0 border border-black/[0.04]"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && contextMenu.isOpen && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] bg-white/95 backdrop-blur-xl rounded-[16px] border border-black/10 p-1.5 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-[#86868B] border-b border-black/[0.06] mb-1">
            {contextMenu.planName}
          </div>

          <button
            onClick={() => handleStartRename(contextMenu.planId, contextMenu.planName)}
            className="w-full px-3 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white rounded-[10px] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>เปลี่ยนชื่อแผน</span>
          </button>

          {onDeletePlan && planEntries.length > 1 && (
            <button
              onClick={() => {
                onDeletePlan(contextMenu.planId, contextMenu.planName);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-xs font-medium text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white rounded-[10px] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบแผนนี้</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
