import React, { useState, useMemo } from 'react';
import { X, Search, Filter, Check, CheckSquare, Square, UserPlus, Phone, Building2, Briefcase, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { Candidate, BatchGroup, MemberAssignmentInfo } from './types';
import { API } from '../../services/api';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBatchId: number | null;
  targetGroupId: number | null;
  targetGroupName: string;
  candidates: Candidate[];
  memberAssignmentMap: Map<string, MemberAssignmentInfo>;
  assignedAppNoSet: Set<string>;
  departments: string[];
  designations: string[];
  currentMemberCount: number;
  maxMembers: number;
  onSingleAdd: (candidate: Candidate) => Promise<void>;
  onBulkAdd: (candidateAppNos: string[]) => Promise<void>;
  onMoveMember: (candidateAppNo: string, memberName: string, currentGroupId: number, currentGroupName: string, currentBatchId: number) => void;
}

export default function AddMemberModal({
  isOpen,
  onClose,
  targetBatchId,
  targetGroupId,
  targetGroupName,
  candidates,
  memberAssignmentMap,
  assignedAppNoSet,
  departments,
  designations,
  currentMemberCount,
  maxMembers,
  onSingleAdd,
  onBulkAdd,
  onMoveMember
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [desigFilter, setDesigFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Assigned'>('All');
  
  const [selectedAppNos, setSelectedAppNos] = useState<Set<string>>(new Set());
  const [addedAppNos, setAddedAppNos] = useState<Set<string>>(new Set());
  const [processingAppNo, setProcessingAppNo] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  if (!isOpen) return null;

  // Filter candidates from Joined Store Directory
  const filteredCandidates = candidates.filter(cand => {
    // Must be Joined Store Directory
    const isAssigned = assignedAppNoSet.has(cand.app_no);

    if (statusFilter === 'Available' && isAssigned) return false;
    if (statusFilter === 'Assigned' && !isAssigned) return false;

    if (deptFilter !== 'All' && cand.department !== deptFilter) return false;
    if (desigFilter !== 'All' && cand.designation !== desigFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        (cand.name || '').toLowerCase().includes(q) ||
        (cand.app_no || '').toLowerCase().includes(q) ||
        (cand.phone || '').toLowerCase().includes(q) ||
        (cand.department || '').toLowerCase().includes(q) ||
        (cand.designation || '').toLowerCase().includes(q) ||
        (cand.section || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const liveMemberCount = currentMemberCount + addedAppNos.size;

  const toggleSelectCandidate = (appNo: string) => {
    // Don't select if already assigned elsewhere or already added
    if (assignedAppNoSet.has(appNo) || addedAppNos.has(appNo)) return;
    const next = new Set(selectedAppNos);
    if (next.has(appNo)) {
      next.delete(appNo);
    } else {
      next.add(appNo);
    }
    setSelectedAppNos(next);
  };

  const handleSelectAllAvailable = () => {
    const available = filteredCandidates.filter(c => !assignedAppNoSet.has(c.app_no) && !addedAppNos.has(c.app_no));
    if (selectedAppNos.size === available.length && available.length > 0) {
      setSelectedAppNos(new Set());
    } else {
      setSelectedAppNos(new Set(available.map(c => c.app_no)));
    }
  };

  const handleSingleAddClick = async (cand: Candidate) => {
    setProcessingAppNo(cand.app_no);
    try {
      await onSingleAdd(cand);
      setAddedAppNos(prev => new Set(prev).add(cand.app_no));
      // Remove from multi-select if present
      setSelectedAppNos(prev => {
        const next = new Set(prev);
        next.delete(cand.app_no);
        return next;
      });
    } finally {
      setProcessingAppNo(null);
    }
  };

  const handleBulkAddClick = async () => {
    if (selectedAppNos.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const appNosList = Array.from(selectedAppNos);
      await onBulkAdd(appNosList);
      setAddedAppNos(prev => {
        const next = new Set(prev);
        appNosList.forEach(id => next.add(id));
        return next;
      });
      setSelectedAppNos(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        {/* HEADER */}
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white uppercase">ADD MEMBERS TO GROUP</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#C9952A] text-white">
                {targetGroupName || 'Group'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-semibold mt-0.5">
              Source: <strong className="text-white">JOINED STORE DIRECTORY ONLY</strong> • Capacity: {liveMemberCount} / {maxMembers} Members
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-4 bg-[#F9F7F4] border-b border-[#e2dfd7] space-y-3 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search employee name / ID / phone / department..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] shadow-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Department</label>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
              >
                <option value="All">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Designation</label>
              <select
                value={desigFilter}
                onChange={e => setDesigFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
              >
                <option value="All">All Designations</option>
                {designations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Assignment Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E]"
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available Only</option>
                <option value="Assigned">Already Assigned Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* CANDIDATE LIST */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-white">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-2 border-b border-slate-100">
            <span>Showing {filteredCandidates.length} Joined Store Employees</span>
            <button
              onClick={handleSelectAllAvailable}
              className="text-[#1E2D4E] hover:underline font-extrabold flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select/Deselect All Available</span>
            </button>
          </div>

          {filteredCandidates.length > 0 ? (
            <div className="space-y-2.5">
              {filteredCandidates.map(cand => {
                const isAlreadyAssigned = assignedAppNoSet.has(cand.app_no);
                const isJustAdded = addedAppNos.has(cand.app_no);
                const isSelected = selectedAppNos.has(cand.app_no);
                const existingAssign = memberAssignmentMap.get(cand.app_no);
                const isProcessingThis = processingAppNo === cand.app_no;

                return (
                  <div
                    key={cand.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isJustAdded
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : isSelected
                        ? 'border-[#C9952A] bg-amber-50/40 shadow-sm'
                        : isAlreadyAssigned
                        ? 'border-slate-200 bg-slate-50/70'
                        : 'border-[#e2dfd7] bg-white hover:border-[#1E2D4E]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox for Multi-select */}
                      {!isAlreadyAssigned && !isJustAdded && (
                        <button
                          type="button"
                          onClick={() => toggleSelectCandidate(cand.app_no)}
                          className="text-slate-400 hover:text-[#1E2D4E] transition-colors p-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#C9952A]" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </button>
                      )}

                      {/* Photo Avatar */}
                      <div className="w-11 h-11 rounded-2xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200 shadow-xs">
                        {cand.photo_url ? (
                          <img src={API.fileUrl(cand.photo_url) || ''} alt={cand.name} className="w-full h-full object-cover" />
                        ) : (
                          cand.name.slice(0, 2).toUpperCase()
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-[#1E2D4E] truncate">{cand.name}</h4>
                          <span className="px-2 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Joined Store
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

                    {/* STATUS & ACTIONS */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      {isJustAdded ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1 shadow-xs">
                          <Check className="w-4 h-4" />
                          <span>✓ ADDED</span>
                        </span>
                      ) : isAlreadyAssigned ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold block">
                              ALREADY ASSIGNED
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                              {existingAssign ? `${existingAssign.batchName} • ${existingAssign.groupName}` : 'Assigned to another group'}
                            </span>
                          </div>
                          {existingAssign && (
                            <button
                              onClick={() =>
                                onMoveMember(cand.app_no, cand.name, existingAssign.groupId, existingAssign.groupName, existingAssign.batchId)
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-extrabold flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Move</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          disabled={isProcessingThis}
                          onClick={() => handleSingleAddClick(cand)}
                          className="px-4 py-1.5 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isProcessingThis ? 'Adding...' : '+ ADD'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-2xl bg-[#F9F7F4]">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-extrabold text-[#1E2D4E]">No Joined Store Employees Found</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Try adjusting your search query or department/designation filters. Only verified Joined Store employees are eligible for batch plan assignments.
              </p>
            </div>
          )}
        </div>

        {/* STICKY FOOTER WITH MULTI-SELECT ACTION */}
        <div className="bg-[#1E2D4E] px-6 py-4 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0 text-white">
          <div className="text-xs font-semibold text-slate-300">
            Current Group Capacity: <strong className="text-white">{liveMemberCount} / {maxMembers}</strong>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {selectedAppNos.size > 0 && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs font-bold text-[#C9952A]">
                  {selectedAppNos.size} employees selected
                </span>
                <button
                  disabled={isBulkProcessing}
                  onClick={handleBulkAddClick}
                  className="px-4 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isBulkProcessing ? 'Adding Selected...' : `Add ${selectedAppNos.size} Members`}</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
