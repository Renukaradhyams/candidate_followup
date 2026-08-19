import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Users, Phone, Calendar, Briefcase, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronUp, Search, Filter, RotateCcw, MessageSquare,
  History, Edit3, PhoneCall, X, Save, Loader2, User, MapPin, Building2,
  CalendarCheck, CalendarX, Zap, ArrowRight, AlertTriangle, ChevronRight,
  ChevronLeft, Download, SlidersHorizontal, Eye, FileSpreadsheet, Activity,
  Sparkles, CheckCircle2, UserCheck, Layers, PieChart, RefreshCw
} from 'lucide-react';

interface RecordItem {
  appNo: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  department: string;
  section: string;
  designation: string;
  offeredDoj: string;
  currentDoj: string;
  photoUrl: string;
  callStatus: 'Pending' | 'Call done' | 'Call not received' | 'Wrong number' | 'Rescheduled' | string;
  dojConfirmation: 'Pending confirmation' | 'Confirmed' | 'Not confirmed' | string;
  notes: string;
  followUpDate: string;
  lastCallDate: string;
  updatedBy: string;
  updatedAt: string | null;
  candidateStatus: string;
  offerStatus: string;
  joiningStatus: string;
}

interface KPIs {
  totalWithDoj: number;
  dojConfirmed: number;
  dojPendingConfirmation: number;
  joiningToday: number;
  joiningTomorrow: number;
  joiningThisWeek: number;
  joiningNext30Days: number;
  overdue: number;
  unassignedCount: number;
}

interface HistoryItem {
  id: number;
  app_no: string;
  action_type: string;
  old_value: string;
  new_value: string;
  notes: string;
  done_by: string;
  created_at: string;
}

const fmtDisplayDate = (dStr?: string) => {
  if (!dStr) return '—';
  try {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dt = new Date(year, month, day);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dStr;
  } catch {
    return dStr;
  }
};

const getDayName = (dStr?: string) => {
  if (!dStr) return '';
  try {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dt = new Date(year, month, day);
      return dt.toLocaleDateString('en-IN', { weekday: 'long' });
    }
    return '';
  } catch {
    return '';
  }
};

