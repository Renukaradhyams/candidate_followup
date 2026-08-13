import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import {
  Users, Phone, Calendar, Briefcase, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronRight, ChevronUp, Search, Filter, RotateCcw,
  MessageSquare, History, Edit3, PhoneCall, PhoneOff, PhoneOutgoing,
  CheckCircle2, AlertCircle, X, Save, Loader2, TrendingUp,
  User, MapPin, Building2, UserCheck, CalendarCheck, CalendarX,
  Zap, Copy, Bell, ArrowRight, Star, AlertTriangle
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
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
  callStatus: 'Pending' | 'Call done' | 'Call not received';
  dojConfirmation: 'Pending confirmation' | 'Confirmed' | 'Not confirmed';
  notes: string;
  followUpDate: string;
  lastCallDate: string;
  updatedBy: string;
  updatedAt: string | null;
}

interface DesigGroup {
  designation: string;
  employees: Employee[];
  callDone: number;
  pending: number;
  notReceived: number;
  dojConfirmed: number;
  dojNotConfirmed: number;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDisplayDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const getDojUrgency = (doj: string) => {
  if (!doj) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dojDate = new Date(doj + 'T00:00:00');
  const diffDays = Math.ceil((dojDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 3) return 'soon';
  return null;
};

const callStatusColor = (s: string) => {
  if (s === 'Call done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'Call not received') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const dojConfirmColor = (s: string) => {
  if (s === 'Confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'Not confirmed') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

const callStatusIcon = (s: string) => {
  if (s === 'Call done') return <PhoneCall className="w-3 h-3" />;
  if (s === 'Call not received') return <PhoneOff className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
};

const actionTypeLabel = (type: string) => {
  switch (type) {
    case 'call_status': return 'Call Status Updated';
    case 'doj_confirmation': return 'DOJ Confirmation Updated';
    case 'note_added': return 'Note Added';
    case 'doj_changed': return 'Date of Joining Changed';
    default: return type;
  }
};

const fileUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  let clean = url.trim();
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.startsWith('uploads/')) clean = `/${clean}`;
  const filename = clean.split('/').pop() || clean;
  if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
  if (clean.startsWith('/uploads/')) return clean;
  return `/uploads/misc/${filename}`;
};

// ── Quick Call Outcome Popup ──────────────────────────────────────────────────
function QuickCallPopup({ emp, session, onClose, onSave }: {
  emp: Employee;
  session: UserSession | null;
  onClose: () => void;
  onSave: (updates: Partial<Employee> & { notes?: string; followUpDate?: string }) => void;
}) {
  const [callStatus, setCallStatus] = useState<Employee['callStatus']>('Call done');
  const [dojConf, setDojConf] = useState<Employee['dojConfirmation']>(emp.dojConfirmation);
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.updateCallDeskStatus({
        appNo: emp.appNo,
        callStatus,
        dojConfirmation: dojConf,
        notes: notes || undefined,
        followUpDate: followUp || undefined,
        doneBy: session?.username || 'HR'
      });
      onSave({ callStatus, dojConfirmation: dojConf, notes, followUpDate: followUp });
      showToast('Call outcome saved!', 'success');
      onClose();
    } catch (e: any) {
      showToast('Failed to save: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#e2dfd7] flex items-center justify-between">
          <div>
            <h3 className="font-black text-[#1E2D4E] text-base">Quick Call Outcome</h3>
            <p className="text-xs text-[#777] font-medium mt-0.5">{emp.name} · {emp.phone}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#f5f3ee] transition-colors"><X className="w-4 h-4 text-[#777]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">Call Outcome</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Call done', 'Call not received', 'Pending'] as Employee['callStatus'][]).map(s => (
                <button key={s} onClick={() => setCallStatus(s)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${callStatus === s ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-md' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                  {s === 'Call done' ? '✅ Done' : s === 'Call not received' ? '❌ No Answer' : '⏳ Pending'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">DOJ Confirmation</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Confirmed', 'Not confirmed', 'Pending confirmation'] as Employee['dojConfirmation'][]).map(s => (
                <button key={s} onClick={() => setDojConf(s)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${dojConf === s ? 'bg-[#C9952A] text-white border-[#C9952A] shadow-md' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#C9952A]'}`}>
                  {s === 'Confirmed' ? '✅ Confirmed' : s === 'Not confirmed' ? '❌ Not Confirmed' : '⏳ Pending'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">Call Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="e.g. Will join on time, requested revision..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] resize-none focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10" />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">Next Follow-up Date (optional)</label>
            <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#f5f3ee] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-black hover:bg-[#162340] transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Outcome
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit DOJ Modal ─────────────────────────────────────────────────────────────
function EditDojModal({ emp, session, onClose, onSaved }: {
  emp: Employee;
  session: UserSession | null;
  onClose: () => void;
  onSaved: (newDoj: string) => void;
}) {
  const [newDoj, setNewDoj] = useState(emp.offeredDoj || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newDoj) { showToast('Please select a date', 'error'); return; }
    setSaving(true);
    try {
      await API.updateCallDeskDOJ({ appNo: emp.appNo, newDoj, doneBy: session?.username || 'HR' });
      showToast('Date of Joining updated successfully!', 'success');
      onSaved(newDoj);
      onClose();
    } catch (e: any) {
      showToast('Failed to update DOJ: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#e2dfd7] flex items-center justify-between">
          <div>
            <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2"><Edit3 className="w-4 h-4 text-[#C9952A]" />Edit Date of Joining</h3>
            <p className="text-xs text-[#777] font-medium mt-0.5">{emp.name} · Current: {formatDisplayDate(emp.offeredDoj)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#f5f3ee]"><X className="w-4 h-4 text-[#777]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">New Date of Joining</label>
            <input type="date" value={newDoj} onChange={e => setNewDoj(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-sm font-bold text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:ring-2 focus:ring-[#C9952A]/10" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium">
            ⚠️ This will update the DOJ in both the Call Desk and Employee Directory.
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#f5f3ee]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b38222] transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Update DOJ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Timeline Modal ────────────────────────────────────────────────────
function HistoryModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.getCallDeskHistory(emp.appNo).then(res => {
      setHistory(res.history || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [emp.appNo]);

  const formatTs = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const actionIcon = (type: string) => {
    switch (type) {
      case 'call_status': return <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />;
      case 'doj_confirmation': return <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />;
      case 'note_added': return <MessageSquare className="w-3.5 h-3.5 text-purple-600" />;
      case 'doj_changed': return <Edit3 className="w-3.5 h-3.5 text-amber-600" />;
      default: return <Zap className="w-3.5 h-3.5 text-[#777]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#e2dfd7] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2"><History className="w-4 h-4 text-[#C9952A]" />Call History</h3>
            <p className="text-xs text-[#777] font-medium mt-0.5">{emp.name} · {emp.designation}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#f5f3ee]"><X className="w-4 h-4 text-[#777]" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#C9952A]" /></div>}
          {!loading && history.length === 0 && (
            <div className="text-center py-10 text-[#777]">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No history yet</p>
              <p className="text-xs mt-1">Call outcomes will appear here</p>
            </div>
          )}
          {!loading && history.length > 0 && (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#e2dfd7]" />
              <div className="space-y-4">
                {history.map((h, i) => (
                  <div key={h.id} className="relative pl-12 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="absolute left-3 top-1 w-5 h-5 rounded-full bg-white border-2 border-[#e2dfd7] flex items-center justify-center shadow-sm">
                      {actionIcon(h.action_type)}
                    </div>
                    <div className="bg-[#F9F7F4] rounded-2xl p-3.5 border border-[#e2dfd7]">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-xs font-black text-[#1E2D4E]">{actionTypeLabel(h.action_type)}</span>
                        <span className="text-[10px] text-[#777] font-medium flex-shrink-0">{formatTs(h.created_at)}</span>
                      </div>
                      {h.old_value && h.new_value && h.action_type !== 'note_added' && (
                        <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 line-through">{h.old_value}</span>
                          <ArrowRight className="w-3 h-3 text-[#777]" />
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">{h.new_value}</span>
                        </div>
                      )}
                      {h.notes && <p className="text-xs text-[#555] font-medium bg-white rounded-lg px-2.5 py-1.5 border border-[#e2dfd7] mt-1">{h.notes}</p>}
                      <p className="text-[10px] text-[#999] font-medium mt-1.5 flex items-center gap-1"><User className="w-2.5 h-2.5" />{h.done_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Note Modal ────────────────────────────────────────────────────────────────
function NoteModal({ emp, session, onClose, onSaved }: {
  emp: Employee;
  session: UserSession | null;
  onClose: () => void;
  onSaved: (note: string) => void;
}) {
  const [note, setNote] = useState(emp.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.updateCallDeskStatus({ appNo: emp.appNo, notes: note, doneBy: session?.username || 'HR' });
      onSaved(note);
      showToast('Note saved!', 'success');
      onClose();
    } catch (e: any) {
      showToast('Failed to save note: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e2dfd7] w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#e2dfd7] flex items-center justify-between">
          <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-600" />Call Notes</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#f5f3ee]"><X className="w-4 h-4 text-[#777]" /></button>
        </div>
        <div className="p-5">
          <label className="text-[11px] font-black uppercase tracking-wider text-[#777] block mb-2">Note for {emp.name}</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
            placeholder="Add a note about this employee's joining status..."
            className="w-full px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] resize-none focus:outline-none focus:border-[#1E2D4E]" />
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#f5f3ee]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black hover:bg-purple-700 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ emp, session, selected, onSelect, onUpdate }: {
  emp: Employee;
  session: UserSession | null;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
}) {
  const [showQuickCall, setShowQuickCall] = useState(false);
  const [showEditDoj, setShowEditDoj] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const urgency = getDojUrgency(emp.offeredDoj);
  const photo = fileUrl(emp.photoUrl);

  const handleStatusChange = async (field: 'callStatus' | 'dojConfirmation', value: string) => {
    setSavingStatus(true);
    try {
      await API.updateCallDeskStatus({
        appNo: emp.appNo,
        [field === 'callStatus' ? 'callStatus' : 'dojConfirmation']: value,
        doneBy: session?.username || 'HR'
      });
      onUpdate(emp.appNo, { [field]: value } as Partial<Employee>);
      if (field === 'callStatus' && value === 'Call done') {
        setShowQuickCall(true);
      }
    } catch (e: any) {
      showToast('Failed to update: ' + e.message, 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <>
      <div className={`card-glass p-4 rounded-2xl border-l-4 transition-all duration-200 relative ${
        selected ? 'border-l-[#C9952A] ring-2 ring-[#C9952A]/20' :
        urgency === 'overdue' ? 'border-l-rose-500' :
        urgency === 'today' || urgency === 'tomorrow' ? 'border-l-amber-500' :
        emp.callStatus === 'Call done' ? 'border-l-emerald-500' :
        emp.callStatus === 'Call not received' ? 'border-l-rose-400' :
        'border-l-[#1E2D4E]'
      }`}>
        {/* Checkbox */}
        <input type="checkbox" checked={selected} onChange={e => onSelect(e.target.checked)}
          className="absolute top-3.5 right-3.5 w-4 h-4 rounded accent-[#C9952A] cursor-pointer" />

        {/* Top row: photo + info */}
        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0">
            {photo ? (
              <img src={photo} alt={emp.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-[#e2dfd7] shadow-sm" onError={e => { (e.target as any).style.display = 'none'; }} />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-lg shadow-sm">
                {emp.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h4 className="font-black text-[#1E2D4E] text-sm truncate leading-tight">{emp.name}</h4>
              {urgency === 'overdue' && <span className="badge bg-rose-100 text-rose-700 border border-rose-200 text-[9px]">⚠ DOJ Overdue</span>}
              {urgency === 'today' && <span className="badge bg-amber-100 text-amber-700 border border-amber-200 text-[9px]">📅 Joining Today</span>}
              {urgency === 'tomorrow' && <span className="badge bg-blue-100 text-blue-700 border border-blue-200 text-[9px]">📅 Tomorrow</span>}
              {urgency === 'soon' && <span className="badge bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px]">⏰ Joining Soon</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10.5px] text-[#666] font-medium">
              <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{emp.phone || '—'}</span>
              <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{emp.gender || '—'}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10.5px] text-[#666] font-medium">
              {emp.department && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5 text-[#C9952A]" />{emp.department}</span>}
              {emp.section && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{emp.section}</span>}
            </div>
          </div>
        </div>

        {/* DOJ row */}
        <div className="mt-3 flex items-center justify-between gap-2 bg-[#F9F7F4] rounded-xl px-3 py-2 border border-[#e2dfd7]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C9952A]" />
            <span className="text-[10.5px] font-black uppercase tracking-wide text-[#777]">Offered DOJ</span>
            <span className="text-xs font-black text-[#1E2D4E]">{formatDisplayDate(emp.offeredDoj)}</span>
          </div>
          <button onClick={() => setShowEditDoj(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#e2dfd7] text-[10px] font-bold text-[#555] hover:border-[#C9952A] hover:text-[#C9952A] transition-all">
            <Edit3 className="w-2.5 h-2.5" />Edit
          </button>
        </div>

        {/* Status selectors */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9.5px] font-black uppercase tracking-wider text-[#999] block mb-1.5">Call Status</label>
            <select value={emp.callStatus} onChange={e => handleStatusChange('callStatus', e.target.value)} disabled={savingStatus}
              className={`w-full text-[11px] font-bold px-2.5 py-2 rounded-xl border cursor-pointer transition-all outline-none ${callStatusColor(emp.callStatus)}`}>
              <option value="Pending">⏳ Pending</option>
              <option value="Call done">✅ Call Done</option>
              <option value="Call not received">❌ Not Received</option>
            </select>
          </div>
          <div>
            <label className="text-[9.5px] font-black uppercase tracking-wider text-[#999] block mb-1.5">DOJ Confirmation</label>
            <select value={emp.dojConfirmation} onChange={e => handleStatusChange('dojConfirmation', e.target.value)} disabled={savingStatus}
              className={`w-full text-[11px] font-bold px-2.5 py-2 rounded-xl border cursor-pointer transition-all outline-none ${dojConfirmColor(emp.dojConfirmation)}`}>
              <option value="Pending confirmation">⏳ Pending</option>
              <option value="Confirmed">✅ Confirmed</option>
              <option value="Not confirmed">❌ Not Confirmed</option>
            </select>
          </div>
        </div>

        {/* Notes preview */}
        {emp.notes && (
          <div className="mt-2.5 px-3 py-2 bg-purple-50 rounded-xl border border-purple-100 text-[11px] text-purple-700 font-medium flex items-start gap-1.5">
            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{emp.notes}</span>
          </div>
        )}

        {/* Meta info */}
        {(emp.updatedBy || emp.lastCallDate) && (
          <div className="mt-2 text-[10px] text-[#999] font-medium flex items-center gap-2 flex-wrap">
            {emp.lastCallDate && <span>📞 Last call: {formatDisplayDate(emp.lastCallDate)}</span>}
            {emp.updatedBy && <span>· Updated by {emp.updatedBy}</span>}
            {emp.followUpDate && <span className="text-amber-600">· Follow-up: {formatDisplayDate(emp.followUpDate)}</span>}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 pt-3 border-t border-[#e2dfd7] flex items-center gap-1.5 flex-wrap">
          <a href={`tel:${emp.phone}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10.5px] font-bold hover:bg-emerald-700 transition-all shadow-sm">
            <PhoneCall className="w-3 h-3" />Call
          </a>
          <a href={`https://wa.me/91${emp.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-[10.5px] font-bold hover:bg-[#1EB957] transition-all shadow-sm">
            <PhoneOutgoing className="w-3 h-3" />WhatsApp
          </a>
          <button onClick={() => { navigator.clipboard.writeText(emp.phone); showToast('Number copied!', 'success'); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#e2dfd7] text-[10.5px] font-bold text-[#555] hover:border-[#1E2D4E] hover:text-[#1E2D4E] transition-all">
            <Copy className="w-3 h-3" />Copy
          </button>
          <button onClick={() => setShowNote(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-[10.5px] font-bold text-purple-700 hover:bg-purple-100 transition-all">
            <MessageSquare className="w-3 h-3" />Note
          </button>
          <button onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-[10.5px] font-bold text-[#555] hover:border-[#C9952A] hover:text-[#C9952A] transition-all">
            <History className="w-3 h-3" />History
          </button>
          <button onClick={() => setShowQuickCall(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-[10.5px] font-bold hover:bg-[#162340] transition-all shadow-sm ml-auto">
            <Zap className="w-3 h-3" />Quick Update
          </button>
        </div>
      </div>

      {showQuickCall && <QuickCallPopup emp={emp} session={session} onClose={() => setShowQuickCall(false)}
        onSave={u => onUpdate(emp.appNo, u as Partial<Employee>)} />}
      {showEditDoj && <EditDojModal emp={emp} session={session} onClose={() => setShowEditDoj(false)}
        onSaved={newDoj => onUpdate(emp.appNo, { offeredDoj: newDoj })} />}
      {showHistory && <HistoryModal emp={emp} onClose={() => setShowHistory(false)} />}
      {showNote && <NoteModal emp={emp} session={session} onClose={() => setShowNote(false)}
        onSaved={note => onUpdate(emp.appNo, { notes: note })} />}
    </>
  );
}

// ── Designation Group Card ────────────────────────────────────────────────────
function DesigGroupCard({ group, session, selectedIds, onSelect, onUpdate, expandedByDefault }: {
  group: DesigGroup;
  session: UserSession | null;
  selectedIds: Set<string>;
  onSelect: (appNo: string, checked: boolean) => void;
  onUpdate: (appNo: string, updates: Partial<Employee>) => void;
  expandedByDefault?: boolean;
}) {
  const [expanded, setExpanded] = useState(expandedByDefault || false);
  const total = group.employees.length;
  const donePercent = total > 0 ? Math.round((group.callDone / total) * 100) : 0;

  return (
    <div className="card-glass rounded-2xl overflow-hidden">
      {/* Header — click to expand */}
      <button onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center gap-3 hover:bg-[#F9F7F4] transition-colors text-left">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-sm shadow-md">
          {group.designation.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-[#1E2D4E] text-sm">{group.designation}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E2D4E]/10 text-[#1E2D4E] font-bold">{total}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] font-bold">
            <span className="text-emerald-600">✅ {group.callDone} Done</span>
            <span className="text-amber-600">⏳ {group.pending} Pending</span>
            <span className="text-rose-600">❌ {group.notReceived} No Answer</span>
            <span className="text-blue-600">📅 {group.dojConfirmed} Confirmed</span>
            <span className="text-orange-600">⚠ {group.dojNotConfirmed} Not Confirmed</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 bg-[#e2dfd7] rounded-full overflow-hidden w-full max-w-xs">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${donePercent}%` }} />
          </div>
          <p className="text-[9.5px] text-[#999] font-medium mt-0.5">{donePercent}% calls completed</p>
        </div>
        <div className="flex-shrink-0 text-[#777]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded employees */}
      {expanded && (
        <div className="border-t border-[#e2dfd7] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {group.employees.map(emp => (
              <EmployeeCard key={emp.appNo} emp={emp} session={session}
                selected={selectedIds.has(emp.appNo)}
                onSelect={checked => onSelect(emp.appNo, checked)}
                onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JoiningCallDeskPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState('');
  const [dojConfirmFilter, setDojConfirmFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Load
  const loadData = useCallback(async () => {
    try {
      const res = await API.getJoiningCallDesk();
      if (res && res.employees) {
        setEmployees(res.employees);
      }
    } catch (e: any) {
      showToast('Could not load joining call desk data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    const sess = Auth.get();
    setSession(sess);
    loadData();
  }, [navigate, loadData]);

  // Live update individual employee in state
  const handleEmployeeUpdate = useCallback((appNo: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.appNo === appNo ? { ...e, ...updates } : e));
  }, []);

  // Filtered employees
  const filtered = useMemo(() => {
    let list = [...employees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q) ||
        (e.appNo || '').toLowerCase().includes(q) ||
        (e.section || '').toLowerCase().includes(q)
      );
    }
    if (desigFilter) list = list.filter(e => e.designation === desigFilter);
    if (deptFilter) list = list.filter(e => e.department === deptFilter);
    if (sectionFilter) list = list.filter(e => e.section === sectionFilter);
    if (callStatusFilter) list = list.filter(e => e.callStatus === callStatusFilter);
    if (dojConfirmFilter) list = list.filter(e => e.dojConfirmation === dojConfirmFilter);
    if (fromDate) list = list.filter(e => e.offeredDoj >= fromDate);
    if (toDate) list = list.filter(e => e.offeredDoj <= toDate);
    return list;
  }, [employees, searchQuery, desigFilter, deptFilter, sectionFilter, callStatusFilter, dojConfirmFilter, fromDate, toDate]);

  // Analytics (based on filtered)
  const analytics = useMemo(() => {
    const total = filtered.length;
    const callDone = filtered.filter(e => e.callStatus === 'Call done').length;
    const pending = filtered.filter(e => e.callStatus === 'Pending').length;
    const notReceived = filtered.filter(e => e.callStatus === 'Call not received').length;
    const dojConfirmed = filtered.filter(e => e.dojConfirmation === 'Confirmed').length;
    const dojNotConfirmed = filtered.filter(e => e.dojConfirmation === 'Not confirmed').length;
    const desigs = new Set(filtered.map(e => e.designation).filter(Boolean)).size;
    return { total, callDone, pending, notReceived, dojConfirmed, dojNotConfirmed, desigs };
  }, [filtered]);

  // Today analytics
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAnalytics = useMemo(() => {
    const todayEmps = employees.filter(e => e.lastCallDate === todayStr);
    return {
      callsDone: todayEmps.filter(e => e.callStatus === 'Call done').length,
      notReceived: todayEmps.filter(e => e.callStatus === 'Call not received').length,
      dojConfirmed: todayEmps.filter(e => e.dojConfirmation === 'Confirmed').length,
    };
  }, [employees, todayStr]);

  // Designation groups
  const desigGroups = useMemo<DesigGroup[]>(() => {
    const map = new Map<string, Employee[]>();
    for (const e of filtered) {
      const d = e.designation || 'Unassigned';
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
    const groups: DesigGroup[] = [];
    map.forEach((emps, desig) => {
      groups.push({
        designation: desig,
        employees: emps,
        callDone: emps.filter(e => e.callStatus === 'Call done').length,
        pending: emps.filter(e => e.callStatus === 'Pending').length,
        notReceived: emps.filter(e => e.callStatus === 'Call not received').length,
        dojConfirmed: emps.filter(e => e.dojConfirmation === 'Confirmed').length,
        dojNotConfirmed: emps.filter(e => e.dojConfirmation === 'Not confirmed').length,
      });
    });
    groups.sort((a, b) => a.designation.localeCompare(b.designation));
    return groups;
  }, [filtered]);

  // Follow-up priority list
  const followUpList = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return filtered.filter(e => {
      if (!e.offeredDoj) return false;
      const doj = new Date(e.offeredDoj + 'T00:00:00');
      const diff = Math.ceil((doj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 3;
    }).sort((a, b) => a.offeredDoj.localeCompare(b.offeredDoj));
  }, [filtered]);

  // Unique options for filters
  const uniqueDesigs = useMemo(() => [...new Set(employees.map(e => e.designation).filter(Boolean))].sort(), [employees]);
  const uniqueDepts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  const uniqueSections = useMemo(() => [...new Set(employees.map(e => e.section).filter(Boolean))].sort(), [employees]);

  // Select handlers
  const handleSelect = useCallback((appNo: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(appNo) : next.delete(appNo);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.appNo)));
    }
  };

  // Bulk update
  const handleBulkUpdate = async (callStatus?: string, dojConfirmation?: string) => {
    if (selectedIds.size === 0) { showToast('No employees selected', 'error'); return; }
    setBulkSaving(true);
    try {
      const promises = [...selectedIds].map(appNo =>
        API.updateCallDeskStatus({
          appNo,
          ...(callStatus ? { callStatus } : {}),
          ...(dojConfirmation ? { dojConfirmation } : {}),
          doneBy: session?.username || 'HR'
        })
      );
      await Promise.all(promises);
      setEmployees(prev => prev.map(e => selectedIds.has(e.appNo) ? {
        ...e,
        ...(callStatus ? { callStatus } as Partial<Employee> : {}),
        ...(dojConfirmation ? { dojConfirmation } as Partial<Employee> : {}),
      } : e));
      showToast(`Updated ${selectedIds.size} employees`, 'success');
      setSelectedIds(new Set());
    } catch (e: any) {
      showToast('Bulk update failed: ' + e.message, 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const hasActiveFilters = searchQuery || desigFilter || deptFilter || sectionFilter || callStatusFilter || dojConfirmFilter || fromDate || toDate;

  const resetFilters = () => {
    setSearchQuery(''); setDesigFilter(''); setDeptFilter(''); setSectionFilter('');
    setCallStatusFilter(''); setDojConfirmFilter(''); setFromDate(''); setToDate('');
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Joining Confirmation Call Desk"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Joining Call Desk' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">

          {/* Page header */}
          <div className="card-glass p-5 border-2 border-[#1E2D4E]/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-[#C9952A]" />
                  Joining Confirmation Call Desk
                </h2>
                <p className="text-xs text-[#666] font-medium mt-0.5">
                  Call employees to confirm joining on their offered DOJ · Track call status and DOJ confirmation in real-time
                </p>
              </div>
              <button onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] transition-all shadow-sm">
                <RotateCcw className="w-3.5 h-3.5" />Refresh Data
              </button>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
            {[
              { title: 'Total Employees', value: analytics.total, icon: Users, color: 'navy' as const },
              { title: 'Designations', value: analytics.desigs, icon: Briefcase, color: 'indigo' as const },
              { title: 'Calls Completed', value: analytics.callDone, icon: CheckCircle, color: 'emerald' as const },
              { title: 'Calls Pending', value: analytics.pending, icon: Clock, color: 'amber' as const },
              { title: 'Not Received', value: analytics.notReceived, icon: PhoneOff, color: 'rose' as const },
              { title: 'DOJ Confirmed', value: analytics.dojConfirmed, icon: CalendarCheck, color: 'teal' as const },
              { title: 'Not Confirmed', value: analytics.dojNotConfirmed, icon: CalendarX, color: 'gold' as const },
            ].map(card => (
              <MetricCard key={card.title} title={card.title} value={card.value} icon={card.icon} color={card.color} />
            ))}
          </div>

          {/* Today's Productivity + Follow-up Priority */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Today */}
            <div className="card-glass p-4">
              <h3 className="font-black text-[#1E2D4E] text-sm flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[#C9952A]" />Today's Activity
                <span className="text-[10px] font-bold text-[#777] bg-[#F9F7F4] px-2 py-0.5 rounded-lg border border-[#e2dfd7]">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Calls Done', value: todayAnalytics.callsDone, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                  { label: 'No Answer', value: todayAnalytics.notReceived, bg: 'bg-rose-50 border-rose-200 text-rose-700' },
                  { label: 'DOJ Confirmed', value: todayAnalytics.dojConfirmed, bg: 'bg-blue-50 border-blue-200 text-blue-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border px-3 py-2.5 text-center ${s.bg}`}>
                    <div className="text-2xl font-black">{s.value}</div>
                    <div className="text-[10px] font-bold mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up Priority */}
            <div className="card-glass p-4">
              <h3 className="font-black text-[#1E2D4E] text-sm flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />Follow-up Priority
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">{followUpList.length} employees</span>
              </h3>
              {followUpList.length === 0 ? (
                <div className="text-center py-3 text-[#999] text-xs">No urgent follow-ups</div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {followUpList.slice(0, 6).map(emp => {
                    const urgency = getDojUrgency(emp.offeredDoj);
                    return (
                      <div key={emp.appNo} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                        urgency === 'overdue' ? 'bg-rose-50 border-rose-200' :
                        urgency === 'today' ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <span className="font-black text-[#1E2D4E] flex-1 truncate">{emp.name}</span>
                        <span className="text-[10px] font-bold">{formatDisplayDate(emp.offeredDoj)}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${
                          urgency === 'overdue' ? 'bg-rose-200 text-rose-800' :
                          urgency === 'today' ? 'bg-amber-200 text-amber-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {urgency === 'overdue' ? 'OVERDUE' : urgency === 'today' ? 'TODAY' : urgency === 'tomorrow' ? 'TOMORROW' : 'SOON'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9952A]" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, App No, section..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] focus:ring-2 focus:ring-[#1E2D4E]/10" />
              </div>
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${showFilters ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                <Filter className="w-3.5 h-3.5" />Filters
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#C9952A]" />}
              </button>
              {hasActiveFilters && (
                <button onClick={resetFilters}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors">
                  <X className="w-3 h-3" />Clear
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-[#e2dfd7] animate-fade-in">
                {[
                  { label: 'Designation', value: desigFilter, opts: uniqueDesigs, setter: setDesigFilter },
                  { label: 'Department', value: deptFilter, opts: uniqueDepts, setter: setDeptFilter },
                  { label: 'Section', value: sectionFilter, opts: uniqueSections, setter: setSectionFilter },
                  { label: 'Call Status', value: callStatusFilter, opts: ['Pending', 'Call done', 'Call not received'], setter: setCallStatusFilter },
                  { label: 'DOJ Confirmation', value: dojConfirmFilter, opts: ['Pending confirmation', 'Confirmed', 'Not confirmed'], setter: setDojConfirmFilter },
                ].map(f => (
                  <select key={f.label} value={f.value} onChange={e => f.setter(e.target.value)}
                    className="px-2.5 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] outline-none focus:border-[#1E2D4E]">
                    <option value="">{f.label}</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                <div className="flex gap-1">
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="flex-1 px-2 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[10px] font-bold text-[#1E2D4E] outline-none" placeholder="From DOJ" title="From DOJ" />
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="flex-1 px-2 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[10px] font-bold text-[#1E2D4E] outline-none" placeholder="To DOJ" title="To DOJ" />
                </div>
              </div>
            )}
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="card-glass p-3.5 bg-[#1E2D4E] border-[#1E2D4E] animate-slide-up">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white text-xs font-black mr-2">{selectedIds.size} selected</span>
                <button onClick={() => handleBulkUpdate('Call done')} disabled={bulkSaving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60">✅ Mark Call Done</button>
                <button onClick={() => handleBulkUpdate('Call not received')} disabled={bulkSaving}
                  className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors disabled:opacity-60">❌ No Answer</button>
                <button onClick={() => handleBulkUpdate(undefined, 'Confirmed')} disabled={bulkSaving}
                  className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors disabled:opacity-60">📅 DOJ Confirmed</button>
                <button onClick={() => handleBulkUpdate(undefined, 'Not confirmed')} disabled={bulkSaving}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-60">⚠ Not Confirmed</button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" />Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Select All + Count row */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <input type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded accent-[#C9952A] cursor-pointer" />
                <span className="text-xs font-bold text-[#555]">
                  {selectedIds.size > 0 ? `${selectedIds.size} / ${filtered.length} selected` : `Select All (${filtered.length} employees)`}
                </span>
              </div>
              <span className="text-xs font-bold text-[#777]">{desigGroups.length} designation{desigGroups.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Loading / Empty State */}
          {loading && (
            <div className="card-glass p-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9952A]" />
              <p className="text-sm font-bold text-[#777]">Loading employee data...</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="card-glass p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1E2D4E]/5 flex items-center justify-center">
                <Users className="w-8 h-8 text-[#1E2D4E]/30" />
              </div>
              <div>
                <p className="font-black text-[#1E2D4E] text-base">No employees found</p>
                <p className="text-sm text-[#777] font-medium mt-1">
                  {employees.length === 0 ? 'No joined employees with a DOJ in the Employee Directory.' : 'Try clearing your filters.'}
                </p>
              </div>
              {hasActiveFilters && (
                <button onClick={resetFilters}
                  className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors">
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* Designation Groups */}
          {!loading && desigGroups.length > 0 && (
            <div className="space-y-3">
              {desigGroups.map((group, i) => (
                <DesigGroupCard key={group.designation} group={group} session={session}
                  selectedIds={selectedIds} onSelect={handleSelect} onUpdate={handleEmployeeUpdate}
                  expandedByDefault={i === 0 && desigGroups.length === 1} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
