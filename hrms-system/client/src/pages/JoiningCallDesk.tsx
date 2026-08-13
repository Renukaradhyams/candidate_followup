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
  Star, Download, SlidersHorizontal, BadgeCheck, Ban, Sparkles,
  Command, Tag, CheckSquare, Square, CornerDownLeft
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled';
type DojConf    = 'Pending confirmation' | 'Confirmed' | 'Not confirmed';

interface Employee {
  appNo: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  department: string;
  section: string;
  designation: string;
  offeredDoj: string;
  photoUrl: string;
  callStatus: CallStatus;
  dojConfirmation: DojConf;
  notes: string;
  followUpDate: string;
  lastCallDate: string;
  updatedBy: string;
  updatedAt: string | null;
}

interface Analytics {
  total: number;
  callDone: number;
  pending: number;
  notReceived: number;
  wrongNumber: number;
  rescheduled: number;
  dojConfirmed: number;
  dojNotConfirmed: number;
  joiningThisWeek: number;
  overdueFollowUps: number;
  today: { callsDone: number; dojConfirmed: number; dojChanged: number; notesAdded: number };
}

interface HistoryEntry {
  id: number;
  app_no: string;
  action_type: string;
  old_value: string;
  new_value: string;
  notes: string;
  done_by: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const fmtTs = (ts: string) => {
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
};

const daysUntil = (doj?: string) => {
  if (!doj) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
    case 'call_status':      return 'Call Status Updated';
    case 'doj_confirmation': return 'DOJ Confirmation Updated';
    case 'note_added':       return 'Note Added';
    case 'doj_changed':      return 'Date of Joining Changed';
    case 'followup_set':     return 'Follow-up Date Set';
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

// ─── Text Match Highlighter ───────────────────────────────────────────────────
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(q);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return (
    <>
      {before}
      <mark className="bg-amber-200 text-[#1E2D4E] font-black rounded-xs px-0.5">{match}</mark>
      {after}
    </>
  );
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 7, color = '#10b981' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ minWidth: size }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2dfd7" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  );
}

