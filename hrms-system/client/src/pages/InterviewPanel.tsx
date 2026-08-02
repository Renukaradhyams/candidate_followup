import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';
import { Target, Search, Share2, Copy, CheckCircle, XCircle, RefreshCw, X, Award, UserCheck, Calendar, Star } from 'lucide-react';

export default function InterviewPanelPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [interviews, setInterviews] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Scoring Side Panel
  const [scorePanel, setScorePanel] = useState<{ open: boolean; interview: any | null; questions: any[]; round: 'HR' | 'Round 2' }>({ open: false, interview: null, questions: [], round: 'HR' });
  const [scores, setScores] = useState<number[]>([]);
  const [remarks, setRemarks] = useState('');
  const [offeredSalary, setOfferedSalary] = useState('');
  const [offeredDoj, setOfferedDoj] = useState('');

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
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadInterviews();
  }, [navigate, loadInterviews]);

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

  const handleOpenScorePanel = async (iv: any, round: 'HR' | 'Round 2' = 'HR') => {
    try {
      const qRes = await API.getInterviewQuestions(iv.desig, round);
      const questions = qRes.questions || [];
      const previousScore = round === 'HR' ? iv.hrScore : iv.assignedScore;
      const initScores = questions.map((q: any) => previousScore?.scores?.[questions.indexOf(q)] || 0);

      setScorePanel({ open: true, interview: iv, questions, round });
      setScores(initScores);
      setRemarks(previousScore?.remarks || '');
      setOfferedSalary('');
      setOfferedDoj('');
    } catch (e) {
      showToast('Error loading interview questions', 'error');
    }
  };

  const handleSaveScore = async () => {
    const { interview, questions, round } = scorePanel;
    if (!interview) return;

    const total = scores.reduce((a, b) => a + b, 0);
    const maxTotal = questions.reduce((s, q) => s + (q.max || 10), 0);

    try {
      await API.saveScore(interview.appNo, round, { scores, total, maxTotal, remarks }, offeredSalary, offeredDoj);
      showToast(`${round} score saved: ${total}/${maxTotal}`, 'success');
      setScorePanel({ open: false, interview: null, questions: [], round: 'HR' });
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
    const { interview, probation } = approveModal;
    if (!interview) return;

    try {
      await API.approveSelection({
        appNo: interview.appNo,
        candName: interview.candidate,
        desig: interview.desig,
        probation,
        remarks: approveRemarks
      });

      showToast(`Candidate ${interview.candidate} approved for Selection & Offer Process!`, 'success');
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
          title="Interview Evaluation Desk"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Interview Panel' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-[#C9952A]" />
                <span>Interview Panel &amp; Scorecard</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">Score candidate technical &amp; HR rounds, generate shareable links, and approve selections.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate, app no..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] w-56 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
            {[
              { key: 'all', label: 'All Scheduled Interviews' },
              { key: 'pending', label: 'Pending HR Round 1' },
              { key: 'inprogress', label: 'In Round 2 Evaluation' },
              { key: 'completed', label: 'Completed Both Rounds' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`
                  px-4 py-2 rounded-full border transition-all duration-150 shadow-xs
                  ${activeFilter === f.key 
                    ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] font-black' 
                    : 'bg-white text-[#555555] border-[#e2dfd7] hover:bg-[#F9F7F4]'}
                `}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Interview List Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/60">
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">HR Score (Round 1)</th>
                    <th className="py-3 px-4">Round 2 Evaluator</th>
                    <th className="py-3 px-4">Round 2 Score</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filtered.map((iv) => (
                    <tr key={iv.appNo} className="hover:bg-black/5 transition-colors font-medium">
                      <td className="py-3.5 px-4 font-mono text-[#555555] font-bold">{iv.appNo}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#1E2D4E]">{iv.candidate}</td>
                      <td className="py-3.5 px-4 text-[#555555] font-semibold">{iv.desig}</td>

                      {/* HR Score */}
                      <td className="py-3.5 px-4">
                        {iv.hrScore ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${isPassing(iv.hrScore.total, iv.hrScore.maxTotal) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {iv.hrScore.total}/{iv.hrScore.maxTotal}
                          </span>
                        ) : (
                          <span className="text-[#888888] italic">Not Evaluated</span>
                        )}
                      </td>

                      {/* Evaluator Link */}
                      <td className="py-3.5 px-4">
                        {iv.assignedName ? (
                          <div className="font-bold text-[#1E2D4E]">
                            <div>{iv.assignedName}</div>
                            <div className="text-[10px] text-[#777777] font-medium">{iv.assignedDesig}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAssignModal({ open: true, interview: iv }); setEvalName(''); setEvalDesig(''); setGeneratedLink(''); }}
                            className="px-2.5 py-1 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] font-bold text-[11px] hover:bg-[#1E2D4E] hover:text-white transition-all flex items-center gap-1 shadow-xs"
                          >
                            <Share2 className="w-3 h-3" /> Assign Evaluator
                          </button>
                        )}
                      </td>

                      {/* Round 2 Score */}
                      <td className="py-3.5 px-4">
                        {iv.assignedScore ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${isPassing(iv.assignedScore.total, iv.assignedScore.maxTotal) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {iv.assignedScore.total}/{iv.assignedScore.maxTotal}
                          </span>
                        ) : (
                          <span className="text-[#888888] italic">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {session?.role !== 'Manager' && (
                            <button
                              onClick={() => handleOpenScorePanel(iv, 'HR')}
                              className="px-2.5 py-1 rounded-lg bg-[#1E2D4E] text-white font-bold text-[11px] hover:bg-[#162340] shadow-xs"
                            >
                              {iv.hrScore ? 'Edit HR Score' : 'Score HR Round'}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenScorePanel(iv, 'Round 2')}
                            className="px-2.5 py-1 rounded-lg bg-[#C9952A] text-white font-bold text-[11px] hover:bg-amber-600 shadow-xs"
                          >
                            {iv.assignedScore ? 'Edit R2 Score' : 'Score Round 2'}
                          </button>
                          <button
                            onClick={() => setApproveModal({ open: true, interview: iv, probation: false })}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 shadow-xs"
                          >
                            Approve Selection
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-[#888888] font-semibold">
                        No scheduled interviews found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Score Side Panel */}
      {scorePanel.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setScorePanel({ open: false, interview: null, questions: [], round: 'HR' })} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col z-10 space-y-4 animate-fade-in overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base">{scorePanel.round} Scorecard — {scorePanel.interview?.candidate}</h3>
                <p className="text-xs text-[#777777] font-semibold">{scorePanel.interview?.desig} · App No: {scorePanel.interview?.appNo}</p>
              </div>
              <button onClick={() => setScorePanel({ open: false, interview: null, questions: [], round: 'HR' })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 text-xs">
              {scorePanel.questions.map((q, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-2">
                  <div className="flex justify-between font-bold text-[#1E2D4E]">
                    <span>{idx + 1}. {q.question}</span>
                    <span className="text-[#C9952A] font-mono">Max: {q.max || 10}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max={q.max || 10}
                      value={scores[idx] || 0}
                      onChange={(e) => {
                        const next = [...scores];
                        next[idx] = parseInt(e.target.value) || 0;
                        setScores(next);
                      }}
                      className="w-full accent-[#1E2D4E]"
                    />
                    <span className="font-black text-sm text-[#1E2D4E] w-6 text-right">{scores[idx] || 0}</span>
                  </div>
                </div>
              ))}

              <div className="p-4 rounded-xl bg-[#1E2D4E] text-white flex justify-between items-center shadow-md">
                <span className="font-bold text-xs uppercase tracking-wider">Total Evaluated Score</span>
                <span className="text-xl font-black text-[#C9952A]">
                  {scores.reduce((a, b) => a + b, 0)} / {scorePanel.questions.reduce((s, q) => s + (q.max || 10), 0)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Evaluator Remarks &amp; Feedback *</label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Detailed remarks on communication, skills, culture fit..."
                  className="input-modern"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered Salary (₹ Monthly)</label>
                  <input type="text" value={offeredSalary} onChange={(e) => setOfferedSalary(e.target.value)} placeholder="e.g. 25,000" className="input-modern" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered DOJ</label>
                  <input type="date" value={offeredDoj} onChange={(e) => setOfferedDoj(e.target.value)} className="input-modern" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
              <button onClick={() => setScorePanel({ open: false, interview: null, questions: [], round: 'HR' })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs">
                Cancel
              </button>
              <button onClick={handleSaveScore} className="btn-primary text-xs shadow-md">
                Save Evaluation Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Evaluator Modal */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">Assign Round 2 Evaluator</h3>
              <button onClick={() => setAssignModal({ open: false, interview: null })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Evaluator Full Name *</label>
                <input type="text" value={evalName} onChange={(e) => setEvalName(e.target.value)} placeholder="e.g. Rajesh Kumar" className="input-modern" />
              </div>
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Evaluator Designation *</label>
                <input type="text" value={evalDesig} onChange={(e) => setEvalDesig(e.target.value)} placeholder="e.g. Senior Floor Manager" className="input-modern" />
              </div>

              {generatedLink && (
                <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1">
                  <span className="text-[10px] uppercase font-black text-[#777777] block">Shareable Evaluator Link</span>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={generatedLink} className="w-full bg-white p-2 rounded border text-xs font-mono" />
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedLink); showToast('Link copied to clipboard!', 'success'); }}
                      className="p-2 rounded bg-[#1E2D4E] text-white font-bold"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setAssignModal({ open: false, interview: null })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs">
                Close
              </button>
              {!generatedLink && (
                <button onClick={handleGenerateLink} className="btn-primary text-xs shadow-md">
                  Generate Shareable Link
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Selection Modal */}
      {approveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">Approve Candidate Selection</h3>
              <button onClick={() => setApproveModal({ open: false, interview: null, probation: false })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#555555] font-medium">Are you sure you want to approve candidate <strong>{approveModal.interview?.candidate}</strong> for final selection and offer issuance?</p>
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Approval Remarks *</label>
                <textarea rows={3} value={approveRemarks} onChange={(e) => setApproveRemarks(e.target.value)} placeholder="Final approval notes..." className="input-modern" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setApproveModal({ open: false, interview: null, probation: false })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs">
                Cancel
              </button>
              <button onClick={handleConfirmApprove} className="btn-gold text-xs shadow-md">
                Confirm Selection Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
