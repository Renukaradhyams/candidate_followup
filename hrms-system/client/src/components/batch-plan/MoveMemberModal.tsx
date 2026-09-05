import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { BatchPlan, BatchGroup } from './types';

interface MoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateAppNo: string;
  memberName: string;
  currentGroupId: number;
  currentGroupName: string;
  currentBatchId: number;
  batches: BatchPlan[];
  groups: BatchGroup[];
  onMoveSubmit: (targetBatchId: number, targetGroupId: number) => Promise<void>;
}

export default function MoveMemberModal({
  isOpen,
  onClose,
  candidateAppNo,
  memberName,
  currentGroupId,
  currentGroupName,
  currentBatchId,
  batches,
  groups,
  onMoveSubmit
}: MoveMemberModalProps) {
  const [targetBatchId, setTargetBatchId] = useState<number>(currentBatchId || batches[0]?.id || 0);
  const [targetGroupId, setTargetGroupId] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available groups under target batch
  const availableGroups = groups.filter(g => g.batch_id === targetBatchId);

  useEffect(() => {
    if (availableGroups.length > 0) {
      // Pick first group under target batch that isn't the current group if possible
      const valid = availableGroups.find(g => g.id !== currentGroupId) || availableGroups[0];
      setTargetGroupId(valid ? valid.id : 0);
    } else {
      setTargetGroupId(0);
    }
  }, [targetBatchId, groups, currentGroupId, isOpen]);

  if (!isOpen) return null;

  const currentBatchName = batches.find(b => b.id === currentBatchId)?.name || 'Batch';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBatchId || !targetGroupId) return;

    setIsSubmitting(true);
    try {
      await onMoveSubmit(Number(targetBatchId), Number(targetGroupId));
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-md overflow-hidden transform transition-all">
        {/* HEADER */}
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-white font-black flex items-center justify-center text-sm shadow-md">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase">MOVE EMPLOYEE</h2>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">{memberName} ({candidateAppNo})</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#F9F7F4]">
          {/* CURRENT ASSIGNMENT */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#e2dfd7] space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase block">Current Location</span>
            <div className="text-xs font-black text-[#1E2D4E]">
              {currentBatchName} • <span className="text-[#C9952A]">{currentGroupName}</span>
            </div>
          </div>

          {/* DESTINATION SELECTION */}
          <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase block">Destination Location</span>

            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Target Batch</label>
              <select
                value={targetBatchId}
                onChange={e => setTargetBatchId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.batch_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Target Group</label>
              <select
                value={targetGroupId}
                onChange={e => setTargetGroupId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
              >
                {availableGroups.length > 0 ? (
                  availableGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.group_code}) {g.id === currentGroupId ? '• Current Group' : ''}
                    </option>
                  ))
                ) : (
                  <option value={0}>No groups available under target batch</option>
                )}
              </select>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[#e2dfd7] bg-white hover:bg-slate-50 text-xs font-black text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetGroupId || targetGroupId === currentGroupId}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Moving...' : 'Move Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
