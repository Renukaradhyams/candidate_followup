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
  Command, Tag, CheckSquare, Square, CornerDownLeft, Eye, ShieldCheck,
  FileSpreadsheet, Activity, Flame, CheckCircle2
} from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled';
type DojConf    = 'Pending confirmation' | 'Confirmed' | 'Not confirmed';
type QuickFilterType = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'confirmed' | 'pending' | 'no_answer';

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

interface SessionActivityLog {
  id: string;
  time: string;
  empName: string;
  appNo: string;
  actionType: 'call_status' | 'doj_confirmed' | 'doj_not_confirmed' | 'doj_changed' | 'note_added' | 'followup_scheduled';
  description: string;
  doneBy: string;
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
  if (u === 'tomorrow') return 'border-l-blue-400';
  if (u === 'soon')     return 'border-l-yellow-400';
  if (u === 'week')     return 'border-l-emerald-400';
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
function ProgressRing({ pct, size = 48, stroke = 4, color = '#C9952A' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2dfd7" strokeWidth={stroke} fill="transparent" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="transparent"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
    </svg>
  );
}

// ─── Centered 880px × 80vh Profile Popup Modal Card ────────────────────────────
function ProfileModal({
  emp, session, onClose, onUpdate, onLogSessionActivity, matchingList, onNavigate
}: {
  emp: Employee;
  session: UserSession | null;
  onClose: () => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
  onLogSessionActivity: (entry: Omit<SessionActivityLog, 'id' | 'time'>) => void;
  matchingList?: Employee[];
  onNavigate?: (emp: Employee) => void;
}) {
  const [callStatus, setCallStatus] = useState<CallStatus>(emp.callStatus || 'Pending');
  const [dojConf, setDojConf] = useState<DojConf>(emp.dojConfirmation || 'Pending confirmation');
  const [notes, setNotes] = useState(emp.notes || '');
  const [followUpDate, setFollowUpDate] = useState(emp.followUpDate || '');
  const [editDoj, setEditDoj] = useState(false);
  const [newDoj, setNewDoj] = useState(emp.offeredDoj || '');
  const [saving, setSaving] = useState(false);
  const [savingDoj, setSavingDoj] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setCallStatus(emp.callStatus || 'Pending');
    setDojConf(emp.dojConfirmation || 'Pending confirmation');
    setNotes(emp.notes || '');
    setFollowUpDate(emp.followUpDate || '');
    setNewDoj(emp.offeredDoj || '');
    setEditDoj(false);
    setShowHistory(false);
  }, [emp]);

  const currentIndex = matchingList ? matchingList.findIndex(e => e.appNo === emp.appNo) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = matchingList && currentIndex >= 0 && currentIndex < matchingList.length - 1;

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setLoadingHistory(true);
    setShowHistory(true);
    try {
      const res = await API.getCallDeskHistory(emp.appNo);
      if (res?.history) setHistory(res.history);
    } catch (e: any) {
      showToast('Could not load call history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async (andNext = false) => {
    setSaving(true);
    try {
      const doneByUser = session?.username || 'HR';
      await API.updateCallDeskStatus({
        appNo: emp.appNo,
        callStatus,
        dojConfirmation: dojConf,
        notes,
        followUpDate,
        doneBy: doneByUser
      });

      onUpdate(emp.appNo, {
        callStatus,
        dojConfirmation: dojConf,
        notes,
        followUpDate,
        lastCallDate: new Date().toISOString().slice(0, 10),
        updatedBy: doneByUser,
        updatedAt: new Date().toISOString()
      });

      if (callStatus !== emp.callStatus) {
        onLogSessionActivity({
          empName: emp.name,
          appNo: emp.appNo,
          actionType: 'call_status',
          description: `Call outcome set to "${callStatus}"`,
          doneBy: doneByUser
        });
      }
      if (dojConf !== emp.dojConfirmation) {
        onLogSessionActivity({
          empName: emp.name,
          appNo: emp.appNo,
          actionType: dojConf === 'Confirmed' ? 'doj_confirmed' : 'doj_not_confirmed',
          description: `DOJ confirmation updated to "${dojConf}"`,
          doneBy: doneByUser
        });
      }
      if (notes && notes !== emp.notes) {
        onLogSessionActivity({
          empName: emp.name,
          appNo: emp.appNo,
          actionType: 'note_added',
          description: `Added note: "${notes.slice(0, 30)}${notes.length > 30 ? '...' : ''}"`,
          doneBy: doneByUser
        });
      }
      if (followUpDate && followUpDate !== emp.followUpDate) {
        onLogSessionActivity({
          empName: emp.name,
          appNo: emp.appNo,
          actionType: 'followup_scheduled',
          description: `Follow-up date scheduled for ${fmtDate(followUpDate)}`,
          doneBy: doneByUser
        });
      }

      showToast(`Updated status for ${emp.name}!`, 'success');
      if (andNext && hasNext && matchingList && onNavigate) {
        onNavigate(matchingList[currentIndex + 1]);
      } else if (!andNext) {
        onClose();
      }
    } catch (e: any) {
      showToast('Failed to save update: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDoj = async () => {
    if (!newDoj) { showToast('Please select a valid date', 'error'); return; }
    setSavingDoj(true);
    try {
      const doneByUser = session?.username || 'HR';
      await API.updateCallDeskDOJ({
        appNo: emp.appNo,
        newDoj: newDoj,
        offeredDoj: newDoj,
        doneBy: doneByUser
      });

      onUpdate(emp.appNo, { offeredDoj: newDoj });
      setEditDoj(false);

      onLogSessionActivity({
        empName: emp.name,
        appNo: emp.appNo,
        actionType: 'doj_changed',
        description: `DOJ rescheduled to ${fmtDate(newDoj)}`,
        doneBy: doneByUser
      });

      showToast(`DOJ updated to ${fmtDate(newDoj)}`, 'success');
    } catch (e: any) {
      showToast('Failed to update DOJ: ' + e.message, 'error');
    } finally {
      setSavingDoj(false);
    }
  };

  const photo = fileUrl(emp.photoUrl);

  const historyActionLabel = (type: string) => {
    if (type === 'call_status') return 'Call Status Change';
    if (type === 'doj_confirmation') return 'DOJ Confirmation';
    if (type === 'doj_changed') return 'DOJ Rescheduled';
    if (type === 'note_added') return 'Note Added';
    return type;
  };

  const historyActionColor = (type: string) => {
    if (type === 'call_status') return 'bg-[#1E2D4E] text-white';
    if (type === 'doj_confirmation') return 'bg-emerald-600 text-white';
    if (type === 'doj_changed') return 'bg-amber-600 text-white';
    return 'bg-purple-600 text-white';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="max-w-[880px] w-full h-[80vh] max-h-[750px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#e2dfd7] animate-scale-up z-50">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E2D4E] to-[#2a3f6e] p-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {photo ? (
                <img src={photo} alt={emp.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 shadow-md flex-shrink-0"
                  onError={e => { (e.target as any).style.display = 'none'; }} />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9952A] to-[#a3761c] text-white flex items-center justify-center font-black text-xl shadow-md flex-shrink-0 border-2 border-white/30">
                  {emp.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg text-white leading-tight">{emp.name}</h2>
                  <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono font-bold text-xs">
                    App: {emp.appNo}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#C9952A] text-white font-black text-xs">
                    {emp.gender || 'Male'}
                  </span>
                </div>
                <div className="text-xs text-white/80 font-semibold mt-1">
                  <span className="text-[#C9952A] font-black">{emp.designation}</span> · {[emp.department, emp.section].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {matchingList && matchingList.length > 0 && (
                <span className="text-xs text-white/70 font-mono hidden sm:inline">
                  {currentIndex + 1} of {matchingList.length}
                </span>
              )}
              <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Body (Left 35%, Right 65%) */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-12 gap-5 bg-[#fbf9f6]">
          
          {/* Left Column (35%) */}
          <div className="col-span-12 md:col-span-4 space-y-3">
            {/* Profile Photo (Max 220x260) */}
            <div className="bg-white p-2 rounded-2xl border border-[#e2dfd7] shadow-xs flex flex-col items-center justify-center">
              {photo ? (
                <img src={photo} alt={emp.name} className="max-w-[220px] max-h-[240px] w-full object-cover rounded-xl border border-slate-100" />
              ) : (
                <div className="w-[180px] h-[200px] rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-5xl">
                  {emp.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Candidate Key Details */}
            <div className="bg-white p-3 rounded-2xl border border-[#e2dfd7] space-y-1.5 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-[#777] font-bold">App ID</span>
                <span className="font-mono font-black text-[#1E2D4E]">{emp.appNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-[#777] font-bold">Gender</span>
                <span className="font-bold text-[#1E2D4E]">{emp.gender}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-[#777] font-bold">Department</span>
                <span className="font-bold text-[#1E2D4E] truncate max-w-[120px]">{emp.department}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-[#777] font-bold">Section</span>
                <span className="font-bold text-[#1E2D4E] truncate max-w-[120px]">{emp.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777] font-bold">Offered DOJ</span>
                <span className="font-mono font-black text-[#C9952A]">{fmtDate(emp.offeredDoj)}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5">
              <a href={`tel:${emp.phone}`}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-2xs">
                <PhoneCall className="w-3.5 h-3.5" /> Call ({emp.phone})
              </a>
              <a href={`https://wa.me/91${(emp.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="w-full py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-2xs">
                <PhoneOutgoing className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Phone number copied!', 'success'); }}
                className="w-full py-2 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy Phone Number
              </button>
            </div>
          </div>

          {/* Right Column (65%) */}
          <div className="col-span-12 md:col-span-8 space-y-4">
            
            {/* 1. Call Outcome Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#e2dfd7] space-y-2">
              <label className="text-[10.5px] font-black uppercase tracking-wider text-[#666] block">1. Call Outcome Status</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Pending', 'Call done', 'Call not received', 'Wrong number', 'Rescheduled'] as CallStatus[]).map(st => (
                  <button key={st} type="button" onClick={() => setCallStatus(st)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all text-left flex items-center gap-1.5 ${callStatus === st ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm ring-2 ring-[#1E2D4E]/20' : 'bg-slate-50 text-[#555] border-[#e2dfd7] hover:bg-slate-100'}`}>
                    <span>{callStatusEmoji(st)}</span>
                    <span className="truncate">{st}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. DOJ Confirmation Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#e2dfd7] space-y-2">
              <label className="text-[10.5px] font-black uppercase tracking-wider text-[#666] block">2. Candidate DOJ Confirmation</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Confirmed', 'Not confirmed', 'Pending confirmation'] as DojConf[]).map(conf => (
                  <button key={conf} type="button" onClick={() => setDojConf(conf)}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all text-center ${dojConf === conf ? 'bg-[#C9952A] text-white border-[#C9952A] shadow-sm' : 'bg-slate-50 text-[#555] border-[#e2dfd7] hover:bg-slate-100'}`}>
                    {conf === 'Confirmed' ? '✅ Confirmed' : conf === 'Not confirmed' ? '❌ Not Conf' : '⏳ Pending'}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Inline Offered DOJ Edit Tool */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#e2dfd7] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-widest text-[#777]">Offered Date of Joining</span>
                <button onClick={() => setEditDoj(e => !e)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${editDoj ? 'bg-[#1E2D4E] text-white' : 'bg-slate-100 border border-[#e2dfd7] text-[#555] hover:text-[#C9952A]'}`}>
                  <Edit3 className="w-2.5 h-2.5" />{editDoj ? 'Cancel' : 'Edit DOJ'}
                </button>
              </div>
              <div className="text-sm font-black text-[#1E2D4E]">{fmtDate(emp.offeredDoj)}</div>
              {editDoj && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#e2dfd7]">
                  <input type="date" value={newDoj} onChange={e => setNewDoj(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold" />
                  <button onClick={handleSaveDoj} disabled={savingDoj}
                    className="px-4 py-1.5 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b38222] transition-colors flex items-center gap-1">
                    {savingDoj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Update
                  </button>
                </div>
              )}
            </div>

            {/* 4. Follow-up Date & Telecaller Remarks Notes */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#e2dfd7] space-y-2">
              <div>
                <label className="text-[10.5px] font-black uppercase tracking-wider text-[#666] block mb-1">Next Follow-up Date</label>
                <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none" />
              </div>
              <div>
                <label className="text-[10.5px] font-black uppercase tracking-wider text-[#666] block mb-1">Telecaller Remarks / Call Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Enter call conversation notes..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]" />
              </div>
            </div>

            {/* Audit History Accordion */}
            <div>
              <button onClick={loadHistory}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#555] hover:border-[#C9952A] transition-all shadow-2xs">
                <span className="flex items-center gap-2"><History className="w-3.5 h-3.5 text-[#C9952A]" />Audit Timeline & Call History</span>
                {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2 animate-fade-in max-h-40 overflow-y-auto pr-1">
                  {history.length === 0 && !loadingHistory && (
                    <div className="text-center py-3 text-[#999] text-xs">No call history recorded yet</div>
                  )}
                  {history.map((h) => (
                    <div key={h.id} className="flex gap-2 text-xs bg-white rounded-xl px-3 py-2 border border-[#e2dfd7]">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${historyActionColor(h.action_type)}`}>{historyActionLabel(h.action_type)}</span>
                      <span className="text-[10px] text-[#555] truncate flex-1">{h.new_value || h.notes}</span>
                      <span className="text-[9px] text-[#aaa] font-mono">{fmtTs(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last Contact Info */}
            <div className="bg-white p-2.5 rounded-xl border border-[#e2dfd7] flex items-center justify-between text-[11px] font-bold text-[#777]">
              <span>Last Call: <strong className="text-[#1E2D4E]">{fmtDate(emp.lastCallDate)}</strong></span>
              <span>Updated By: <strong className="text-[#1E2D4E]">{emp.updatedBy || 'HR'}</strong></span>
              <span>Updated At: <strong className="text-[#1E2D4E]">{emp.updatedAt ? fmtTs(emp.updatedAt) : '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="p-3.5 bg-white border-t border-[#e2dfd7] flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-2">
            {hasPrev && onNavigate && matchingList && (
              <button onClick={() => onNavigate(matchingList[currentIndex - 1])}
                className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[#1E2D4E] text-xs font-bold hover:bg-slate-200 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            )}
            {hasNext && onNavigate && matchingList && (
              <button onClick={() => onNavigate(matchingList[currentIndex + 1])}
                className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[#1E2D4E] text-xs font-bold hover:bg-slate-200 flex items-center gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-[#e2dfd7] text-[#666] text-xs font-bold hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-black hover:bg-[#162340] flex items-center gap-1.5 shadow-md">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Update
            </button>
            {hasNext && (
              <button onClick={() => handleSave(true)} disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b38222] flex items-center gap-1.5 shadow-md">
                Save & Next Candidate →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Redesigned Compact Employee Glass Card (52x52 Thumbnail) ────────────────
const EmployeeCard = React.memo(function EmployeeCard({ emp, selected, searchQuery, onSelect, onOpenModal, onQuickUpdate }: {
  emp: Employee; selected: boolean; searchQuery: string;
  onSelect: (checked: boolean) => void;
  onOpenModal: () => void;
  onQuickUpdate: (appNo: string, callStatus?: CallStatus, dojConf?: DojConf) => void;
}) {
  const urgency = urgencyOf(emp.offeredDoj);
  const photo = fileUrl(emp.photoUrl);
  const daysRem = daysUntil(emp.offeredDoj);

  return (
    <div onClick={onOpenModal}
      className={`card-glass p-3 rounded-2xl border-l-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group bg-white ${urgencyBorderColor(urgency)} flex flex-col justify-between space-y-2.5`}>
      
      {/* Top Row: Checkbox + Photo (52x52) + Name & AppNo + Gender */}
      <div className="flex items-center gap-2.5">
        <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onSelect(e.target.checked); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded accent-[#C9952A] cursor-pointer flex-shrink-0" />
        {photo ? (
          <img src={photo} alt={emp.name} loading="lazy" className="w-[52px] h-[52px] rounded-xl object-cover border border-[#e2dfd7] flex-shrink-0 shadow-2xs" onError={e => { (e.target as any).style.display = 'none'; }} />
        ) : (
          <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-base shadow-2xs flex-shrink-0">
            {emp.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-black text-[#1E2D4E] text-xs leading-tight truncate">
              <HighlightMatch text={emp.name} query={searchQuery} />
            </h4>
            <span className={`px-1 py-0.2 rounded text-[8.5px] font-black border ${emp.gender === 'Female' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
              {emp.gender || 'M'}
            </span>
          </div>
          <div className="text-[9.5px] font-mono font-bold text-[#888] bg-slate-100 px-1.5 py-0.2 rounded w-max mt-0.5">
            <HighlightMatch text={emp.appNo} query={searchQuery} />
          </div>
        </div>
      </div>

      {/* Row 2: Designation / Department / Section */}
      <div className="text-[10.5px] text-[#555] space-y-0.5 bg-[#F9F7F4] p-2 rounded-xl border border-[#e2dfd7]/60">
        <div className="font-bold text-[#C9952A] truncate">
          <HighlightMatch text={emp.designation} query={searchQuery} />
        </div>
        <div className="font-semibold text-[#1E2D4E] truncate text-[10px]">
          <HighlightMatch text={[emp.department, emp.section].filter(Boolean).join(' · ')} query={searchQuery} />
        </div>
      </div>

      {/* Row 3: Phone + Offered DOJ & Urgency Chip */}
      <div className="flex items-center justify-between text-[10.5px] text-[#555]">
        <span className="font-mono font-semibold text-[#1E2D4E] flex items-center gap-1">
          <Phone className="w-2.5 h-2.5 text-[#C9952A]" />
          <HighlightMatch text={emp.phone} query={searchQuery} />
        </span>
        <div className="flex items-center gap-1 font-mono font-bold text-xs text-[#1E2D4E]">
          <Calendar className="w-3 h-3 text-[#C9952A]" />
          {fmtDate(emp.offeredDoj)}
          {daysRem !== null && (
            <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full ${daysRem < 0 ? 'bg-rose-100 text-rose-700' : daysRem === 0 ? 'bg-amber-100 text-amber-800' : daysRem === 1 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
              {daysRem < 0 ? `Overdue ${Math.abs(daysRem)}d` : daysRem === 0 ? 'Today' : daysRem === 1 ? 'Tomorrow' : `${daysRem}d`}
            </span>
          )}
        </div>
      </div>

      {/* Row 4: Call Status & DOJ Confirmation Badges (Click to Quick Update) */}
      <div className="flex items-center justify-between gap-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => {
            const nextStatus: CallStatus = emp.callStatus === 'Pending' ? 'Call done' : emp.callStatus === 'Call done' ? 'Call not received' : 'Pending';
            onQuickUpdate(emp.appNo, nextStatus, undefined);
          }}
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all hover:scale-105 ${callStatusCls(emp.callStatus)}`}>
          {callStatusEmoji(emp.callStatus)} {emp.callStatus || 'Pending'}
        </button>

        <button
          onClick={() => {
            const nextConf: DojConf = emp.dojConfirmation === 'Confirmed' ? 'Not confirmed' : emp.dojConfirmation === 'Not confirmed' ? 'Pending confirmation' : 'Confirmed';
            onQuickUpdate(emp.appNo, undefined, nextConf);
          }}
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition-all hover:scale-105 ${dojConfCls(emp.dojConfirmation)}`}>
          {emp.dojConfirmation === 'Confirmed' ? '✅ Conf' : emp.dojConfirmation === 'Not confirmed' ? '❌ Not Conf' : '⏳ Pend'}
        </button>
      </div>

      {/* Row 5: Compact Pipeline Indicator + Action Pills */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <span className="text-[8px] font-black uppercase text-[#888] mr-1">Progress:</span>
          <div className="flex-1 grid grid-cols-3 gap-1 items-center">
            <div className="h-1 rounded-full bg-emerald-500" title="1. Registered" />
            <div className={`h-1 rounded-full ${emp.callStatus === 'Call done' ? 'bg-emerald-500' : emp.callStatus === 'Call not received' ? 'bg-rose-500' : 'bg-amber-400'}`} title="2. Call Status" />
            <div className={`h-1 rounded-full ${emp.dojConfirmation === 'Confirmed' ? 'bg-emerald-500' : emp.dojConfirmation === 'Not confirmed' ? 'bg-orange-500' : 'bg-slate-200'}`} title="3. DOJ Confirmation" />
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onOpenModal}
            className="px-2 py-1 rounded-lg bg-[#C9952A] hover:bg-[#b38222] text-white text-[10px] font-black transition-all flex items-center gap-0.5 shadow-2xs">
            <Eye className="w-2.5 h-2.5" />View Profile
          </button>
          <a href={`tel:${emp.phone}`} className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-0.5">
            <PhoneCall className="w-2.5 h-2.5" />Call
          </a>
          <a href={`https://wa.me/91${(emp.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="px-2 py-1 rounded-lg bg-[#e8fde8] border border-[#c3f0c3] text-[10px] font-bold text-[#1a8a4a] hover:bg-[#d0f7d0] transition-colors flex items-center gap-0.5">
            <PhoneOutgoing className="w-2.5 h-2.5" />WA
          </a>
          <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Phone copied!', 'success'); }}
            className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-colors ml-auto">
            <Copy className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Designation Accordion Group Card ─────────────────────────────────────────
function DesigGroupCard({ designation, employees, totalCount, selectedIds, searchQuery, defaultExpanded, onSelect, onOpenModal, onQuickUpdate }: {
  designation: string;
  employees: Employee[];
  totalCount: number;
  selectedIds: Set<string>;
  searchQuery: string;
  defaultExpanded: boolean;
  onSelect: (appNo: string, checked: boolean) => void;
  onOpenModal: (emp: Employee) => void;
  onQuickUpdate: (appNo: string, callStatus?: CallStatus, dojConf?: DojConf) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (searchQuery.trim()) setExpanded(true);
  }, [searchQuery]);

  const callDone = employees.filter(e => e.callStatus === 'Call done').length;
  const pending = employees.filter(e => e.callStatus === 'Pending' || !e.callStatus).length;
  const notReceived = employees.filter(e => e.callStatus === 'Call not received').length;
  const dojConfirmed = employees.filter(e => e.dojConfirmation === 'Confirmed').length;

  const pct = totalCount > 0 ? Math.round((callDone / totalCount) * 100) : 0;
  const ringColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="card-glass rounded-3xl overflow-hidden border border-[#e2dfd7] shadow-xs bg-white">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center gap-3.5 hover:bg-slate-50/80 transition-colors text-left">
        <div className="relative flex-shrink-0">
          <ProgressRing pct={pct} size={48} stroke={4} color={ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10.5px] font-black text-[#1E2D4E]">{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#1E2D4E] text-base">
              <HighlightMatch text={designation} query={searchQuery} />
            </h3>
            <span className="text-xs px-3 py-0.5 rounded-full bg-[#1E2D4E] text-white font-black">
              {employees.length} {searchQuery ? 'matching' : `of ${totalCount}`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 mt-1.5">
            <span className="text-xs font-bold text-emerald-600">✅ {callDone} Done</span>
            <span className="text-xs font-bold text-amber-600">⏳ {pending} Pending</span>
            <span className="text-xs font-bold text-rose-600">📵 {notReceived} No Ans</span>
            <span className="text-xs font-bold text-blue-600">📅 {dojConfirmed} Confirmed</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-[#777] flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-[#777] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-[#e2dfd7] p-3.5 bg-[#F9F7F4]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => (
              <EmployeeCard key={emp.appNo} emp={emp} selected={selectedIds.has(emp.appNo)}
                searchQuery={searchQuery}
                onSelect={c => onSelect(emp.appNo, c)}
                onOpenModal={() => onOpenModal(emp)}
                onQuickUpdate={onQuickUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Priority Call Queue ──────────────────────────────────────────────────────
function PriorityBoard({ priorityData, onOpenModal }: {
  priorityData: {
    joiningToday: Employee[];
    joiningTomorrow: Employee[];
    overdue: Employee[];
    unconfirmed: Employee[];
  };
  onOpenModal: (emp: Employee) => void;
}) {
  const lanes = [
    { key: 'today',    label: 'Joining Today',    color: 'border-emerald-400 bg-emerald-50/70', badge: 'bg-emerald-600', emps: priorityData.joiningToday },
    { key: 'tomorrow', label: 'Joining Tomorrow',  color: 'border-blue-400 bg-blue-50/70', badge: 'bg-blue-600', emps: priorityData.joiningTomorrow },
    { key: 'overdue',  label: 'Overdue (Past DOJ)', color: 'border-rose-400 bg-rose-50/70', badge: 'bg-rose-600', emps: priorityData.overdue },
    { key: 'unconf',   label: 'DOJ Not Confirmed',  color: 'border-amber-400 bg-amber-50/70', badge: 'bg-amber-600', emps: priorityData.unconfirmed },
  ];

  const nonEmpty = lanes.filter(l => l.emps.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="card-glass p-5 bg-white rounded-3xl border border-[#e2dfd7] shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-[#1E2D4E] text-sm uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Priority Call Queue (Auto-Classified)
        </h3>
        <span className="text-xs font-bold text-[#888]">Real-time Offered DOJ & Confirmation Status</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {nonEmpty.map(lane => (
          <div key={lane.key} className={`rounded-2xl border-2 ${lane.color} p-3 space-y-2 flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[#1E2D4E]">{lane.label}</span>
                <span className={`w-5 h-5 rounded-full ${lane.badge} flex items-center justify-center text-white text-[10px] font-black`}>
                  {lane.emps.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {lane.emps.slice(0, 8).map(emp => (
                  <button key={emp.appNo} onClick={() => onOpenModal(emp)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-white text-left transition-all hover:shadow-xs">
                    <div className="w-7 h-7 rounded-lg bg-[#1E2D4E] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-[#1E2D4E] truncate">{emp.name}</div>
                      <div className="text-[10px] text-[#777] font-semibold">{fmtDate(emp.offeredDoj)}</div>
                    </div>
                    <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex-shrink-0">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Today's Operations Panel & Live Recent Activity Feed ──────────────────────
function TodaysOperationsPanel({
  todayStats,
  sessionLog,
  lastUpdatedTime
}: {
  todayStats: {
    callsCompleted: number;
    notReceived: number;
    pendingFollowups: number;
    dojConfirmed: number;
    dojNotConfirmed: number;
    dojChanged: number;
    notesAdded: number;
    followupsScheduled: number;
  };
  sessionLog: SessionActivityLog[];
  lastUpdatedTime: string;
}) {
  const [showFeed, setShowFeed] = useState(true);

  const trackerCards = [
    { label: 'Calls Completed', value: todayStats.callsCompleted, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    { label: 'DOJ Confirmed',   value: todayStats.dojConfirmed,   icon: CalendarCheck, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
    { label: 'DOJ Rescheduled', value: todayStats.dojChanged,     icon: Edit3,         color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    { label: 'Call Not Received',value: todayStats.notReceived,    icon: PhoneOff,      color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
    { label: 'DOJ Not Confirmed',value: todayStats.dojNotConfirmed,icon: CalendarX,     color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
    { label: 'Pending Follow-ups',value: todayStats.pendingFollowups,icon: Clock,       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
    { label: 'Notes Added',     value: todayStats.notesAdded,      icon: MessageSquare, color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
    { label: 'Follow-ups Set',  value: todayStats.followupsScheduled,icon: Calendar,  color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  ];

  return (
    <div className="card-glass p-5 bg-white rounded-3xl border border-[#e2dfd7] shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2dfd7] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Today's Telecalling Operations Panel
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-[#888] font-mono">Last updated: {lastUpdatedTime}</span>
          <button
            onClick={() => setShowFeed(f => !f)}
            className="px-3 py-1 rounded-xl bg-[#1E2D4E] text-white text-xs font-black flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            {showFeed ? 'Hide Live Feed' : `View Live Feed (${sessionLog.length})`}
          </button>
        </div>
      </div>

      {/* 8 Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {trackerCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`p-3 rounded-2xl border ${c.bg} shadow-2xs`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className={`text-2xl font-black ${c.color} mt-1`}>{c.value}</div>
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#777] mt-0.5 truncate">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Live Recent Activity Feed (Latest 10 Updates) */}
      {showFeed && (
        <div className="mt-3 pt-3 border-t border-[#e2dfd7] space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-black text-[#1E2D4E]">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10.5px] text-[#777]">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Live Activity Stream (Today's Actions)
            </span>
            <span className="text-[#888] font-semibold">{sessionLog.length} recent events logged</span>
          </div>

          {sessionLog.length === 0 ? (
            <div className="p-4 text-center text-xs font-bold text-[#888] bg-[#F9F7F4] rounded-2xl border border-[#e2dfd7]">
              No actions logged yet in this session today. Updating any employee status, DOJ, or note will stream live updates here!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sessionLog.slice(0, 10).map(log => (
                <div key={log.id} className="card-glass px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-[#888] px-1.5 py-0.5 rounded bg-white border border-[#e2dfd7] flex-shrink-0">
                      {log.time}
                    </span>
                    <span className="font-black text-[#1E2D4E] truncate">{log.empName}</span>
                    <span className="text-[10px] font-mono font-semibold text-[#888]">({log.appNo})</span>
                    <span className="text-xs text-[#555] font-semibold truncate">· {log.description}</span>
                  </div>
                  <span className="text-[9.5px] font-bold text-[#888] flex-shrink-0">by {log.doneBy}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single Source of Truth Analytics Top Header ──────────────────────────────
function AnalyticsHeader({ analytics, loading }: { analytics: Analytics | null; loading: boolean }) {
  if (loading || !analytics) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array(6).fill(0).map((_, i) => <div key={i} className="card-glass h-24 rounded-2xl animate-pulse bg-white border border-[#e2dfd7]" />)}
    </div>
  );

  const cards = [
    { label: 'Total Employees', value: analytics.total,           icon: Users,         color: 'text-[#1E2D4E]',  bg: 'bg-white' },
    { label: 'Calls Done',      value: analytics.callDone,        icon: CheckCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50/60' },
    { label: 'Pending Calls',   value: analytics.pending,         icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-50/60' },
    { label: 'No Answer',       value: analytics.notReceived,     icon: PhoneOff,      color: 'text-rose-600',    bg: 'bg-rose-50/60' },
    { label: 'DOJ Confirmed',   value: analytics.dojConfirmed,    icon: CalendarCheck, color: 'text-blue-600',    bg: 'bg-blue-50/60' },
    { label: 'Unconfirmed DOJ', value: analytics.dojNotConfirmed, icon: CalendarX,     color: 'text-orange-600',  bg: 'bg-orange-50/60' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`card-glass rounded-3xl p-4 border border-[#e2dfd7] ${c.bg} shadow-xs hover:-translate-y-0.5 transition-all`}>
            <div className="flex items-center justify-between">
              <Icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <div className={`text-3xl font-black ${c.color} tracking-tight mt-1`}>{c.value}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#888] mt-1 truncate">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sticky Enterprise Bulk Action Toolbar ────────────────────────────────────
function BulkActionBar({ count, saving, onAction, onClear, onExport }: {
  count: number; saving: boolean;
  onAction: (call?: CallStatus, doj?: DojConf, followUpDate?: string) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  const [fpDate, setFpDate] = useState('');
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1E2D4E] text-white p-3 px-5 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-slide-up flex-wrap max-w-4xl w-[92%] justify-between">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-xl bg-[#C9952A] text-white text-xs font-black">{count} Selected</span>
        <span className="text-xs font-bold text-white/80 hidden md:inline">Bulk Telecaller Operations:</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onAction('Call done')} disabled={saving} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors disabled:opacity-50">✅ Call Done</button>
        <button onClick={() => onAction('Call not received')} disabled={saving} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-colors disabled:opacity-50">特性 No Answer</button>
        <button onClick={() => onAction('Pending')} disabled={saving} className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors disabled:opacity-50">⏳ Pending</button>
        <div className="h-5 w-px bg-white/20 hidden sm:block" />
        <button onClick={() => onAction(undefined, 'Confirmed')} disabled={saving} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors disabled:opacity-50">📅 Confirmed</button>
        <button onClick={() => onAction(undefined, 'Not confirmed')} disabled={saving} className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-colors disabled:opacity-50">⚠️ Not Conf</button>
        
        <div className="flex items-center gap-1">
          <input type="date" value={fpDate} onChange={e => setFpDate(e.target.value)} title="Set follow-up date"
            className="px-2 py-1 rounded-lg bg-white/10 text-white text-xs font-bold border border-white/20 focus:outline-none" />
          {fpDate && <button onClick={() => { onAction(undefined, undefined, fpDate); setFpDate(''); }} disabled={saving}
            className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-black hover:bg-purple-700 transition-colors">Set FU</button>}
        </div>

        <button onClick={onExport} className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1">
          <FileSpreadsheet className="w-3.5 h-3.5" />Export
        </button>
        <button onClick={onClear} className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1">
          <X className="w-3.5 h-3.5" />Clear
        </button>
      </div>
    </div>
  );
}

// ─── Main Operations Command Center Page ──────────────────────────────────────
export default function JoiningCallDeskPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Master employee list (Single Source of Truth)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // In-session Activity Log & Last Updated Time
  const [sessionLog, setSessionLog] = useState<SessionActivityLog[]>([]);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Centered Profile Modal state
  const [modalEmp, setModalEmp] = useState<Employee | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Command Search Input & Debounced value
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('');
  const [filterDojConf, setFilterDojConf] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [dojFrom, setDojFrom] = useState('');
  const [dojTo, setDojTo] = useState('');
  const [sortBy, setSortBy] = useState<'doj_nearest' | 'recently_updated' | 'pending_first' | 'overdue_first' | 'name'>('doj_nearest');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search input (150ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keyboard shortcut Ctrl+K to focus search bar
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

  // Log session activity entry
  const handleLogSessionActivity = useCallback((entry: Omit<SessionActivityLog, 'id' | 'time'>) => {
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const fullTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSessionLog(prev => [
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        ...entry
      },
      ...prev
    ]);
    setLastUpdatedTime(fullTimeStr);
  }, []);

  // Fetch full employee directory dataset for single source of truth
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resDesk = await API.getJoiningCallDesk();
      if (resDesk?.employees) {
        setAllEmployees(resDesk.employees);
      }
    } catch (e: any) {
      showToast('Could not load call desk data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  // In-place local state update after edit (Syncs all KPIs instantly)
  const handleEmployeeUpdate = useCallback((appNo: string, updates: Partial<Employee>) => {
    setAllEmployees(prev => prev.map(e => e.appNo === appNo ? { ...e, ...updates } : e));
    setModalEmp(prev => prev?.appNo === appNo ? { ...prev, ...updates } as Employee : prev);
  }, []);

  // Inline Quick Update Trigger for Employee Cards
  const handleQuickUpdate = useCallback(async (appNo: string, callStatus?: CallStatus, dojConf?: DojConf) => {
    try {
      const doneByUser = session?.username || 'HR';
      await API.updateCallDeskStatus({
        appNo,
        ...(callStatus ? { callStatus } : {}),
        ...(dojConf ? { dojConfirmation: dojConf } : {}),
        doneBy: doneByUser
      });

      const updates: Partial<Employee> = {};
      if (callStatus) updates.callStatus = callStatus;
      if (dojConf) updates.dojConfirmation = dojConf;
      updates.lastCallDate = new Date().toISOString().slice(0, 10);
      updates.updatedBy = doneByUser;
      updates.updatedAt = new Date().toISOString();

      handleEmployeeUpdate(appNo, updates);
      showToast('Quick status updated!', 'success');
    } catch (e: any) {
      showToast('Quick update failed: ' + e.message, 'error');
    }
  }, [session, handleEmployeeUpdate]);

  // Dynamic Single Source of Truth Analytics Calculation
  const analytics = useMemo<Analytics>(() => {
    const total = allEmployees.length;
    let callDone = 0;
    let pending = 0;
    let notReceived = 0;
    let wrongNumber = 0;
    let rescheduled = 0;
    let dojConfirmed = 0;
    let dojNotConfirmed = 0;
    let joiningThisWeek = 0;
    let overdueFollowUps = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    allEmployees.forEach(e => {
      if (e.callStatus === 'Call done') callDone++;
      else if (e.callStatus === 'Call not received') notReceived++;
      else if (e.callStatus === 'Wrong number') wrongNumber++;
      else if (e.callStatus === 'Rescheduled') rescheduled++;
      else pending++;

      if (e.dojConfirmation === 'Confirmed') dojConfirmed++;
      else if (e.dojConfirmation === 'Not confirmed') dojNotConfirmed++;

      if (e.offeredDoj) {
        const u = urgencyOf(e.offeredDoj);
        if (u === 'today' || u === 'tomorrow' || u === 'soon' || u === 'week') {
          joiningThisWeek++;
        }
      }

      if (e.followUpDate && e.followUpDate <= todayStr && e.callStatus !== 'Call done') {
        overdueFollowUps++;
      }
    });

    return {
      total,
      callDone,
      pending,
      notReceived,
      wrongNumber,
      rescheduled,
      dojConfirmed,
      dojNotConfirmed,
      joiningThisWeek,
      overdueFollowUps,
    };
  }, [allEmployees]);

  // Today's Operations Stats Calculation (DB + Real-time Session Log)
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let callsCompleted = 0;
    let notReceived = 0;
    let pendingFollowups = 0;
    let dojConfirmed = 0;
    let dojNotConfirmed = 0;
    let dojChanged = 0;
    let notesAdded = 0;
    let followupsScheduled = 0;

    allEmployees.forEach(e => {
      const isTodayUpdate = e.updatedAt && e.updatedAt.slice(0, 10) === todayStr;
      if (isTodayUpdate) {
        if (e.callStatus === 'Call done') callsCompleted++;
        if (e.callStatus === 'Call not received') notReceived++;
        if (e.callStatus === 'Pending') pendingFollowups++;
        if (e.dojConfirmation === 'Confirmed') dojConfirmed++;
        if (e.dojConfirmation === 'Not confirmed') dojNotConfirmed++;
        if (e.notes) notesAdded++;
        if (e.followUpDate) followupsScheduled++;
      }
    });

    sessionLog.forEach(log => {
      if (log.actionType === 'call_status' && log.description.includes('Call done')) callsCompleted++;
      if (log.actionType === 'call_status' && log.description.includes('Call not received')) notReceived++;
      if (log.actionType === 'doj_confirmed') dojConfirmed++;
      if (log.actionType === 'doj_not_confirmed') dojNotConfirmed++;
      if (log.actionType === 'doj_changed') dojChanged++;
      if (log.actionType === 'note_added') notesAdded++;
      if (log.actionType === 'followup_scheduled') followupsScheduled++;
    });

    return {
      callsCompleted,
      notReceived,
      pendingFollowups,
      dojConfirmed,
      dojNotConfirmed,
      dojChanged,
      notesAdded,
      followupsScheduled,
    };
  }, [allEmployees, sessionLog]);

  // Priority Queue Data Calculation
  const priorityQueueData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const joiningToday = allEmployees.filter(e => e.offeredDoj === todayStr);
    const joiningTomorrow = allEmployees.filter(e => e.offeredDoj === tomorrowStr);
    const overdue = allEmployees.filter(e => e.offeredDoj && e.offeredDoj < todayStr && e.callStatus !== 'Call done');
    const unconfirmed = allEmployees.filter(e => e.dojConfirmation === 'Not confirmed' && e.offeredDoj > todayStr);

    return {
      joiningToday,
      joiningTomorrow,
      overdue,
      unconfirmed,
    };
  }, [allEmployees]);

  // Filtered employees list based on multi-field search, quick filter toggles, and filters
  const filteredEmployees = useMemo(() => {
    let list = [...allEmployees];
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Quick Segmented Toggles
    if (quickFilter === 'overdue') {
      list = list.filter(e => e.offeredDoj && e.offeredDoj < todayStr && e.callStatus !== 'Call done');
    } else if (quickFilter === 'today') {
      list = list.filter(e => e.offeredDoj === todayStr);
    } else if (quickFilter === 'tomorrow') {
      list = list.filter(e => e.offeredDoj === tomorrowStr);
    } else if (quickFilter === 'week') {
      list = list.filter(e => {
        const u = urgencyOf(e.offeredDoj);
        return u === 'today' || u === 'tomorrow' || u === 'soon' || u === 'week';
      });
    } else if (quickFilter === 'confirmed') {
      list = list.filter(e => e.dojConfirmation === 'Confirmed');
    } else if (quickFilter === 'pending') {
      list = list.filter(e => e.callStatus === 'Pending' || !e.callStatus);
    } else if (quickFilter === 'no_answer') {
      list = list.filter(e => e.callStatus === 'Call not received');
    }

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
    if (sortBy === 'doj_nearest') {
      list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    } else if (sortBy === 'recently_updated') {
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else if (sortBy === 'pending_first') {
      list.sort((a, b) => (a.callStatus === 'Pending' ? -1 : 1));
    } else if (sortBy === 'overdue_first') {
      list.sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [allEmployees, quickFilter, debouncedSearch, filterDesig, filterCallStatus, filterDojConf, filterDept, filterSection, filterGender, dojFrom, dojTo, sortBy]);

  // Group filtered employees by Designation
  const designationGroups = useMemo(() => {
    const map = new Map<string, Employee[]>();
    filteredEmployees.forEach(e => {
      const desig = e.designation || 'Unassigned';
      if (!map.has(desig)) map.set(desig, []);
      map.get(desig)!.push(e);
    });

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

  // Auto-open modal if search yields EXACTLY 1 candidate result
  useEffect(() => {
    if (debouncedSearch.trim() && filteredEmployees.length === 1) {
      setModalEmp(filteredEmployees[0]);
    }
  }, [debouncedSearch, filteredEmployees]);

  // Unique filter dropdown options
  const uniqDepts    = useMemo(() => [...new Set(allEmployees.map(e => e.department).filter(Boolean))].sort(), [allEmployees]);
  const uniqSections = useMemo(() => [...new Set(allEmployees.map(e => e.section).filter(Boolean))].sort(), [allEmployees]);
  const uniqDesigs   = useMemo(() => [...new Set(allEmployees.map(e => e.designation).filter(Boolean))].sort(), [allEmployees]);

  // Bulk Actions
  const handleBulkAction = async (callStatus?: CallStatus, dojConf?: DojConf, followUpDate?: string) => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const doneByUser = session?.username || 'HR';
      await Promise.all([...selectedIds].map(appNo =>
        API.updateCallDeskStatus({
          appNo,
          ...(callStatus ? { callStatus } : {}),
          ...(dojConf ? { dojConfirmation: dojConf } : {}),
          ...(followUpDate ? { followUpDate } : {}),
          doneBy: doneByUser
        })
      ));
      selectedIds.forEach(appNo => {
        const updates: Partial<Employee> = {};
        if (callStatus) updates.callStatus = callStatus;
        if (dojConf) updates.dojConfirmation = dojConf;
        if (followUpDate) updates.followUpDate = followUpDate;
        handleEmployeeUpdate(appNo, updates);
      });

      handleLogSessionActivity({
        empName: `${selectedIds.size} Selected Employees`,
        appNo: 'BULK',
        actionType: callStatus === 'Call done' ? 'call_status' : 'doj_confirmed',
        description: `Bulk update applied: ${[callStatus, dojConf, followUpDate ? `FU: ${fmtDate(followUpDate)}` : ''].filter(Boolean).join(' · ')}`,
        doneBy: doneByUser
      });

      showToast(`Bulk updated ${selectedIds.size} employee records`, 'success');
      setSelectedIds(new Set());
    } catch (e: any) {
      showToast('Bulk update failed: ' + e.message, 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleExportSelected = () => {
    const listToExport = selectedIds.size > 0 ? allEmployees.filter(e => selectedIds.has(e.appNo)) : filteredEmployees;
    if (!listToExport.length) {
      showToast('No data to export', 'error');
      return;
    }
    const csvRows = listToExport.map(e => ({
      'App No': e.appNo,
      Name: e.name,
      Gender: e.gender,
      Phone: e.phone,
      Department: e.department,
      Section: e.section,
      Designation: e.designation,
      'Offered DOJ': e.offeredDoj,
      'Call Status': e.callStatus || 'Pending',
      'DOJ Confirmation': e.dojConfirmation || 'Pending confirmation',
      Notes: e.notes || '',
    }));

    const keys = Object.keys(csvRows[0]);
    const csvContent = keys.join(',') + '\n' + csvRows.map(r => keys.map(k => `"${(r[k as keyof typeof r] || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Joining_Call_Desk_Report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast(`Exported ${listToExport.length} employee records to CSV`, 'success');
  };

  const hasFilters = searchInput || quickFilter !== 'all' || filterDesig || filterCallStatus || filterDojConf || filterDept || filterSection || filterGender || dojFrom || dojTo;

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#1E2D4E] flex flex-col font-sans">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Topbar title="Joining Call Desk" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Joining Call Desk' }]}
          session={session} onMenuClick={() => setSidebarOpen(true)} />

        {/* Sticky Search & Segmented Filter Controls */}
        <div className="sticky top-16 z-30 bg-[#F4F1EA]/95 backdrop-blur-md border-b border-[#e2dfd7] px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9952A]" />
              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Enterprise Search (Name, App No, Phone, ID, Dept, Section)..."
                className="w-full pl-10 pr-20 py-2 rounded-2xl border border-[#e2dfd7] bg-white text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10 shadow-xs transition-all"
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

            {/* Quick Segmented Controls */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#e2dfd7] shadow-xs overflow-x-auto scrollbar-none">
              {[
                { key: 'all', label: 'All' },
                { key: 'overdue', label: 'Overdue' },
                { key: 'today', label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'week', label: 'This Week' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'pending', label: 'Pending' },
                { key: 'no_answer', label: 'No Answer' }
              ].map(seg => (
                <button
                  key={seg.key}
                  onClick={() => setQuickFilter(seg.key as QuickFilterType)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex-shrink-0 ${quickFilter === seg.key ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#555] hover:bg-slate-100'}`}>
                  {seg.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-2xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none shadow-xs">
              <option value="doj_nearest">DOJ Nearest</option>
              <option value="recently_updated">Recently Updated</option>
              <option value="pending_first">Pending First</option>
              <option value="overdue_first">Overdue First</option>
              <option value="name">Name (A–Z)</option>
            </select>

            {/* Filter Drawer Toggle */}
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-black transition-all shadow-xs ${showFilters || hasFilters ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters{hasFilters ? ' ●' : ''}
            </button>

            <button onClick={loadData} title="Refresh Data"
              className="p-2 rounded-2xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#555] hover:border-[#1E2D4E] transition-all shadow-xs">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {hasFilters && (
              <button onClick={() => { setSearchInput(''); setQuickFilter('all'); setFilterDesig(''); setFilterCallStatus(''); setFilterDojConf(''); setFilterDept(''); setFilterSection(''); setFilterGender(''); setDojFrom(''); setDojTo(''); }}
                className="flex items-center gap-1 px-3 py-2 rounded-2xl border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors shadow-xs">
                <X className="w-3.5 h-3.5" />Clear
              </button>
            )}
          </div>

          {/* Active Filter Chips Bar */}
          {hasFilters && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap pt-2 border-t border-[#e2dfd7]">
              <span className="text-[10px] font-black uppercase text-[#777] mr-1">Active Filters:</span>
              {quickFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1E2D4E] text-white text-[10.5px] font-bold">
                  ⚡ {quickFilter.toUpperCase()} ONLY <X className="w-3 h-3 cursor-pointer" onClick={() => setQuickFilter('all')} />
                </span>
              )}
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10.5px] font-bold">
                  🔍 "{debouncedSearch}" <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchInput('')} />
                </span>
              )}
              {filterDesig && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10.5px] font-bold">
                  Desig: {filterDesig} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDesig('')} />
                </span>
              )}
              {filterCallStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                  Status: {filterCallStatus} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterCallStatus('')} />
                </span>
              )}
              {filterDojConf && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10.5px] font-bold">
                  DOJ Conf: {filterDojConf} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDojConf('')} />
                </span>
              )}
              {filterDept && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10.5px] font-bold">
                  Dept: {filterDept} <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterDept('')} />
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

        {/* Main Body Content */}
        <main className={`p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto ${selectedIds.size > 0 ? 'pb-24' : ''}`}>

          {/* Banner Header */}
          <div className="card-glass p-5 rounded-3xl bg-white border border-[#e2dfd7] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C9952A]">
                <ShieldCheck className="w-4 h-4" />
                <span>Telecalling Operations Command Center</span>
              </div>
              <h1 className="text-2xl font-black text-[#1E2D4E] tracking-tight mt-0.5">
                Joining Confirmation Call Desk
              </h1>
              <p className="text-xs text-[#777] font-semibold mt-1">
                Real-time telecalling operations · Centered popup profile card & instant inline status updates
              </p>
            </div>

            <button
              onClick={handleExportSelected}
              className="px-4 py-2.5 rounded-2xl bg-[#1E2D4E] hover:bg-[#162340] text-white text-xs font-black transition-colors flex items-center gap-2 shadow-md flex-shrink-0">
              <Download className="w-4 h-4 text-[#C9952A]" />
              Export Full Report (CSV)
            </button>
          </div>

          {/* Synchronized Analytics KPI Header */}
          <AnalyticsHeader analytics={analytics} loading={loading} />

          {/* Today's Operations Panel & Live Recent Activity Feed */}
          <TodaysOperationsPanel
            todayStats={todayStats}
            sessionLog={sessionLog}
            lastUpdatedTime={lastUpdatedTime}
          />

          {/* Dynamic Priority Follow-up Queue */}
          <PriorityBoard priorityData={priorityQueueData} onOpenModal={setModalEmp} />

          {/* Search Result Summary Feedback Bar */}
          {debouncedSearch.trim() && (
            <div className="card-glass p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-black text-amber-950">
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
            <div className="card-glass p-16 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-[#e2dfd7]">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9952A]" />
              <p className="text-sm font-bold text-[#777]">Synchronizing call desk data...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && designationGroups.length === 0 && (
            <div className="card-glass p-16 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-3xl border border-[#e2dfd7]">
              <Users className="w-12 h-12 text-[#1E2D4E]/20" />
              <div>
                <p className="font-black text-[#1E2D4E] text-base">No matching candidates found</p>
                <p className="text-xs text-[#777] font-medium mt-1">
                  {debouncedSearch ? `No record matched "${debouncedSearch}". Try searching by name, phone, or App No.` : 'No joined candidates found in the directory.'}
                </p>
              </div>
              {hasFilters && (
                <button onClick={() => { setSearchInput(''); setQuickFilter('all'); setFilterDesig(''); setFilterCallStatus(''); setFilterDojConf(''); setFilterDept(''); setFilterSection(''); setFilterGender(''); setDojFrom(''); setDojTo(''); }}
                  className="mt-2 px-4 py-2.5 rounded-2xl bg-[#1E2D4E] text-white text-xs font-black hover:bg-[#162340] shadow-md">
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
              searchQuery={debouncedSearch}
              defaultExpanded={!!debouncedSearch.trim() || designationGroups.length <= 3}
              onSelect={(appNo, checked) => {
                setSelectedIds(prev => {
                  const next = new Set(prev);
                  checked ? next.add(appNo) : next.delete(appNo);
                  return next;
                });
              }}
              onOpenModal={setModalEmp}
              onQuickUpdate={handleQuickUpdate}
            />
          ))}
        </main>
      </div>

      {/* Centered Profile Popup Modal Card (880px x 80vh) */}
      {modalEmp && (
        <ProfileModal
          emp={modalEmp}
          session={session}
          onClose={() => setModalEmp(null)}
          onUpdate={handleEmployeeUpdate}
          onLogSessionActivity={handleLogSessionActivity}
          matchingList={filteredEmployees}
          onNavigate={setModalEmp}
        />
      )}

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          saving={bulkSaving}
          onAction={(cs, dj, fu) => handleBulkAction(cs as CallStatus | undefined, dj as DojConf | undefined, fu)}
          onClear={() => setSelectedIds(new Set())}
          onExport={handleExportSelected}
        />
      )}
    </div>
  );
}
