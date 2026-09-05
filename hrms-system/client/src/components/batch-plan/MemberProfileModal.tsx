import React from 'react';
import { X, User, Phone, Mail, Building2, Briefcase, Calendar, ShieldCheck, ArrowRightLeft, Trash2, Award } from 'lucide-react';
import { Candidate, BatchPlan, BatchGroup, MemberAssignmentInfo } from './types';
import { API } from '../../services/api';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  assignmentInfo?: MemberAssignmentInfo | null;
  groupLeaderName?: string | null;
  onMove: (candidateAppNo: string, memberName: string, currentGroupId: number, currentGroupName: string, currentBatchId: number) => void;
  onRemove: (candidateAppNo: string, memberName: string, groupName: string) => void;
}

export default function MemberProfileModal({
  isOpen,
  onClose,
  candidate,
  assignmentInfo,
  groupLeaderName,
  onMove,
  onRemove
}: MemberProfileModalProps) {
  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-md overflow-hidden transform transition-all">
        {/* HEADER */}
        <div className="bg-[#1E2D4E] text-white p-6 flex flex-col items-center justify-center text-center relative">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center absolute top-4 right-4 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-20 h-20 rounded-3xl bg-[#C9952A] text-white font-black text-2xl flex items-center justify-center overflow-hidden border-4 border-white/20 shadow-xl mb-3">
            {candidate.photo_url ? (
              <img src={API.fileUrl(candidate.photo_url) || ''} alt={candidate.name} className="w-full h-full object-cover" />
            ) : (
              candidate.name.slice(0, 2).toUpperCase()
            )}
          </div>

          <h2 className="text-xl font-black text-white">{candidate.name}</h2>
          <div className="text-xs text-slate-300 font-bold mt-0.5">ID: {candidate.app_no}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Joined Store Directory</span>
          </div>
        </div>

        {/* DETAILS BODY */}
        <div className="p-6 space-y-4 bg-[#F9F7F4] text-xs">
          <div className="bg-white p-4 rounded-2xl border border-[#e2dfd7] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Department</span>
                <span className="font-extrabold text-[#1E2D4E] mt-0.5 block">{candidate.department || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Designation</span>
                <span className="font-extrabold text-[#1E2D4E] mt-0.5 block">{candidate.designation || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Phone</span>
                <span className="font-extrabold text-[#1E2D4E] mt-0.5 block">{candidate.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Date of Joining</span>
                <span className="font-extrabold text-[#1E2D4E] mt-0.5 block">
                  {candidate.actual_doj || candidate.offered_doj || 'Joined Store'}
                </span>
              </div>
            </div>
          </div>

          {/* ASSIGNMENT CONTEXT */}
          <div className="bg-white p-4 rounded-2xl border border-[#e2dfd7] space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase block">Current Group Assignment</span>

            {assignmentInfo ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between font-extrabold text-[#1E2D4E]">
                  <span>Batch:</span>
                  <span className="text-[#C9952A]">{assignmentInfo.batchName}</span>
                </div>
                <div className="flex items-center justify-between font-extrabold text-[#1E2D4E]">
                  <span>Group:</span>
                  <span className="text-indigo-700">{assignmentInfo.groupName}</span>
                </div>
                {groupLeaderName && (
                  <div className="flex items-center justify-between font-semibold text-slate-600">
                    <span>Group Leader:</span>
                    <span className="font-extrabold text-[#1E2D4E]">{groupLeaderName}</span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs font-bold text-rose-600 block mt-1">UNASSIGNED (Joined Store Pool)</span>
            )}
          </div>

          {/* ACTIONS */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            {assignmentInfo && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onMove(candidate.app_no, candidate.name, assignmentInfo.groupId, assignmentInfo.groupName, assignmentInfo.batchId);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center gap-1.5 border border-indigo-200 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Move Member</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onRemove(candidate.app_no, candidate.name, assignmentInfo.groupName);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center gap-1.5 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove Member</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white p-4 border-t border-[#e2dfd7] flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#1E2D4E] text-white font-black hover:bg-[#162340] transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
