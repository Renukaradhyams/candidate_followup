import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';

function InterviewFormContent() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<Record<number, number>>({});
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing evaluation token link.');
      setLoading(false);
      return;
    }

    API.call('getInterviewByToken', { token })
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'Token expired or invalid.');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleScore = (qIdx: number, val: number) => {
    setScores(prev => ({ ...prev, [qIdx]: val }));
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = (data?.questions?.length || 5) * 15;
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const handleSubmit = async () => {
    if (Object.keys(scores).length < (data?.questions?.length || 5)) {
      showToast('Please rate all evaluation questions', 'error');
      return;
    }
    if (!remarks.trim() || remarks.trim().length < 5) {
      showToast('Please enter mandatory remarks (min 5 characters)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.call('submitInterviewScore', {
        token,
        scores,
        totalScore,
        maxScore,
        pct,
        remarks
      });

      if (res.success) {
        setSubmitted(true);
        showToast('Evaluation submitted successfully!', 'success');
      } else {
        showToast(res.error || 'Submission failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4">
        <div className="text-xs font-bold text-[#1E2D4E] animate-pulse">Loading Interview Evaluation Form...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-red-200 text-center space-y-3 max-w-md shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 font-bold text-xl flex items-center justify-center mx-auto">✕</div>
          <h2 className="font-black text-[#1E2D4E] text-base">Evaluation Link Error</h2>
          <p className="text-xs text-red-600 font-medium">{error || 'Unable to load evaluation form.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-[#e0ddd8] text-center space-y-4 max-w-md shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 font-black text-3xl flex items-center justify-center mx-auto">✓</div>
          <h2 className="font-black text-[#1E2D4E] text-xl">Feedback Submitted!</h2>
          <p className="text-xs text-[#888888]">Thank you for submitting your candidate evaluation score.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDE8DE] p-4 lg:p-6">
      <ToastContainer />
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-[#1E2D4E] p-4 rounded-2xl text-white flex items-center justify-between shadow-lg">
          <div>
            <h1 className="font-extrabold text-base">Candidate Evaluation Form</h1>
            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">BSC Interview Panel Portal</div>
          </div>
          <div className="px-3 py-1 rounded-full bg-[#C9952A] text-white font-extrabold text-xs">
            {data.round || 'Round 2'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e0ddd8] shadow-md space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#e0ddd8] pb-3">
            <div>
              <div className="font-black text-sm text-[#1E2D4E]">{data.candidateName}</div>
              <div className="text-[11px] text-[#888888]">{data.designation} · {data.appNo}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#888888] font-bold">Evaluator</div>
              <div className="font-bold text-[#1E2D4E]">{data.evaluatorName || 'Panelist'}</div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {(data.questions || []).map((q: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                <div className="font-bold text-[#1E2D4E]">
                  {idx + 1}. {typeof q === 'string' ? q : (q?.text || q?.question || '')}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[0, 3, 6, 9, 12, 15].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleScore(idx, val)}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-black transition-all border
                        ${scores[idx] === val 
                          ? 'bg-[#1E2D4E] text-white border-transparent shadow' 
                          : 'bg-white text-[#1E2D4E] border-[#e0ddd8] hover:bg-black/5'}
                      `}
                    >
                      {val} pts
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="p-4 rounded-xl bg-[#FFF7E6] border border-amber-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-amber-800 uppercase">Total Evaluation Score</div>
                <div className="text-xl font-black text-[#1E2D4E]">{totalScore} / {maxScore}</div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg font-black text-xs ${pct >= 60 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                {pct}% ({pct >= 60 ? 'PASS' : 'FAIL'})
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Evaluator Remarks *</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter mandatory evaluation feedback and observations..."
                className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] text-xs"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340] disabled:opacity-50"
            >
              {submitting ? 'Submitting Score...' : 'Submit Final Evaluation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EvaluatorInterviewFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center text-xs font-bold text-[#1E2D4E]">Loading...</div>}>
      <InterviewFormContent />
    </Suspense>
  );
}
