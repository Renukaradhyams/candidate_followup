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
  FileSpreadsheet, Flame, CheckCircle2, Store, UserX, Tag,
  Filter, Sparkles, PhoneOff, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled';
type DojConf    = 'Pending confirmation' | 'Confirmed' | 'Not confirmed';
type QuickFilterType = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'next_7_days' | 'followup_required' | 'no_answer' | 'confirmed' | 'custom';
export type KpiFilterType = 'all' | 'total' | 'overdue' | 'today' | 'upcoming' | 'followup_required' | 'no_answer' | 'doj_confirmed';

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
  salary?: string;
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
  joiningToday: number;
  upcomingDoj: number;
  joiningThisWeek: number;
  followUpRequired: number;
  noAnswer: number;
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

const formatSalaryVal = (val: any): string => {
  if (!val) return '—';
  const str = String(val).trim();
  if (!str || str === '0' || str === 'null' || str === 'undefined' || str === '—' || str.toLowerCase() === 'nan') return '—';

  if (str.includes('|')) {
    const parts = str.split('|');
    const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
    const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
    const total = base + inc;
    if (total === 0) return '—';
    return inc > 0 
      ? `₹ ${base.toLocaleString('en-IN')} (+ ₹ ${inc.toLocaleString('en-IN')} Inc)` 
      : `₹ ${base.toLocaleString('en-IN')}`;
  }

  if (str.includes('+')) {
    const parts = str.split('+');
    const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
    const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
    const total = base + inc;
    if (total === 0) return '—';
    return inc > 0 
      ? `₹ ${base.toLocaleString('en-IN')} (+ ₹ ${inc.toLocaleString('en-IN')} Inc)` 
      : `₹ ${base.toLocaleString('en-IN')}`;
  }

  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num === 0) return '—';
  return `₹ ${num.toLocaleString('en-IN')}`;
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
  return 'future';
};

