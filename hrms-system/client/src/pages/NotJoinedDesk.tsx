import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Calendar, CheckCircle, Clock, Search, RotateCcw, MessageSquare,
  History, Edit3, Phone, PhoneCall, PhoneOutgoing, X, Save,
  Loader2, Briefcase, CalendarX, ArrowRight, AlertTriangle,
  FileSpreadsheet, Flame, CheckCircle2, Store, UserX, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled';
type DojConf    = 'Pending confirmation' | 'Confirmed' | 'Not confirmed';
type QuickFilterType = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'confirmed' | 'pending' | 'no_answer';
export type KpiFilterType = 'all' | 'call_done' | 'pending' | 'no_answer' | 'doj_confirmed' | 'unconfirmed_doj' | 'overdue_doj';

interface Employee {
  appNo: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  department: string;
  section: string;
  designation: string;
  candidateStatus: string;
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
  overdueDoj: number;
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
  return `/uploads/candidate-photos/${fn}`;
};

export default function NotJoinedDeskPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [summaries, setSummaries] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedDesig, setSelectedDesig] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Modals & Drawers
  const [callModalEmp, setCallModalEmp] = useState<Employee | null>(null);
  const [callForm, setCallForm] = useState({
    callStatus: 'Pending' as CallStatus,
    dojConfirmation: 'Pending confirmation' as DojConf,
    notes: '',
    followUpDate: ''
  });
  const [savingCall, setSavingCall] = useState(false);

  const [dojModalEmp, setDojModalEmp] = useState<Employee | null>(null);
  const [newDojInput, setNewDojInput] = useState('');
  const [savingDoj, setSavingDoj] = useState(false);

  const [joinModalEmp, setJoinModalEmp] = useState<Employee | null>(null);
  const [joiningStore, setJoiningStore] = useState(false);

  const [historyEmp, setHistoryEmp] = useState<Employee | null>(null);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Authentication check
  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  // Load summary & analytics
  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, anaRes] = await Promise.all([
        API.getNotJoinedSummary(),
        API.getNotJoinedAnalytics()
      ]);
      if (sumRes && sumRes.summaries) {
        setSummaries(sumRes.summaries);
        if (!selectedDesig && sumRes.summaries.length > 0) {
          setSelectedDesig(sumRes.summaries[0].designation);
        }
      }
      if (anaRes) {
        setAnalytics(anaRes);
      }
    } catch (err: any) {
      showToast('Error loading not-joined data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDesig]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // Load employees for selected designation
  const loadEmployeesForDesig = useCallback(async (desig: string) => {
    if (!desig) return;
    try {
      setEmpLoading(true);
      const res = await API.getNotJoinedByDesignation(desig);
      if (res && res.employees) {
        setEmployees(res.employees);
      } else {
        setEmployees([]);
      }
    } catch (err: any) {
      showToast('Error loading candidates: ' + err.message, 'error');
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDesig) {
      loadEmployeesForDesig(selectedDesig);
    }
  }, [selectedDesig, loadEmployeesForDesig]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered candidate list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          emp.name.toLowerCase().includes(q) ||
          emp.appNo.toLowerCase().includes(q) ||
          emp.phone.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q) ||
          emp.section.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Department
      if (deptFilter !== 'all' && emp.department !== deptFilter) return false;

      // Quick filter
      const urg = urgencyOf(emp.offeredDoj);
      if (quickFilter === 'overdue' && urg !== 'overdue') return false;
      if (quickFilter === 'today' && urg !== 'today') return false;
      if (quickFilter === 'tomorrow' && urg !== 'tomorrow') return false;
      if (quickFilter === 'week' && urg !== 'week' && urg !== 'soon' && urg !== 'today' && urg !== 'tomorrow') return false;
      if (quickFilter === 'confirmed' && emp.dojConfirmation !== 'Confirmed') return false;
      if (quickFilter === 'pending' && emp.callStatus !== 'Pending') return false;
      if (quickFilter === 'no_answer' && emp.callStatus !== 'Call not received') return false;

      // KPI filter
      if (kpiFilter === 'call_done' && emp.callStatus !== 'Call done') return false;
      if (kpiFilter === 'pending' && emp.callStatus !== 'Pending') return false;
      if (kpiFilter === 'no_answer' && emp.callStatus !== 'Call not received') return false;
      if (kpiFilter === 'doj_confirmed' && emp.dojConfirmation !== 'Confirmed') return false;
      if (kpiFilter === 'unconfirmed_doj' && emp.dojConfirmation === 'Confirmed') return false;
      if (kpiFilter === 'overdue_doj' && urg !== 'overdue') return false;

      return true;
    });
  }, [employees, search, deptFilter, quickFilter, kpiFilter]);

  // Open Log Call Modal
  const openCallModal = (emp: Employee) => {
    setCallModalEmp(emp);
    setCallForm({
      callStatus: emp.callStatus || 'Pending',
      dojConfirmation: emp.dojConfirmation || 'Pending confirmation',
      notes: emp.notes || '',
      followUpDate: emp.followUpDate || ''
    });
  };

  // Submit Call Log
  const handleSaveCall = async () => {
    if (!callModalEmp) return;
    try {
      setSavingCall(true);
      await API.updateCallDeskStatus({
        appNo: callModalEmp.appNo,
        callStatus: callForm.callStatus,
        dojConfirmation: callForm.dojConfirmation,
        notes: callForm.notes,
        followUpDate: callForm.followUpDate || undefined,
        doneBy: session?.fullName || session?.username || 'HR'
      });
      showToast(`Follow-up saved for ${callModalEmp.name}!`, 'success');
      setCallModalEmp(null);
      loadSummaries();
      if (selectedDesig) loadEmployeesForDesig(selectedDesig);
    } catch (err: any) {
      showToast('Error saving call: ' + err.message, 'error');
    } finally {
      setSavingCall(false);
    }
  };

  // Open Reschedule DOJ Modal
  const openDojModal = (emp: Employee) => {
    setDojModalEmp(emp);
    setNewDojInput(emp.offeredDoj || '');
  };

  // Submit Rescheduled DOJ
  const handleSaveDoj = async () => {
    if (!dojModalEmp || !newDojInput) return;
    try {
      setSavingDoj(true);
      await API.updateCallDeskDOJ({
        appNo: dojModalEmp.appNo,
        newDoj: newDojInput,
        doneBy: session?.fullName || session?.username || 'HR'
      });
      showToast(`Date of Joining updated to ${fmtDate(newDojInput)} for ${dojModalEmp.name}! 🎉`, 'success');
      setDojModalEmp(null);
      loadSummaries();
      if (selectedDesig) loadEmployeesForDesig(selectedDesig);
    } catch (err: any) {
      showToast('Error updating DOJ: ' + err.message, 'error');
    } finally {
      setSavingDoj(false);
    }
  };

  // Open Mark Joined Modal
  const openJoinModal = (emp: Employee) => {
    setJoinModalEmp(emp);
  };

  // Confirm Mark Joined Store
  const handleConfirmMarkJoined = async () => {
    if (!joinModalEmp) return;
    try {
      setJoiningStore(true);
      const today = new Date().toISOString().slice(0, 10);
      await API.markJoined({
        appNo: joinModalEmp.appNo,
        actualDoj: joinModalEmp.offeredDoj || today,
        joinedStore: 'Main Store',
        remarks: 'Marked joined via Not Joined Desk'
      });
      showToast(`${joinModalEmp.name} marked as Successfully Joined Store! 🏬🎉`, 'success');
      setJoinModalEmp(null);
      loadSummaries();
      if (selectedDesig) loadEmployeesForDesig(selectedDesig);
    } catch (err: any) {
      showToast('Error marking candidate as joined: ' + err.message, 'error');
    } finally {
      setJoiningStore(false);
    }
  };

  // Open History Slide-over
  const openHistoryDrawer = async (emp: Employee) => {
    setHistoryEmp(emp);
    setHistoryLoading(true);
    try {
      const res = await API.getCallDeskHistory(emp.appNo);
      setHistoryList(res.history || []);
    } catch (err: any) {
      showToast('Error loading history: ' + err.message, 'error');
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      showToast('Generating Excel report of all non-joined candidates...', 'info');
      const res = await API.getNotJoinedAll();
      const list: Employee[] = (res && res.employees) ? res.employees : filteredEmployees;

      if (!list || list.length === 0) {
        showToast('No candidate data available to export', 'warn');
        return;
      }

      const rows = list.map((e, idx) => ({
        '#': idx + 1,
        'App No': e.appNo,
        'Candidate Name': e.name,
        'Phone': e.phone,
        'Email': e.email,
        'Gender': e.gender,
        'Department': e.department,
        'Section': e.section,
        'Designation': e.designation,
        'Candidate Status': e.candidateStatus,
        'Offered DOJ': e.offeredDoj,
        'DOJ Urgency': urgencyOf(e.offeredDoj) || 'Normal',
        'Call Status': e.callStatus,
        'DOJ Confirmation': e.dojConfirmation,
        'Notes': e.notes,
        'Follow-up Date': e.followUpDate,
        'Last Call Date': e.lastCallDate,
        'Updated By': e.updatedBy
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Not_Joined_Store_List');
      const fileName = `BSC_Non_Joiners_DOJ_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Excel report downloaded successfully! 📊', 'success');
    } catch (err: any) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Non-Joiners &amp; DOJ Follow-up Desk"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Not Joined Desk' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">

          {/* ── Top Header Banner ── */}
          <div className="card-glass p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#e2dfd7] shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#1E2D4E] text-[#C9952A] flex items-center justify-center shadow-md">
                  <CalendarX className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                    <span>Not Joined Store &amp; DOJ Follow-up Desk</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                      Pre-Joining Tracker
                    </span>
                  </h2>
                  <p className="text-xs text-[#666] font-medium">
                    Tracking candidates with offered Date of Joining who are not yet confirmed in the Joined Store Directory.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
              <button
                onClick={loadSummaries}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] text-xs font-bold hover:bg-[#F9F7F4] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Refresh latest data"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportToExcel}
                className="btn-secondary text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* ── KPI Analytics Metric Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total Non-Joined */}
            <div
              onClick={() => setKpiFilter('all')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'all'
                  ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-md ring-2 ring-[#C9952A]/50'
                  : 'bg-white border-[#e2dfd7] text-[#1E2D4E] hover:border-[#1E2D4E]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${kpiFilter === 'all' ? 'text-[#C9952A]' : 'text-[#777]'}`}>
                  Total Not Joined
                </span>
                <UserX className={`w-4 h-4 ${kpiFilter === 'all' ? 'text-[#C9952A]' : 'text-[#1E2D4E]'}`} />
              </div>
              <div className="text-2xl font-black mt-1">
                {analytics?.total ?? summaries.reduce((acc, s) => acc + s.total, 0)}
              </div>
              <div className={`text-[10px] font-semibold mt-0.5 ${kpiFilter === 'all' ? 'text-white/70' : 'text-[#888]'}`}>
                Awaiting Store Entry
              </div>
            </div>

            {/* 2. Overdue DOJ (No-Shows) */}
            <div
              onClick={() => setKpiFilter('overdue_doj')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'overdue_doj'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-md ring-2 ring-rose-400'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Overdue (No Show)
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black mt-1">
                {analytics?.overdueDoj ?? 0}
              </div>
              <div className="text-[10px] font-semibold mt-0.5 opacity-80">
                DOJ in past / lapsed
              </div>
            </div>

            {/* 3. Joining This Week */}
            <div
              onClick={() => setQuickFilter('week')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                quickFilter === 'week'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Joining This Week
                </span>
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black mt-1">
                {analytics?.joiningThisWeek ?? 0}
              </div>
              <div className="text-[10px] font-semibold mt-0.5 opacity-80">
                Next 7 days DOJ
              </div>
            </div>

            {/* 4. Calls Done */}
            <div
              onClick={() => setKpiFilter('call_done')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'call_done'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-400'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Calls Done
                </span>
                <PhoneCall className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black mt-1">
                {analytics?.callDone ?? summaries.reduce((acc, s) => acc + s.callDone, 0)}
              </div>
              <div className="text-[10px] font-semibold mt-0.5 opacity-80">
                Follow-up completed
              </div>
            </div>

            {/* 5. Pending Calls */}
            <div
              onClick={() => setKpiFilter('pending')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'pending'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-md ring-2 ring-blue-400'
                  : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Pending Calls
                </span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black mt-1">
                {analytics?.pending ?? summaries.reduce((acc, s) => acc + s.pending, 0)}
              </div>
              <div className="text-[10px] font-semibold mt-0.5 opacity-80">
                Needs outreach call
              </div>
            </div>

            {/* 6. DOJ Confirmed */}
            <div
              onClick={() => setKpiFilter('doj_confirmed')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'doj_confirmed'
                  ? 'bg-[#1E2D4E] text-[#C9952A] border-[#1E2D4E] shadow-md ring-2 ring-[#C9952A]'
                  : 'bg-white border-[#e2dfd7] text-[#1E2D4E] hover:border-[#1E2D4E]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#777]">
                  DOJ Confirmed
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black mt-1 text-emerald-700">
                {analytics?.dojConfirmed ?? summaries.reduce((acc, s) => acc + s.dojConfirmed, 0)}
              </div>
              <div className="text-[10px] font-semibold mt-0.5 text-[#888]">
                Ready to Join Store
              </div>
            </div>
          </div>

          {/* ── Designation Breakdown Selector ── */}
          <div className="card-glass p-5 space-y-3 border border-[#e2dfd7]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1E2D4E] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#C9952A]" />
                <span>Select Designation to Review Non-Joiners</span>
              </h3>
              <span className="text-[11px] font-bold text-[#777]">
                {summaries.length} Designations with Pending Joiners
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {summaries.map(s => {
                const isSel = selectedDesig === s.designation;
                return (
                  <button
                    key={s.designation}
                    onClick={() => setSelectedDesig(s.designation)}
                    className={`
                      px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-150 flex items-center gap-2.5 shadow-xs cursor-pointer
                      ${isSel
                        ? 'bg-[#1E2D4E] text-white shadow-md ring-2 ring-[#C9952A]'
                        : 'bg-white text-[#555] border border-[#e2dfd7] hover:bg-[#F9F7F4] hover:text-[#1E2D4E]'}
                    `}
                  >
                    <span>{s.designation}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isSel ? 'bg-[#C9952A] text-slate-900' : 'bg-[#1E2D4E]/10 text-[#1E2D4E]'}`}>
                      {s.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Filter & Search Toolbar ── */}
          <div className="card-glass p-4 space-y-3 border border-[#e2dfd7]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777]" />
                <input
                  type="text"
                  placeholder="Search candidate name, phone, App ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                />
              </div>

              {/* Department Dropdown */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-xs font-bold px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] focus:outline-none shadow-xs"
                >
                  <option value="all">All Departments ({employees.length})</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7]">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'card' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-[#e2dfd7]/60 scrollbar-none text-xs font-bold">
              <button
                onClick={() => { setQuickFilter('all'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'all' && kpiFilter === 'all'
                    ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]'
                    : 'bg-white text-[#666] border-[#e2dfd7] hover:bg-[#F9F7F4]'
                }`}
              >
                All ({employees.length})
              </button>
              <button
                onClick={() => setQuickFilter('overdue')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'overdue'
                    ? 'bg-rose-700 text-white border-rose-800'
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
              >
                ⚠️ Overdue DOJ (No Show)
              </button>
              <button
                onClick={() => setQuickFilter('today')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'today'
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                }`}
              >
                ⭐ Joining Today
              </button>
              <button
                onClick={() => setQuickFilter('tomorrow')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'tomorrow'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
                }`}
              >
                📅 Joining Tomorrow
              </button>
              <button
                onClick={() => setQuickFilter('week')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'week'
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
                }`}
              >
                📆 Next 7 Days
              </button>
              <button
                onClick={() => setQuickFilter('confirmed')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'confirmed'
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                ✅ DOJ Confirmed
              </button>
              <button
                onClick={() => setQuickFilter('pending')}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  quickFilter === 'pending'
                    ? 'bg-slate-800 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ⏳ Pending Follow-up
              </button>
            </div>
          </div>

          {/* ── Main Candidate List / Grid ── */}
          {empLoading ? (
            <div className="card-glass p-12 text-center space-y-3 border border-[#e2dfd7]">
              <Loader2 className="w-8 h-8 text-[#C9952A] animate-spin mx-auto" />
              <div className="text-sm font-black text-[#1E2D4E]">Loading Non-Joined Candidates...</div>
              <p className="text-xs text-[#777]">Fetching latest DOJ status and call desk records</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="card-glass p-12 text-center space-y-3 border border-[#e2dfd7]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-base font-black text-[#1E2D4E]">No Non-Joined Candidates Matching Filters</div>
              <p className="text-xs text-[#777] max-w-md mx-auto">
                {employees.length === 0
                  ? `All selected candidates for ${selectedDesig || 'this role'} have successfully joined the store, or no DOJ is scheduled.`
                  : 'Try adjusting your search or filters above.'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            /* ── Card Grid View ── */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEmployees.map(emp => {
                const urg = urgencyOf(emp.offeredDoj);
                const days = daysUntil(emp.offeredDoj);

                return (
                  <div
                    key={emp.appNo}
                    className={`card-glass p-5 space-y-4 border-l-4 transition-all duration-200 hover:shadow-md border border-[#e2dfd7] ${urgencyBorderColor(urg)}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#1E2D4E] text-[#C9952A] font-black text-sm flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0 border border-[#C9952A]/30">
                          {emp.photoUrl ? (
                            <img src={fileUrl(emp.photoUrl) || ''} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            emp.name ? emp.name.slice(0, 2).toUpperCase() : 'BSC'
                          )}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#1E2D4E] leading-tight">
                            {emp.name}
                          </h4>
                          <div className="text-[11px] text-[#777] font-mono font-semibold">
                            {emp.appNo} · {emp.gender || 'Candidate'}
                          </div>
                        </div>
                      </div>

                      {/* Urgency Badge */}
                      {urg === 'overdue' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                          Overdue ({Math.abs(days || 0)}d)
                        </span>
                      )}
                      {urg === 'today' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          Joining Today!
                        </span>
                      )}
                      {urg === 'tomorrow' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                          Tomorrow
                        </span>
                      )}
                      {urg === 'soon' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                          In {days} Days
                        </span>
                      )}
                      {urg === 'week' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          This Week
                        </span>
                      )}
                    </div>

                    {/* Meta Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/70">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#777]">Department</div>
                        <div className="font-bold text-[#1E2D4E] truncate">{emp.department || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#777]">Section</div>
                        <div className="font-bold text-[#1E2D4E] truncate">{emp.section || 'General'}</div>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-[#e2dfd7]/50 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-[#777]">Scheduled DOJ</div>
                          <div className="font-black text-rose-700 text-xs flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{fmtDate(emp.offeredDoj)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => openDojModal(emp)}
                          className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-white border border-[#1E2D4E]/30 text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Reschedule
                        </button>
                      </div>
                    </div>

                    {/* Status Pills */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${callStatusCls(emp.callStatus)}`}>
                        <span>{callStatusEmoji(emp.callStatus)}</span>
                        <span>{emp.callStatus}</span>
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${dojConfCls(emp.dojConfirmation)}`}>
                        {emp.dojConfirmation}
                      </span>
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#1E2D4E]/10 text-[#1E2D4E] border border-[#1E2D4E]/20">
                        {emp.candidateStatus}
                      </span>
                    </div>

                    {/* Follow-up / Notes snippet */}
                    {emp.notes && (
                      <div className="text-[11.5px] text-[#555] bg-white p-2.5 rounded-xl border border-[#e2dfd7] font-medium leading-relaxed italic line-clamp-2">
                        "{emp.notes}"
                      </div>
                    )}

                    {/* Contact Quick Actions & Log Call Buttons */}
                    <div className="pt-2 border-t border-[#e2dfd7] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${emp.phone}`}
                          className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                          title="Call Phone"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/91${emp.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(emp.name)},%20this%20is%20regarding%20your%20scheduled%20joining%20at%20BSC%20The%20Textile%20Mall.`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors"
                          title="WhatsApp Candidate"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => openHistoryDrawer(emp)}
                          className="w-8 h-8 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                          title="View Call History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openCallModal(emp)}
                          className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#2A3F6D] transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <PhoneOutgoing className="w-3 h-3 text-[#C9952A]" />
                          <span>Log Call</span>
                        </button>
                        <button
                          onClick={() => openJoinModal(emp)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Mark as Joined Store"
                        >
                          <Store className="w-3 h-3" />
                          <span>Mark Joined</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Table View ── */
            <div className="card-glass p-4 overflow-hidden border border-[#e2dfd7]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777] bg-[#F9F7F4]/60">
                      <th className="py-3 px-3">Candidate</th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3">Department &amp; Section</th>
                      <th className="py-3 px-3">Scheduled DOJ</th>
                      <th className="py-3 px-3">Call Status</th>
                      <th className="py-3 px-3">DOJ Confirmation</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2dfd7]/60 font-medium">
                    {filteredEmployees.map(emp => {
                      const urg = urgencyOf(emp.offeredDoj);
                      return (
                        <tr key={emp.appNo} className="hover:bg-black/5 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-[#1E2D4E] text-sm">{emp.name}</div>
                            <div className="text-[11px] text-[#777] font-mono">{emp.appNo} · {emp.gender || '—'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-[#333] font-mono">{emp.phone}</div>
                            <div className="text-[10.5px] text-[#777] truncate max-w-[140px]">{emp.email || '—'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#1E2D4E]">{emp.department}</div>
                            <div className="text-[11px] text-[#666]">{emp.section || 'General'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-black text-rose-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{fmtDate(emp.offeredDoj)}</span>
                            </div>
                            {urg === 'overdue' && (
                              <span className="text-[10px] font-bold text-rose-600 uppercase">Overdue</span>
                            )}
                            {urg === 'today' && (
                              <span className="text-[10px] font-bold text-amber-600 uppercase">Today</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1 ${callStatusCls(emp.callStatus)}`}>
                              <span>{callStatusEmoji(emp.callStatus)}</span>
                              <span>{emp.callStatus}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-block ${dojConfCls(emp.dojConfirmation)}`}>
                              {emp.dojConfirmation}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openCallModal(emp)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#1E2D4E] text-white font-bold text-[11px] hover:bg-[#2A3F6D] transition-colors cursor-pointer"
                              >
                                Log Call
                              </button>
                              <button
                                onClick={() => openDojModal(emp)}
                                className="px-2.5 py-1.5 rounded-xl border border-[#1E2D4E] text-[#1E2D4E] font-bold text-[11px] hover:bg-[#1E2D4E] hover:text-white transition-colors cursor-pointer"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => openJoinModal(emp)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                Join Store
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Modal 1: Log Call & Follow-up ── */}
      {callModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setCallModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between border-b border-[#C9952A]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black shadow-md">
                  <PhoneOutgoing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Log Follow-up Call</h3>
                  <p className="text-[11px] text-[#C9952A] font-semibold mt-0.5">{callModalEmp.name} · {callModalEmp.appNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCallModalEmp(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Summary */}
            <div className="bg-[#F9F7F4] px-6 py-3 border-b border-[#e2dfd7] flex items-center justify-between text-xs font-bold">
              <div>
                <span className="text-[#777]">Role: </span>
                <span className="text-[#1E2D4E]">{callModalEmp.designation}</span>
              </div>
              <div>
                <span className="text-[#777]">Scheduled DOJ: </span>
                <span className="text-rose-700 font-black">{fmtDate(callModalEmp.offeredDoj)}</span>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  Call Status *
                </label>
                <select
                  value={callForm.callStatus}
                  onChange={(e) => setCallForm({ ...callForm, callStatus: e.target.value as CallStatus })}
                  className="w-full text-xs font-bold p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                >
                  <option value="Pending">⏳ Pending Call</option>
                  <option value="Call done">✅ Call Done (Connected)</option>
                  <option value="Call not received">📵 Call Not Received / No Answer</option>
                  <option value="Wrong number">❌ Wrong Number / Unreachable</option>
                  <option value="Rescheduled">📅 Call Rescheduled</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  DOJ Confirmation Status *
                </label>
                <select
                  value={callForm.dojConfirmation}
                  onChange={(e) => setCallForm({ ...callForm, dojConfirmation: e.target.value as DojConf })}
                  className="w-full text-xs font-bold p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                >
                  <option value="Confirmed">🟢 Confirmed (Candidate will join on scheduled DOJ)</option>
                  <option value="Not confirmed">🔴 Not Confirmed (Candidate requested delay / unsure)</option>
                  <option value="Pending confirmation">⚪ Pending Confirmation</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  Next Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={callForm.followUpDate}
                  onChange={(e) => setCallForm({ ...callForm, followUpDate: e.target.value })}
                  className="w-full text-xs font-bold p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  Call Notes &amp; Observations
                </label>
                <textarea
                  rows={3}
                  value={callForm.notes}
                  onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                  placeholder="e.g. Candidate confirmed they will reach store by 10 AM, requested uniform details..."
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2dfd7]">
                <button
                  type="button"
                  onClick={() => setCallModalEmp(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#F9F7F4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCall}
                  disabled={savingCall}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {savingCall ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savingCall ? 'Saving...' : 'Save Call Record'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Reschedule DOJ ── */}
      {dojModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setDojModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between border-b border-[#C9952A]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black shadow-md">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Reschedule Date of Joining</h3>
                  <p className="text-[11px] text-[#C9952A] font-semibold mt-0.5">{dojModalEmp.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDojModalEmp(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-[#F9F7F4] rounded-xl border border-[#e2dfd7] space-y-1">
                <div className="text-[10px] font-black uppercase text-[#777]">Current Scheduled DOJ</div>
                <div className="font-black text-[#1E2D4E] text-sm">{fmtDate(dojModalEmp.offeredDoj)}</div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  Select New Date of Joining *
                </label>
                <input
                  type="date"
                  value={newDojInput}
                  onChange={(e) => setNewDojInput(e.target.value)}
                  className="w-full text-xs font-bold p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2dfd7]">
                <button
                  type="button"
                  onClick={() => setDojModalEmp(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#F9F7F4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDoj}
                  disabled={savingDoj || !newDojInput}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {savingDoj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>{savingDoj ? 'Updating...' : 'Confirm Rescheduled DOJ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Mark as Joined Store ── */}
      {joinModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setJoinModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-emerald-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white text-emerald-800 flex items-center justify-center font-black shadow-md">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Confirm Store Joining</h3>
                  <p className="text-[11px] text-emerald-200 font-semibold mt-0.5">Move to Joined Store Directory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setJoinModalEmp(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-[#F9F7F4] rounded-2xl border border-[#e2dfd7] space-y-2">
                <div className="font-black text-sm text-[#1E2D4E]">{joinModalEmp.name}</div>
                <div className="text-[11px] text-[#777] font-mono">{joinModalEmp.appNo} · {joinModalEmp.designation}</div>
                <div className="text-[11px] text-[#555]">
                  Scheduled DOJ: <strong className="text-emerald-700">{fmtDate(joinModalEmp.offeredDoj)}</strong>
                </div>
              </div>

              <p className="text-xs text-[#555] font-medium leading-relaxed">
                Confirming this action will update the candidate's status to <strong>Successfully Joined Store</strong> and automatically move them into the <strong>Joined Store Directory</strong> and <strong>Employee Master (greytHR)</strong>.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2dfd7]">
                <button
                  type="button"
                  onClick={() => setJoinModalEmp(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#F9F7F4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMarkJoined}
                  disabled={joiningStore}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {joiningStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{joiningStore ? 'Updating...' : 'Confirm Store Entry'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-over Drawer: Call History & Audit Trail ── */}
      {historyEmp && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryEmp(null); }}
        >
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#e2dfd7] flex flex-col animate-slide-left">
            {/* Drawer Header */}
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between border-b border-[#C9952A]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Call &amp; DOJ History Log</h3>
                  <p className="text-[10.5px] text-[#C9952A] font-semibold">{historyEmp.name} ({historyEmp.appNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryEmp(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-[#C9952A] animate-spin mx-auto" />
                  <p className="text-xs text-[#777] font-bold mt-2">Loading History...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777] font-medium">
                  No previous call records logged for this candidate yet.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2dfd7]">
                  {historyList.map(h => (
                    <div key={h.id} className="relative pl-7 space-y-1">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-[#1E2D4E] border-2 border-white shadow-xs"></div>
                      <div className="flex items-center justify-between text-[10px] text-[#777] font-semibold">
                        <span>{fmtTs(h.created_at)}</span>
                        <span className="font-bold text-[#1E2D4E]">by {h.done_by || 'HR'}</span>
                      </div>
                      <div className="p-3 bg-[#F9F7F4] rounded-xl border border-[#e2dfd7] text-xs font-semibold space-y-1">
                        <div className="font-bold text-[#1E2D4E] flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-[#C9952A]" />
                          <span className="uppercase text-[10px] tracking-wider">{h.action_type}</span>
                        </div>
                        {h.notes && (
                          <div className="text-[#555] font-medium italic">"{h.notes}"</div>
                        )}
                        {h.old_value && h.new_value && (
                          <div className="text-[11px] text-[#777] flex items-center gap-1">
                            <span className="line-through">{h.old_value}</span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-bold text-[#1E2D4E]">{h.new_value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
