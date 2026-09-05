import React, { useState } from 'react';
import { Layers, Edit3, UserPlus, MoreVertical, Award, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { BatchGroup, Candidate } from './types';
import { API } from '../../services/api';

interface GroupCardProps {
  group: BatchGroup;
  leaderCandidate: Candidate | null;
  memberCount: number;
  onOpenGroupModal: (group: BatchGroup) => void;
  onAddMemberDirect: (batchId: number, groupId: number, groupName: string) => void;
  onEditGroup: (group: BatchGroup) => void;
  onAssignGroupLeader: (groupId: number, groupName: string) => void;
  onDeleteGroup: (groupId: number, groupName: string) => void;
}

export default function GroupCard({
  group,
  leaderCandidate,
  memberCount,
  onOpenGroupModal,
  onAddMemberDirect,
  onEditGroup,
  onAssignGroupLeader,
  onDeleteGroup
}: GroupCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const capacity = group.max_members || 9;
  const isFull = memberCount >= capacity;
  const slotsAvailable = capacity - memberCount;

  return (
    <div className="border border-[#e2dfd7] rounded-3xl p-5 bg-white hover:shadow-xl transition-all flex flex-col justify-between space-y-4">
      <div>
        {/* GROUP HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-black text-[#1E2D4E]">{group.name}</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                {group.group_code}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {isFull ? (
                <span className="text-emerald-700 font-extrabold">✓ Group Capacity Full ({memberCount}/{capacity})</span>
              ) : (
                <span>{memberCount} / {capacity} Members • <strong className="text-sky-700">{slotsAvailable} SLOTS AVAILABLE</strong></span>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {dropdownOpen && (
              <div
                onMouseLeave={() => setDropdownOpen(false)}
                className="absolute right-0 top-8 w-44 bg-white rounded-2xl shadow-xl border border-[#e2dfd7] z-20 py-1.5 text-xs font-bold text-[#1E2D4E] animate-fade-in space-y-0.5"
              >
                <button
                  onClick={() => { setDropdownOpen(false); onAssignGroupLeader(group.id, group.name); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <Award className="w-3.5 h-3.5 text-[#C9952A]" />
                  <span>{leaderCandidate ? 'Change Leader' : '+ Assign Leader'}</span>
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); onEditGroup(group); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F9F7F4] flex items-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Edit Group</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { setDropdownOpen(false); onDeleteGroup(group.id, group.name); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-700 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Group</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* GROUP LEADER SUMMARY */}
        <div className="mt-3 bg-[#F9F7F4] p-3 rounded-2xl border border-slate-200">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Group Leader</div>
          {leaderCandidate ? (
            <div className="flex items-center gap-2.5 mt-1">
              <div className="w-8 h-8 rounded-xl bg-[#C9952A] text-white font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0">
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
              <span className="text-xs font-extrabold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Leader Not Assigned
              </span>
              <button
                onClick={() => onAssignGroupLeader(group.id, group.name)}
                className="text-[11px] font-black text-[#1E2D4E] underline hover:text-[#C9952A]"
              >
                + Assign Leader
              </button>
            </div>
          )}
        </div>

        {/* CAPACITY PROGRESS BAR */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Members Allocation</span>
            <span className="font-black text-[#1E2D4E]">{memberCount} / {capacity}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? 'bg-emerald-500' : 'bg-[#C9952A]'}`}
              style={{ width: `${Math.min(100, Math.round((memberCount / capacity) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* CARD QUICK ACTIONS */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <button
          onClick={() => onOpenGroupModal(group)}
          className="flex-1 py-2 px-3 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white text-xs font-black text-center shadow-xs transition-colors"
        >
          Open Group
        </button>

        <button
          onClick={() => onAddMemberDirect(group.batch_id, group.id, group.name)}
          className="py-2 px-3 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black transition-colors flex items-center gap-1"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Add</span>
        </button>

        <button
          onClick={() => onEditGroup(group)}
          className="py-2 px-3 rounded-xl bg-white border border-[#e2dfd7] hover:bg-slate-50 text-[#1E2D4E] text-xs font-extrabold transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