const urgencyBorderColor = (u: string | null) => {
  if (u === 'overdue')  return 'border-l-rose-500 bg-rose-50/10';
  if (u === 'today')    return 'border-l-amber-500 bg-amber-50/10';
  if (u === 'tomorrow') return 'border-l-blue-500';
  if (u === 'soon')     return 'border-l-indigo-400';
  if (u === 'week')     return 'border-l-emerald-500';
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
  const [allNotJoinedList, setAllNotJoinedList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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

  const [profileModalEmp, setProfileModalEmp] = useState<Employee | null>(null);

  // Authentication check
  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  // Load summary, analytics, & all records for global filtering
  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, anaRes, allRes] = await Promise.all([
        API.getNotJoinedSummary(),
        API.getNotJoinedAnalytics(),
        API.getNotJoinedAll()
      ]);
      if (sumRes && sumRes.summaries) {
        setSummaries(sumRes.summaries);
      }
      if (anaRes) {
        setAnalytics(anaRes);
      }
      if (allRes && allRes.employees) {
        setAllNotJoinedList(allRes.employees);
      }
    } catch (err: any) {
      showToast('Error loading not-joined data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // Load employees for selected designation (or fetch all if no desig selected)
  const loadEmployeesForDesig = useCallback(async (desig: string) => {
    try {
      setEmpLoading(true);
      if (desig) {
        const res = await API.getNotJoinedByDesignation(desig);
        setEmployees(res && res.employees ? res.employees : []);
      } else {
        const res = await API.getNotJoinedAll();
        setEmployees(res && res.employees ? res.employees : []);
      }
    } catch (err: any) {
      showToast('Error loading candidates: ' + err.message, 'error');
      setEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployeesForDesig(selectedDesig);
  }, [selectedDesig, loadEmployeesForDesig]);

  // Total Not Joined count across summaries
  const totalNotJoinedCount = useMemo(() => {
    if (analytics?.total !== undefined) return analytics.total;
    if (allNotJoinedList.length > 0) return allNotJoinedList.length;
    return summaries.reduce((acc, s) => acc + s.total, 0);
  }, [analytics, summaries, allNotJoinedList]);

  // Unique departments from current candidate set
  const departments = useMemo(() => {
    const sourceList = selectedDesig ? employees : allNotJoinedList;
    const set = new Set<string>();
    sourceList.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [employees, allNotJoinedList, selectedDesig]);

  // Department counts for Not Joined population ONLY
  const deptCounts = useMemo(() => {
    const sourceList = selectedDesig ? employees : allNotJoinedList;
    const map: Record<string, number> = {};
    sourceList.forEach(e => {
      const d = e.department || 'Unassigned';
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [employees, allNotJoinedList, selectedDesig]);

  // Filtered candidate list based on search, KPI cards, quick filters, and department
  const activeEmployeeList = useMemo(() => {
    return selectedDesig ? employees : allNotJoinedList;
  }, [selectedDesig, employees, allNotJoinedList]);

  const filteredEmployees = useMemo(() => {
    return activeEmployeeList.filter(emp => {
      // 1. Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          emp.name.toLowerCase().includes(q) ||
          emp.appNo.toLowerCase().includes(q) ||
          emp.phone.toLowerCase().includes(q) ||
          (emp.email && emp.email.toLowerCase().includes(q)) ||
          (emp.department && emp.department.toLowerCase().includes(q)) ||
          (emp.section && emp.section.toLowerCase().includes(q)) ||
          (emp.designation && emp.designation.toLowerCase().includes(q));
        if (!match) return false;
      }

      // 2. Department filter
      if (deptFilter !== 'all' && emp.department !== deptFilter) return false;

      // 3. KPI Filter
      const urg = urgencyOf(emp.offeredDoj);
      const days = daysUntil(emp.offeredDoj);

      if (kpiFilter === 'overdue' && urg !== 'overdue') return false;
      if (kpiFilter === 'today' && urg !== 'today') return false;
      if (kpiFilter === 'upcoming' && urg !== 'tomorrow' && urg !== 'soon' && urg !== 'week' && urg !== 'future') return false;
      if (kpiFilter === 'followup_required') {
        const isPending = emp.callStatus === 'Pending';
        const isFollowUpDue = emp.followUpDate && emp.followUpDate <= new Date().toISOString().slice(0, 10);
        if (!isPending && !isFollowUpDue) return false;
      }
      if (kpiFilter === 'no_answer' && emp.callStatus !== 'Call not received' && emp.callStatus !== 'Wrong number') return false;
      if (kpiFilter === 'doj_confirmed' && emp.dojConfirmation !== 'Confirmed') return false;

      // 4. Quick Date / Status Filter
      if (quickFilter === 'overdue' && urg !== 'overdue') return false;
      if (quickFilter === 'today' && urg !== 'today') return false;
      if (quickFilter === 'tomorrow' && urg !== 'tomorrow') return false;
      if (quickFilter === 'week' && urg !== 'week' && urg !== 'soon' && urg !== 'today' && urg !== 'tomorrow') return false;
      if (quickFilter === 'next_7_days' && (days === null || days < 0 || days > 7)) return false;
      if (quickFilter === 'confirmed' && emp.dojConfirmation !== 'Confirmed') return false;
      if (quickFilter === 'followup_required' && emp.callStatus !== 'Pending') return false;
      if (quickFilter === 'no_answer' && emp.callStatus !== 'Call not received' && emp.callStatus !== 'Wrong number') return false;

      // 5. Custom Date Range Filter on Scheduled DOJ
      if (quickFilter === 'custom' || fromDate || toDate) {
        if (!emp.offeredDoj) return false;
        if (fromDate && emp.offeredDoj < fromDate) return false;
        if (toDate && emp.offeredDoj > toDate) return false;
      }

      return true;
    });
  }, [activeEmployeeList, search, deptFilter, kpiFilter, quickFilter, fromDate, toDate]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearch('');
    setKpiFilter('all');
    setQuickFilter('all');
    setDeptFilter('all');
    setSelectedDesig('');
    setFromDate('');
    setToDate('');
  };

  // Has active filter indicator
  const hasActiveFilters = useMemo(() => {
    return (
      kpiFilter !== 'all' ||
      quickFilter !== 'all' ||
      deptFilter !== 'all' ||
      selectedDesig !== '' ||
      search.trim() !== '' ||
      fromDate !== '' ||
      toDate !== ''
    );
  }, [kpiFilter, quickFilter, deptFilter, selectedDesig, search, fromDate, toDate]);

  // Active filter label description
  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (kpiFilter !== 'all') {
      if (kpiFilter === 'total') parts.push('Total Not Joined');
      else if (kpiFilter === 'overdue') parts.push('Overdue — Not Joined');
      else if (kpiFilter === 'today') parts.push('Joining Today');
      else if (kpiFilter === 'upcoming') parts.push('Upcoming DOJ');
      else if (kpiFilter === 'followup_required') parts.push('Follow-Up Required');
      else if (kpiFilter === 'no_answer') parts.push('No Answer / Unreachable');
      else if (kpiFilter === 'doj_confirmed') parts.push('DOJ Confirmed — Not Joined');
    }
    if (quickFilter !== 'all' && kpiFilter === 'all') {
      if (quickFilter === 'overdue') parts.push('Overdue DOJ');
      else if (quickFilter === 'today') parts.push('Joining Today');
      else if (quickFilter === 'tomorrow') parts.push('Joining Tomorrow');
      else if (quickFilter === 'week') parts.push('This Week');
      else if (quickFilter === 'next_7_days') parts.push('Next 7 Days');
      else if (quickFilter === 'confirmed') parts.push('DOJ Confirmed');
      else if (quickFilter === 'followup_required') parts.push('Follow-up Required');
      else if (quickFilter === 'no_answer') parts.push('No Answer');
    }
    if (selectedDesig) parts.push(`Designation: ${selectedDesig}`);
    if (deptFilter !== 'all') parts.push(`Dept: ${deptFilter}`);
    if (fromDate || toDate) parts.push(`DOJ Range: ${fromDate || 'Start'} to ${toDate || 'End'}`);
    if (search.trim()) parts.push(`Search: "${search}"`);
    return parts.join(' • ');
  }, [kpiFilter, quickFilter, selectedDesig, deptFilter, fromDate, toDate, search]);

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
      showToast(`Follow-up record saved for ${callModalEmp.name}!`, 'success');
      setCallModalEmp(null);
      loadSummaries();
      loadEmployeesForDesig(selectedDesig);
    } catch (err: any) {
      showToast('Error saving call record: ' + err.message, 'error');
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
      loadEmployeesForDesig(selectedDesig);
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
        remarks: 'Marked joined via Not Joined & DOJ Follow-up Desk'
      });
      showToast(`${joinModalEmp.name} marked as Successfully Joined Store! 🏬🎉`, 'success');
      setJoinModalEmp(null);
      loadSummaries();
      loadEmployeesForDesig(selectedDesig);
    } catch (err: any) {
      showToast('Error marking employee as joined store: ' + err.message, 'error');
    } finally {
      setJoiningStore(false);
    }
  };

  // Open History Drawer
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

  // Export Excel for current NOT JOINED population ONLY
  const exportToExcel = async () => {
    try {
      showToast('Generating Excel report of Not Joined candidates...', 'info');
      const listToExport = filteredEmployees.length > 0 ? filteredEmployees : allNotJoinedList;

      if (!listToExport || listToExport.length === 0) {
        showToast('No pending non-joined employee data to export', 'warn');
        return;
      }

      const rows = listToExport.map((e, idx) => {
        const days = daysUntil(e.offeredDoj);
        let statusStr = 'NOT JOINED';
        if (days !== null) {
          if (days < 0) statusStr = `OVERDUE (${Math.abs(days)} DAYS)`;
          else if (days === 0) statusStr = 'JOINING TODAY';
          else if (days === 1) statusStr = 'JOINING TOMORROW';
          else statusStr = `JOINING IN ${days} DAYS`;
        }

        return {
          '#': idx + 1,
          'App / Employee ID': e.appNo,
          'Employee Name': e.name,
          'Phone Number': e.phone,
          'Email': e.email || '—',
          'Gender': e.gender || '—',
          'Department': e.department,
          'Section': e.section || 'General',
          'Designation': e.designation,
          'Offered Salary': formatSalaryVal(e.salary),
          'Store Joining Status': statusStr,
          'Scheduled DOJ': fmtDate(e.offeredDoj),
          'Call Status': e.callStatus,
          'DOJ Confirmation': e.dojConfirmation,
          'Notes': e.notes || '—',
          'Follow-up Date': fmtDate(e.followUpDate),
          'Last Call Date': fmtDate(e.lastCallDate),
          'Updated By': e.updatedBy || 'HR'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Not_Joined_Employees');
      const fileName = `BSC_Not_Joined_FollowUp_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Exported report of non-joined employees! 📊', 'success');
    } catch (err: any) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex font-sans">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="NOT JOINED &amp; DOJ FOLLOW-UP DESK"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Not Joined Desk' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">

          {/* ── 1. Redesigned Main Header ── */}
          <div className="card-glass p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#e2dfd7] shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#1E2D4E] text-[#C9952A] flex items-center justify-center shadow-md border border-[#C9952A]/40 flex-shrink-0">
                  <CalendarX className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#1E2D4E] tracking-tight">
                      NOT JOINED &amp; DOJ FOLLOW-UP DESK
                    </h2>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-600" /> PRE-JOINING TRACKER
                    </span>
                  </div>
                  <p className="text-xs text-[#666] font-semibold mt-0.5">
                    Track employees from the Employee Directory who have not yet joined the store, based on their Date of Joining.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
              <button
                onClick={loadSummaries}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] text-xs font-bold hover:bg-[#F9F7F4] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Refresh latest data"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>
              <button
                onClick={exportToExcel}
                className="btn-secondary text-xs py-2.5 flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* ── 2. KPI Cards Section (6 Primary KPIs on NOT JOINED Population) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

            {/* KPI 1: TOTAL NOT JOINED (Main KPI) */}
            <div
              onClick={() => { setKpiFilter('total'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs relative overflow-hidden ${
                kpiFilter === 'total' || (kpiFilter === 'all' && quickFilter === 'all')
                  ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-md ring-2 ring-[#C9952A]'
                  : 'bg-white border-[#e2dfd7] text-[#1E2D4E] hover:border-[#1E2D4E]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  kpiFilter === 'total' || (kpiFilter === 'all' && quickFilter === 'all') ? 'text-[#C9952A]' : 'text-[#777]'
                }`}>
                  TOTAL NOT JOINED
                </span>
                <UserX className={`w-4 h-4 ${
                  kpiFilter === 'total' || (kpiFilter === 'all' && quickFilter === 'all') ? 'text-[#C9952A]' : 'text-[#1E2D4E]'
                }`} />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                {totalNotJoinedCount}
              </div>
              <div className={`text-[10.5px] font-bold mt-0.5 truncate ${
                kpiFilter === 'total' || (kpiFilter === 'all' && quickFilter === 'all') ? 'text-white/80' : 'text-[#777]'
              }`}>
                Employees awaiting store joining
              </div>
            </div>

            {/* KPI 2: OVERDUE — NOT JOINED */}
            <div
              onClick={() => { setKpiFilter('overdue'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'overdue' || quickFilter === 'overdue'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-md ring-2 ring-rose-300'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950 hover:bg-rose-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                  OVERDUE
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-rose-900">
                {analytics?.overdueDoj ?? allNotJoinedList.filter(e => urgencyOf(e.offeredDoj) === 'overdue').length}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5 text-rose-700 truncate">
                DOJ passed — still not joined
              </div>
            </div>

            {/* KPI 3: JOINING TODAY */}
            <div
              onClick={() => { setKpiFilter('today'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'today' || quickFilter === 'today'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950 hover:bg-amber-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  JOINING TODAY
                </span>
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-amber-900">
                {analytics?.joiningToday ?? allNotJoinedList.filter(e => urgencyOf(e.offeredDoj) === 'today').length}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5 text-amber-800 truncate">
                Expected to join today
              </div>
            </div>

            {/* KPI 4: UPCOMING */}
            <div
              onClick={() => { setKpiFilter('upcoming'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'upcoming' || quickFilter === 'week' || quickFilter === 'tomorrow'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-md ring-2 ring-blue-300'
                  : 'bg-blue-50/80 border-blue-200 text-blue-950 hover:bg-blue-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                  UPCOMING DOJ
                </span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-blue-900">
                {analytics?.upcomingDoj ?? allNotJoinedList.filter(e => {
                  const u = urgencyOf(e.offeredDoj);
                  return u === 'tomorrow' || u === 'soon' || u === 'week' || u === 'future';
                }).length}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5 text-blue-700 truncate">
                Expected to join soon
              </div>
            </div>

            {/* KPI 5: FOLLOW-UP REQUIRED */}
            <div
              onClick={() => { setKpiFilter('followup_required'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'followup_required'
                  ? 'bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-300'
                  : 'bg-purple-50/80 border-purple-200 text-purple-950 hover:bg-purple-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                  FOLLOW-UP REQUIRED
                </span>
                <PhoneOutgoing className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-purple-900">
                {analytics?.followUpRequired ?? allNotJoinedList.filter(e => e.callStatus === 'Pending').length}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5 text-purple-700 truncate">
                Needs outreach
              </div>
            </div>

            {/* KPI 6: NO ANSWER / UNREACHED */}
            <div
              onClick={() => { setKpiFilter('no_answer'); setQuickFilter('all'); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                kpiFilter === 'no_answer'
                  ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-400'
                  : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  NO ANSWER
                </span>
                <PhoneOff className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight text-slate-900">
                {analytics?.noAnswer ?? allNotJoinedList.filter(e => e.callStatus === 'Call not received' || e.callStatus === 'Wrong number').length}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5 text-slate-600 truncate">
                Follow-up unsuccessful
              </div>
            </div>

          </div>

          {/* ── Active Filter Notification Banner ── */}
          {hasActiveFilters && (
            <div className="bg-[#1E2D4E] text-white px-4 py-3 rounded-2xl border border-[#C9952A]/40 flex items-center justify-between gap-3 text-xs font-bold animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <Filter className="w-4 h-4 text-[#C9952A] flex-shrink-0" />
                <span className="text-[#C9952A] uppercase tracking-wider text-[10px] font-black flex-shrink-0">ACTIVE FILTER:</span>
                <span className="text-white truncate font-extrabold">[{activeFilterLabel}]</span>
                <span className="text-white/70 font-normal flex-shrink-0">({filteredEmployees.length} non-joined employees found)</span>
              </div>
              <button
                onClick={clearAllFilters}
                className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filter</span>
              </button>
            </div>
          )}

          {/* ── 3. Designation Breakdown Review ── */}
          <div className="card-glass p-5 space-y-3 border border-[#e2dfd7]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1E2D4E] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#C9952A]" />
                <span>Designation Review (Pending Not Joined Population)</span>
              </h3>
              <span className="text-[11px] font-extrabold text-[#777]">
                {summaries.length} Designations Awaiting Store Entry
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedDesig('')}
                className={`
                  px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer
                  ${selectedDesig === ''
                    ? 'bg-[#1E2D4E] text-white shadow-md ring-2 ring-[#C9952A]'
                    : 'bg-white text-[#555] border border-[#e2dfd7] hover:bg-[#F9F7F4] hover:text-[#1E2D4E]'}
                `}
              >
                <span>All Designations</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${selectedDesig === '' ? 'bg-[#C9952A] text-slate-900' : 'bg-[#1E2D4E]/10 text-[#1E2D4E]'}`}>
                  {totalNotJoinedCount}
                </span>
              </button>

              {summaries.map(s => {
                const isSel = selectedDesig === s.designation;
                return (
                  <button
                    key={s.designation}
                    onClick={() => setSelectedDesig(isSel ? '' : s.designation)}
                    className={`
                      px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer
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

          {/* ── 4. Toolbar: Date-Based Follow-Up Filters, Search & View Controls ── */}
          <div className="card-glass p-4 space-y-3 border border-[#e2dfd7]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">

              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777]" />
                <input
                  type="text"
                  placeholder="Search name, phone, App ID, Employee ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs font-bold pl-10 pr-4 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                />
              </div>

              {/* Controls: Department & View Mode */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">

                {/* Department Dropdown */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="text-xs font-bold px-3 py-2.5 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] focus:outline-none shadow-xs"
                >
                  <option value="all">All Departments ({totalNotJoinedCount})</option>
                  {departments.map(d => (
                    <option key={d} value={d}>
                      {d} ({deptCounts[d] || 0})
                    </option>
                  ))}
                </select>

                {/* View Mode Cards / Table Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7]">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      viewMode === 'card' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    Cards View
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    Table View
                  </button>
                </div>
              </div>
            </div>

            {/* Date-Based Quick Filters Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#e2dfd7]/60 scrollbar-none text-xs font-bold">
              <span className="text-[10px] font-black uppercase text-[#777] tracking-wider flex-shrink-0">
                Scheduled DOJ Filters:
              </span>

              <button
                onClick={() => { setQuickFilter('all'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'all' && kpiFilter === 'all'
                    ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]'
                    : 'bg-white text-[#666] border-[#e2dfd7] hover:bg-[#F9F7F4]'
                }`}
              >
                All Not Joined ({totalNotJoinedCount})
              </button>

              <button
                onClick={() => { setQuickFilter('overdue'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'overdue' || kpiFilter === 'overdue'
                    ? 'bg-rose-700 text-white border-rose-800'
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
              >
                🔴 Overdue DOJ
              </button>

              <button
                onClick={() => { setQuickFilter('today'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'today' || kpiFilter === 'today'
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                }`}
              >
                🟠 Joining Today
              </button>

              <button
                onClick={() => { setQuickFilter('tomorrow'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'tomorrow'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
                }`}
              >
                🔵 Joining Tomorrow
              </button>

              <button
                onClick={() => { setQuickFilter('week'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'week'
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
                }`}
              >
                📅 This Week
              </button>

              <button
                onClick={() => { setQuickFilter('next_7_days'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'next_7_days'
                    ? 'bg-indigo-700 text-white border-indigo-800'
                    : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                📆 Next 7 Days
              </button>

              <button
                onClick={() => { setQuickFilter('confirmed'); setKpiFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  quickFilter === 'confirmed' || kpiFilter === 'doj_confirmed'
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                🟢 DOJ Confirmed — Not Joined
              </button>

              {/* Custom Date Range Filter Inputs */}
              <div className="flex items-center gap-1.5 ml-auto border-l border-[#e2dfd7] pl-3 flex-shrink-0">
                <span className="text-[10px] font-black uppercase text-[#777]">DOJ Range:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setQuickFilter('custom'); }}
                  className="px-2 py-1 rounded-lg border border-[#e2dfd7] bg-white text-[11px] font-bold text-[#1E2D4E]"
                  title="From Date"
                />
                <span className="text-[10px] font-bold text-[#777]">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setQuickFilter('custom'); }}
                  className="px-2 py-1 rounded-lg border border-[#e2dfd7] bg-white text-[11px] font-bold text-[#1E2D4E]"
                  title="To Date"
                />
              </div>
            </div>
          </div>

          {/* ── 5. Main Employee List View (Cards or Table) ── */}
          {empLoading ? (
            <div className="card-glass p-12 text-center space-y-3 border border-[#e2dfd7]">
              <Loader2 className="w-8 h-8 text-[#C9952A] animate-spin mx-auto" />
              <div className="text-sm font-black text-[#1E2D4E]">Loading Non-Joined Employees...</div>
              <p className="text-xs text-[#777] font-semibold">Reconciling Employee Directory against Joined Store Directory</p>
            </div>
          ) : totalNotJoinedCount === 0 ? (
            /* ── No Data State: All Employees Joined 🎉 ── */
            <div className="card-glass p-12 text-center space-y-4 border-2 border-emerald-200 bg-emerald-50/30">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-md border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#1E2D4E]">🎉 ALL EMPLOYEES HAVE JOINED</h3>
                <p className="text-xs text-[#555] font-semibold max-w-md mx-auto">
                  No candidates or employees are currently pending store joining. Every confirmed record in the Employee Directory has successfully joined the store!
                </p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            /* ── Filter Result Empty State ── */
            <div className="card-glass p-12 text-center space-y-4 border border-[#e2dfd7]">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-[#1E2D4E]">No Non-Joined Candidates Match Filters</h3>
                <p className="text-xs text-[#777] max-w-md mx-auto font-medium">
                  There are non-joined candidates, but none match your current search, date range, or KPI filter selection.
                </p>
              </div>
              <button
                onClick={clearAllFilters}
                className="btn-primary text-xs py-2 px-4 shadow-sm cursor-pointer mx-auto inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
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
                    {/* Header: Photo, Name, App ID & Prominent Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#1E2D4E] text-[#C9952A] font-black text-sm flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0 border border-[#C9952A]/40">
                          {emp.photoUrl ? (
                            <img src={fileUrl(emp.photoUrl) || ''} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            emp.name ? emp.name.slice(0, 2).toUpperCase() : 'BSC'
                          )}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#1E2D4E] leading-tight flex items-center gap-1.5">
                            <span>{emp.name}</span>
                          </h4>
                          <div className="text-[11px] text-[#777] font-mono font-bold mt-0.5">
                            {emp.appNo} · {emp.gender || 'Candidate'}
                          </div>
                          <div className="text-[11px] text-[#C9952A] font-extrabold truncate">
                            {emp.designation}
                          </div>
                        </div>
                      </div>

                      {/* Prominent Joining Status Badges */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                          🔴 NOT JOINED
                        </span>

                        {urg === 'overdue' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-2xs">
                            🔴 OVERDUE ({Math.abs(days || 0)} DAYS)
                          </span>
                        )}
                        {urg === 'today' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white animate-pulse shadow-2xs">
                            🟠 JOINING TODAY
                          </span>
                        )}
                        {urg === 'tomorrow' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                            🔵 JOINING TOMORROW
                          </span>
                        )}
                        {urg === 'soon' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-2xs">
                            🔵 JOINING IN {days} DAYS
                          </span>
                        )}
                        {urg === 'week' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                            🟢 JOINING THIS WEEK
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta Details Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                      <div>
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-[#777]">Department</div>
                        <div className="font-bold text-[#1E2D4E] truncate">{emp.department || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-[#777]">Section</div>
                        <div className="font-bold text-[#1E2D4E] truncate">{emp.section || 'General'}</div>
                      </div>

                      <div className="col-span-2 pt-2 border-t border-[#e2dfd7]/60 flex items-center justify-between">
                        <div>
                          <div className="text-[9.5px] font-black uppercase tracking-wider text-[#777]">Scheduled DOJ</div>
                          <div className="font-black text-rose-700 text-xs flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{fmtDate(emp.offeredDoj)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => openDojModal(emp)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-[#1E2D4E]/30 text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Edit3 className="w-3 h-3 text-[#C9952A]" /> Reschedule
                        </button>
                      </div>
                    </div>

                    {/* Follow-Up Status Pills */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${callStatusCls(emp.callStatus)}`}>
                        <span>{callStatusEmoji(emp.callStatus)}</span>
                        <span>{emp.callStatus}</span>
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${dojConfCls(emp.dojConfirmation)}`}>
                        {emp.dojConfirmation}
                      </span>
                    </div>

                    {/* Notes Snippet */}
                    {emp.notes && (
                      <div className="text-[11.5px] text-[#555] bg-white p-2.5 rounded-xl border border-[#e2dfd7] font-medium leading-relaxed italic line-clamp-2">
                        "{emp.notes}"
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-[#e2dfd7] flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${emp.phone}`}
                          className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                          title="Call Candidate"
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
                          onClick={() => setProfileModalEmp(emp)}
                          className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center hover:bg-amber-100 transition-colors cursor-pointer"
                          title="View Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openHistoryDrawer(emp)}
                          className="w-8 h-8 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                          title="View History Log"
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
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Move to Joined Store Directory"
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
                    <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777] bg-[#F9F7F4]">
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">App ID</th>
                      <th className="py-3 px-3">Department &amp; Section</th>
                      <th className="py-3 px-3">Designation</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Scheduled DOJ</th>
                      <th className="py-3 px-3">Joining Status</th>
                      <th className="py-3 px-3">Call Status</th>
                      <th className="py-3 px-3">DOJ Confirmation</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2dfd7]/60 font-medium">
                    {filteredEmployees.map(emp => {
                      const urg = urgencyOf(emp.offeredDoj);
                      const days = daysUntil(emp.offeredDoj);

                      return (
                        <tr key={emp.appNo} className="hover:bg-black/5 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-extrabold text-[#1E2D4E] text-sm">{emp.name}</div>
                            <div className="text-[10.5px] text-[#777] font-semibold">{emp.gender || 'Candidate'}</div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[#1E2D4E]">
                            {emp.appNo}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-[#1E2D4E]">{emp.department}</div>
                            <div className="text-[11px] text-[#666]">{emp.section || 'General'}</div>
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-[#C9952A]">
                            {emp.designation}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[#333]">
                            {emp.phone}
                          </td>
                          <td className="py-3.5 px-3 font-black text-rose-700">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-rose-600" />
                              <span>{fmtDate(emp.offeredDoj)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {urg === 'overdue' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-600 text-white">
                                OVERDUE ({Math.abs(days || 0)}d)
                              </span>
                            )}
                            {urg === 'today' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500 text-white animate-pulse">
                                TODAY
                              </span>
                            )}
                            {urg === 'tomorrow' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-600 text-white">
                                TOMORROW
                              </span>
                            )}
                            {(urg === 'soon' || urg === 'week' || urg === 'future') && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
                                IN {days} DAYS
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-1 rounded-xl text-[10.5px] font-bold border inline-flex items-center gap-1 ${callStatusCls(emp.callStatus)}`}>
                              <span>{callStatusEmoji(emp.callStatus)}</span>
                              <span>{emp.callStatus}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-1 rounded-xl text-[10.5px] font-bold border inline-block ${dojConfCls(emp.dojConfirmation)}`}>
                              {emp.dojConfirmation}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
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
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-[11px] hover:bg-emerald-700 transition-colors cursor-pointer"
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

      {/* ── Modal 1: Log Call & Follow-Up ── */}
      {callModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setCallModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
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
                  <option value="Call not received">机 Call Not Received / No Answer</option>
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
                  <option value="Confirmed">🟢 Confirmed (Employee will join on scheduled date)</option>
                  <option value="Not confirmed">🔴 Not Confirmed (Employee requested delay / unsure)</option>
                  <option value="Pending confirmation">⚪ Pending Confirmation</option>
                </select>
                <p className="text-[10.5px] text-[#777] font-semibold italic">
                  Note: Confirming DOJ does NOT mean employee has joined store. Actual store entry happens when marked joined.
                </p>
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
                  placeholder="e.g. Employee confirmed arrival time, requested uniform details..."
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

      {/* ── Modal 3: Mark Joined Store ── */}
      {joinModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setJoinModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
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
                Confirming this action will update the status to <strong>Successfully Joined Store</strong> and automatically move the employee into the <strong>Joined Store Directory</strong>. They will automatically disappear from this Not Joined Desk.
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

      {/* ── Modal 4: Employee Profile View ── */}
      {profileModalEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setProfileModalEmp(null); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#C9952A] text-slate-900 font-black text-sm flex items-center justify-center shadow-md overflow-hidden border-2 border-white/20">
                  {profileModalEmp.photoUrl ? (
                    <img src={fileUrl(profileModalEmp.photoUrl) || ''} alt={profileModalEmp.name} className="w-full h-full object-cover" />
                  ) : (
                    profileModalEmp.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">{profileModalEmp.name}</h3>
                  <p className="text-[11px] text-[#C9952A] font-semibold mt-0.5">{profileModalEmp.designation} · {profileModalEmp.appNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalEmp(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F9F7F4] p-4 rounded-2xl border border-[#e2dfd7]">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Department</span>
                  <span className="font-bold text-[#1E2D4E]">{profileModalEmp.department}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Section</span>
                  <span className="font-bold text-[#1E2D4E]">{profileModalEmp.section || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Phone</span>
                  <span className="font-bold text-[#1E2D4E] font-mono">{profileModalEmp.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Email</span>
                  <span className="font-bold text-[#1E2D4E] truncate block">{profileModalEmp.email || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Offered Salary</span>
                  <span className="font-bold text-[#1E2D4E]">{formatSalaryVal(profileModalEmp.salary)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Scheduled DOJ</span>
                  <span className="font-black text-rose-700">{fmtDate(profileModalEmp.offeredDoj)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#777] block">Store Joining Status</span>
                  <span className="font-black text-rose-600">🔴 NOT JOINED</span>
                </div>
              </div>

              {profileModalEmp.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#777] block">Follow-up Notes</span>
                  <div className="p-3 bg-[#F9F7F4] rounded-xl border border-[#e2dfd7] text-xs text-[#555] italic">
                    "{profileModalEmp.notes}"
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
                <a
                  href={`tel:${profileModalEmp.phone}`}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                </a>
                <a
                  href={`https://wa.me/91${profileModalEmp.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-green-600" /> WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setProfileModalEmp(null)}
                  className="btn-primary text-xs"
                >
                  Close Profile
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

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-[#C9952A] animate-spin mx-auto" />
                  <p className="text-xs text-[#777] font-bold mt-2">Loading Audit Log...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777] font-medium">
                  No previous call records logged for this employee yet.
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
