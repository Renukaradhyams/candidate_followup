import React, { useState } from 'react';
import { X, Search, Award, CheckCircle2, UserCheck, ShieldCheck, Phone } from 'lucide-react';
import { Candidate, BatchPlan, BatchGroup } from './types';
import { API } from '../../services/api';

interface SelectLeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  roleType: 'batch_leader' | 'group_leader';
  targetEntityName: string;
  candidates: Candidate[];
  batches: BatchPlan[];
  groups: BatchGroup[];
  assignedAppNoSet: Set<string>;
  departments: string[];
  designations: string[];
  onAssignLeader: (cand: Candidate) => Promise<void>;
}

export default function SelectLeaderModal({
  isOpen,
  onClose,
  title,
  roleType,
  targetEntityName,
  candidates,
  batches,
  groups,
  assignedAppNoSet,
  departments,
  designations,
  onAssignLeader
}: SelectLeaderModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [desigFilter, setDesigFilter] = useState('All');
  const [processingAppNo, setProcessingAppNo] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build sets of current leaders
  const batchLeaderSet = new Set(batches.map(b => b.batch_leader_app_no).filter(Boolean) as string[]);
  const groupLeaderSet = new Set(groups.map(g => g.group_leader_app_no).filter(Boolean) as string[]);

  // Filter candidate list
  const filteredCandidates = candidates.filter(cand => {
    if (deptFilter !== 'All' && cand.department !== deptFilter) return false;
    if (desigFilter !== 'All' && cand.designation !== desigFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        (cand.name || '').toLowerCase().includes(q) ||
        (cand.app_no || '').toLowerCase().includes(q) ||
        (cand.phone || '').toLowerCase().includes(q) ||
        (cand.department || '').toLowerCase().includes(q) ||
        (cand.designation || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const getLeaderStatus = (appNo: string) => {
    if (batchLeaderSet.has(appNo)) {
      const b = batches.find(x => x.batch_leader_app_no === appNo);
      return { label: `ALREADY BATCH LEADER (${b?.name || 'Batch'})`, color: 'purple', available: false };
    }
    if (groupLeaderSet.has(appNo)) {
      const g = groups.find(x => x.group_leader_app_no === appNo);
      return { label: `ALREADY GROUP LEADER (${g?.name || 'Group'})`, color: 'indigo', available: false };
    }
    if (assignedAppNoSet.has(appNo)) {
      return { label: 'ALREADY ASSIGNED AS MEMBER', color: 'amber', available: true };
    }
    return { label: '✓ Available', color: 'emerald', available: true };
  };

  const handleAssignClick = async (cand: Candidate) => {
    setProcessingAppNo(cand.app_no);
    try {
      await onAssignLeader(cand);
      onClose();
    } finally {
      setProcessingAppNo(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        {/* HEADER */}
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-white font-black flex items-center justify-center text-sm shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase">{title || 'SELECT LEADER'}</h2>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                Target: <strong className="text-white">{targetEntityName}</strong> • Source: Joined Store Directory Only
              </p>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>
        </div>

        {/* CANDIDATE CARDS LIST */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-white">
          {filteredCandidates.length > 0 ? (
            <div className="space-y-2.5">
              {filteredCandidates.map(cand => {
                const statusInfo = getLeaderStatus(cand.app_no);
                const isProcessingThis = processingAppNo === cand.app_no;

                return (
                  <div
                    key={cand.id}
                    className="p-3.5 rounded-2xl border border-[#e2dfd7] bg-white hover:border-[#1E2D4E]/40 hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-[#C9952A]">
                        {cand.photo_url ? (
                          <img src={API.fileUrl(cand.photo_url) || ''} alt={cand.name} className="w-full h-full object-cover" />
                        ) : (
                          cand.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-[#1E2D4E] truncate">{cand.name}</h4>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-black bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-semibold truncate mt-0.5">
                          ID: {cand.app_no} • {cand.department || 'Department'} • {cand.designation || 'Designation'}
                        </div>
                        {cand.phone && (
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-300" />
                            <span>{cand.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={isProcessingThis}
                      onClick={() => handleAssignClick(cand)}
                      className="px-4 py-2 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white text-xs font-extrabold shadow-xs transition-all flex-shrink-0 self-end sm:self-center flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#C9952A]" />
                      <span>{isProcessingThis ? 'Assigning...' : 'Assign Leader'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-2xl bg-[#F9F7F4]">
              <Award className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-extrabold text-[#1E2D4E]">No Employees Found</div>
              <p className="text-[11px] text-slate-500 mt-1">Try refining your search query or filters.</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-[#1E2D4E] px-6 py-3.5 border-t border-slate-700/50 flex items-center justify-between flex-shrink-0 text-white">
          <span className="text-xs text-slate-300 font-semibold">
            Select an employee to assign as {roleType === 'batch_leader' ? 'Batch Leader' : 'Group Leader'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
