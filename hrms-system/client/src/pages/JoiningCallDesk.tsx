import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Users, Phone, Calendar, Briefcase, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronUp, Search, Filter, RotateCcw, MessageSquare,
  History, Edit3, PhoneCall, PhoneOff, PhoneOutgoing, X, Save,
  Loader2, User, MapPin, Building2, CalendarCheck, CalendarX, Zap,
  Copy, ArrowRight, AlertTriangle, ChevronRight, ChevronLeft,
  Star, Download, SlidersHorizontal, BadgeCheck, Ban
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled';
type DojConf    = 'Pending confirmation' | 'Confirmed' | 'Not confirmed';

interface Employee {
  appNo: string; name: string; phone: string; email: string;
  gender: string; department: string; section: string; designation: string;
  offeredDoj: string; photoUrl: string;
  callStatus: CallStatus; dojConfirmation: DojConf;
  notes: string; followUpDate: string; lastCallDate: string;
  updatedBy: string; updatedAt: string | null;
}

interface DesigSummary {
  designation: string; total: number;
  callDone: number; pending: number; notReceived: number;
  wrongNumber: number; rescheduled: number;
  dojConfirmed: number; dojNotConfirmed: number;
}

interface Analytics {
  total: number; callDone: number; pending: number; notReceived: number;
  wrongNumber: number; rescheduled: number;
  dojConfirmed: number; dojNotConfirmed: number;
  joiningThisWeek: number; overdueFollowUps: number;
  today: { callsDone: number; dojConfirmed: number; dojChanged: number; notesAdded: number };
}

interface HistoryEntry {
  id: number; app_no: string; action_type: string;
  old_value: string; new_value: string; notes: string;
  done_by: string; created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtTs = (ts: string) => {
  try { return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ts; }
};

const daysUntil = (doj?: string) => {
  if (!doj) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(doj + 'T00:00:00');
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
};

const urgencyOf = (doj?: string) => {
  const d = daysUntil(doj);
  if (d === null) return null;
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 3) return 'soon';
  if (d <= 7) return 'week';
  return null;
};

const urgencyBorderColor = (u: string | null) => {
  if (u === 'overdue')  return 'border-l-rose-500';
  if (u === 'today')    return 'border-l-amber-400';
  if (u === 'tomorrow') return 'border-l-orange-400';
  if (u === 'soon')     return 'border-l-yellow-400';
  if (u === 'week')     return 'border-l-blue-400';
  return 'border-l-[#1E2D4E]/20';
};

const callStatusCls = (s: string) => {
  if (s === 'Call done')         return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'Call not received') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (s === 'Wrong number')      return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'Rescheduled')       return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const dojConfCls = (s: string) => {
  if (s === 'Confirmed')     return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'Not confirmed') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

const callStatusEmoji = (s: string) => {
  if (s === 'Call done')         return '✅';
  if (s === 'Call not received') return '📵';
  if (s === 'Wrong number')      return '❌';
  if (s === 'Rescheduled')       return '📅';
  return '⏳';
};

const historyActionLabel = (t: string) => {
  switch (t) {
    case 'call_status':   return 'Call Status Updated';
    case 'doj_confirmation': return 'DOJ Confirmation Updated';
    case 'note_added':    return 'Note Added';
    case 'doj_changed':   return 'Date of Joining Changed';
    case 'followup_set':  return 'Follow-up Date Set';
    default: return t;
  }
};

const historyActionColor = (t: string) => {
  switch (t) {
    case 'call_status':      return 'bg-emerald-100 text-emerald-700';
    case 'doj_confirmation': return 'bg-blue-100 text-blue-700';
    case 'note_added':       return 'bg-purple-100 text-purple-700';
    case 'doj_changed':      return 'bg-amber-100 text-amber-700';
    case 'followup_set':     return 'bg-indigo-100 text-indigo-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const fileUrl = (url?: string | null) => {
  if (!url) return null;
  let c = url.trim();
  if (!c) return null;
  if (c.startsWith('http://') || c.startsWith('https://')) return c;
  if (c.startsWith('uploads/')) c = '/' + c;
  const fn = c.split('/').pop() || c;
  if (fn.startsWith('photo') && !c.includes('applicants')) return `/uploads/candidate-photos/${fn}`;
  if (c.startsWith('/uploads/')) return c;
  return `/uploads/misc/${fn}`;
};

// ─── Progress Ring SVG ────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 7, color = '#10b981' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ minWidth: size }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2dfd7" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  );
}

