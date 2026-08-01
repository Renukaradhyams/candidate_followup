"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { Target, Search, Share2, Copy, CheckCircle, XCircle, RefreshCw, X, Award } from 'lucide-react';

export default function InterviewPanelPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [interviews, setInterviews] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Scoring Side Panel
  const [scorePanel, setScorePanel] = useState<{ open: boolean; interview: any | null; questions: any[] }>({ open: false, interview: null, questions: [] });
  const [scores, setScores] = useState<number[]>([]);
  const [remarks, setRemarks] = useState('');

  // Assign Evaluator Modal
  const [assignModal, setAssignModal] = useState<{ open: boolean; interview: any | null }>({ open: false, interview: null });
  const [evalName, setEvalName] = useState('');
  const [evalDesig, setEvalDesig] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Approve / Reject Modal
  const [approveModal, setApproveModal] = useState<{ open: boolean; interview: any | null; probation: boolean }>({ open: false, interview: null, probation: false });
  const [approveRemarks, setApproveRemarks] = useState('');

  // New Role Modal
  const [newRoleModal, setNewRoleModal] = useState<{ open: boolean; interview: any | null }>({ open: false, interview: null });
  const [newDesig, setNewDesig] = useState('');
  const [newRoleRemarks, setNewRoleRemarks] = useState('');

  const loadInterviews = useCallback(async () => {
    try {
      const res = await API.getInterviews();
      if (res && res.interviews) {
        setInterviews(res.interviews);
      }
    } catch (err: any) {
      showToast('Could not load interviews: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      router.replace('/login');
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadInterviews();
  }, [router, loadInterviews]);

  useEffect(() => {
    let list = [...interviews];

    if (activeFilter === 'pending') list = list.filter(i => !i.hrScore);
    if (activeFilter === 'inprogress') list = list.filter(i => i.hrScore && !i.assignedScore);
    if (activeFilter === 'completed') list = list.filter(i => i.hrScore && i.assignedScore);

    if (session?.role === 'Manager') {
      list = list.filter(i => !!i.hrScore);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.candidate.toLowerCase().includes(q) || i.appNo.toLowerCase().includes(q));
    }

    setFiltered(list);
  }, [interviews, activeFilter, searchQuery, session]);

  const isPassing = (score: number, max: number) => (score / (max || 1)) * 100 >= 60;

  const handleOpenScorePanel = async (iv: any) => {
    try {
      const qRes = await API.getInterviewQuestions(iv.desig, 'HR');
      const questions = qRes.questions || [];
      const initScores = questions.map((q: any) => iv.hrScore?.scores?.[questions.indexOf(q)] || 0);

      setScorePanel({ open: true, interview: iv, questions });
      setScores(initScores);
      setRemarks(iv.hrScore?.remarks || '');
    } catch (e) {
      showToast('Error loading interview questions', 'error');
    }
  };

  const handleSaveScore = async () => {
    if (!remarks.trim() || remarks.trim().length < 5) {
      showToast('Remarks are mandatory before saving', 'error');
      return;
    }
    const { interview, questions } = scorePanel;
    if (!interview) return;

    const total = scores.reduce((a, b) => a + b, 0);
    const maxTotal = questions.reduce((s, q) => s + (q.max || 10), 0);

    try {
      await API.saveScore(interview.appNo, 'HR', { scores, total, maxTotal, remarks });
      showToast(`HR score saved: ${total}/${maxTotal}`, 'success');
      setScorePanel({ open: false, interview: null, questions: [] });
      loadInterviews();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleGenerateLink = async () => {
    if (!evalName.trim() || !evalDesig.trim()) {
      showToast('Evaluator name and designation are required', 'error');
      return;
    }
    const { interview } = assignModal;
    if (!interview) return;

    try {
      const res = await API.generateInterviewToken({
        appNo: interview.appNo,
        candidate: interview.candidate,
        desig: interview.desig,
        assignedName: evalName,
        assignedDesig: evalDesig
      });

      setGeneratedLink(res.link);
      showToast('Shareable evaluator link generated!', 'success');
      loadInterviews();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleConfirmApprove = async () => {
    if (!approveRemarks.trim()) {
      showToast('Remarks are mandatory', 'error');
      return;
    }
    const { interview, probation } = approveModal;
    if (!interview) return;

    try {
      await API.approveSelection({
        appNo: interview.appNo,
        candidate: interview.candidate,
        desig: interview.desig,
        remarks: approveRemarks,
        probation
      });
      showToast(`${interview.candidate} selected! Moved to Offer Process`, 'success');
      setApproveModal({ open: false, interview: null, probation: false });
      loadInterviews();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Interview Panel"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Interview Panel' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Tabs Bar */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Not Started' },
              { key: 'inprogress', label: 'Round 1 Done' },
              { key: 'completed', label: 'Both Rounds Done' }
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveFilter(t.key)}
                className={`
                  px-4 py-2 rounded-xl border transition-all
                  ${activeFilter === t.key 
                    ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm' 
                    : 'bg-white text-[#666666] border-[#e0ddd8] hover:bg-black/5'}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Table Card */}
          <div className="card-glass p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-sm">Scheduled Interviews</h3>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-xs text-[#1E2D4E]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888] tracking-wider">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Interview Date</th>
                    <th className="py-2.5 px-3">HR Round</th>
                    <th className="py-2.5 px-3">Round 2 (Assigned)</th>
                    <th className="py-2.5 px-3">Overall</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {filtered.length > 0 ? (
                    filtered.map((iv) => {
                      const allDone = iv.hrScore && iv.assignedScore;
                      const hrTotal = iv.hrScore?.total || 0;
                      const hrMax = iv.hrScore?.maxTotal || 35;
                      const r2Total = iv.assignedScore?.total || 0;
                      const r2Max = iv.assignedScore?.maxTotal || 65;
                      const grandTotal = hrTotal + r2Total;
                      const grandMax = hrMax + r2Max;
                      const pass = isPassing(grandTotal, grandMax);

                      return (
                        <tr key={iv.appNo} className="hover:bg-black/5 transition-colors font-medium">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#1E2D4E] text-white font-black text-[10px] flex items-center justify-center">
                                {iv.initials}
                              </div>
                              <div>
                                <div className="font-bold text-[#1E2D4E]">{iv.candidate}</div>
                                <div className="text-[10px] text-[#888888] font-mono">{iv.appNo}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#555555]">{iv.desig}</td>
                          <td className="py-3 px-3 text-[#666666] font-semibold">{iv.interviewDate || '—'}</td>
                          <td className="py-3 px-3">
                            {iv.hrScore ? (
                              <span className={`sc-chip ${isPassing(hrTotal, hrMax) ? 'sc-done' : 'sc-fail'}`}>
                                HR: {hrTotal}/{hrMax}
                              </span>
                            ) : (
                              <span className="sc-chip sc-pending">HR: —</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {iv.assignedScore ? (
                              <span className={`sc-chip ${isPassing(r2Total, r2Max) ? 'sc-done' : 'sc-fail'}`}>
                                R2: {r2Total}/{r2Max}
                              </span>
                            ) : iv.assignedName ? (
                              <span className="badge b-short">{iv.assignedName}</span>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-bold">⚠️ Assign needed</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {allDone ? (
                              <span className={`badge ${pass ? 'b-sel' : 'b-rej'}`}>
                                {grandTotal}/{grandMax} ({Math.round((grandTotal / grandMax) * 100)}%)
                              </span>
                            ) : (
                              <span className="text-[#888888]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {!iv.hrScore && session?.role !== 'Manager' && (
                                <button
                                  onClick={() => handleOpenScorePanel(iv)}
                                  className="px-2.5 py-1 rounded-md bg-[#1E2D4E] text-white font-bold hover:bg-[#162340] text-[11px]"
                                >
                                  Score HR Round
                                </button>
                              )}
                              {iv.hrScore && !iv.assignedName && session?.role !== 'Manager' && (
                                <button
                                  onClick={() => {
                                    setAssignModal({ open: true, interview: iv });
                                    setEvalName(''); setEvalDesig(''); setGeneratedLink('');
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-amber-500 text-white font-bold hover:bg-amber-600 text-[11px]"
                                >
                                  🔗 Assign Round 2
                                </button>
                              )}
                              {allDone && (
                                <button
                                  onClick={() => setApproveModal({ open: true, interview: iv, probation: !pass })}
                                  className={`px-2.5 py-1 rounded-md text-white font-bold text-[11px] ${pass ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'}`}
                                >
                                  {pass ? '✓ Select' : '✓ Probation'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#888888] font-semibold">
                        No scheduled interviews found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Evaluation Side Panel */}
      {scorePanel.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScorePanel({ open: false, interview: null, questions: [] })} />

          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">{scorePanel.interview?.candidate}</h3>
                <div className="text-[11px] text-white/60">{scorePanel.interview?.desig} · HR Evaluation</div>
              </div>
              <button onClick={() => setScorePanel({ open: false, interview: null, questions: [] })}>
                <X className="w-5 h-5 text-white/70 hover:text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {scorePanel.questions.map((q, idx) => (
                <div key={q.id} className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                  <div className="font-bold text-[#1E2D4E]">{q.text} (Max {q.max} pts)</div>
                  
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: q.max }).map((_, i) => {
                      const val = i + 1;
                      const isSelected = scores[idx] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            const newS = [...scores];
                            newS[idx] = val;
                            setScores(newS);
                          }}
                          className={`
                            w-8 h-8 rounded-lg font-bold border transition-all text-xs
                            ${isSelected 
                              ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' 
                              : 'bg-white text-[#666666] border-[#e0ddd8] hover:border-[#1E2D4E]'}
                          `}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase text-[#777777]">
                  Mandatory HR Remarks <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter assessment remarks (mandatory)..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#e0ddd8] bg-[#F9F7F4]">
              <button
                onClick={handleSaveScore}
                className="w-full py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340]"
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Evaluator Modal */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <h3 className="font-black text-[#1E2D4E] text-base">Assign Round 2 Evaluator</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Evaluator Name *</label>
                <input
                  type="text"
                  value={evalName}
                  onChange={(e) => setEvalName(e.target.value)}
                  placeholder="Full name"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Designation *</label>
                <input
                  type="text"
                  value={evalDesig}
                  onChange={(e) => setEvalDesig(e.target.value)}
                  placeholder="e.g. Floor Supervisor"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              {generatedLink && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Shareable Evaluator Link</div>
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="w-full p-2 text-[11px] rounded border border-emerald-300 bg-white font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        showToast('Link copied!', 'success');
                      }}
                      className="flex-1 py-1.5 rounded bg-[#1E2D4E] text-white font-bold text-[11px]"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssignModal({ open: false, interview: null })}
                className="px-4 py-2 rounded-lg border border-[#e0ddd8] text-xs font-bold text-[#666666]"
              >
                Close
              </button>
              {!generatedLink && (
                <button
                  onClick={handleGenerateLink}
                  className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold"
                >
                  Generate Link
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
