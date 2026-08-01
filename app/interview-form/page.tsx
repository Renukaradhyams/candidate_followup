"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { API } from '../../services/api';
import ToastContainer, { showToast } from '../../components/Toast';

export default function EvaluatorInterviewFormPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any | null>(null);

  const [scores, setScores] = useState<number[]>([]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing interview token link');
      setLoading(false);
      return;
    }

    API.call('getInterviewByToken', { token })
      .then(res => {
        if (res && res.success) {
          setData(res);
          const qList = res.questions || [];
          setScores(new Array(qList.length).fill(0));
        } else {
          setError(res.error || 'Invalid or expired interview token link');
        }
      })
      .catch(err => {
        setError('Error fetching interview data: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmitScore = async () => {
    if (!remarks.trim() || remarks.trim().length < 5) {
      showToast('Mandatory remarks are required (min 5 chars)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const total = scores.reduce((a, b) => a + b, 0);
      const res = await API.call('submitInterviewScore', {
        token,
        scores,
        total,
        remarks
      });

      if (res && res.success) {
        setSubmitted(true);
        showToast('Assessment submitted successfully!', 'success');
      } else {
        showToast('Submission failed: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4 text-xs font-bold text-[#1E2D4E]">
        Loading evaluation form...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-red-200 text-center space-y-3">
          <div className="text-2xl">⚠️</div>
          <h2 className="font-extrabold text-base text-red-700">Link Invalid or Expired</h2>
          <p className="text-xs text-[#888888]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EDE8DE] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-emerald-200 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h2 className="font-black text-xl text-[#1E2D4E]">Assessment Submitted</h2>
          <p className="text-xs text-[#888888]">Thank you {data?.assignedName}. Your evaluation for {data?.candidate} has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDE8DE] p-4 lg:p-6">
      <ToastContainer />

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-[#1E2D4E] p-5 rounded-2xl text-white shadow-xl flex items-center justify-between">
          <div>
            <h1 className="font-black text-base leading-tight">BSC Candidate Assessment</h1>
            <div className="text-[11px] text-white/60 mt-0.5">Assigned to: {data?.assignedName} ({data?.assignedDesig})</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#C9952A] font-black flex items-center justify-center text-xs">
            BSC
          </div>
        </div>

        {/* Candidate Summary */}
        <div className="bg-white p-5 rounded-2xl border border-[#e0ddd8] shadow-md space-y-2 text-xs">
          <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Candidate Profile</div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-[#888888]">Name:</span> <b className="text-[#1E2D4E]">{data?.candidate}</b></div>
            <div><span className="text-[#888888]">App No:</span> <b className="font-mono">{data?.appNo}</b></div>
            <div><span className="text-[#888888]">Designation:</span> <b>{data?.desig}</b></div>
          </div>
        </div>

        {/* Evaluation Form */}
        <div className="bg-white p-6 rounded-2xl border border-[#e0ddd8] shadow-xl space-y-5 text-xs">
          <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2">
            Round 2 Questions (Score 1 to Max)
          </div>

          {data?.questions?.map((q: any, idx: number) => (
            <div key={q.id} className="p-4 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
              <div className="font-bold text-[#1E2D4E]">{q.text} (Max {q.max} pts)</div>

              <div className="flex flex-wrap gap-1.5">
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
                        w-9 h-9 rounded-lg font-bold border transition-all text-xs
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

          <div className="space-y-1.5 pt-2">
            <label className="block text-[10px] font-extrabold uppercase text-[#777777]">
              Mandatory Evaluator Remarks <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Detailed assessment feedback and recommendation (mandatory)..."
              className="w-full p-3 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] focus:outline-none focus:border-[#1E2D4E]"
            />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitScore}
            className="w-full py-3.5 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340] disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Final Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}