// ─── Telecaller Panel (right slide-over) ─────────────────────────────────────
function TelecallerPanel({ emp, session, onClose, onUpdate, siblings, onNavigate }: {
  emp: Employee; session: UserSession | null;
  onClose: () => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
  siblings?: Employee[];
  onNavigate?: (emp: Employee) => void;
}) {
  const [draft, setDraft] = useState({ callStatus: emp.callStatus, dojConfirmation: emp.dojConfirmation, notes: emp.notes || '', followUpDate: emp.followUpDate || '' });
  const [editDoj, setEditDoj] = useState(false);
  const [newDoj, setNewDoj] = useState(emp.offeredDoj || '');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDoj, setSavingDoj] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const sibIdx = siblings?.findIndex(s => s.appNo === emp.appNo) ?? -1;

  useEffect(() => {
    setDraft({ callStatus: emp.callStatus, dojConfirmation: emp.dojConfirmation, notes: emp.notes || '', followUpDate: emp.followUpDate || '' });
    setEditDoj(false);
    setNewDoj(emp.offeredDoj || '');
    setShowHistory(false);
    setHistory([]);
  }, [emp.appNo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.updateCallDeskStatus({ appNo: emp.appNo, callStatus: draft.callStatus, dojConfirmation: draft.dojConfirmation, notes: draft.notes || undefined, followUpDate: draft.followUpDate || undefined, doneBy: session?.username || 'HR' });
      onUpdate(emp.appNo, { callStatus: draft.callStatus, dojConfirmation: draft.dojConfirmation, notes: draft.notes, followUpDate: draft.followUpDate });
      showToast('Saved!', 'success');
    } catch (e: any) { showToast('Failed: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveDoj = async () => {
    if (!newDoj) { showToast('Select a date', 'error'); return; }
    setSavingDoj(true);
    try {
      await API.updateCallDeskDOJ({ appNo: emp.appNo, newDoj, doneBy: session?.username || 'HR' });
      onUpdate(emp.appNo, { offeredDoj: newDoj });
      setEditDoj(false);
      showToast('DOJ updated in Employee Directory & Call Desk!', 'success');
    } catch (e: any) { showToast('Failed: ' + e.message, 'error'); }
    finally { setSavingDoj(false); }
  };

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true);
    if (history.length > 0) return;
    setLoadingHistory(true);
    try {
      const res = await API.getCallDeskHistory(emp.appNo);
      setHistory(res.history || []);
    } catch { } finally { setLoadingHistory(false); }
  };

  const days = daysUntil(emp.offeredDoj);
  const urgency = urgencyOf(emp.offeredDoj);
  const photo = fileUrl(emp.photoUrl);

  const CALL_OUTCOMES: { val: CallStatus; label: string; cls: string }[] = [
    { val: 'Call done',         label: '✅ Call Done',     cls: 'bg-emerald-500 hover:bg-emerald-600' },
    { val: 'Call not received', label: '📵 No Answer',     cls: 'bg-rose-500 hover:bg-rose-600' },
    { val: 'Wrong number',      label: '❌ Wrong No.',     cls: 'bg-red-500 hover:bg-red-600' },
    { val: 'Rescheduled',       label: '📅 Rescheduled',   cls: 'bg-blue-500 hover:bg-blue-600' },
    { val: 'Pending',           label: '⏳ Pending',       cls: 'bg-amber-500 hover:bg-amber-600' },
  ];

  return (
    <div className="fixed top-0 right-0 h-screen w-full sm:w-[400px] z-50 flex flex-col bg-white border-l border-[#e2dfd7] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#1E2D4E] to-[#2a3f6e] px-4 pt-4 pb-3">
        {/* Nav row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {siblings && sibIdx > 0 && (
              <button onClick={() => onNavigate?.(siblings[sibIdx - 1])}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors" title="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {siblings && sibIdx < siblings.length - 1 && (
              <button onClick={() => onNavigate?.(siblings[sibIdx + 1])}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors" title="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {siblings && <span className="text-white/50 text-[10px] font-bold ml-1">{sibIdx + 1}/{siblings.length}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {/* Employee info */}
        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt={emp.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 shadow-lg flex-shrink-0" onError={e => { (e.target as any).style.display = 'none'; }} />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#C9952A] flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">{emp.name.charAt(0).toUpperCase()}</div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-white text-sm leading-tight truncate">{emp.name}</h3>
            <p className="text-white/70 text-[11px] font-semibold mt-0.5 truncate">{emp.designation}</p>
            <p className="text-white/50 text-[10.5px] font-medium truncate">{[emp.department, emp.section].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {/* DOJ + phone row */}
        <div className="mt-3 flex gap-2">
          <div className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${urgency === 'overdue' ? 'bg-rose-500/20 text-rose-200' : urgency === 'today' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/80'}`}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-wide opacity-70">DOJ</span>
            </div>
            <div className="font-black mt-0.5">{fmtDate(emp.offeredDoj)}</div>
            {days !== null && (
              <div className="text-[10px] opacity-80">
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Joining today' : `${days}d remaining`}
              </div>
            )}
          </div>
          <div className="flex-1 rounded-xl px-3 py-2 bg-white/10 text-white/80 text-xs font-bold">
            <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /><span className="text-[10px] font-black uppercase tracking-wide opacity-70">Phone</span></div>
            <div className="font-black mt-0.5 text-[11px]">{emp.phone || '—'}</div>
            <div className="flex gap-1.5 mt-1">
              <a href={`tel:${emp.phone}`} className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[9px] font-black hover:bg-emerald-600 transition-colors">📞 Call</a>
              <a href={`https://wa.me/91${(emp.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="px-2 py-0.5 rounded-lg bg-[#25D366] text-white text-[9px] font-black hover:bg-[#1EB957] transition-colors">💬 WA</a>
              <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Copied!', 'success'); }}
                className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[9px] font-black hover:bg-white/30 transition-colors">📋</button>
            </div>
          </div>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* ── Call Outcome ─── */}
          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Call Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.map(o => (
                <button key={o.val} onClick={() => setDraft(d => ({ ...d, callStatus: o.val }))}
                  className={`py-2.5 px-3 rounded-xl text-[11px] font-black border-2 transition-all text-left ${draft.callStatus === o.val ? o.cls + ' text-white border-transparent shadow-lg scale-[1.02]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── DOJ Confirmation ─── */}
          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">DOJ Confirmation</label>
            <div className="grid grid-cols-3 gap-2">
              {([['Confirmed', '✅ Confirmed', 'bg-emerald-500'], ['Not confirmed', '❌ Not Confirmed', 'bg-orange-500'], ['Pending confirmation', '⏳ Pending', 'bg-slate-400']] as [DojConf, string, string][]).map(([val, label, cls]) => (
                <button key={val} onClick={() => setDraft(d => ({ ...d, dojConfirmation: val }))}
                  className={`py-2.5 px-2 rounded-xl text-[10px] font-black border-2 transition-all text-center ${draft.dojConfirmation === val ? cls + ' text-white border-transparent shadow-lg scale-[1.02]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ─── */}
          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Notes</label>
            <textarea ref={notesRef} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} rows={3}
              placeholder="Will join, requesting shift change..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] resize-none focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10 transition-all" />
          </div>

          {/* ── Follow-up Date ─── */}
          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Next Follow-up</label>
            <input type="date" value={draft.followUpDate} onChange={e => setDraft(d => ({ ...d, followUpDate: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] transition-all" />
          </div>

          {/* ── Save ─── */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-2xl bg-[#1E2D4E] text-white text-sm font-black hover:bg-[#162340] transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-60 active:scale-[0.98]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Outcome
            <span className="text-white/50 text-[9px] font-semibold ml-1 hidden sm:inline">Ctrl+Enter</span>
          </button>

          {/* ── Edit DOJ ─── */}
          <div className="bg-[#F9F7F4] rounded-2xl border border-[#e2dfd7] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] font-black uppercase tracking-widest text-[#777]">Date of Joining</span>
              <button onClick={() => setEditDoj(e => !e)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${editDoj ? 'bg-[#1E2D4E] text-white' : 'bg-white border border-[#e2dfd7] text-[#555] hover:border-[#C9952A] hover:text-[#C9952A]'}`}>
                <Edit3 className="w-2.5 h-2.5" />{editDoj ? 'Cancel' : 'Edit DOJ'}
              </button>
            </div>
            <div className="text-sm font-black text-[#1E2D4E]">{fmtDate(emp.offeredDoj)}</div>
            {editDoj && (
              <div className="mt-2 space-y-2 animate-fade-in">
                <input type="date" value={newDoj} onChange={e => setNewDoj(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]" />
                <div className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  ⚠ Updates Employee Directory & Offer Desk simultaneously
                </div>
                <button onClick={handleSaveDoj} disabled={savingDoj}
                  className="w-full py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b38222] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60">
                  {savingDoj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Update DOJ
                </button>
              </div>
            )}
          </div>

          {/* ── History ─── */}
          <div>
            <button onClick={loadHistory}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[11px] font-bold text-[#555] hover:border-[#C9952A] hover:text-[#1E2D4E] transition-all">
              <span className="flex items-center gap-2"><History className="w-3.5 h-3.5 text-[#C9952A]" />Call History</span>
              {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2 animate-fade-in">
                {history.length === 0 && !loadingHistory && (
                  <div className="text-center py-4 text-[#999] text-xs">No history yet</div>
                )}
                {history.map((h, i) => (
                  <div key={h.id} className="flex gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${historyActionColor(h.action_type)}`}>
                        {h.action_type === 'call_status' ? '📞' : h.action_type === 'doj_changed' ? '📅' : h.action_type === 'note_added' ? '📝' : '·'}
                      </div>
                    </div>
                    <div className="flex-1 bg-[#F9F7F4] rounded-xl px-3 py-2 border border-[#e2dfd7]">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10.5px] font-black text-[#1E2D4E]">{historyActionLabel(h.action_type)}</span>
                        <span className="text-[9px] text-[#aaa] font-medium flex-shrink-0">{fmtTs(h.created_at)}</span>
                      </div>
                      {h.old_value && h.new_value && h.action_type !== 'note_added' && (
                        <div className="flex items-center gap-1.5 text-[10px] mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 line-through">{h.old_value}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-[#aaa]" />
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{h.new_value}</span>
                        </div>
                      )}
                      {h.notes && h.action_type !== 'note_added' && <p className="text-[10px] text-[#666] font-medium">{h.notes}</p>}
                      {h.action_type === 'note_added' && <p className="text-[10px] text-purple-700 font-medium bg-purple-50 rounded px-1.5 py-1">{h.new_value}</p>}
                      <p className="text-[9px] text-[#bbb] mt-1">by {h.done_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Card (compact) ──────────────────────────────────────────────────
const EmployeeCard = React.memo(function EmployeeCard({ emp, selected, isPanelOpen, onSelect, onOpenPanel }: {
  emp: Employee; selected: boolean; isPanelOpen: boolean;
  onSelect: (checked: boolean) => void;
  onOpenPanel: () => void;
}) {
  const urgency = urgencyOf(emp.offeredDoj);
  const photo = fileUrl(emp.photoUrl);

  return (
    <div onClick={onOpenPanel}
      className={`card-glass p-3 rounded-2xl border-l-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 group ${isPanelOpen ? 'ring-2 ring-[#C9952A]/40 shadow-lg' : ''} ${urgencyBorderColor(urgency)}`}>
      {/* Row 1 */}
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onSelect(e.target.checked); }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded accent-[#C9952A] cursor-pointer flex-shrink-0" />
        {photo ? (
          <img src={photo} alt={emp.name} className="w-9 h-9 rounded-xl object-cover border border-[#e2dfd7] flex-shrink-0" onError={e => { (e.target as any).style.display = 'none'; }} />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0">
            {emp.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-black text-[#1E2D4E] text-xs leading-tight truncate">{emp.name}</div>
          <div className="text-[10px] text-[#888] font-medium truncate">{emp.phone}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {urgency && urgency !== 'week' && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${urgency === 'overdue' ? 'bg-rose-100 text-rose-700' : urgency === 'today' ? 'bg-amber-100 text-amber-700' : urgency === 'tomorrow' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {urgency === 'overdue' ? '⚠LATE' : urgency === 'today' ? '📅TODAY' : urgency === 'tomorrow' ? 'TMR' : 'SOON'}
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#C9952A] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {/* Row 2: section + DOJ */}
      <div className="flex items-center gap-2 mt-1.5 pl-[52px]">
        {emp.section && <span className="text-[10px] text-[#666] font-medium truncate flex-1">{emp.section}</span>}
        <span className="text-[10px] text-[#888] font-semibold flex-shrink-0 flex items-center gap-0.5">
          <Calendar className="w-2.5 h-2.5" />{fmtDate(emp.offeredDoj)}
        </span>
      </div>
      {/* Row 3: status chips */}
      <div className="flex gap-1.5 mt-2 pl-[52px] flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${callStatusCls(emp.callStatus)}`}>
          {callStatusEmoji(emp.callStatus)} {emp.callStatus}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${dojConfCls(emp.dojConfirmation)}`}>
          {emp.dojConfirmation === 'Confirmed' ? '✅' : emp.dojConfirmation === 'Not confirmed' ? '❌' : '⏳'} {emp.dojConfirmation === 'Pending confirmation' ? 'Pending' : emp.dojConfirmation}
        </span>
      </div>
      {/* Row 4: quick actions */}
      <div className="flex gap-1 mt-2 pl-[52px]" onClick={e => e.stopPropagation()}>
        <a href={`tel:${emp.phone}`} className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-0.5">
          <PhoneCall className="w-2.5 h-2.5" />Call
        </a>
        <a href={`https://wa.me/91${(emp.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
          className="px-2.5 py-1 rounded-lg bg-[#e8fde8] border border-[#c3f0c3] text-[10px] font-bold text-[#1a8a4a] hover:bg-[#d0f7d0] transition-colors flex items-center gap-0.5">
          <PhoneOutgoing className="w-2.5 h-2.5" />WA
        </a>
        <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Copied!', 'success'); }}
          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
          <Copy className="w-2.5 h-2.5" />
        </button>
        <button onClick={onOpenPanel}
          className="ml-auto px-2.5 py-1 rounded-lg bg-[#1E2D4E] text-white text-[10px] font-bold hover:bg-[#162340] transition-colors flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5" />Update
        </button>
      </div>
      {emp.notes && (
        <div className="mt-1.5 pl-[52px]">
          <p className="text-[10px] text-purple-600 font-medium truncate">📝 {emp.notes}</p>
        </div>
      )}
    </div>
  );
});

// ─── Designation Group Card (with lazy loading) ───────────────────────────────
function DesigGroupCard({ summary, session, empByDesig, selectedIds, panelEmpNo, onSelect, onOpenPanel, onUpdate, onExpand }: {
  summary: DesigSummary; session: UserSession | null;
  empByDesig: Map<string, Employee[]>;
  selectedIds: Set<string>;
  panelEmpNo: string | null;
  onSelect: (appNo: string, checked: boolean) => void;
  onOpenPanel: (emp: Employee) => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
  onExpand: (desig: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const employees = empByDesig.get(summary.designation);
  const pct = summary.total > 0 ? Math.round((summary.callDone / summary.total) * 100) : 0;
  const ringColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const handleToggle = () => {
    if (!expanded && !employees) {
      setLoading(true);
      onExpand(summary.designation);
    }
    setExpanded(e => !e);
  };

  useEffect(() => {
    if (employees) setLoading(false);
  }, [employees]);

  return (
    <div className="card-glass rounded-2xl overflow-hidden">
      <button onClick={handleToggle} className="w-full p-4 flex items-center gap-3 hover:bg-[#F9F7F4] transition-colors text-left">
        {/* Progress ring */}
        <div className="relative flex-shrink-0">
          <ProgressRing pct={pct} size={60} stroke={7} color={ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black text-[#1E2D4E]">{pct}%</span>
          </div>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#1E2D4E] text-sm">{summary.designation}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E2D4E]/10 text-[#1E2D4E] font-black">{summary.total}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-0.5 mt-1.5">
            <span className="text-[10px] font-bold text-emerald-600">✅ {summary.callDone} Done</span>
            <span className="text-[10px] font-bold text-amber-600">⏳ {summary.pending} Pending</span>
            <span className="text-[10px] font-bold text-rose-600">📵 {summary.notReceived} No Ans</span>
            <span className="text-[10px] font-bold text-blue-600">📅 {summary.dojConfirmed} Conf</span>
            <span className="text-[10px] font-bold text-orange-600">⚠ {summary.dojNotConfirmed} Unconf</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-[#e2dfd7] rounded-full overflow-hidden w-full max-w-[200px]">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: ringColor }} />
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#777] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#777] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-[#e2dfd7] p-3">
          {loading && (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#C9952A]" /></div>
          )}
          {!loading && employees && employees.length === 0 && (
            <div className="text-center py-4 text-[#999] text-xs">No employees</div>
          )}
          {!loading && employees && employees.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {employees.map(emp => (
                <EmployeeCard key={emp.appNo} emp={emp} selected={selectedIds.has(emp.appNo)}
                  isPanelOpen={panelEmpNo === emp.appNo}
                  onSelect={c => onSelect(emp.appNo, c)}
                  onOpenPanel={() => onOpenPanel(emp)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Follow-up Priority Board ─────────────────────────────────────────────────
function FollowUpBoard({ employees, onOpenPanel }: { employees: Employee[]; onOpenPanel: (emp: Employee) => void }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0,10);

  const lanes = [
    { key: 'today',    label: 'Joining Today',    color: 'border-amber-400 bg-amber-50', badge: 'bg-amber-500', emps: employees.filter(e => e.offeredDoj === todayStr) },
    { key: 'tomorrow', label: 'Joining Tomorrow',  color: 'border-orange-400 bg-orange-50', badge: 'bg-orange-500', emps: employees.filter(e => e.offeredDoj === tomorrowStr) },
    { key: 'overdue',  label: 'Overdue (Past DOJ)', color: 'border-rose-400 bg-rose-50', badge: 'bg-rose-500', emps: employees.filter(e => e.offeredDoj < todayStr && e.offeredDoj !== '') },
    { key: 'unconf',   label: 'Not Confirmed',     color: 'border-orange-300 bg-orange-50/50', badge: 'bg-orange-400', emps: employees.filter(e => e.dojConfirmation === 'Not confirmed' && e.offeredDoj > todayStr) },
  ];

  const nonEmpty = lanes.filter(l => l.emps.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="card-glass p-4">
      <h3 className="font-black text-[#1E2D4E] text-sm flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />Priority Follow-up Board
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {nonEmpty.map(lane => (
          <div key={lane.key} className={`rounded-2xl border-2 ${lane.color} p-3`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-5 h-5 rounded-full ${lane.badge} flex items-center justify-center text-white text-[9px] font-black`}>{lane.emps.length}</span>
              <span className="text-[10.5px] font-black text-[#1E2D4E]">{lane.label}</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {lane.emps.slice(0, 5).map(emp => (
                <button key={emp.appNo} onClick={() => onOpenPanel(emp)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-white text-left transition-all hover:shadow-sm">
                  <div className="w-6 h-6 rounded-lg bg-[#1E2D4E] flex items-center justify-center text-white font-black text-[9px] flex-shrink-0">{emp.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] font-black text-[#1E2D4E] truncate">{emp.name}</div>
                    <div className="text-[9.5px] text-[#777] font-medium">{fmtDate(emp.offeredDoj)}</div>
                  </div>
                  <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="p-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex-shrink-0">
                    <PhoneCall className="w-3 h-3" />
                  </a>
                </button>
              ))}
              {lane.emps.length > 5 && <div className="text-[10px] text-center text-[#777] font-medium pt-1">+{lane.emps.length - 5} more</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics Header ─────────────────────────────────────────────────────────
function AnalyticsHeader({ analytics, loading }: { analytics: Analytics | null; loading: boolean }) {
  if (loading || !analytics) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {Array(8).fill(0).map((_, i) => <div key={i} className="card-glass h-20 rounded-2xl animate-pulse bg-[#e2dfd7]/50" />)}
    </div>
  );
  const cards = [
    { label: 'Total',       value: analytics.total,           icon: Users,         color: 'text-[#1E2D4E]',  bg: 'bg-[#1E2D4E]/5' },
    { label: 'Calls Done',  value: analytics.callDone,        icon: CheckCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending',     value: analytics.pending,         icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'No Answer',   value: analytics.notReceived,     icon: PhoneOff,      color: 'text-rose-600',    bg: 'bg-rose-50' },
    { label: 'DOJ Conf',    value: analytics.dojConfirmed,    icon: CalendarCheck, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Unconfirmed', value: analytics.dojNotConfirmed, icon: CalendarX,     color: 'text-orange-600',  bg: 'bg-orange-50' },
    { label: 'This Week',   value: analytics.joiningThisWeek, icon: Star,          color: 'text-[#C9952A]',   bg: 'bg-amber-50' },
    { label: 'Overdue Fup', value: analytics.overdueFollowUps,icon: AlertTriangle, color: 'text-red-600',     bg: 'bg-red-50' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`card-glass rounded-2xl p-3 ${c.bg}`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className={`text-2xl font-black ${c.color} mt-1`}>{c.value}</div>
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">{c.label}</div>
            </div>
          );
        })}
      </div>
      {/* Today's activity strip */}
      <div className="card-glass rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-[10.5px] font-black text-[#777] uppercase tracking-wider">Today:</span>
        <span className="text-[11px] font-bold text-emerald-600">✅ {analytics.today.callsDone} calls done</span>
        <span className="text-[11px] font-bold text-blue-600">📅 {analytics.today.dojConfirmed} DOJ confirmed</span>
        <span className="text-[11px] font-bold text-amber-600">✏️ {analytics.today.dojChanged} DOJ changed</span>
        <span className="text-[11px] font-bold text-purple-600">📝 {analytics.today.notesAdded} notes</span>
      </div>
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────
function BulkActionBar({ count, saving, onAction, onClear }: {
  count: number; saving: boolean;
  onAction: (call?: CallStatus, doj?: DojConf, followUpDate?: string) => void;
  onClear: () => void;
}) {
  const [fpDate, setFpDate] = useState('');
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1E2D4E] border-t border-white/10 shadow-2xl animate-slide-up">
      <div className="lg:pl-64 px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-white text-xs font-black mr-2 flex-shrink-0">{count} selected</span>
        <button onClick={() => onAction('Call done')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10.5px] font-black hover:bg-emerald-600 transition-colors disabled:opacity-50">✅ Mark Done</button>
        <button onClick={() => onAction('Call not received')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[10.5px] font-black hover:bg-rose-600 transition-colors disabled:opacity-50">📵 No Answer</button>
        <button onClick={() => onAction('Pending')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10.5px] font-black hover:bg-amber-600 transition-colors disabled:opacity-50">⏳ Pending</button>
        <button onClick={() => onAction('Wrong number')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10.5px] font-black hover:bg-red-600 transition-colors disabled:opacity-50">❌ Wrong No</button>
        <div className="h-5 w-px bg-white/20 hidden sm:block" />
        <button onClick={() => onAction(undefined, 'Confirmed')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[10.5px] font-black hover:bg-blue-600 transition-colors disabled:opacity-50">📅 DOJ Confirmed</button>
        <button onClick={() => onAction(undefined, 'Not confirmed')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[10.5px] font-black hover:bg-orange-600 transition-colors disabled:opacity-50">⚠ Not Conf</button>
        <div className="flex items-center gap-1">
          <input type="date" value={fpDate} onChange={e => setFpDate(e.target.value)} title="Set follow-up date"
            className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold border border-white/20 focus:outline-none" />
          {fpDate && <button onClick={() => { onAction(undefined, undefined, fpDate); setFpDate(''); }} disabled={saving}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-black hover:bg-indigo-600 transition-colors">Set FU</button>}
        </div>
        <button onClick={onClear} className="ml-auto px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10.5px] font-bold hover:bg-white/20 transition-colors flex items-center gap-1">
          <X className="w-3 h-3" />Clear
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JoiningCallDeskPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summaries, setSummaries] = useState<DesigSummary[]>([]);
  const [empByDesig, setEmpByDesig] = useState<Map<string, Employee[]>>(new Map());
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [summariesLoading, setSummariesLoading] = useState(true);

  // Panel
  const [panelEmp, setPanelEmp] = useState<Employee | null>(null);
  const [panelDesig, setPanelDesig] = useState<string>('');

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('');
  const [filterDojConf, setFilterDojConf] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [dojFrom, setDojFrom] = useState('');
  const [dojTo, setDojTo] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'doj_nearest' | 'pending_first' | 'overdue_first'>('doj_nearest');
  const [showFilters, setShowFilters] = useState(false);

  // Load initial data (summaries + analytics — fast)
  const loadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    try {
      const res = await API.getCallDeskSummary();
      if (res?.summaries) setSummaries(res.summaries);
    } catch (e: any) { showToast('Could not load summaries', 'error'); }
    finally { setSummariesLoading(false); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await API.getCallDeskAnalytics();
      if (res) setAnalytics(res as Analytics);
    } catch { }
    finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    setSession(Auth.get());
    loadSummaries();
    loadAnalytics();
  }, [navigate, loadSummaries, loadAnalytics]);

  // Lazy-load employees for a designation
  const handleExpand = useCallback(async (desig: string) => {
    if (empByDesig.has(desig)) return;
    try {
      const res = await API.getCallDeskByDesignation(desig);
      if (res?.employees) {
        setEmpByDesig(prev => new Map(prev).set(desig, res.employees));
      }
    } catch (e: any) { showToast('Could not load employees: ' + e.message, 'error'); }
  }, [empByDesig]);

  // In-place employee update (no refetch)
  const handleEmployeeUpdate = useCallback((appNo: string, updates: Partial<Employee>) => {
    setEmpByDesig(prev => {
      const next = new Map(prev);
      next.forEach((emps, desig) => {
        const idx = emps.findIndex(e => e.appNo === appNo);
        if (idx >= 0) {
          const updated = [...emps];
          updated[idx] = { ...updated[idx], ...updates };
          next.set(desig, updated);
        }
      });
      return next;
    });
    // Update panel if it's the same employee
    setPanelEmp(prev => prev?.appNo === appNo ? { ...prev, ...updates } as Employee : prev);
    // Update designation summary counters
    if (updates.callStatus || updates.dojConfirmation) {
      setEmpByDesig(prev => {
        // Recompute summary for affected designation
        prev.forEach((emps, desig) => {
          const emp = emps.find(e => e.appNo === appNo);
          if (emp) {
            const updated = { ...emp, ...updates };
            setSummaries(sums => sums.map(s => {
              if (s.designation !== desig) return s;
              // Rebuild from fresh employee list
              const freshEmps = emps.map(e => e.appNo === appNo ? updated : e);
              return {
                ...s,
                callDone:      freshEmps.filter(e => e.callStatus === 'Call done').length,
                pending:       freshEmps.filter(e => e.callStatus === 'Pending').length,
                notReceived:   freshEmps.filter(e => e.callStatus === 'Call not received').length,
                wrongNumber:   freshEmps.filter(e => e.callStatus === 'Wrong number').length,
                rescheduled:   freshEmps.filter(e => e.callStatus === 'Rescheduled').length,
                dojConfirmed:  freshEmps.filter(e => e.dojConfirmation === 'Confirmed').length,
                dojNotConfirmed: freshEmps.filter(e => e.dojConfirmation === 'Not confirmed').length,
              };
            }));
          }
        });
        return prev;
      });
      // Also update analytics totals live
      setAnalytics(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          callDone:        summaries.reduce((a, s) => a + s.callDone, 0),
          pending:         summaries.reduce((a, s) => a + s.pending, 0),
          notReceived:     summaries.reduce((a, s) => a + s.notReceived, 0),
          dojConfirmed:    summaries.reduce((a, s) => a + s.dojConfirmed, 0),
          dojNotConfirmed: summaries.reduce((a, s) => a + s.dojNotConfirmed, 0),
        };
      });
    }
  }, [summaries]);

  // All flat employees (from loaded designations — for follow-up board + filters)
  const allLoaded = useMemo(() => {
    const all: Employee[] = [];
    empByDesig.forEach(emps => all.push(...emps));
    return all;
  }, [empByDesig]);

  // Filtered summaries (designation-level filter)
  const filteredSummaries = useMemo(() => {
    let s = [...summaries];
    if (filterDesig) s = s.filter(x => x.designation === filterDesig);
    if (filterCallStatus) s = s.filter(x => {
      if (filterCallStatus === 'Call done') return x.callDone > 0;
      if (filterCallStatus === 'Pending') return x.pending > 0;
      if (filterCallStatus === 'Call not received') return x.notReceived > 0;
      return true;
    });
    return s;
  }, [summaries, filterDesig, filterCallStatus]);

  // Filtered employees for expanded cards
  const getFilteredEmps = useCallback((desig: string) => {
    const emps = empByDesig.get(desig) || [];
    let list = [...emps];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.phone.includes(q) || e.appNo.toLowerCase().includes(q) || (e.section || '').toLowerCase().includes(q));
    }
    if (filterCallStatus) list = list.filter(e => e.callStatus === filterCallStatus);
    if (filterDojConf) list = list.filter(e => e.dojConfirmation === filterDojConf);
    if (filterDept) list = list.filter(e => e.department === filterDept);
    if (filterSection) list = list.filter(e => e.section === filterSection);
    if (dojFrom) list = list.filter(e => e.offeredDoj >= dojFrom);
    if (dojTo) list = list.filter(e => e.offeredDoj <= dojTo);
    if (sortBy === 'doj_nearest') list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    else if (sortBy === 'pending_first') list.sort((a, b) => (a.callStatus === 'Pending' ? -1 : 1));
    else if (sortBy === 'overdue_first') list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [empByDesig, search, filterCallStatus, filterDojConf, filterDept, filterSection, dojFrom, dojTo, sortBy]);

  // Unique filter options from all loaded employees
  const uniqDepts    = useMemo(() => [...new Set(allLoaded.map(e => e.department).filter(Boolean))].sort(), [allLoaded]);
  const uniqSections = useMemo(() => [...new Set(allLoaded.map(e => e.section).filter(Boolean))].sort(), [allLoaded]);

  // Bulk actions
  const handleBulkAction = async (callStatus?: CallStatus, dojConf?: DojConf, followUpDate?: string) => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all([...selectedIds].map(appNo =>
        API.updateCallDeskStatus({ appNo, ...(callStatus ? { callStatus } : {}), ...(dojConf ? { dojConfirmation: dojConf } : {}), ...(followUpDate ? { followUpDate } : {}), doneBy: session?.username || 'HR' })
      ));
      // Update locally
      selectedIds.forEach(appNo => {
        const updates: Partial<Employee> = {};
        if (callStatus) updates.callStatus = callStatus;
        if (dojConf) updates.dojConfirmation = dojConf;
        if (followUpDate) updates.followUpDate = followUpDate;
        handleEmployeeUpdate(appNo, updates);
      });
      showToast(`Updated ${selectedIds.size} employees`, 'success');
      setSelectedIds(new Set());
    } catch (e: any) { showToast('Bulk update failed: ' + e.message, 'error'); }
    finally { setBulkSaving(false); }
  };

  const hasFilters = search || filterDesig || filterCallStatus || filterDojConf || filterDept || filterSection || dojFrom || dojTo;
  const panelSiblings = panelEmp ? (empByDesig.get(panelEmp.designation) || []) : [];
  const isPanelOpen = !!panelEmp;

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isPanelOpen ? 'sm:pr-[400px]' : ''} lg:pl-64`}>
        <Topbar title="Joining Call Desk" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Joining Call Desk' }]}
          session={session} onMenuClick={() => setSidebarOpen(true)} />

        {/* Sticky Filter Bar */}
        <div className="sticky top-16 z-30 bg-[#EDE8DE]/95 backdrop-blur-md border-b border-[#e2dfd7] px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9952A]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, App No, section..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] shadow-xs" />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none shadow-xs">
              <option value="doj_nearest">DOJ Nearest</option>
              <option value="name">A–Z</option>
              <option value="pending_first">Pending First</option>
              <option value="overdue_first">Overdue First</option>
            </select>
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs ${showFilters || hasFilters ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters{hasFilters ? ' ●' : ''}
            </button>
            <button onClick={() => { loadSummaries(); loadAnalytics(); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#555] hover:border-[#1E2D4E] transition-all shadow-xs">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {hasFilters && <button onClick={() => { setSearch(''); setFilterDesig(''); setFilterCallStatus(''); setFilterDojConf(''); setFilterDept(''); setFilterSection(''); setDojFrom(''); setDojTo(''); }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-xs">
              <X className="w-3 h-3" />Clear
            </button>}
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2 pt-2 border-t border-[#e2dfd7] animate-fade-in">
              {[
                { label: 'Designation', value: filterDesig, opts: summaries.map(s => s.designation), set: setFilterDesig },
                { label: 'Call Status', value: filterCallStatus, opts: ['Pending', 'Call done', 'Call not received', 'Wrong number', 'Rescheduled'], set: setFilterCallStatus },
                { label: 'DOJ Confirm', value: filterDojConf, opts: ['Pending confirmation', 'Confirmed', 'Not confirmed'], set: setFilterDojConf },
                { label: 'Department', value: filterDept, opts: uniqDepts, set: setFilterDept },
                { label: 'Section', value: filterSection, opts: uniqSections, set: setFilterSection },
              ].map(f => (
                <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none focus:border-[#1E2D4E]">
                  <option value="">{f.label}</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              <div className="flex gap-1">
                <input type="date" value={dojFrom} onChange={e => setDojFrom(e.target.value)} title="DOJ From"
                  className="flex-1 px-2 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[10px] font-bold text-[#1E2D4E] outline-none" />
                <input type="date" value={dojTo} onChange={e => setDojTo(e.target.value)} title="DOJ To"
                  className="flex-1 px-2 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[10px] font-bold text-[#1E2D4E] outline-none" />
              </div>
            </div>
          )}
        </div>

        <main className={`p-4 lg:p-5 space-y-4 flex-1 overflow-y-auto ${selectedIds.size > 0 ? 'pb-20' : ''}`}>

          {/* Page Header */}
          <div className="card-glass p-4 border-2 border-[#1E2D4E]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#1E2D4E] flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-[#C9952A]" />Joining Confirmation Call Desk
                </h2>
                <p className="text-xs text-[#666] font-medium mt-0.5">
                  Call employees to confirm joining · Updates sync across Employee Directory & Offer Desk
                </p>
              </div>
            </div>
          </div>

          {/* Analytics */}
          <AnalyticsHeader analytics={analytics} loading={analyticsLoading} />

          {/* Follow-up Priority Board */}
          <FollowUpBoard employees={allLoaded} onOpenPanel={emp => { setPanelEmp(emp); setPanelDesig(emp.designation); }} />

          {/* Summary loading */}
          {summariesLoading && (
            <div className="card-glass p-10 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9952A]" />
              <p className="text-sm font-bold text-[#777]">Loading designation groups...</p>
            </div>
          )}

          {/* Select All row */}
          {!summariesLoading && filteredSummaries.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#777]">
                {filteredSummaries.length} designation{filteredSummaries.length !== 1 ? 's' : ''} · {summaries.reduce((a, s) => a + s.total, 0)} employees
                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
              </span>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-rose-600 hover:underline">Deselect All</button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!summariesLoading && filteredSummaries.length === 0 && (
            <div className="card-glass p-12 flex flex-col items-center gap-4 text-center">
              <Users className="w-12 h-12 text-[#1E2D4E]/20" />
              <div>
                <p className="font-black text-[#1E2D4E] text-base">No results</p>
                <p className="text-sm text-[#777] font-medium mt-1">
                  {summaries.length === 0 ? 'No joined employees with a DOJ in the Employee Directory.' : 'Try adjusting your filters.'}
                </p>
              </div>
            </div>
          )}

          {/* Designation Groups */}
          {!summariesLoading && filteredSummaries.map(summary => {
            // Build a filtered empMap for this designation
            const filteredEmpsMap = new Map(empByDesig);
            const rawEmps = empByDesig.get(summary.designation);
            if (rawEmps) {
              filteredEmpsMap.set(summary.designation, getFilteredEmps(summary.designation));
            }
            return (
              <DesigGroupCard key={summary.designation} summary={summary} session={session}
                empByDesig={filteredEmpsMap}
                selectedIds={selectedIds}
                panelEmpNo={panelEmp?.appNo || null}
                onSelect={(appNo, checked) => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    checked ? next.add(appNo) : next.delete(appNo);
                    return next;
                  });
                }}
                onOpenPanel={emp => { setPanelEmp(emp); setPanelDesig(emp.designation); }}
                onUpdate={handleEmployeeUpdate}
                onExpand={handleExpand}
              />
            );
          })}
        </main>
      </div>

      {/* Right Telecaller Panel */}
      {panelEmp && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setPanelEmp(null)} />
          <TelecallerPanel
            emp={panelEmp}
            session={session}
            onClose={() => setPanelEmp(null)}
            onUpdate={handleEmployeeUpdate}
            siblings={panelSiblings}
            onNavigate={emp => { setPanelEmp(emp); setPanelDesig(emp.designation); }}
          />
        </>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar count={selectedIds.size} saving={bulkSaving}
          onAction={(cs, dj, fu) => handleBulkAction(cs as CallStatus | undefined, dj as DojConf | undefined, fu)}
          onClear={() => setSelectedIds(new Set())} />
      )}
    </div>
  );
}
