import React, { useState } from 'react';
import { Search, UserCheck, ShieldCheck, UserPlus, Phone, X } from 'lucide-react';
import { Candidate, BatchPlan, BatchGroup } from './types';
import { API } from '../../services/api';

interface UnassignedEmployeesSectionProps {
  unassignedCandidates: Candidate[];
  batches: BatchPlan[];
  groups: BatchGroup[];
  departments: string[];
  designations: string[];
  onAssignSubmit: (candidateAppNo: string, memberName: string, batchId: number, groupId: number, groupName: string) => Promise<void>;
  onViewMemberProfile: (cand: Candidate) => void;
}

export default function UnassignedEmployeesSection({
  unassignedCandidates,
  batches,
  groups,
  departments,
  designations,
  onAssignSubmit,
  onViewMemberProfile
}: UnassignedEmployeesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [desigFilter, setDesigFilter] = useState('All');

  // Quick Assign Dialog state
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    candidate: Candidate | null;
    batchId: number;
    groupId: number;
  }>({ open: false, candidate: null, batchId: batches[0]?.id || 0, groupId: 0 });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter unassigned list
  const filtered = unassignedCandidates.filter(c => {
    if (deptFilter !== 'All' && c.department !== deptFilter) return false;
    if (desigFilter !== 'All' && c.designation !== desigFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.app_no || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.department || '').toLowerCase().includes(q) ||
        (c.designation || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableGroups = groups.filter(g => g.batch_id === assignModal.batchId);

  const handleOpenAssignModal = (cand: Candidate) => {
    const defaultBatchId = batches[0]?.id || 0;
    const defaultGroups = groups.filter(g => g.batch_id === defaultBatchId);
    setAssignModal({
      open: true,
      candidate: cand,
      batchId: defaultBatchId,
      groupId: defaultGroups[0]?.id || 0
    });
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal.candidate || !assignModal.batchId || !assignModal.groupId) return;

    setIsSubmitting(true);
    try {
      const targetGroup = groups.find(g => g.id === assignModal.groupId);
      await onAssignSubmit(
        assignModal.candidate.app_no,
        assignModal.candidate.name,
        assignModal.batchId,
        assignModal.groupId,
        targetGroup ? targetGroup.name : 'Group'
      );
      setAssignModal({ open: false, candidate: null, batchId: 0, groupId: 0 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER */}
      <div className="card-glass p-5 border-l-4 border-l-rose-500 bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight uppercase">UNASSIGNED JOINED EMPLOYEES</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800">
                {unassignedCandidates.length} Pool Count
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Verified Joined Store employees ready for batch and group assignment.
            </p>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search unassigned employee..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
            />
          </div>

          <div>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
            >
              <option value="All">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={desigFilter}
              onChange={e => setDesigFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
            >
              <option value="All">All Designations ({designations.length})</option>
              {designations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABLE / LIST */}
      <div className="card-glass p-5 bg-white">
        {filtered.length > 0 ? (
          <div className="space-y-2.5">
            {filtered.map(cand => (
              <div
                key={cand.id}
                className="p-4 rounded-2xl border border-[#e2dfd7] bg-white hover:border-[#1E2D4E]/40 hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                    {cand.photo_url ? (
                      <img src={API.fileUrl(cand.photo_url) || ''} alt={cand.name} className="w-full h-full object-cover" />
                    ) : (
                      cand.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-[#1E2D4E] truncate">{cand.name}</h4>
                      <span className="px-2 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-black">
                        UNASSIGNED
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold truncate mt-0.5">
                      ID: {cand.app_no} • {cand.department || 'Department'} • {cand.designation || 'Designation'}
                    </div>
                    {cand.phone && (
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Phone: {cand.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => onViewMemberProfile(cand)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E2D4E] text-xs font-extrabold transition-colors"
                  >
                    View
                  </button>

                  <button
                    onClick={() => handleOpenAssignModal(cand)}
                    className="px-4 py-1.5 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-2xl bg-[#F9F7F4]">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <div className="text-xs font-extrabold text-[#1E2D4E]">All Joined Employees Are Assigned!</div>
            <p className="text-[11px] text-slate-500 mt-1">There are currently no unassigned joined store employees matching your filter criteria.</p>
          </div>
        )}
      </div>

      {/* QUICK ASSIGN MODAL */}
      {assignModal.open && assignModal.candidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-md overflow-hidden">
            <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
              <div>
                <h3 className="text-base font-black tracking-tight uppercase">QUICK ASSIGN EMPLOYEE</h3>
                <p className="text-xs text-slate-300 font-semibold mt-0.5">{assignModal.candidate.name} ({assignModal.candidate.app_no})</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModal({ open: false, candidate: null, batchId: 0, groupId: 0 })}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="p-6 space-y-4 bg-[#F9F7F4]">
              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Select Target Batch *</label>
                <select
                  value={assignModal.batchId}
                  onChange={e => {
                    const bId = Number(e.target.value);
                    const bGroups = groups.filter(g => g.batch_id === bId);
                    setAssignModal(prev => ({
                      ...prev,
                      batchId: bId,
                      groupId: bGroups[0]?.id || 0
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.batch_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#1E2D4E] block mb-1">Select Target Group *</label>
                <select
                  value={assignModal.groupId}
                  onChange={e => setAssignModal(prev => ({ ...prev, groupId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
                >
                  {availableGroups.length > 0 ? (
                    availableGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.group_code})</option>
                    ))
                  ) : (
                    <option value={0}>No groups in target batch</option>
                  )}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssignModal({ open: false, candidate: null, batchId: 0, groupId: 0 })}
                  className="px-5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-black text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !assignModal.groupId}
                  className="px-6 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