export default function DOJPlanning() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Raw data from server
  const [kpis, setKpis] = useState<KPIs>({
    totalWithDoj: 0,
    dojConfirmed: 0,
    dojPendingConfirmation: 0,
    joiningToday: 0,
    joiningTomorrow: 0,
    joiningThisWeek: 0,
    joiningNext30Days: 0,
    overdue: 0,
    unassignedCount: 0,
  });
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [unassigned, setUnassigned] = useState<RecordItem[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<string>('all'); // all, today, tomorrow, this_week, next_week, this_month, next_month, custom
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterDesignation, setFilterDesignation] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterCallStatus, setFilterCallStatus] = useState('all');
  const [filterConfirmation, setFilterConfirmation] = useState('all');
  const [filterJoiningStatus, setFilterJoiningStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'today' | 'unassigned'>('overview');

  // Selected Date Details Modal State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateDeptFilter, setSelectedDateDeptFilter] = useState<string>('all');
  const [selectedDateSecFilter, setSelectedDateSecFilter] = useState<string>('all');
  const [selectedDateDesigFilter, setSelectedDateDesigFilter] = useState<string>('all');

  // Edit DOJ Modal State
  const [editItem, setEditItem] = useState<RecordItem | null>(null);
  const [newDojValue, setNewDojValue] = useState('');
  const [savingDoj, setSavingDoj] = useState(false);

  // History Modal State
  const [historyItem, setHistoryItem] = useState<RecordItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // View Profile Modal State
  const [profileItem, setProfileItem] = useState<RecordItem | null>(null);

  // Calendar State
  const [currentCalMonth, setCurrentCalMonth] = useState<Date>(new Date());

  // Load Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getDojPlanning();
      if (res && res.success) {
        setKpis(res.kpis || {
          totalWithDoj: 0,
          dojConfirmed: 0,
          dojPendingConfirmation: 0,
          joiningToday: 0,
          joiningTomorrow: 0,
          joiningThisWeek: 0,
          joiningNext30Days: 0,
          overdue: 0,
          unassignedCount: 0,
        });
        setRecords(res.records || []);
        setUnassigned(res.unassigned || []);
      }
    } catch (err: any) {
      showToast('Error loading DOJ data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    fetchData();
  }, [navigate, fetchData]);

  // Derive unique taxonomy dropdown lists
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.department) set.add(r.department); });
    return Array.from(set).sort();
  }, [records]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.section) set.add(r.section); });
    return Array.from(set).sort();
  }, [records]);

  const designationOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.designation) set.add(r.designation); });
    return Array.from(set).sort();
  }, [records]);

  // Date range logic
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Filtered records according to global search & filter bar
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.name.toLowerCase().includes(q);
        const matchApp = r.appNo.toLowerCase().includes(q);
        const matchPhone = r.phone.toLowerCase().includes(q);
        const matchDept = r.department.toLowerCase().includes(q);
        const matchSec = r.section.toLowerCase().includes(q);
        const matchDesig = r.designation.toLowerCase().includes(q);
        if (!matchName && !matchApp && !matchPhone && !matchDept && !matchSec && !matchDesig) {
          return false;
        }
      }

      // Department
      if (filterDepartment !== 'all' && r.department !== filterDepartment) return false;
      // Section
      if (filterSection !== 'all' && r.section !== filterSection) return false;
      // Designation
      if (filterDesignation !== 'all' && r.designation !== filterDesignation) return false;
      // Gender
      if (filterGender !== 'all' && r.gender.toLowerCase() !== filterGender.toLowerCase()) return false;
      // Call Status
      if (filterCallStatus !== 'all' && r.callStatus !== filterCallStatus) return false;
      // Confirmation
      if (filterConfirmation !== 'all' && r.dojConfirmation !== filterConfirmation) return false;
      // Joining Status
      if (filterJoiningStatus !== 'all' && r.joiningStatus !== filterJoiningStatus) return false;

      // Date Presets
      if (dateRangePreset === 'today' && r.offeredDoj !== todayStr) return false;
      if (dateRangePreset === 'tomorrow' && r.offeredDoj !== tomorrowStr) return false;

      if (dateRangePreset === 'this_week') {
        const curr = new Date();
        const first = new Date(curr.setDate(curr.getDate() - curr.getDay())).toISOString().slice(0, 10);
        const last = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6)).toISOString().slice(0, 10);
        if (r.offeredDoj < first || r.offeredDoj > last) return false;
      }
      if (dateRangePreset === 'next_week') {
        const curr = new Date();
        const first = new Date(curr.setDate(curr.getDate() - curr.getDay() + 7)).toISOString().slice(0, 10);
        const last = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6)).toISOString().slice(0, 10);
        if (r.offeredDoj < first || r.offeredDoj > last) return false;
      }
      if (dateRangePreset === 'this_month') {
        const d = new Date();
        const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!r.offeredDoj.startsWith(monthPrefix)) return false;
      }
      if (dateRangePreset === 'next_month') {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!r.offeredDoj.startsWith(monthPrefix)) return false;
      }
      if (dateRangePreset === 'overdue') {
        if (!(r.offeredDoj < todayStr && r.joiningStatus !== 'Joined' && r.dojConfirmation !== 'Confirmed')) return false;
      }
      if (dateRangePreset === 'custom') {
        if (customFromDate && r.offeredDoj < customFromDate) return false;
        if (customToDate && r.offeredDoj > customToDate) return false;
      }

      return true;
    });
  }, [
    records, searchQuery, filterDepartment, filterSection, filterDesignation,
    filterGender, filterCallStatus, filterConfirmation, filterJoiningStatus,
    dateRangePreset, todayStr, tomorrowStr, customFromDate, customToDate
  ]);

  // Group records date-wise and sort chronologically
  const dateWiseGroups = useMemo(() => {
    const map = new Map<string, RecordItem[]>();
    filteredRecords.forEach(r => {
      if (!r.offeredDoj) return;
      if (!map.has(r.offeredDoj)) map.set(r.offeredDoj, []);
      map.get(r.offeredDoj)!.push(r);
    });

    const dates = Array.from(map.keys()).sort();
    return dates.map(d => {
      const items = map.get(d)!;
      const confirmed = items.filter(i => i.dojConfirmation === 'Confirmed').length;
      const pending = items.filter(i => i.dojConfirmation === 'Pending confirmation' || !i.dojConfirmation).length;
      const notConfirmed = items.filter(i => i.dojConfirmation === 'Not confirmed').length;

      // Department breakdown for badge display
      const deptMap: Record<string, number> = {};
      items.forEach(i => {
        deptMap[i.department] = (deptMap[i.department] || 0) + 1;
      });

      return {
        date: d,
        displayDate: fmtDisplayDate(d),
        dayName: getDayName(d),
        total: items.length,
        confirmed,
        pending,
        notConfirmed,
        deptMap,
        items
      };
    });
  }, [filteredRecords]);

  // Next 7-14 days upcoming joinings list
  const upcomingDates = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      if (r.offeredDoj && r.offeredDoj >= todayStr) {
        map.set(r.offeredDoj, (map.get(r.offeredDoj) || 0) + 1);
      }
    });
    const sorted = Array.from(map.keys()).sort().slice(0, 14);
    return sorted.map(d => ({
      date: d,
      displayDate: fmtDisplayDate(d),
      dayName: getDayName(d),
      count: map.get(d)!
    }));
  }, [records, todayStr]);

  // Today's joining records
  const todayJoiners = useMemo(() => {
    return records.filter(r => r.offeredDoj === todayStr);
  }, [records, todayStr]);

  // Items for selected date in modal
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return records.filter(r => r.offeredDoj === selectedDate);
  }, [records, selectedDate]);

  // Filtered items inside date details modal
  const modalFilteredItems = useMemo(() => {
    return selectedDateItems.filter(r => {
      if (selectedDateDeptFilter !== 'all' && r.department !== selectedDateDeptFilter) return false;
      if (selectedDateSecFilter !== 'all' && r.section !== selectedDateSecFilter) return false;
      if (selectedDateDesigFilter !== 'all' && r.designation !== selectedDateDesigFilter) return false;
      return true;
    });
  }, [selectedDateItems, selectedDateDeptFilter, selectedDateSecFilter, selectedDateDesigFilter]);

  // Breakdown statistics for selected date
  const selectedDateStats = useMemo(() => {
    if (!selectedDateItems.length) return null;

    // Gender breakdown
    let male = 0, female = 0, other = 0;
    selectedDateItems.forEach(i => {
      const g = (i.gender || '').toLowerCase();
      if (g === 'male' || g === 'm') male++;
      else if (g === 'female' || g === 'f') female++;
      else other++;
    });
    const total = selectedDateItems.length;
    const malePct = total > 0 ? Math.round((male / total) * 100) : 0;
    const femalePct = total > 0 ? Math.round((female / total) * 100) : 0;
    const otherPct = total > 0 ? 100 - malePct - femalePct : 0;

    // Department breakdown
    const deptMap: Record<string, { total: number; male: number; female: number; other: number; items: RecordItem[] }> = {};
    selectedDateItems.forEach(i => {
      if (!deptMap[i.department]) {
        deptMap[i.department] = { total: 0, male: 0, female: 0, other: 0, items: [] };
      }
      deptMap[i.department].total++;
      deptMap[i.department].items.push(i);
      const g = (i.gender || '').toLowerCase();
      if (g === 'male' || g === 'm') deptMap[i.department].male++;
      else if (g === 'female' || g === 'f') deptMap[i.department].female++;
      else deptMap[i.department].other++;
    });

    // Section breakdown
    const secMap: Record<string, number> = {};
    selectedDateItems.forEach(i => {
      secMap[i.section] = (secMap[i.section] || 0) + 1;
    });

    // Designation breakdown
    const desigMap: Record<string, number> = {};
    selectedDateItems.forEach(i => {
      desigMap[i.designation] = (desigMap[i.designation] || 0) + 1;
    });

    return {
      male, female, other, malePct, femalePct, otherPct,
      deptMap, secMap, desigMap
    };
  }, [selectedDateItems]);

  // DOJ Save Action
  const handleSaveDoj = async () => {
    if (!editItem || !newDojValue) return;
    setSavingDoj(true);
    try {
      const res = await API.updateCallDeskDOJ({
        appNo: editItem.appNo,
        newDoj: newDojValue,
        doneBy: session?.fullName || session?.username || 'HR'
      });
      if (res && res.success) {
        showToast(`Date of Joining updated to ${fmtDisplayDate(newDojValue)} for ${editItem.name}`, 'success');
        setEditItem(null);
        fetchData();
      } else {
        showToast(res?.error || 'Failed to update DOJ', 'error');
      }
    } catch (err: any) {
      showToast('Error updating DOJ: ' + err.message, 'error');
    } finally {
      setSavingDoj(false);
    }
  };

  // Status Change Quick Update Action inside Date Modal
  const handleUpdateStatus = async (appNo: string, callStatus?: string, dojConfirmation?: string) => {
    try {
      const res = await API.updateCallDeskStatus({
        appNo,
        callStatus,
        dojConfirmation,
        doneBy: session?.fullName || session?.username || 'HR'
      });
      if (res && res.success) {
        showToast('Confirmation status updated', 'success');
        fetchData();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // View Audit History
  const handleOpenHistory = async (item: RecordItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await API.getCallDeskHistory(item.appNo);
      if (res && res.success) {
        setHistoryLogs(res.history || []);
      }
    } catch (err: any) {
      showToast('Error fetching history: ' + err.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredRecords.length) {
      showToast('No records available to export', 'error');
      return;
    }
    const headers = [
      'Application No', 'Candidate Name', 'Phone', 'Gender',
      'Department', 'Section', 'Designation', 'Offered DOJ',
      'Call Status', 'DOJ Confirmation Status', 'Joining Status'
    ];

    const rows = filteredRecords.map(r => [
      `"${r.appNo}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.gender}"`,
      `"${r.department}"`,
      `"${r.section}"`,
      `"${r.designation}"`,
      `"${r.offeredDoj}"`,
      `"${r.callStatus}"`,
      `"${r.dojConfirmation}"`,
      `"${r.joiningStatus}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DOJ_Planning_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('DOJ Planning report exported successfully', 'success');
  };

  // Clear all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDateRangePreset('all');
    setCustomFromDate('');
    setCustomToDate('');
    setFilterDepartment('all');
    setFilterSection('all');
    setFilterDesignation('all');
    setFilterGender('all');
    setFilterCallStatus('all');
    setFilterConfirmation('all');
    setFilterJoiningStatus('all');
  };

  // Calendar computation helpers
  const calendarDays = useMemo(() => {
    const year = currentCalMonth.getFullYear();
    const month = currentCalMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalMonthDays = lastDay.getDate();

    const daysArr: { dateStr: string; dayNum: number; isCurrentMonth: boolean; count: number; confirmed: number; pending: number }[] = [];

    // Prev month padding
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevLastDay - i);
      const dStr = prevDate.toISOString().slice(0, 10);
      daysArr.push({ dateStr: dStr, dayNum: prevLastDay - i, isCurrentMonth: false, count: 0, confirmed: 0, pending: 0 });
    }

    // Map records count for each date
    const dateMap = new Map<string, { total: number; confirmed: number; pending: number }>();
    records.forEach(r => {
      if (!r.offeredDoj) return;
      if (!dateMap.has(r.offeredDoj)) {
        dateMap.set(r.offeredDoj, { total: 0, confirmed: 0, pending: 0 });
      }
      const obj = dateMap.get(r.offeredDoj)!;
      obj.total++;
      if (r.dojConfirmation === 'Confirmed') obj.confirmed++;
      else obj.pending++;
    });

    // Current month days
    for (let d = 1; d <= totalMonthDays; d++) {
      const dtStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const stat = dateMap.get(dtStr) || { total: 0, confirmed: 0, pending: 0 };
      daysArr.push({
        dateStr: dtStr,
        dayNum: d,
        isCurrentMonth: true,
        count: stat.total,
        confirmed: stat.confirmed,
        pending: stat.pending
      });
    }

    // Next month padding to reach multiple of 7
    const remaining = 35 - daysArr.length > 0 ? 35 - daysArr.length : (42 - daysArr.length > 0 ? 42 - daysArr.length : 0);
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dStr = nextDate.toISOString().slice(0, 10);
      daysArr.push({ dateStr: dStr, dayNum: n, isCurrentMonth: false, count: 0, confirmed: 0, pending: 0 });
    }

    return daysArr;
  }, [currentCalMonth, records]);

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Date of Joining &amp; Strength Desk"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Date of Joining' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <button
              onClick={fetchData}
              className="p-2 rounded-xl text-[#1E2D4E] hover:bg-[#1E2D4E]/10 transition-colors border border-[#e2dfd7] flex items-center gap-1 text-xs font-bold bg-white"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          }
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Dashboard Banner */}
          <div className="card-glass p-5 lg:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-[#C9952A]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-black text-[#1E2D4E] tracking-tight">Date of Joining</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1E2D4E]/10 text-[#1E2D4E]">
                  DOJ Intelligence
                </span>
              </div>
              <p className="text-xs text-[#555555] font-medium mt-1">
                Track upcoming joining dates, confirmed employees, department breakdown and daily workforce joining strength.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={handleExportCSV}
                className="flex-1 md:flex-none btn-secondary text-xs flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="card-glass p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#666666]">Total DOJ</div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{kpis.totalWithDoj}</div>
              <div className="text-[9.5px] text-[#777777] font-semibold mt-1">Assigned Dates</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between border-t-2 border-t-emerald-500">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Confirmed</div>
              <div className="text-xl font-black text-emerald-700 mt-1">{kpis.dojConfirmed}</div>
              <div className="text-[9.5px] text-emerald-600 font-semibold mt-1">DOJ Confirmed</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between border-t-2 border-t-amber-500">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pending</div>
              <div className="text-xl font-black text-amber-700 mt-1">{kpis.dojPendingConfirmation}</div>
              <div className="text-[9.5px] text-amber-600 font-semibold mt-1">Awaiting Call</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between border-t-2 border-t-blue-500">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">Today</div>
              <div className="text-xl font-black text-blue-700 mt-1">{kpis.joiningToday}</div>
              <div className="text-[9.5px] text-blue-600 font-semibold mt-1">{fmtDisplayDate(todayStr)}</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between border-t-2 border-t-indigo-500">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">Tomorrow</div>
              <div className="text-xl font-black text-indigo-700 mt-1">{kpis.joiningTomorrow}</div>
              <div className="text-[9.5px] text-indigo-600 font-semibold mt-1">{fmtDisplayDate(tomorrowStr)}</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E2D4E]">This Week</div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{kpis.joiningThisWeek}</div>
              <div className="text-[9.5px] text-[#555555] font-semibold mt-1">7-Day Window</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E2D4E]">Next 30 Days</div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{kpis.joiningNext30Days}</div>
              <div className="text-[9.5px] text-[#555555] font-semibold mt-1">Upcoming Strength</div>
            </div>

            <div className="card-glass p-3.5 flex flex-col justify-between border-t-2 border-t-rose-500">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800">Overdue / Past</div>
              <div className="text-xl font-black text-rose-700 mt-1">{kpis.overdue}</div>
              <div className="text-[9.5px] text-rose-600 font-semibold mt-1">Past Unjoined</div>
            </div>
          </div>

          {/* Today Highlight Alert Card */}
          {todayJoiners.length > 0 && (
            <div className="card-glass p-4 bg-gradient-to-r from-[#1E2D4E] to-[#2B3F6C] text-white space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#C9952A] text-white flex items-center justify-center font-black">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
                      <span>Joining Today</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black">
                        {todayJoiners.length} Employees Scheduled
                      </span>
                    </h3>
                    <p className="text-[11px] text-white/80">Employees scheduled to join on {fmtDisplayDate(todayStr)} ({getDayName(todayStr)})</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-3 py-1.5 rounded-xl bg-white text-[#1E2D4E] hover:bg-[#C9952A] hover:text-white transition-all text-xs font-black flex items-center gap-1 shadow-md"
                >
                  <span>View All Today Joiners</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {todayJoiners.slice(0, 4).map(emp => (
                  <div key={emp.appNo} className="p-3 rounded-xl bg-white/10 border border-white/20 flex items-center gap-3">
                    <img
                      src={API.fileUrl(emp.photoUrl) || '/default-avatar.png'}
                      alt={emp.name}
                      className="w-10 h-10 rounded-xl object-cover border border-white/30 bg-white/20 flex-shrink-0"
                      onError={(e) => { (e.target as any).src = '/default-avatar.png'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate text-white">{emp.name}</div>
                      <div className="text-[10px] text-[#C9952A] font-semibold truncate">{emp.designation} · {emp.department}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <a href={`tel:${emp.phone}`} className="text-[10px] text-emerald-300 font-bold hover:underline flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" /> {emp.phone}
                        </a>
                        <a href={`https://wa.me/91${emp.phone}`} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 font-bold hover:underline">
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Multi-Filters Toolbar */}
          <div className="card-glass p-4 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  placeholder="Search candidate name, application no, phone, department, section, designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-modern pl-9 w-full text-xs font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-black">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 bg-[#F9F7F4] p-1 rounded-xl border border-[#e2dfd7]">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${activeTab === 'overview' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#555555] hover:text-[#1E2D4E]'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Date Overview</span>
                </button>

                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${activeTab === 'calendar' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#555555] hover:text-[#1E2D4E]'}`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar View</span>
                </button>

                <button
                  onClick={() => setActiveTab('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${activeTab === 'today' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#555555] hover:text-[#1E2D4E]'}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Today's Joinings ({kpis.joiningToday})</span>
                </button>

                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${activeTab === 'unassigned' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#555555] hover:text-[#1E2D4E]'}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>DOJ Not Assigned ({kpis.unassignedCount})</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs pt-1 border-t border-[#e2dfd7]">
              {/* Date Presets */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Date Range</label>
                <select
                  value={dateRangePreset}
                  onChange={(e) => setDateRangePreset(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="this_week">This Week</option>
                  <option value="next_week">Next Week</option>
                  <option value="this_month">This Month</option>
                  <option value="next_month">Next Month</option>
                  <option value="overdue">Overdue / Past</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Departments</option>
                  {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Section</label>
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Sections</option>
                  {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Designation</label>
                <select
                  value={filterDesignation}
                  onChange={(e) => setFilterDesignation(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Designations</option>
                  {designationOptions.map(ds => <option key={ds} value={ds}>{ds}</option>)}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Gender</label>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Call Status */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">Call Status</label>
                <select
                  value={filterCallStatus}
                  onChange={(e) => setFilterCallStatus(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Call Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Call done">Call Done</option>
                  <option value="Call not received">Call Not Received</option>
                  <option value="Wrong number">Wrong Number</option>
                  <option value="Rescheduled">Rescheduled</option>
                </select>
              </div>

              {/* Confirmation */}
              <div>
                <label className="text-[10px] font-black uppercase text-[#777777] block mb-1">DOJ Confirmation</label>
                <select
                  value={filterConfirmation}
                  onChange={(e) => setFilterConfirmation(e.target.value)}
                  className="select-modern text-xs font-bold"
                >
                  <option value="all">All Confirmations</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending confirmation">Pending Confirmation</option>
                  <option value="Not confirmed">Not Confirmed</option>
                </select>
              </div>
            </div>

            {/* Custom Date Inputs if selected */}
            {dateRangePreset === 'custom' && (
              <div className="flex items-center gap-3 pt-2 border-t border-[#e2dfd7]/50 text-xs">
                <div>
                  <span className="font-extrabold text-[#1E2D4E] mr-2">From Date:</span>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="input-modern text-xs"
                  />
                </div>
                <div>
                  <span className="font-extrabold text-[#1E2D4E] mr-2">To Date:</span>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="input-modern text-xs"
                  />
                </div>
              </div>
            )}

            {/* Active Filters Bar */}
            <div className="flex items-center justify-between text-xs text-[#666666] pt-1">
              <div>
                Showing <strong className="text-[#1E2D4E]">{filteredRecords.length}</strong> matching candidates under <strong className="text-[#1E2D4E]">{dateWiseGroups.length}</strong> dates.
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-[#C9952A] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>

          {/* Upcoming Date Strip */}
          {upcomingDates.length > 0 && activeTab === 'overview' && (
            <div className="card-glass p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-[#C9952A]" />
                  <span>Upcoming Joining Schedule (Next 14 Days)</span>
                </h3>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {upcomingDates.map(item => (
                  <button
                    key={item.date}
                    onClick={() => setSelectedDate(item.date)}
                    className={`
                      px-4 py-3 rounded-2xl border text-left min-w-[130px] flex-shrink-0 transition-all group shadow-xs hover:shadow-md
                      ${item.date === todayStr 
                        ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' 
                        : 'bg-white text-[#1E2D4E] border-[#e2dfd7] hover:border-[#C9952A]'}
                    `}
                  >
                    <div className={`text-[10px] font-black uppercase tracking-wider ${item.date === todayStr ? 'text-[#C9952A]' : 'text-[#777777]'}`}>
                      {item.dayName.slice(0, 3)} · {item.displayDate.split(' ')[0]} {item.displayDate.split(' ')[1]}
                    </div>
                    <div className="text-lg font-black mt-1 flex items-center justify-between">
                      <span>{item.count}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.date === todayStr ? 'bg-white/20 text-white' : 'bg-[#1E2D4E]/10 text-[#1E2D4E]'}`}>
                        Joiners
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: DATE OVERVIEW TABLE */}
          {activeTab === 'overview' && (
            <div className="card-glass p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <h3 className="font-extrabold text-base text-[#1E2D4E] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#C9952A]" />
                  <span>Date-Wise Joining Overview</span>
                </h3>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs font-bold text-[#1E2D4E]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C9952A]" />
                  <span>Loading Date of Joining Overview...</span>
                </div>
              ) : dateWiseGroups.length === 0 ? (
                <div className="py-12 text-center space-y-2 card-glass bg-[#F9F7F4]/50 border-dashed">
                  <CalendarX className="w-10 h-10 text-[#777777] mx-auto" />
                  <div className="font-bold text-sm text-[#1E2D4E]">No employees scheduled to join on matching dates.</div>
                  <p className="text-xs text-[#777777]">Try adjusting your search criteria or date filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] bg-[#F9F7F4]/60">
                        <th className="py-3 px-4">Joining Date</th>
                        <th className="py-3 px-4">Day</th>
                        <th className="py-3 px-4 text-center">Total Joining</th>
                        <th className="py-3 px-4 text-center">Confirmed</th>
                        <th className="py-3 px-4 text-center">Pending</th>
                        <th className="py-3 px-4">Department Breakdown</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]/60">
                      {dateWiseGroups.map(group => {
                        const isToday = group.date === todayStr;
                        const isTomorrow = group.date === tomorrowStr;

                        return (
                          <tr
                            key={group.date}
                            onClick={() => setSelectedDate(group.date)}
                            className={`hover:bg-[#1E2D4E]/5 cursor-pointer transition-colors ${isToday ? 'bg-amber-50/60 font-medium' : ''}`}
                          >
                            <td className="py-4 px-4 font-black text-[#1E2D4E]">
                              <div className="flex items-center gap-2">
                                <span>{group.displayDate}</span>
                                {isToday && (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-blue-600 text-white uppercase tracking-wider">
                                    Today
                                  </span>
                                )}
                                {isTomorrow && (
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                                    Tomorrow
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-4 text-[#555555] font-semibold">
                              {group.dayName}
                            </td>

                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-[#1E2D4E] text-white">
                                {group.total}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {group.confirmed}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                {group.pending}
                              </span>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(group.deptMap).map(([dept, cnt]) => (
                                  <span key={dept} className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#F4F1EA] text-[#1E2D4E] border border-[#e2dfd7]">
                                    {dept}: {cnt}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedDate(group.date); }}
                                className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#C9952A] transition-colors inline-flex items-center gap-1 shadow-xs"
                              >
                                <span>View Employees</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className="card-glass p-5 space-y-4">
              {/* Calendar Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-extrabold text-base text-[#1E2D4E] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C9952A]" />
                    <span>
                      {currentCalMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentCalMonth(new Date())}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1))}
                    className="p-1.5 rounded-xl border border-[#e2dfd7] bg-white hover:bg-[#F9F7F4]"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#1E2D4E]" />
                  </button>
                  <button
                    onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1))}
                    className="p-1.5 rounded-xl border border-[#e2dfd7] bg-white hover:bg-[#F9F7F4]"
                  >
                    <ChevronRight className="w-4 h-4 text-[#1E2D4E]" />
                  </button>
                </div>
              </div>

              {/* Month Grid Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] uppercase text-[#777777] bg-[#F9F7F4] py-2 rounded-xl border border-[#e2dfd7]">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  const isToday = cell.dateStr === todayStr;
                  const hasJoiners = cell.count > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => hasJoiners && setSelectedDate(cell.dateStr)}
                      className={`
                        min-h-[90px] p-2 rounded-2xl border transition-all flex flex-col justify-between
                        ${!cell.isCurrentMonth ? 'bg-gray-100/40 text-gray-400 border-gray-100' : 'bg-white border-[#e2dfd7]'}
                        ${hasJoiners ? 'hover:border-[#C9952A] hover:shadow-md cursor-pointer' : ''}
                        ${isToday ? 'ring-2 ring-[#C9952A] bg-amber-50/30' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isToday ? 'w-6 h-6 rounded-full bg-[#1E2D4E] text-white flex items-center justify-center' : ''}`}>
                          {cell.dayNum}
                        </span>
                        {isToday && <span className="text-[9px] font-black text-[#C9952A] uppercase">Today</span>}
                      </div>

                      {hasJoiners ? (
                        <div className="space-y-1 mt-2">
                          <div className="px-2 py-1 rounded-xl bg-[#1E2D4E] text-white text-[10px] font-extrabold flex items-center justify-between">
                            <span>{cell.count} joining</span>
                            <ChevronRight className="w-3 h-3 opacity-70" />
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-[#555555] px-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{cell.confirmed} conf.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[9px] text-gray-300 font-medium text-center">No joinings</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TODAY'S JOININGS LIST */}
          {activeTab === 'today' && (
            <div className="card-glass p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <h3 className="font-extrabold text-base text-[#1E2D4E] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>Joining Today ({fmtDisplayDate(todayStr)})</span>
                </h3>
              </div>

              {todayJoiners.length === 0 ? (
                <div className="py-12 text-center space-y-2 card-glass bg-[#F9F7F4]/50 border-dashed">
                  <UserCheck className="w-10 h-10 text-[#777777] mx-auto" />
                  <div className="font-bold text-sm text-[#1E2D4E]">No employees scheduled to join today.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayJoiners.map(emp => (
                    <div key={emp.appNo} className="card-glass p-4 space-y-3 border-l-4 border-l-blue-600 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <img
                          src={API.fileUrl(emp.photoUrl) || '/default-avatar.png'}
                          alt={emp.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-[#e2dfd7] bg-[#F4F1EA]"
                          onError={(e) => { (e.target as any).src = '/default-avatar.png'; }}
                        />
                        <div className="overflow-hidden flex-1">
                          <div className="font-extrabold text-sm text-[#1E2D4E] truncate">{emp.name}</div>
                          <div className="text-xs text-[#555555] font-semibold">{emp.designation}</div>
                          <div className="text-[11px] text-[#C9952A] font-bold truncate">{emp.department} · {emp.section}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F9F7F4] p-2.5 rounded-xl border border-[#e2dfd7]">
                        <div>
                          <span className="text-[9.5px] text-[#777777] uppercase font-black block">App No</span>
                          <span className="font-mono font-bold text-[#1E2D4E]">{emp.appNo}</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-[#777777] uppercase font-black block">Phone</span>
                          <span className="font-bold text-[#1E2D4E]">{emp.phone}</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-[#777777] uppercase font-black block">Call Status</span>
                          <span className="font-bold text-[#1E2D4E]">{emp.callStatus}</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-[#777777] uppercase font-black block">DOJ Confirmation</span>
                          <span className={`font-black ${emp.dojConfirmation === 'Confirmed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {emp.dojConfirmation}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a href={`tel:${emp.phone}`} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" /> Call
                        </a>
                        <a href={`https://wa.me/91${emp.phone}`} target="_blank" rel="noreferrer" className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                          WhatsApp
                        </a>
                        <button onClick={() => setProfileItem(emp)} className="btn-primary text-xs py-1.5 px-3">
                          Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: UNASSIGNED DOJ CANDIDATES */}
          {activeTab === 'unassigned' && (
            <div className="card-glass p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <h3 className="font-extrabold text-base text-[#1E2D4E] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>DOJ Not Assigned ({unassigned.length} Candidates)</span>
                </h3>
              </div>

              {unassigned.length === 0 ? (
                <div className="py-12 text-center space-y-2 card-glass bg-[#F9F7F4]/50 border-dashed">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <div className="font-bold text-sm text-[#1E2D4E]">All candidates have an assigned Date of Joining!</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] bg-[#F9F7F4]/60">
                        <th className="py-3 px-4">Candidate</th>
                        <th className="py-3 px-4">App No</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4">Candidate Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]/60">
                      {unassigned.map(cand => (
                        <tr key={cand.appNo} className="hover:bg-black/5">
                          <td className="py-3.5 px-4 font-black text-[#1E2D4E]">{cand.name}</td>
                          <td className="py-3.5 px-4 font-mono">{cand.appNo}</td>
                          <td className="py-3.5 px-4">{cand.phone}</td>
                          <td className="py-3.5 px-4">{cand.department}</td>
                          <td className="py-3.5 px-4">{cand.designation}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              {cand.candidateStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => { setEditItem(cand); setNewDojValue(''); }}
                              className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#C9952A] transition-colors"
                            >
                              Assign DOJ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL 1: SELECTED DATE DETAILS MODAL ─────────────────────────── */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#EDE8DE] rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/40 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-[#1E2D4E] text-white flex items-center justify-between border-b border-white/10">
              <div>
                <div className="text-[10px] font-black uppercase text-[#C9952A] tracking-widest">Date Joining Strength</div>
                <h2 className="text-xl font-black tracking-tight flex items-center gap-2 mt-0.5">
                  <span>{fmtDisplayDate(selectedDate)}</span>
                  <span className="text-xs font-normal text-white/70">({getDayName(selectedDate)})</span>
                  <span className="ml-2 px-3 py-0.5 rounded-full text-xs font-black bg-[#C9952A] text-white">
                    {selectedDateItems.length} Employees Joining
                  </span>
                </h2>
              </div>

              <button
                onClick={() => { setSelectedDate(null); setSelectedDateDeptFilter('all'); setSelectedDateSecFilter('all'); setSelectedDateDesigFilter('all'); }}
                className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* Gender Summary Visual Indicator */}
              {selectedDateStats && (
                <div className="card-glass p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-black text-[#1E2D4E]">
                    <span>Gender Distribution</span>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-700">Male: {selectedDateStats.male} ({selectedDateStats.malePct}%)</span>
                      <span className="text-pink-700">Female: {selectedDateStats.female} ({selectedDateStats.femalePct}%)</span>
                      {selectedDateStats.other > 0 && <span>Other: {selectedDateStats.other}</span>}
                    </div>
                  </div>

                  {/* Percentage Progress Bar */}
                  <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden flex shadow-inner">
                    <div style={{ width: `${selectedDateStats.malePct}%` }} className="bg-blue-600 h-full transition-all" title={`Male: ${selectedDateStats.male}`} />
                    <div style={{ width: `${selectedDateStats.femalePct}%` }} className="bg-pink-500 h-full transition-all" title={`Female: ${selectedDateStats.female}`} />
                    <div style={{ width: `${selectedDateStats.otherPct}%` }} className="bg-gray-400 h-full transition-all" title={`Other: ${selectedDateStats.other}`} />
                  </div>
                </div>
              )}

              {/* Department & Section & Designation Breakdown Tabs */}
              {selectedDateStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Department Breakdown */}
                  <div className="card-glass p-4 space-y-2.5">
                    <h4 className="font-extrabold text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center justify-between">
                      <span>Department Breakdown</span>
                      <span className="text-[10px] text-[#777777]">Click to Filter</span>
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => setSelectedDateDeptFilter('all')}
                        className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateDeptFilter === 'all' ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                      >
                        <span>All Departments</span>
                        <span>{selectedDateItems.length}</span>
                      </button>

                      {Object.entries(selectedDateStats.deptMap).map(([dept, info]) => (
                        <button
                          key={dept}
                          onClick={() => setSelectedDateDeptFilter(dept)}
                          className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateDeptFilter === dept ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                        >
                          <div>
                            <div>{dept}</div>
                            <div className="text-[9.5px] opacity-75 font-normal">M: {info.male} · F: {info.female}</div>
                          </div>
                          <span className="font-black">{info.total}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section Breakdown */}
                  <div className="card-glass p-4 space-y-2.5">
                    <h4 className="font-extrabold text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center justify-between">
                      <span>Section Breakdown</span>
                      <span className="text-[10px] text-[#777777]">Click to Filter</span>
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => setSelectedDateSecFilter('all')}
                        className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateSecFilter === 'all' ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                      >
                        <span>All Sections</span>
                        <span>{selectedDateItems.length}</span>
                      </button>

                      {Object.entries(selectedDateStats.secMap).map(([sec, cnt]) => (
                        <button
                          key={sec}
                          onClick={() => setSelectedDateSecFilter(sec)}
                          className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateSecFilter === sec ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                        >
                          <span>{sec}</span>
                          <span className="font-black">{cnt}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Designation Breakdown */}
                  <div className="card-glass p-4 space-y-2.5">
                    <h4 className="font-extrabold text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center justify-between">
                      <span>Designation Distribution</span>
                      <span className="text-[10px] text-[#777777]">Click to Filter</span>
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => setSelectedDateDesigFilter('all')}
                        className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateDesigFilter === 'all' ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                      >
                        <span>All Designations</span>
                        <span>{selectedDateItems.length}</span>
                      </button>

                      {Object.entries(selectedDateStats.desigMap).map(([desig, cnt]) => (
                        <button
                          key={desig}
                          onClick={() => setSelectedDateDesigFilter(desig)}
                          className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${selectedDateDesigFilter === desig ? 'bg-[#1E2D4E] text-white' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'}`}
                        >
                          <span>{desig}</span>
                          <span className="font-black">{cnt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Employee Cards List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[#1E2D4E]">
                    Employee List ({modalFilteredItems.length} Shown)
                  </h3>

                  {(selectedDateDeptFilter !== 'all' || selectedDateSecFilter !== 'all' || selectedDateDesigFilter !== 'all') && (
                    <button
                      onClick={() => { setSelectedDateDeptFilter('all'); setSelectedDateSecFilter('all'); setSelectedDateDesigFilter('all'); }}
                      className="text-xs font-bold text-[#C9952A] hover:underline"
                    >
                      Clear Modal Sub-filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modalFilteredItems.map(emp => (
                    <div key={emp.appNo} className="card-glass p-4 space-y-3 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <img
                          src={API.fileUrl(emp.photoUrl) || '/default-avatar.png'}
                          alt={emp.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-[#e2dfd7] bg-[#F4F1EA] flex-shrink-0"
                          onError={(e) => { (e.target as any).src = '/default-avatar.png'; }}
                        />
                        <div className="overflow-hidden flex-1">
                          <div className="font-extrabold text-sm text-[#1E2D4E] truncate">{emp.name}</div>
                          <div className="text-xs text-[#555555] font-semibold">{emp.designation}</div>
                          <div className="text-[11px] text-[#C9952A] font-bold truncate">{emp.department} · {emp.section}</div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${emp.dojConfirmation === 'Confirmed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                          {emp.dojConfirmation}
                        </span>
                      </div>

                      {/* Detail Fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] bg-[#F9F7F4] p-2.5 rounded-xl border border-[#e2dfd7]">
                        <div>
                          <span className="text-[9px] text-[#777777] uppercase font-black block">App No</span>
                          <span className="font-mono font-bold text-[#1E2D4E]">{emp.appNo}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#777777] uppercase font-black block">Phone / Gender</span>
                          <span className="font-bold text-[#1E2D4E]">{emp.phone} ({emp.gender})</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#777777] uppercase font-black block">Call Status</span>
                          <select
                            value={emp.callStatus}
                            onChange={(e) => handleUpdateStatus(emp.appNo, e.target.value, undefined)}
                            className="p-1 rounded-lg border border-[#e2dfd7] text-[10px] font-bold bg-white text-[#1E2D4E] mt-0.5"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Call done">Call Done</option>
                            <option value="Call not received">Call Not Received</option>
                            <option value="Wrong number">Wrong Number</option>
                            <option value="Rescheduled">Rescheduled</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#777777] uppercase font-black block">DOJ Confirmation</span>
                          <select
                            value={emp.dojConfirmation}
                            onChange={(e) => handleUpdateStatus(emp.appNo, undefined, e.target.value)}
                            className="p-1 rounded-lg border border-[#e2dfd7] text-[10px] font-bold bg-white text-[#1E2D4E] mt-0.5"
                          >
                            <option value="Pending confirmation">Pending Confirmation</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Not confirmed">Not Confirmed</option>
                          </select>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          onClick={() => setProfileItem(emp)}
                          className="px-2.5 py-1 rounded-lg bg-[#1E2D4E] text-white text-[11px] font-bold hover:bg-[#C9952A] transition-colors"
                        >
                          View Profile
                        </button>

                        <a
                          href={`tel:${emp.phone}`}
                          className="px-2.5 py-1 rounded-lg border border-emerald-600 text-emerald-700 bg-emerald-50 text-[11px] font-bold hover:bg-emerald-100 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>

                        <a
                          href={`https://wa.me/91${emp.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg border border-emerald-600 text-emerald-700 bg-emerald-50 text-[11px] font-bold hover:bg-emerald-100"
                        >
                          WhatsApp
                        </a>

                        <button
                          onClick={() => { setEditItem(emp); setNewDojValue(emp.offeredDoj || ''); }}
                          className="px-2.5 py-1 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 text-[11px] font-bold hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit DOJ
                        </button>

                        <button
                          onClick={() => handleOpenHistory(emp)}
                          className="px-2.5 py-1 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] text-[11px] font-bold hover:bg-[#1E2D4E] hover:text-white flex items-center gap-1 ml-auto"
                        >
                          <History className="w-3 h-3" /> View History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT DOJ MODAL ───────────────────────────────────────── */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#e2dfd7]">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-base text-[#1E2D4E] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#C9952A]" />
                <span>Edit Date of Joining (DOJ)</span>
              </h3>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7]">
                <div className="font-extrabold text-sm text-[#1E2D4E]">{editItem.name}</div>
                <div className="text-xs text-[#555555]">{editItem.designation} · {editItem.department}</div>
                <div className="text-[11px] text-[#777777] mt-1 font-mono">App No: {editItem.appNo}</div>
              </div>

              <div>
                <label className="text-[10.5px] font-black uppercase text-[#777777] block mb-1">Current DOJ</label>
                <div className="font-bold text-[#1E2D4E]">{fmtDisplayDate(editItem.offeredDoj) || 'Not Assigned'}</div>
              </div>

              <div>
                <label className="text-[10.5px] font-black uppercase text-[#777777] block mb-1">Select New Date of Joining *</label>
                <input
                  type="date"
                  value={newDojValue}
                  onChange={(e) => setNewDojValue(e.target.value)}
                  className="input-modern text-xs font-bold w-full"
                />
              </div>

              <div className="text-[10.5px] text-[#777777] bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <strong>Note:</strong> Updating DOJ will sync real-time across Candidate Directory, Employee Directory, Offer Desk, Joining Call Desk, and log an audit entry.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setEditItem(null)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button onClick={handleSaveDoj} disabled={savingDoj || !newDojValue} className="btn-primary text-xs flex items-center gap-1 shadow-md">
                {savingDoj && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save New DOJ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: AUDIT HISTORY MODAL ──────────────────────────────────── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#e2dfd7] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <div className="text-[10px] font-black uppercase text-[#C9952A] tracking-wider">Audit History</div>
                <h3 className="font-extrabold text-base text-[#1E2D4E] truncate">{historyItem.name}</h3>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 p-1">
              {loadingHistory ? (
                <div className="py-8 flex justify-center text-xs text-[#1E2D4E]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#C9952A]" />
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#777777]">No past history recorded for this employee.</div>
              ) : (
                historyLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#1E2D4E]">
                      <span className="uppercase text-[10px] tracking-wider text-[#C9952A]">{log.action_type}</span>
                      <span className="text-[10px] font-mono text-[#777777]">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-[#1E2D4E] font-medium">
                      {log.old_value && <span>From <strong>{log.old_value}</strong> → </span>}
                      <strong>{log.new_value}</strong>
                    </div>

                    {log.notes && <div className="text-[11px] text-[#555555] italic">"{log.notes}"</div>}
                    <div className="text-[10px] text-[#777777] font-semibold">By: {log.done_by}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setHistoryItem(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: VIEW CANDIDATE PROFILE MODAL ─────────────────────────── */}
      {profileItem && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-[#e2dfd7]">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={API.fileUrl(profileItem.photoUrl) || '/default-avatar.png'}
                  alt={profileItem.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-[#e2dfd7] bg-[#F4F1EA]"
                  onError={(e) => { (e.target as any).src = '/default-avatar.png'; }}
                />
                <div>
                  <h3 className="font-extrabold text-base text-[#1E2D4E]">{profileItem.name}</h3>
                  <div className="text-xs text-[#C9952A] font-bold">{profileItem.designation}</div>
                </div>
              </div>
              <button onClick={() => setProfileItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#F9F7F4] p-4 rounded-2xl border border-[#e2dfd7]">
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Application No</span>
                <span className="font-mono font-bold text-[#1E2D4E]">{profileItem.appNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Phone</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.phone}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Department</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.department}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Section</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.section}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Gender</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.gender}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Offered DOJ</span>
                <span className="font-bold text-emerald-700">{fmtDisplayDate(profileItem.offeredDoj)}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">Call Status</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.callStatus}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#777777] block">DOJ Confirmation</span>
                <span className="font-bold text-[#1E2D4E]">{profileItem.dojConfirmation}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <a href={`tel:${profileItem.phone}`} className="btn-secondary text-xs flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
              </a>
              <a href={`https://wa.me/91${profileItem.phone}`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                WhatsApp
              </a>
              <button onClick={() => setProfileItem(null)} className="btn-primary text-xs">
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
