import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, UserX, Award, Phone, Eye, ArrowRightLeft, Trash2, AlertTriangle, CheckCircle2, User } from 'lucide-react';
import { Candidate, BatchGroup, BatchPlan, GroupMember } from './types';
import { API } from '../../services/api';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: BatchGroup | null;
  batch: BatchPlan | null;
  groupMembers: GroupMember[];
  candidateMap: Map<string, Candidate>;
  onChangeLeader: (groupId: number, groupName: string) => void;
  onRemoveLeader: (groupId: number, groupName: string) => void;
  onAddMember: (batchId: number, groupId: number, groupName: string) => void;
  onViewMember: (candidate: Candidate) => void;
  onMoveMember: (candidateAppNo: string, memberName: string, currentGroupId: number, currentGroupName: string, currentBatchId: number) => void;
  onRemoveMember: (candidateAppNo: string, memberName: string, groupName: string) => void;
}

export default function GroupModal({
  isOpen,
  onClose,
  group,
  batch,
  groupMembers,
  candidateMap,
  onChangeLeader,
  onRemoveLeader,
  onAddMember,
  onViewMember,
  onMoveMember,
  onRemoveMember
}: GroupModalProps) {
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  if (!isOpen || !group) return null;

  const leaderCandidate = group.group_leader_app_no ? candidateMap.get(group.group_leader_app_no) : null;
  const currentMembers = groupMembers.filter(m => m.group_id === group.id);
  const memberCount = currentMembers.length;
  const capacity = group.max_members || 9;

  // Filter members inside the group
  const filteredMembers = currentMembers.filter(m => {
    const cand = candidateMap.get(m.candidate_app_no);
    if (!cand) return true;
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      (cand.name || '').toLowerCase().includes(q) ||
      (cand.app_no || '').toLowerCase().includes(q) ||
      (cand.phone || '').toLowerCase().includes(q) ||
      (cand.department || '').toLowerCase().includes(q) ||
      (cand.designation || '').toLowerCase().includes(q) ||
      (cand.section || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        {/* FIXED HEADER */}
        <div className="bg-[#1E2D4E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-white font-black flex items-center justify-center text-sm shadow-md">
              {group.name.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">{group.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#C9952A]/20 text-[#C9952A] border border-[#C9952A]/30">
                  {group.group_code}
                </span>
                {batch && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white/10 text-slate-200">
                    {batch.name} • {batch.batch_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                Group Capacity: {memberCount} / {capacity} Members
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

        {/* INTERNAL SCROLLABLE CONTENT */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#F9F7F4]">
          {/* GROUP LEADER CARD */}
          <div className="bg-white rounded-2xl p-5 border border-[#e2dfd7] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-[#C9952A]" />
                <span>GROUP LEADER</span>
              </h3>
              {leaderCandidate ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onChangeLeader(group.id, group.name)}
                    className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold transition-all"
                  >
                    Change Leader
                  </button>
                  <button
                    onClick={() => onRemoveLeader(group.id, group.name)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-extrabold transition-all"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onChangeLeader(group.id, group.name)}
                  className="px-4 py-1.5 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Assign Group Leader</span>
                </button>
              )}
            </div>

            {leaderCandidate ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7]">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-[#1E2D4E] text-white font-black flex items-center justify-center text-lg shadow-sm border-2 border-[#C9952A] overflow-hidden flex-shrink-0">
                    {leaderCandidate.photo_url ? (
                      <img src={API.fileUrl(leaderCandidate.photo_url) || ''} alt={leaderCandidate.name} className="w-full h-full object-cover" />
                    ) : (
                      leaderCandidate.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-[#1E2D4E] text-base">{leaderCandidate.name}</h4>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        Group Leader
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mt-0.5">
                      {leaderCandidate.app_no} • {leaderCandidate.designation || 'Staff'} • {leaderCandidate.department || 'General'}
                    </div>
                    {leaderCandidate.phone && (
                      <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{leaderCandidate.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onViewMember(leaderCandidate)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-slate-50 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Leader</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 flex items-center gap-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="text-xs font-black">No Group Leader Assigned</div>
                  <div className="text-[11px] font-medium text-amber-700">Assign a leader from Joined Store Directory to manage this group.</div>
                </div>
              </div>
            )}
          </div>

          {/* MEMBERS SECTION */}
          <div className="bg-white rounded-2xl p-5 border border-[#e2dfd7] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-black text-[#1E2D4E] text-sm uppercase tracking-wider">MEMBERS</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  memberCount >= capacity ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                }`}>
                  {memberCount} / {capacity}
                </span>
                {memberCount >= capacity && (
                  <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Group Full</span>
                  </span>
                )}
              </div>

              <button
                onClick={() => onAddMember(group.batch_id, group.id, group.name)}
                className="px-4 py-2 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Member</span>
              </button>
            </div>

            {/* Search Input inside modal */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
                placeholder="Search group members by name, ID, department, designation..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] transition-all"
              />
            </div>

            {/* Members List */}
            {filteredMembers.length > 0 ? (
              <div className="space-y-2.5">
                {filteredMembers.map(m => {
                  const cand = candidateMap.get(m.candidate_app_no);
                  if (!cand) {
                    return (
                      <div key={m.id} className="p-3 rounded-xl bg-slate-50 text-xs font-bold text-slate-500 border border-slate-200">
                        Employee ID: {m.candidate_app_no} (Profile details loading)
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl border border-[#e2dfd7] bg-white hover:border-[#1E2D4E]/40 hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                          {cand.photo_url ? (
                            <img src={API.fileUrl(cand.photo_url) || ''} alt={cand.name} className="w-full h-full object-cover" />
                          ) : (
                            cand.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-[#1E2D4E] truncate">{cand.name}</div>
                          <div className="text-xs text-slate-500 font-semibold truncate">
                            {cand.app_no} • {cand.department || 'Department'} • {cand.designation || 'Designation'}
                          </div>
                          {cand.phone && (
                            <div className="text-[11px] text-slate-400 font-medium">Phone: {cand.phone}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => onViewMember(cand)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#1E2D4E] text-xs font-extrabold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => onMoveMember(cand.app_no, cand.name, group.id, group.name, group.batch_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center gap-1 border border-indigo-200 transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Move</span>
                        </button>

                        <button
                          onClick={() => onRemoveMember(cand.app_no, cand.name, group.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center gap-1 border border-rose-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-xl bg-[#F9F7F4]">
                <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-extrabold text-[#1E2D4E]">No members found</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {memberSearchQuery ? 'No members matching search query' : 'This group currently has no assigned members.'}
                </p>
                <button
                  onClick={() => onAddMember(group.batch_id, group.id, group.name)}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b08020]"
                >
                  + Add First Member
                </button>
              </div>
            )}
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="bg-white px-6 py-3.5 border-t border-[#e2dfd7] flex items-center justify-between flex-shrink-0">
          <div className="text-xs font-bold text-slate-500">
            Total Members in Group: <span className="font-black text-[#1E2D4E]">{memberCount}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-black hover:bg-[#162340] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
