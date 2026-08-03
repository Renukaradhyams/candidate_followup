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
  const [scorePanel, setScorePanel] = useState<{ open: boolean; interview: any | null; questions: any[]; hrQuestions?: any[]; round: 'HR' | 'Round 2' }>({ open: false, interview: null, questions: [], round: 'HR' });
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
      
      let hrQuestions = [];
      if (round === 'Round 2' && iv.hrScore) {
        const hrQRes = await API.getInterviewQuestions(iv.desig, 'HR');
        hrQuestions = hrQRes.questions || [];
      }

      const previousScore = round === 'HR' ? iv.hrScore : iv.assignedScore;
      const initScores = questions.map((q: any) => previousScore?.scores?.[questions.indexOf(q)] || 0);

      setScorePanel({ open: true, interview: iv, questions, hrQuestions, round });
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
                            onClick={() => {
                              handleOpenScorePanel(iv, 'Round 2');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#C9952A] text-white font-bold text-[11px] hover:bg-amber-600 shadow-xs"
                          >
                            {iv.assignedScore ? 'Edit Management Score' : 'Score Management Round'}
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

      {/* Centered Score Evaluation Modal */}
      {scorePanel.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-[#1E2D4E]/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] overflow-hidden flex flex-col max-h-[90vh] my-auto animate-scale-in">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-[#e2dfd7] bg-[#1E2D4E] text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C9952A]/20 border border-[#C9952A]/40 flex items-center justify-center text-[#C9952A]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C9952A] text-white">
                      {scorePanel.round} Evaluation
                    </span>
                    <span className="text-xs font-mono font-bold text-white/70">
                      App No: {scorePanel.interview?.appNo}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-white tracking-tight leading-tight mt-0.5">
                    {scorePanel.interview?.candidate}
                  </h3>
                  <p className="text-xs text-white/80 font-medium">{scorePanel.interview?.desig}</p>
                </div>
              </div>
              <button
                onClick={() => setScorePanel({ open: false, interview: null, questions: [], round: 'HR' })}
                className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {scorePanel.round === 'Round 2' && scorePanel.interview?.hrScore && scorePanel.hrQuestions && (
                <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                  <h4 className="font-extrabold text-[#1E2D4E] text-xs uppercase tracking-wider mb-3">HR Round 1 Evaluation Summary</h4>
                  <div className="space-y-2 mb-3">
                    {scorePanel.hrQuestions.map((hq: any, idx: number) => (
                      <div key={hq.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#e2dfd7]">
                        <span className="font-bold text-[#1E2D4E] text-[11px] max-w-[80%]">{hq.text}</span>
                        <span className="font-black text-xs text-[#C9952A]">
                          {scorePanel.interview.hrScore.scores?.[idx] || 0} / {hq.max || 10}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100">
                    <span className="block text-[10px] font-black uppercase text-blue-800 mb-1">HR Remarks</span>
                    <p className="text-xs font-medium text-[#555555]">
                      {scorePanel.interview.hrScore.remarks || 'No remarks provided.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-extrabold text-[#1E2D4E] text-xs uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#C9952A]" />
                  <span>{scorePanel.round === 'Round 2' ? 'Management Evaluation Rubric' : 'Evaluation Questions & Scoring Rubric'}</span>
                </h4>
                
                {scorePanel.questions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-3">
                    <div className="flex items-start justify-between gap-3 font-bold text-[#1E2D4E]">
                      <span className="text-xs sm:text-sm font-extrabold leading-snug">{idx + 1}. {q.question}</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#1E2D4E]/10 text-[#1E2D4E] font-mono text-[11px] font-black flex-shrink-0">
                        Max: {q.max || 10}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl border border-[#e2dfd7]">
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
                        className="w-full accent-[#1E2D4E] cursor-pointer"
                      />
                      <span className="font-black text-base text-[#1E2D4E] w-8 text-center bg-[#F9F7F4] py-1 rounded-lg border border-[#e2dfd7]">
                        {scores[idx] || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Score Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1E2D4E] to-[#162340] text-white flex items-center justify-between shadow-lg border border-[#C9952A]/30">
                <div>
                  <span className="font-black text-xs uppercase tracking-wider block text-white">Aggregated Evaluation Score</span>
                  <span className="text-[11px] text-white/80 font-medium">Based on evaluator criteria points</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#C9952A]">
                    {scores.reduce((a, b) => a + b, 0)} <span className="text-sm text-white/80">/ {scorePanel.questions.reduce((s, q) => s + (q.max || 10), 0)}</span>
                  </span>
                </div>
              </div>

              {/* Remarks & Recommendation Inputs */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block font-extrabold text-[#1E2D4E] mb-1 text-xs">Evaluator Remarks &amp; Observations *</label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Provide detailed feedback regarding candidate attitude, communication, technical fit, salary expectations..."
                    className="input-modern text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-extrabold text-[#1E2D4E] mb-1 text-xs">
                      {scorePanel.round === 'HR' ? 'Expected Monthly Salary (₹)' : 'Recommended Salary (₹)'}
                    </label>
                    <input
                      type="text"
                      value={offeredSalary}
                      onChange={(e) => setOfferedSalary(e.target.value)}
                      placeholder="e.g. 25,000"
                      className="input-modern text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-extrabold text-[#1E2D4E] mb-1 text-xs">
                      {scorePanel.round === 'HR' ? 'Expected Date of Joining' : 'Recommended Date of Joining'}
                    </label>
                    <input
                      type="date"
                      value={offeredDoj}
                      onChange={(e) => setOfferedDoj(e.target.value)}
                      className="input-modern text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-end gap-3 sticky bottom-0 z-10">
              <button
                onClick={() => setScorePanel({ open: false, interview: null, questions: [], round: 'HR' })}
                className="px-5 py-2.5 rounded-xl border-2 border-[#e2dfd7] bg-white text-[#555555] font-extrabold hover:bg-black/5 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                className="px-6 py-2.5 rounded-xl bg-[#1E2D4E] text-white font-black hover:bg-[#162340] shadow-md transition-all text-xs flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-[#C9952A]" />
                <span>Save Evaluation Scorecard</span>
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
              
              {approveModal.interview?.hrScore && (
                <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]">
                  <h4 className="font-extrabold text-[#1E2D4E] text-[10px] uppercase tracking-wider mb-1">HR Round 1 Summary</h4>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[#555555]">Score:</span>
                    <span className="font-black text-[#C9952A]">{approveModal.interview.hrScore.total} / {approveModal.interview.hrScore.maxTotal}</span>
                  </div>
                  <p className="text-[#777777] font-medium italic">"{approveModal.interview.hrScore.remarks || 'No remarks.'}"</p>
                </div>
              )}

              {approveModal.interview?.assignedScore && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <h4 className="font-extrabold text-[#1E2D4E] text-[10px] uppercase tracking-wider mb-1">Round 2 Management Summary</h4>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[#555555]">Score:</span>
                    <span className="font-black text-blue-700">{approveModal.interview.assignedScore.total} / {approveModal.interview.assignedScore.maxTotal}</span>
                  </div>
                  <p className="text-[#777777] font-medium italic">"{approveModal.interview.assignedScore.remarks || 'No remarks.'}"</p>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Approval Remarks</label>
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
