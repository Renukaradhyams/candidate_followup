import React, { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { BatchGroup, BatchPlan } from './types';

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: BatchGroup | null;
  selectedBatchId: number | null;
  batches: BatchPlan[];
  onSaveGroup: (payload: any) => Promise<void>;
}

export default function EditGroupModal({
  isOpen,
  onClose,
  group,
  selectedBatchId,
  batches,
  onSaveGroup
}: EditGroupModalProps) {
  const [name, setName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [batchId, setBatchId] = useState<number>(selectedBatchId || (batches[0]?.id || 0));
  const [maxMembers, setMaxMembers] = useState(9);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setGroupCode(group.group_code || '');
      setBatchId(group.batch_id);
      setMaxMembers(group.max_members || 9);
      setDescription(group.description || '');
      setStatus(group.status || 'Active');
    } else {
      setName('');
      setGroupCode('');
      setBatchId(selectedBatchId || (batches[0]?.id || 0));
      setMaxMembers(9);
      setDescription('');
      setStatus('Active');
    }
  }, [group, selectedBatchId, batches, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !batchId) return;

    setIsSubmitting(true);
    try {
      const code = groupCode.trim() || `GRP-${name.replace(/\s+/g, '-').toUpperCase()}`;
      await onSaveGroup({
        id: group?.id,
        batchId: Number(batchId),
        name: name.trim(),
        groupCode: code,
        maxMembers: Number(maxMembers) || 9,
        description: description.trim(),
        status,
        groupLeaderAppNo: group?.group_leader_app_no || null
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-lg overflow-hidden transform transition-all">
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-white font-black flex items-center justify-center text-sm shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase">
                {group ? `EDIT GROUP - ${group.name}` : 'CREATE NEW GROUP'}
              </h2>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">Group Configuration</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#F9F7F4]">
          <div>
            <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Parent Batch *</label>
            <select
              disabled={!!group}
              value={batchId}
              onChange={e => setBatchId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.batch_code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Group Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Group 01"
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Group Code</label>
              <input
                type="text"
                value={groupCode}
                onChange={e => setGroupCode(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Max Capacity (Members)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxMembers}
                onChange={e => setMaxMembers(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Group notes..."
              className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-[#e2dfd7] bg-white hover:bg-slate-50 text-xs font-black text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
