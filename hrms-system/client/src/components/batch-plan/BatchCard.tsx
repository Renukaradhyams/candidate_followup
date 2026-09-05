import React, { useState } from 'react';
import { Layers, Edit3, Plus, MoreVertical, Award, Users, FolderTree, AlertTriangle, UserPlus, Trash2 } from 'lucide-react';
import { BatchPlan, Candidate, BatchGroup } from './types';
import { API } from '../../services/api';

interface BatchCardProps {
  batch: BatchPlan;
  leaderCandidate: Candidate | null;
  groups: BatchGroup[];
  memberCount: number;
  groupLeaderCount: number;
  onOpenBatch: (batchId: number) => void;
  onEditBatch: (batch: BatchPlan) => void;
  onAssignBatchLeader: (batchId: number, batchName: string) => void;
  onCreateGroup: (batchId: number) => void;
  onViewHierarchy: () => void;
  onViewUnassigned: () => void;
  onDeactivateBatch: (batchId: number, batchName: string) => void;
}

export default function BatchCard({
  batch,
  leaderCandidate,
  groups,
  memberCount,
  groupLeaderCount,
  onOpenBatch,
  onEditBatch,
  onAssignBatchLeader,
  onCreateGroup,
  onViewHierarchy,
  onViewUnassigned,
  onDeactivateBatch
}: BatchCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="border border-[#e2dfd7] rounded-3xl p-5 bg-white hover:shadow-xl transition-all flex flex-col justify-between space-y-4">
      <div>
        {/* TOP BANNER */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-[#1E2D4E] tracking-tight">{batch.name}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#1E2D4E]/10 text-[#1E2D4E]">
                {batch.batch_code}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{batch.type} Batch • Capacity: {batch.capacity}</p>
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {dropdownOpen && (
              <div
                onMouseLeave={() => setDropdownOpen(false)}
                className="absolute right-0 top-9 w-52 bg-white rounded-2xl shadow-xl border border-[#e2dfd7] z-20 py-2 text-xs font-bold text-[#1E2D4E] animate-fade-in space-y-0.5"
              >
                <button
                  onClick={() => { setDropdownOpen(false); onAssignBatchLeader(batch.id, batch.name); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <Award className="w-4 h-4 text-[#C9952A]" />
                  <span>+ Assign Batch Leader</span>
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); onCreateGroup(batch.id); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>+ Create Group</span>
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); onViewHierarchy(); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <FolderTree className="w-4 h-4 text-purple-600" />
                  <span>View Hierarchy</span>
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); onViewUnassigned(); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-rose-600" />
                  <span>View Unassigned Employees</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { setDropdownOpen(false); onDeactivateBatch(batch.id, batch.name); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Deactivate Batch</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BATCH LEADER SECTION */}
        <div className="mt-3 bg-[#F9F7F4] p-3 rounded-2xl border border-slate-200">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Batch Leader</div>
          {leaderCandidate ? (
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center border border-[#C9952A] overflow-hidden flex-shrink-0">
                {leaderCandidate.photo_url ? (
                  <img src={API.fileUrl(leaderCandidate.photo_url) || ''} alt={leaderCandidate.name} className="w-full h-full object-cover" />
                ) : (
                  leaderCandidate.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-[#1E2D4E] truncate">{leaderCandidate.name}</div>
                <div className="text-[10px] text-slate-500 font-semibold truncate">ID: {leaderCandidate.app_no}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-extrabold text-amber-700">Leader Not Assigned</span>
              <button
                onClick={() => onAssignBatchLeader(batch.id, batch.name)}
                className="text-xs font-black text-[#1E2D4E] underline hover:text-[#C9952A]"
              >
                + Assign
              </button>
            </div>
          )}
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 block uppercase">Members</span>
            <span className="font-black text-[#1E2D4E] text-sm">{memberCount} / {batch.capacity}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 block uppercase">Groups</span>
            <span className="font-black text-[#1E2D4E] text-sm">{groups.length}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 block uppercase">Group Leaders</span>
            <span className="font-black text-[#1E2D4E] text-sm">{groupLeaderCount}</span>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenBatch(batch.id)}
          className="flex-1 py-2 px-3 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white text-xs font-black text-center shadow-xs transition-colors"
        >
          Open Batch
        </button>

        <button
          onClick={() => onEditBatch(batch)}
          className="py-2 px-3.5 rounded-xl bg-white border border-[#e2dfd7] hover:bg-slate-50 text-[#1E2D4E] text-xs font-extrabold transition-colors flex items-center gap-1"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}
