import React, { useState, useEffect } from 'react';
import { X, Layers, Award, Users, ShieldCheck, Edit3 } from 'lucide-react';
import { BatchPlan, Candidate, BatchGroup, GroupMember } from './types';
import { API } from '../../services/api';

interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchPlan | null;
  candidateMap: Map<string, Candidate>;
  groups: BatchGroup[];
  groupMembers: GroupMember[];
  onSaveBatch: (payload: any) => Promise<void>;
  onChangeBatchLeader: (batchId: number, batchName: string) => void;
}

export default function EditBatchModal({
  isOpen,
  onClose,
  batch,
  candidateMap,
  groups,
  groupMembers,
  onSaveBatch,
  onChangeBatchLeader
}: EditBatchModalProps) {
  const [name, setName] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [type, setType] = useState('Regular');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(80);
  const [status, setStatus] = useState('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (batch) {
      setName(batch.name || '');
      setBatchCode(batch.batch_code || '');
      setType(batch.type || 'Regular');
      setDescription(batch.description || '');
      setCapacity(batch.capacity || 80);
      setStatus(batch.status || 'Active');
    } else {
      setName('');
      setBatchCode('');
      setType('Regular');
      setDescription('');
      setCapacity(80);
      setStatus('Active');
    }
  }, [batch, isOpen]);

  if (!isOpen) return null;

  const currentLeader = batch && batch.batch_leader_app_no ? candidateMap.get(batch.batch_leader_app_no) : null;
  const batchGroups = batch ? groups.filter(g => g.batch_id === batch.id) : [];
  const batchMembers = batch ? groupMembers.filter(m => m.batch_id === batch.id) : [];
  const groupLeadersCount = batchGroups.filter(g => g.group_leader_app_no).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const code = batchCode.trim() || `B-${name.replace(/\s+/g, '-').toUpperCase()}`;
      await onSaveBatch({
        id: batch?.id,
        name: name.trim(),
        batchCode: code,
        type,
        description: description.trim(),
        capacity: Number(capacity) || 80,
        status,
        batchLeaderAppNo: batch?.batch_leader_app_no || null
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        {/* HEADER */}
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-white font-black flex items-center justify-center text-sm shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase">
                {batch ? `EDIT BATCH - ${batch.name}` : 'CREATE NEW BATCH'}
              </h2>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                Structured Batch Configuration
              </p>
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

        {/* CONTENT FORM */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9F7F4]">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2dfd7] shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider">BASIC INFORMATION</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Batch Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. B-Alpha"
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Batch Code</label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={e => setBatchCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Batch Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="Regular">Regular</option>
                  <option value="Fast-track">Fast-track</option>
                  <option value="Special">Special</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
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
                placeholder="Optional batch description or notes..."
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
              />
            </div>
          </div>

          {/* SECTION 2: CAPACITY & STATUS */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2dfd7] shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider">CAPACITY & LIMITS</h3>
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Max Capacity (Employees)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
              />
              <p className="text-[11px] text-slate-400 font-medium mt-1">Recommended capacity is 80 members per batch.</p>
            </div>
          </div>

          {/* SECTION 3: BATCH LEADER */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2dfd7] shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-[#C9952A]" />
                <span>BATCH LEADER</span>
              </h3>
              {batch && (
                <button
                  type="button"
                  onClick={() => onChangeBatchLeader(batch.id, batch.name)}
                  className="px-3 py-1 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold"
                >
                  {currentLeader ? 'Change Leader' : '+ Assign Leader'}
                </button>
              )}
            </div>

            {currentLeader ? (
              <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center border border-[#C9952A] overflow-hidden flex-shrink-0">
                  {currentLeader.photo_url ? (
                    <img src={API.fileUrl(currentLeader.photo_url) || ''} alt={currentLeader.name} className="w-full h-full object-cover" />
                  ) : (
                    currentLeader.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-[#1E2D4E]">{currentLeader.name}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">
                    ID: {currentLeader.app_no} • {currentLeader.designation || 'Staff'} ({currentLeader.department || 'General'})
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-500">
                No Batch Leader assigned yet.
              </div>
            )}
          </div>

          {/* SECTION 4: BATCH SUMMARY */}
          {batch && (
            <div className="bg-white p-5 rounded-2xl border border-[#e2dfd7] shadow-xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider">BATCH SUMMARY</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#F9F7F4] border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Employees</div>
                  <div className="text-base font-black text-[#1E2D4E] mt-0.5">{batchMembers.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F7F4] border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Groups</div>
                  <div className="text-base font-black text-[#1E2D4E] mt-0.5">{batchGroups.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F7F4] border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Group Leaders</div>
                  <div className="text-base font-black text-[#1E2D4E] mt-0.5">{groupLeadersCount}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F7F4] border border-slate-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Capacity Usage</div>
                  <div className="text-base font-black text-[#C9952A] mt-0.5">
                    {Math.round((batchMembers.length / capacity) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="pt-2 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[#e2dfd7] bg-white hover:bg-slate-50 text-xs font-black text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