// ─── Right Telecaller Panel (slide-over) ──────────────────────────────────────
function TelecallerPanel({ emp, session, onClose, onUpdate, matchingList, onNavigate }: {
  emp: Employee; session: UserSession | null;
  onClose: () => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
  matchingList?: Employee[];
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

  const matchIdx = matchingList?.findIndex(s => s.appNo === emp.appNo) ?? -1;

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
      await API.updateCallDeskStatus({
        appNo: emp.appNo,
        callStatus: draft.callStatus,
        dojConfirmation: draft.dojConfirmation,
        notes: draft.notes || undefined,
        followUpDate: draft.followUpDate || undefined,
        doneBy: session?.username || 'HR'
      });
      onUpdate(emp.appNo, { callStatus: draft.callStatus, dojConfirmation: draft.dojConfirmation, notes: draft.notes, followUpDate: draft.followUpDate });
      showToast('Saved call outcome!', 'success');
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
    <div className="fixed top-0 right-0 h-screen w-full sm:w-[420px] z-50 flex flex-col bg-white border-l border-[#e2dfd7] shadow-2xl overflow-hidden animate-slide-left">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#1E2D4E] to-[#2a3f6e] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {matchingList && matchIdx > 0 && (
              <button onClick={() => onNavigate?.(matchingList[matchIdx - 1])}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Previous result">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {matchingList && matchIdx < matchingList.length - 1 && (
              <button onClick={() => onNavigate?.(matchingList[matchIdx + 1])}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Next result">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {matchingList && <span className="text-white/60 text-[10.5px] font-bold ml-1">{matchIdx + 1} of {matchingList.length}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt={emp.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 shadow-lg flex-shrink-0" onError={e => { (e.target as any).style.display = 'none'; }} />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#C9952A] flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">
              {emp.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-white text-sm leading-tight truncate">{emp.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white font-mono">{emp.appNo}</span>
              <span className="text-white/70 text-[10.5px] font-semibold truncate">{emp.gender}</span>
            </div>
            <p className="text-white/60 text-[10.5px] font-medium truncate mt-0.5">{emp.designation} · {emp.section || emp.department}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <div className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${urgency === 'overdue' ? 'bg-rose-500/20 text-rose-200' : urgency === 'today' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/90'}`}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-wide opacity-70">Offered DOJ</span>
            </div>
            <div className="font-black mt-0.5">{fmtDate(emp.offeredDoj)}</div>
            {days !== null && (
              <div className="text-[10px] opacity-90 font-semibold">
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Joining today' : `${days}d remaining`}
              </div>
            )}
          </div>
          <div className="flex-1 rounded-xl px-3 py-2 bg-white/10 text-white/90 text-xs font-bold">
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Call Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.map(o => (
                <button key={o.val} onClick={() => setDraft(d => ({ ...d, callStatus: o.val }))}
                  className={`py-2.5 px-3 rounded-xl text-[11px] font-black border-2 transition-all text-left ${draft.callStatus === o.val ? o.cls + ' text-white border-transparent shadow-md scale-[1.02]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">DOJ Confirmation</label>
            <div className="grid grid-cols-3 gap-2">
              {([['Confirmed', '✅ Confirmed', 'bg-emerald-500'], ['Not confirmed', '❌ Not Confirmed', 'bg-orange-500'], ['Pending confirmation', '⏳ Pending', 'bg-slate-400']] as [DojConf, string, string][]).map(([val, label, cls]) => (
                <button key={val} onClick={() => setDraft(d => ({ ...d, dojConfirmation: val }))}
                  className={`py-2.5 px-2 rounded-xl text-[10px] font-black border-2 transition-all text-center ${draft.dojConfirmation === val ? cls + ' text-white border-transparent shadow-md scale-[1.02]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Call Notes</label>
            <textarea ref={notesRef} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} rows={3}
              placeholder="Will join morning shift, confirmed transport..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] resize-none focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10" />
          </div>

          <div>
            <label className="text-[10.5px] font-black uppercase tracking-widest text-[#777] block mb-2">Next Follow-up Date</label>
            <input type="date" value={draft.followUpDate} onChange={e => setDraft(d => ({ ...d, followUpDate: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]" />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-2xl bg-[#1E2D4E] text-white text-sm font-black hover:bg-[#162340] transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Outcome
            <span className="text-white/50 text-[9px] font-semibold ml-1 hidden sm:inline">Ctrl+Enter</span>
          </button>

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
                <div className="text-[10px] text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  ⚠ Syncs with Employee Directory & Offer Desk
                </div>
                <button onClick={handleSaveDoj} disabled={savingDoj}
                  className="w-full py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b38222] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60">
                  {savingDoj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Update DOJ
                </button>
              </div>
            )}
          </div>

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

// ─── Compact Employee Glass Card ──────────────────────────────────────────────
const EmployeeCard = React.memo(function EmployeeCard({ emp, selected, isPanelOpen, searchQuery, onSelect, onOpenPanel }: {
  emp: Employee; selected: boolean; isPanelOpen: boolean; searchQuery: string;
  onSelect: (checked: boolean) => void;
  onOpenPanel: () => void;
}) {
  const urgency = urgencyOf(emp.offeredDoj);
  const photo = fileUrl(emp.photoUrl);

  return (
    <div onClick={onOpenPanel}
      className={`card-glass p-3 rounded-2xl border-l-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${isPanelOpen ? 'ring-2 ring-[#C9952A] shadow-xl' : ''} ${urgencyBorderColor(urgency)}`}>
      {/* Top Row: Checkbox + Photo + Name + AppNo */}
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onSelect(e.target.checked); }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded accent-[#C9952A] cursor-pointer flex-shrink-0" />
        {photo ? (
          <img src={photo} alt={emp.name} className="w-10 h-10 rounded-xl object-cover border border-[#e2dfd7] flex-shrink-0" onError={e => { (e.target as any).style.display = 'none'; }} />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0">
            {emp.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-black text-[#1E2D4E] text-xs leading-tight truncate">
            <HighlightMatch text={emp.name} query={searchQuery} />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] font-mono font-bold text-[#888] bg-slate-100 px-1 rounded">
              <HighlightMatch text={emp.appNo} query={searchQuery} />
            </span>
            <span className="text-[10px] text-[#777] font-medium truncate">
              <HighlightMatch text={emp.phone} query={searchQuery} />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {urgency && urgency !== 'week' && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${urgency === 'overdue' ? 'bg-rose-100 text-rose-700' : urgency === 'today' ? 'bg-amber-100 text-amber-700' : urgency === 'tomorrow' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {urgency === 'overdue' ? 'LATE' : urgency === 'today' ? 'TODAY' : urgency === 'tomorrow' ? 'TMR' : 'SOON'}
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#C9952A] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Row 2: Dept / Section / DOJ */}
      <div className="flex items-center gap-2 mt-1.5 pl-[54px] text-[10px] text-[#666]">
        <span className="font-medium truncate flex-1">
          <HighlightMatch text={[emp.department, emp.section].filter(Boolean).join(' · ')} query={searchQuery} />
        </span>
        <span className="font-semibold text-[#888] flex-shrink-0 flex items-center gap-0.5">
          <Calendar className="w-2.5 h-2.5" />{fmtDate(emp.offeredDoj)}
        </span>
      </div>

      {/* Row 3: Call & DOJ Status Chips */}
      <div className="flex gap-1.5 mt-2 pl-[54px] flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${callStatusCls(emp.callStatus)}`}>
          {callStatusEmoji(emp.callStatus)} {emp.callStatus}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${dojConfCls(emp.dojConfirmation)}`}>
          {emp.dojConfirmation === 'Confirmed' ? '✅' : emp.dojConfirmation === 'Not confirmed' ? '❌' : '⏳'} {emp.dojConfirmation === 'Pending confirmation' ? 'Pending' : emp.dojConfirmation}
        </span>
      </div>

      {/* Row 4: Quick Action Buttons */}
      <div className="flex gap-1 mt-2 pl-[54px]" onClick={e => e.stopPropagation()}>
        <a href={`tel:${emp.phone}`} className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-0.5">
          <PhoneCall className="w-2.5 h-2.5" />Call
        </a>
        <a href={`https://wa.me/91${(emp.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
          className="px-2 py-1 rounded-lg bg-[#e8fde8] border border-[#c3f0c3] text-[10px] font-bold text-[#1a8a4a] hover:bg-[#d0f7d0] transition-colors flex items-center gap-0.5">
          <PhoneOutgoing className="w-2.5 h-2.5" />WA
        </a>
        <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Copied!', 'success'); }}
          className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
          <Copy className="w-2.5 h-2.5" />
        </button>
        <button onClick={onOpenPanel}
          className="ml-auto px-2 py-1 rounded-lg bg-[#1E2D4E] text-white text-[10px] font-bold hover:bg-[#162340] transition-colors flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5" />Update
        </button>
      </div>

      {emp.notes && (
        <div className="mt-1.5 pl-[54px]">
          <p className="text-[10px] text-purple-700 font-medium truncate">📝 {emp.notes}</p>
        </div>
      )}
    </div>
  );
});

// ─── Designation Accordion Group ──────────────────────────────────────────────
function DesigGroupCard({ designation, employees, totalCount, selectedIds, panelEmpNo, searchQuery, defaultExpanded, onSelect, onOpenPanel }: {
  designation: string;
  employees: Employee[];
  totalCount: number;
  selectedIds: Set<string>;
  panelEmpNo: string | null;
  searchQuery: string;
  defaultExpanded: boolean;
  onSelect: (appNo: string, checked: boolean) => void;
  onOpenPanel: (emp: Employee) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (searchQuery.trim()) setExpanded(true);
  }, [searchQuery]);

  const callDone = employees.filter(e => e.callStatus === 'Call done').length;
  const pending = employees.filter(e => e.callStatus === 'Pending').length;
  const notReceived = employees.filter(e => e.callStatus === 'Call not received').length;
  const dojConfirmed = employees.filter(e => e.dojConfirmation === 'Confirmed').length;

  const pct = totalCount > 0 ? Math.round((callDone / totalCount) * 100) : 0;
  const ringColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="card-glass rounded-2xl overflow-hidden border border-[#e2dfd7] shadow-xs">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center gap-3.5 hover:bg-white/80 transition-colors text-left">
        <div className="relative flex-shrink-0">
          <ProgressRing pct={pct} size={58} stroke={6} color={ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black text-[#1E2D4E]">{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#1E2D4E] text-sm">
              <HighlightMatch text={designation} query={searchQuery} />
            </h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#1E2D4E] text-white font-black">
              {employees.length} {searchQuery ? 'matching' : `of ${totalCount}`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 mt-1.5">
            <span className="text-[10px] font-bold text-emerald-600">✅ {callDone} Done</span>
            <span className="text-[10px] font-bold text-amber-600">⏳ {pending} Pending</span>
            <span className="text-[10px] font-bold text-rose-600">📵 {notReceived} No Ans</span>
            <span className="text-[10px] font-bold text-blue-600">📅 {dojConfirmed} Confirmed</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#777] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#777] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-[#e2dfd7] p-3 bg-white/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {employees.map(emp => (
              <EmployeeCard key={emp.appNo} emp={emp} selected={selectedIds.has(emp.appNo)}
                isPanelOpen={panelEmpNo === emp.appNo} searchQuery={searchQuery}
                onSelect={c => onSelect(emp.appNo, c)}
                onOpenPanel={() => onOpenPanel(emp)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Priority Follow-up Board ─────────────────────────────────────────────────
function PriorityBoard({ employees, onOpenPanel }: { employees: Employee[]; onOpenPanel: (emp: Employee) => void }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0,10);

  const lanes = [
    { key: 'today',    label: 'Joining Today',    color: 'border-amber-400 bg-amber-50/80', badge: 'bg-amber-500', emps: employees.filter(e => e.offeredDoj === todayStr) },
    { key: 'tomorrow', label: 'Joining Tomorrow',  color: 'border-orange-400 bg-orange-50/80', badge: 'bg-orange-500', emps: employees.filter(e => e.offeredDoj === tomorrowStr) },
    { key: 'overdue',  label: 'Overdue (Past DOJ)', color: 'border-rose-400 bg-rose-50/80', badge: 'bg-rose-500', emps: employees.filter(e => e.offeredDoj < todayStr && e.offeredDoj !== '') },
    { key: 'unconf',   label: 'DOJ Not Confirmed',  color: 'border-orange-300 bg-orange-50/40', badge: 'bg-orange-400', emps: employees.filter(e => e.dojConfirmation === 'Not confirmed' && e.offeredDoj > todayStr) },
  ];

  const nonEmpty = lanes.filter(l => l.emps.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="card-glass p-4">
      <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />Priority Call Queue
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {nonEmpty.map(lane => (
          <div key={lane.key} className={`rounded-2xl border-2 ${lane.color} p-3`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-5 h-5 rounded-full ${lane.badge} flex items-center justify-center text-white text-[9px] font-black`}>{lane.emps.length}</span>
              <span className="text-[10.5px] font-black text-[#1E2D4E]">{lane.label}</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {lane.emps.slice(0, 6).map(emp => (
                <button key={emp.appNo} onClick={() => onOpenPanel(emp)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-white text-left transition-all hover:shadow-xs">
                  <div className="w-6 h-6 rounded-lg bg-[#1E2D4E] flex items-center justify-center text-white font-black text-[9px] flex-shrink-0">{emp.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10.5px] font-black text-[#1E2D4E] truncate">{emp.name}</div>
                    <div className="text-[9.5px] text-[#777] font-medium">{fmtDate(emp.offeredDoj)}</div>
                  </div>
                  <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="p-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex-shrink-0">
                    <PhoneCall className="w-3 h-3" />
                  </a>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics Top Header ─────────────────────────────────────────────────────
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

      <div className="card-glass rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-[10.5px] font-black text-[#777] uppercase tracking-wider">Today's Activity:</span>
        <span className="text-[11px] font-bold text-emerald-600">✅ {analytics.today.callsDone} calls done</span>
        <span className="text-[11px] font-bold text-blue-600">📅 {analytics.today.dojConfirmed} DOJ confirmed</span>
        <span className="text-[11px] font-bold text-amber-600">✏️ {analytics.today.dojChanged} DOJ changed</span>
        <span className="text-[11px] font-bold text-purple-600">📝 {analytics.today.notesAdded} notes added</span>
      </div>
    </div>
  );
}

// ─── Sticky Bulk Action Toolbar ───────────────────────────────────────────────
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
        <button onClick={() => onAction('Call not received')} disabled={saving} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[10.5px] font-black hover:bg-rose-600 transition-colors disabled:opacity-50">阻 No Answer</button>
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

  // Master employee list
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Telecaller Right Panel
  const [panelEmp, setPanelEmp] = useState<Employee | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Command Search Input & Debounced value
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterDesig, setFilterDesig] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('');
  const [filterDojConf, setFilterDojConf] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [dojFrom, setDojFrom] = useState('');
  const [dojTo, setDojTo] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'doj_nearest' | 'pending_first' | 'overdue_first'>('doj_nearest');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search input (150ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keyboard shortcut Ctrl+K or / to focus search bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fetch full employee directory dataset for instant client search
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resDesk, resAna] = await Promise.all([
        API.getJoiningCallDesk(),
        API.getCallDeskAnalytics(),
      ]);
      if (resDesk?.employees) setAllEmployees(resDesk.employees);
      if (resAna) setAnalytics(resAna as Analytics);
    } catch (e: any) {
      showToast('Could not load call desk data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  // In-place local state update after edit
  const handleEmployeeUpdate = useCallback((appNo: string, updates: Partial<Employee>) => {
    setAllEmployees(prev => prev.map(e => e.appNo === appNo ? { ...e, ...updates } : e));
    setPanelEmp(prev => prev?.appNo === appNo ? { ...prev, ...updates } as Employee : prev);
  }, []);

  // Filtered employees list based on search and filters
  const filteredEmployees = useMemo(() => {
    let list = [...allEmployees];

    // Search query match (exact & partial across name, appNo, phone, dept, section, desig, notes)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.appNo.toLowerCase().includes(q) ||
        e.phone.includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }

    if (filterDesig)      list = list.filter(e => e.designation === filterDesig);
    if (filterCallStatus) list = list.filter(e => e.callStatus === filterCallStatus);
    if (filterDojConf)    list = list.filter(e => e.dojConfirmation === filterDojConf);
    if (filterDept)       list = list.filter(e => e.department === filterDept);
    if (filterSection)    list = list.filter(e => e.section === filterSection);
    if (filterGender)     list = list.filter(e => e.gender === filterGender);
    if (dojFrom)          list = list.filter(e => e.offeredDoj >= dojFrom);
    if (dojTo)            list = list.filter(e => e.offeredDoj <= dojTo);

    // Sorting
    if (sortBy === 'doj_nearest')      list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    else if (sortBy === 'pending_first') list.sort((a, b) => (a.callStatus === 'Pending' ? -1 : 1));
    else if (sortBy === 'overdue_first') list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    else list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [allEmployees, debouncedSearch, filterDesig, filterCallStatus, filterDojConf, filterDept, filterSection, filterGender, dojFrom, dojTo, sortBy]);

  // Group filtered employees by Designation
  const designationGroups = useMemo(() => {
    const map = new Map<string, Employee[]>();
    filteredEmployees.forEach(e => {
      const desig = e.designation || 'Unassigned';
      if (!map.has(desig)) map.set(desig, []);
      map.get(desig)!.push(e);
    });

    // Total employee counts per designation from master allEmployees
    const masterCounts = new Map<string, number>();
    allEmployees.forEach(e => {
      const desig = e.designation || 'Unassigned';
      masterCounts.set(desig, (masterCounts.get(desig) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([desig, emps]) => ({
        designation: desig,
        employees: emps,
        totalCount: masterCounts.get(desig) || emps.length,
      }))
      .sort((a, b) => a.designation.localeCompare(b.designation));
  }, [filteredEmployees, allEmployees]);

  // Auto-open panel if search yields EXACTLY 1 employee result
  useEffect(() => {
    if (debouncedSearch.trim() && filteredEmployees.length === 1) {
      setPanelEmp(filteredEmployees[0]);
    }
  }, [debouncedSearch, filteredEmployees]);

  // Unique filter dropdown options
  const uniqDepts    = useMemo(() => [...new Set(allEmployees.map(e => e.department).filter(Boolean))].sort(), [allEmployees]);
  const uniqSections = useMemo(() => [...new Set(allEmployees.map(e => e.section).filter(Boolean))].sort(), [allEmployees]);
  const uniqDesigs   = useMemo(() => [...new Set(allEmployees.map(e => e.designation).filter(Boolean))].sort(), [allEmployees]);

  // Bulk actions
  const handleBulkAction = async (callStatus?: CallStatus, dojConf?: DojConf, followUpDate?: string) => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all([...selectedIds].map(appNo =>
        API.updateCallDeskStatus({
          appNo,
          ...(callStatus ? { callStatus } : {}),
          ...(dojConf ? { dojConfirmation: dojConf } : {}),
          ...(followUpDate ? { followUpDate } : {}),
          doneBy: session?.username || 'HR'
        })
      ));
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

  const hasFilters = searchInput || filterDesig || filterCallStatus || filterDojConf || filterDept || filterSection || filterGender || dojFrom || dojTo;
  const isPanelOpen = !!panelEmp;

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isPanelOpen ? 'sm:pr-[420px]' : ''} lg:pl-64`}>
        <Topbar title="Joining Call Desk" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Joining Call Desk' }]}
          session={session} onMenuClick={() => setSidebarOpen(true)} />

        {/* Sticky CRM Command Search Bar */}
        <div className="sticky top-16 z-30 bg-[#EDE8DE]/95 backdrop-blur-md border-b border-[#e2dfd7] px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9952A]" />
              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Command Search (Name, App No, Phone, ID, Dept, Section)..."
                className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10 shadow-xs transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchInput ? (
                  <button onClick={() => setSearchInput('')} className="p-1 rounded-md hover:bg-slate-100 text-[#777]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-mono text-[#888] bg-slate-100 border border-slate-200 rounded">
                    Ctrl+K
                  </kbd>
                )}
              </div>
            </div>

            {/* Sort Dropdown */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none shadow-xs">
              <option value="doj_nearest">DOJ Nearest</option>
              <option value="name">A–Z</option>
              <option value="pending_first">Pending First</option>
              <option value="overdue_first">Overdue First</option>
            </select>

            {/* Filter Toggle */}
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${showFilters || hasFilters ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters{hasFilters ? ' ●' : ''}
            </button>

            <button onClick={loadData}
              className="p-2.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#555] hover:border-[#1E2D4E] transition-all shadow-xs">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {hasFilters && (
              <button onClick={() => { setSearchInput(''); setFilterDesig(''); setFilterCallStatus(''); setFilterDojConf(''); setFilterDept(''); setFilterSection(''); setFilterGender(''); setDojFrom(''); setDojTo(''); }}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-xs">
                <X className="w-3.5 h-3.5" />Clear Filters
              </button>
            )}
          </div>

          {/* Active Filter Chips Bar */}
          {hasFilters && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap pt-2 border-t border-[#e2dfd7]">
              <span className="text-[10px] font-black uppercase text-[#777] mr-1">Active:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10.5px] font-bold">
                  🔍 "{debouncedSearch}" <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchInput('')} />
                </span>
              )}
              {filterDesig && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10.5px] font-bold">
                  Briefcase: {filterDesig} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDesig('')} />
                </span>
              )}
              {filterCallStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                  Status: {filterCallStatus} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterCallStatus('')} />
                </span>
              )}
              {filterDojConf && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10.5px] font-bold">
                  DOJ: {filterDojConf} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDojConf('')} />
                </span>
              )}
              {filterDept && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10.5px] font-bold">
                  Dept: {filterDept} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDept('')} />
                </span>
              )}
              {filterSection && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10.5px] font-bold">
                  Sec: {filterSection} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterSection('')} />
                </span>
              )}
            </div>
          )}

          {/* Filter Drawer */}
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2 pt-2 border-t border-[#e2dfd7] animate-fade-in">
              <select value={filterDesig} onChange={e => setFilterDesig(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All Designations</option>
                {uniqDesigs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select value={filterCallStatus} onChange={e => setFilterCallStatus(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All Call Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Call done">Call done</option>
                <option value="Call not received">Call not received</option>
                <option value="Wrong number">Wrong number</option>
                <option value="Rescheduled">Rescheduled</option>
              </select>

              <select value={filterDojConf} onChange={e => setFilterDojConf(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All DOJ Confirmations</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Not confirmed">Not confirmed</option>
                <option value="Pending confirmation">Pending confirmation</option>
              </select>

              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All Departments</option>
                {uniqDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All Sections</option>
                {uniqSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none">
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          )}
        </div>

        {/* Main Body */}
        <main className={`p-4 lg:p-5 space-y-4 flex-1 overflow-y-auto ${selectedIds.size > 0 ? 'pb-20' : ''}`}>

          {/* Page Banner */}
          <div className="card-glass p-4 border-2 border-[#1E2D4E]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#1E2D4E] flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-[#C9952A]" />Joining Confirmation Call Desk
                </h2>
                <p className="text-xs text-[#666] font-medium mt-0.5">
                  Call employees to confirm joining date · Updates sync across Employee Directory & Offer Desk
                </p>
              </div>
            </div>
          </div>

          {/* Analytics Header */}
          <AnalyticsHeader analytics={analytics} loading={loading} />

          {/* Priority Queue Board */}
          <PriorityBoard employees={allEmployees} onOpenPanel={setPanelEmp} />

          {/* Search Result Summary Feedback Bar */}
          {debouncedSearch.trim() && (
            <div className="card-glass p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-black text-amber-900">
                  Showing {filteredEmployees.length} matching result{filteredEmployees.length !== 1 ? 's' : ''} for "{debouncedSearch}" across {designationGroups.length} designation{designationGroups.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={() => setSearchInput('')} className="text-xs font-bold text-amber-800 underline hover:text-amber-950">
                Clear Search
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="card-glass p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9952A]" />
              <p className="text-sm font-bold text-[#777]">Loading employee call desk...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && designationGroups.length === 0 && (
            <div className="card-glass p-12 flex flex-col items-center justify-center text-center gap-3">
              <Users className="w-12 h-12 text-[#1E2D4E]/20" />
              <div>
                <p className="font-black text-[#1E2D4E] text-base">No matching employees found</p>
                <p className="text-xs text-[#777] font-medium mt-1">
                  {debouncedSearch ? `No record matched "${debouncedSearch}". Try searching by name, phone, or App No.` : 'No joined employees found in the directory.'}
                </p>
              </div>
              {hasFilters && (
                <button onClick={() => { setSearchInput(''); setFilterDesig(''); setFilterCallStatus(''); setFilterDojConf(''); setFilterDept(''); setFilterSection(''); setFilterGender(''); setDojFrom(''); setDojTo(''); }}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340]">
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* Designation Accordion Groups */}
          {!loading && designationGroups.map(group => (
            <DesigGroupCard
              key={group.designation}
              designation={group.designation}
              employees={group.employees}
              totalCount={group.totalCount}
              selectedIds={selectedIds}
              panelEmpNo={panelEmp?.appNo || null}
              searchQuery={debouncedSearch}
              defaultExpanded={!!debouncedSearch.trim() || designationGroups.length <= 3}
              onSelect={(appNo, checked) => {
                setSelectedIds(prev => {
                  const next = new Set(prev);
                  checked ? next.add(appNo) : next.delete(appNo);
                  return next;
                });
              }}
              onOpenPanel={setPanelEmp}
            />
          ))}
        </main>
      </div>

      {/* Right Telecaller Panel */}
      {panelEmp && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setPanelEmp(null)} />
          <TelecallerPanel
            emp={panelEmp}
            session={session}
            onClose={() => setPanelEmp(null)}
            onUpdate={handleEmployeeUpdate}
            matchingList={filteredEmployees}
            onNavigate={setPanelEmp}
          />
        </>
      )}

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          saving={bulkSaving}
          onAction={(cs, dj, fu) => handleBulkAction(cs as CallStatus | undefined, dj as DojConf | undefined, fu)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
