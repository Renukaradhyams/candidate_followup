import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  UserPlus, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  ArrowRight,
  Search,
  Filter,
  BarChart3,
  Sparkles,
  TrendingUp,
  Percent,
  CalendarCheck
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRange, setActiveRange] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // KPIs
  const [kpis, setKpis] = useState<{
    total: number;
    shortlisted: number;
    selected: number;
    joined: number;
    acceptanceRate: number;
    avgDays: number;
    onboarding: number;
    awaitingJoining: number;
    interviewsToday: number;
    rejected: number;
    hold: number;
    dailyBreakdown: any[];
  }>({
    total: 0,
    shortlisted: 0,
    selected: 0,
    joined: 0,
    acceptanceRate: 0,
    avgDays: 0,
    onboarding: 0,
    awaitingJoining: 0,
    interviewsToday: 0,
    rejected: 0,
    hold: 0,
    dailyBreakdown: []
  });

  const [pendingActions, setPendingActions] = useState<{ text: string; priority: string }[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState({ walkin: 0, empref: 0, online: 0, other: 0 });
  
  // Recent Candidates Table
  const [candidates, setCandidates] = useState<any[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const loadData = useCallback(async () => {
    try {
      const [kData, pData, sData, cData] = await Promise.all([
        API.getKPIs(activeRange, fromDate, toDate),
        API.getPendingActions(),
        API.getSourceBreakdown(),
        API.getCandidates({ limit: 1000 })
      ]);

      if (kData) setKpis(kData);
      if (pData && pData.items) setPendingActions(pData.items);
      if (sData) setSourceBreakdown(sData);
      if (cData && cData.candidates) {
        setCandidates(cData.candidates);
      }
    } catch (err: any) {
      console.warn('Dashboard data load warning:', err.message);
    }
  }, [activeRange, fromDate, toDate]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadData();
  }, [navigate, loadData]);

  // Date Filtering logic for candidates table
  useEffect(() => {
    let list = [...candidates];

    if (activeRange === 'today') {
      const today = new Date().toDateString();
      list = list.filter(c => c.rawDate && new Date(c.rawDate).toDateString() === today);
    } else if (activeRange === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toDateString();
      list = list.filter(c => c.rawDate && new Date(c.rawDate).toDateString() === yestStr);
    } else if (activeRange === 'week') {
      const weekAgo = Date.now() - 7 * 86400000;
      list = list.filter(c => c.rawDate && c.rawDate >= weekAgo);
    } else if (activeRange === 'month') {
      const monthAgo = Date.now() - 30 * 86400000;
      list = list.filter(c => c.rawDate && c.rawDate >= monthAgo);
    } else if (activeRange === 'last_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      list = list.filter(c => c.rawDate && c.rawDate >= firstDay && c.rawDate <= lastDay);
    } else if (activeRange === 'custom' && fromDate) {
      const start = new Date(fromDate).getTime();
      const end = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : start + 86400000 - 1;
      list = list.filter(c => c.rawDate && c.rawDate >= start && c.rawDate <= end);
    }
    // If activeRange === 'all', all candidates are retained

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.appNo && c.appNo.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q))
      );
    }

    setFilteredCandidates(list);
    setCurrentPage(1);
  }, [candidates, activeRange, fromDate, toDate, searchQuery]);

  // Compute Day-Wise / Date-Wise Breakdown
  const dateWiseBreakdown = useMemo(() => {
    const map: Record<string, {
      date: string;
      formattedDate: string;
      rawTimestamp: number;
      total: number;
      shortlisted: number;
      selected: number;
      joined: number;
      rejected: number;
      hold: number;
    }> = {};

    filteredCandidates.forEach(c => {
      let rawMs = c.rawDate;
      if (!rawMs && c.date) {
        rawMs = new Date(c.date).getTime();
      }
      if (!rawMs) return;

      const d = new Date(rawMs);
      if (isNaN(d.getTime())) return;

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[dateKey]) {
        map[dateKey] = {
          date: dateKey,
          formattedDate: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          rawTimestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
          total: 0,
          shortlisted: 0,
          selected: 0,
          joined: 0,
          rejected: 0,
          hold: 0
        };
      }

      map[dateKey].total += 1;
      const status = (c.status || '').toLowerCase();
      if (status === 'selected') {
        map[dateKey].selected += 1;
      } else if (status === 'joined') {
        map[dateKey].joined += 1;
      } else if (status === 'rejected') {
        map[dateKey].rejected += 1;
      } else if (status === 'hold') {
        map[dateKey].hold += 1;
      } else if (['shortlisted', '1st call done', '2nd call done', 'interview scheduled', 'interviewed'].includes(status)) {
        map[dateKey].shortlisted += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [filteredCandidates]);

  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedCandidates = filteredCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stages = [
    { label: 'Applied', val: kpis.total || 0, color: '#1E2D4E' },
    { label: 'Shortlisted', val: kpis.shortlisted || 0, color: '#2a3f6e' },
    { label: 'Interview Scheduled', val: kpis.interviewsToday || 0, color: '#C9952A' },
    { label: 'Selected', val: kpis.selected || 0, color: '#2d8a4e' },
    { label: 'Offer Desk', val: kpis.shortlisted || 0, color: '#1a8a84' },
    { label: 'Joined', val: kpis.joined || 0, color: '#0d5c58' }
  ];

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      
      <Sidebar 
        session={session} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar 
          title="Executive ATS Dashboard" 
          breadcrumbs={[{ label: 'Overview' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header & Date Range Filter Bar */}
          <div className="card-glass p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#C9952A]" />
                <span>Recruitment Analytics &amp; Pipeline</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">Real-time candidate metrics, funnel conversion &amp; team performance.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center bg-[#F9F7F4] p-1 rounded-xl border border-[#e2dfd7]">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Last Month' }
                ].map(r => (
                  <button
                    key={r.key}
                    onClick={() => { setActiveRange(r.key); setFromDate(''); setToDate(''); }}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${activeRange === r.key 
                        ? 'bg-[#1E2D4E] text-white shadow-xs' 
                        : 'text-[#666666] hover:text-[#1E2D4E]'}
                    `}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs text-[#1E2D4E] font-semibold"
                />
                <span className="text-[#888888] text-xs font-bold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs text-[#1E2D4E] font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Primary Metric Cards Grid - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Pipeline"
              value={kpis.total}
              subtext="All registered candidates"
              icon={Users}
              color="gold"
              onClick={() => navigate('/candidates')}
            />
            <MetricCard
              title="Shortlisted"
              value={kpis.shortlisted}
              subtext="Candidates in Offer Desk"
              icon={Clock}
              color="navy"
              onClick={() => navigate('/offer-process')}
            />
            <MetricCard
              title="Selected Pool"
              value={kpis.selected}
              subtext="Current selected candidates"
              icon={CheckCircle}
              color="emerald"
              onClick={() => navigate('/interview-panel')}
            />
            <MetricCard
              title="Joined Staff"
              value={kpis.joined}
              subtext="Employees in Employee Directory"
              icon={UserCheck}
              color="teal"
              onClick={() => navigate('/employees')}
            />
          </div>

          {/* Secondary Metric Cards Grid - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Acceptance Rate"
              value={`${kpis.acceptanceRate}%`}
              subtext="Shortlisted ÷ Registered Candidates × 100"
              icon={Percent}
              color="indigo"
            />
            <MetricCard
              title="Avg Days To Hire"
              value={`${kpis.avgDays} days`}
              subtext="Applied to final DOJ"
              icon={TrendingUp}
              color="amber"
            />
            <MetricCard
              title="Awaiting Joining"
              value={kpis.awaitingJoining ?? kpis.onboarding}
              subtext="Offer Desk pending acceptance"
              icon={UserPlus}
              color="emerald"
              onClick={() => navigate('/offer-process?filter=pending')}
            />
            <MetricCard
              title="Interviews Today"
              value={kpis.interviewsToday}
              subtext="Today's scheduled interviews"
              icon={CalendarCheck}
              color="rose"
              onClick={() => navigate('/interview-panel?filter=today')}
            />
          </div>

          {/* Middle Layout: Funnel Breakdown + Pending Action Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hiring Funnel Card */}
            <div className="card-glass p-5 lg:col-span-2 space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight flex items-center justify-between">
                  <span>Hiring Pipeline &amp; Conversion Funnel</span>
                  <span className="text-xs font-bold text-[#C9952A] bg-[#C9952A]/10 px-2.5 py-1 rounded-full">
                    {kpis.total} Total Applications
                  </span>
                </h3>
                <p className="text-xs text-[#777777] font-medium mt-1">Stage-by-stage candidate progression and drop-off percentages.</p>
              </div>

              <div className="space-y-3.5 my-2">
                {stages.map((s, idx) => {
                  const pct = kpis.total > 0 ? Math.round((s.val / kpis.total) * 100) : 0;
                  const prev = stages[idx - 1]?.val || 0;
                  const dropPct = idx === 0 || prev === 0 ? '' : `−${Math.round((1 - s.val / prev) * 100)}%`;

                  return (
                    <div key={s.label} className="funnel-row">
                      <div className="f-lbl text-xs font-bold">{s.label}</div>
                      <div className="f-bg">
                        <div 
                          className="f-bar shadow-xs" 
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: s.color }}
                        >
                          {pct > 5 && `${pct}%`}
                        </div>
                      </div>
                      <div className="f-num font-black text-[#1E2D4E] text-xs">{s.val}</div>
                      <div className="f-drop font-extrabold text-xs">{dropPct}</div>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline Loss Summary */}
              <div className="pt-4 border-t border-[#e2dfd7] flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="text-[10px] uppercase text-[#777777] tracking-widest font-black">Drop-Off Metrics:</span>
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                  🔴 Rejected: {kpis.rejected}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                  🟡 On Hold: {kpis.hold}
                </span>
              </div>
            </div>

            {/* Pending Actions Feed */}
            <div className="card-glass p-5 space-y-4 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-sm flex items-center gap-2">
                    <span>Pending Actions</span>
                    {pendingActions.filter(i => i.priority === 'urgent').length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                        {pendingActions.filter(i => i.priority === 'urgent').length}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#777777] font-medium mt-0.5">Tasks requiring prompt HR action</p>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72 pr-1">
                {pendingActions.length > 0 ? (
                  pendingActions.map((item, idx) => {
                    const isUrgent = item.priority === 'urgent';
                    const isWarn = item.priority === 'warn';

                    return (
                      <div
                        key={idx}
                        className={`
                          p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-xs transition-all
                          ${isUrgent 
                            ? 'bg-rose-50/80 border-rose-200 text-rose-900 font-semibold' 
                            : isWarn 
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900 font-medium' 
                            : 'bg-sky-50/80 border-sky-200 text-sky-900'}
                        `}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isUrgent ? 'bg-rose-600' : isWarn ? 'bg-amber-500' : 'bg-sky-600'}`} />
                          <span className="leading-snug">{item.text}</span>
                        </div>
                        <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${isUrgent ? 'bg-rose-200 text-rose-900' : 'bg-white/90 border border-slate-200'}`}>
                          {item.priority}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-xs text-[#777777] font-semibold space-y-1">
                    <div className="text-2xl">🎉</div>
                    <div>All caught up! No pending alerts</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date-Wise Application Trends & Breakdown Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-[#C9952A]" />
                  <span>Date-Wise Application Trends &amp; Daily Breakdown</span>
                </h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">
                  Day-by-day candidate registration breakdown and recruitment pipeline progress.
                </p>
              </div>
              <span className="text-xs font-extrabold text-[#1E2D4E] bg-[#1E2D4E]/10 px-3 py-1 rounded-full self-start sm:self-auto">
                {dateWiseBreakdown.length} Active Days
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/50">
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4 text-center">Total Applications</th>
                    <th className="py-3 px-4 text-center">Shortlisted</th>
                    <th className="py-3 px-4 text-center">Selected</th>
                    <th className="py-3 px-4 text-center">Joined</th>
                    <th className="py-3 px-4 text-center">Rejected</th>
                    <th className="py-3 px-4 text-center">On Hold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {dateWiseBreakdown.length > 0 ? (
                    dateWiseBreakdown.map((row) => (
                      <tr key={row.date} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3.5 px-4 font-bold text-[#1E2D4E] flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#C9952A]" />
                          <span>{row.formattedDate}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-[#1E2D4E]">{row.total}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-sky-800">{row.shortlisted}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-700">{row.selected}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-teal-800">{row.joined}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-rose-700">{row.rejected}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-amber-700">{row.hold}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#777777] font-semibold">
                        No day-wise candidate records found for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {dateWiseBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#e2dfd7] bg-[#F9F7F4] font-black text-xs text-[#1E2D4E]">
                      <td className="py-3 px-4">Total ({dateWiseBreakdown.length} active days)</td>
                      <td className="py-3 px-4 text-center">{dateWiseBreakdown.reduce((sum, r) => sum + r.total, 0)}</td>
                      <td className="py-3 px-4 text-center text-sky-800">{dateWiseBreakdown.reduce((sum, r) => sum + r.shortlisted, 0)}</td>
                      <td className="py-3 px-4 text-center text-emerald-700">{dateWiseBreakdown.reduce((sum, r) => sum + r.selected, 0)}</td>
                      <td className="py-3 px-4 text-center text-teal-800">{dateWiseBreakdown.reduce((sum, r) => sum + r.joined, 0)}</td>
                      <td className="py-3 px-4 text-center text-rose-700">{dateWiseBreakdown.reduce((sum, r) => sum + r.rejected, 0)}</td>
                      <td className="py-3 px-4 text-center text-amber-700">{dateWiseBreakdown.reduce((sum, r) => sum + r.hold, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Recent Candidates Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight">Recent Candidate Applications</h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">Showing {filteredCandidates.length} filtered candidate records</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate, phone, app no..."
                    className="pl-9 pr-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs text-[#1E2D4E] font-semibold focus:outline-none focus:border-[#1E2D4E] w-56 shadow-xs"
                  />
                </div>

                <button
                  onClick={() => navigate('/candidates')}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <span>Candidate Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/50">
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Days In Pipeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {paginatedCandidates.length > 0 ? (
                    paginatedCandidates.map((c) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#555555] font-bold">{c.appNo}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {c.initials}
                            </div>
                            <div>
                              <span className="font-extrabold text-[#1E2D4E] block">{c.name}</span>
                              <span className="text-[10px] text-[#777777] font-medium">{c.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#555555] font-bold">{c.desig}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-medium">{c.source}</td>
                        <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap">{c.date}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={c.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#1E2D4E]">{c.daysIn} days</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#777777] font-semibold">
                        No matching candidate records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs pt-3 border-t border-[#e2dfd7]">
              <span className="text-[#777777] font-semibold">
                Showing {paginatedCandidates.length} of {filteredCandidates.length} entries
              </span>

              <div className="flex items-center gap-2 font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2dfd7] bg-white text-[#1E2D4E] hover:bg-[#F9F7F4] disabled:opacity-40 transition-colors shadow-xs"
                >
                  ← Previous
                </button>
                <span className="px-2 py-1 bg-[#F9F7F4] rounded-lg border border-[#e2dfd7]">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2dfd7] bg-white text-[#1E2D4E] hover:bg-[#F9F7F4] disabled:opacity-40 transition-colors shadow-xs"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
