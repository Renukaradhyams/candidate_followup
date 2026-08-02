"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
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
  Filter
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRange, setActiveRange] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // KPIs
  const [kpis, setKpis] = useState({
    total: 0,
    shortlisted: 0,
    selected: 0,
    joined: 0,
    acceptanceRate: 0,
    avgDays: 0,
    onboarding: 0,
    interviewsToday: 0,
    rejected: 0,
    hold: 0
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
        API.getKPIs(activeRange),
        API.getPendingActions(),
        API.getSourceBreakdown(),
        API.getCandidates({ limit: 500 })
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
  }, [activeRange]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadData();
  }, [router, loadData]);

  // Date Filtering logic
  useEffect(() => {
    let list = [...candidates];

    if (activeRange === 'today') {
      const today = new Date().toDateString();
      list = list.filter(c => c.rawDate && new Date(c.rawDate).toDateString() === today);
    } else if (activeRange === 'week') {
      const now = new Date();
      const weekAgo = new Date(now.setDate(now.getDate() - 7)).getTime();
      list = list.filter(c => c.rawDate && c.rawDate >= weekAgo);
    } else if (activeRange === 'month') {
      const now = new Date();
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).getTime();
      list = list.filter(c => c.rawDate && c.rawDate >= monthAgo);
    } else if (activeRange === 'custom' && fromDate) {
      const start = new Date(fromDate).getTime();
      const end = toDate ? new Date(toDate).setHours(23, 59, 59) : start + 86400000;
      list = list.filter(c => c.rawDate && c.rawDate >= start && c.rawDate <= end);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.appNo.toLowerCase().includes(q) || 
        c.phone.includes(q)
      );
    }

    setFilteredCandidates(list);
    setCurrentPage(1);
  }, [candidates, activeRange, fromDate, toDate, searchQuery]);

  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedCandidates = filteredCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stages = [
    { label: 'Applied', val: kpis.total || 0, color: '#1E2D4E' },
    { label: 'Shortlisted', val: kpis.shortlisted || 0, color: '#2a3f6e' },
    { label: 'Interview Scheduled', val: kpis.interviewsToday || 0, color: '#C9952A' },
    { label: 'Selected', val: kpis.selected || 0, color: '#2d8a4e' },
    { label: 'Joined', val: kpis.joined || 0, color: '#1a8a84' }
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
          title="Dashboard" 
          breadcrumbs={[{ label: 'Dashboard' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Date Filter Bar */}
          <div className="card-glass p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 font-bold">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => { setActiveRange(r.key); setFromDate(''); setToDate(''); }}
                  className={`
                    px-3 py-1.5 rounded-lg border transition-all
                    ${activeRange === r.key 
                      ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm' 
                      : 'bg-white text-[#666666] border-[#e0ddd8] hover:bg-black/5'}
                  `}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                className="px-2.5 py-1 rounded-md border border-[#e0ddd8] bg-white text-[#1E2D4E] font-medium"
              />
              <span className="text-[#888888]">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                className="px-2.5 py-1 rounded-md border border-[#e0ddd8] bg-white text-[#1E2D4E] font-medium"
              />
            </div>
          </div>

          {/* Primary KPI Grid Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="card-glass p-4 border-l-4 border-l-[#C9952A] space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Total Pipeline</div>
              <div className="text-2xl lg:text-3xl font-black text-[#1E2D4E]">{kpis.total}</div>
              <div className="text-[10px] text-[#888888] font-semibold">All registered candidates</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-[#1E2D4E] space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Shortlisted</div>
              <div className="text-2xl lg:text-3xl font-black text-[#1E2D4E]">{kpis.shortlisted}</div>
              <div className="text-[10px] text-[#888888] font-semibold">Awaiting interview</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-[#2d8a4e] space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Selected</div>
              <div className="text-2xl lg:text-3xl font-black text-[#2d8a4e]">{kpis.selected}</div>
              <div className="text-[10px] text-[#888888] font-semibold">Passed all rounds</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-[#1a8a84] space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Joined</div>
              <div className="text-2xl lg:text-3xl font-black text-[#1a8a84]">{kpis.joined}</div>
              <div className="text-[10px] text-[#888888] font-semibold">Onboarded staff</div>
            </div>
          </div>

          {/* Primary KPI Grid Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="card-glass p-4 border-l-4 border-l-blue-600 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Acceptance Rate</div>
              <div className="text-2xl lg:text-3xl font-black text-blue-700">{kpis.acceptanceRate}<span className="text-sm">%</span></div>
              <div className="text-[10px] text-[#888888] font-semibold">of offers accepted</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-amber-500 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Avg Days to Hire</div>
              <div className="text-2xl lg:text-3xl font-black text-amber-600">{kpis.avgDays}<span className="text-sm">d</span></div>
              <div className="text-[10px] text-[#888888] font-semibold">Applied → Joined</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-purple-600 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Awaiting Joining</div>
              <div className="text-2xl lg:text-3xl font-black text-purple-700">{kpis.onboarding}</div>
              <div className="text-[10px] text-[#888888] font-semibold">Offer accepted</div>
            </div>

            <div className="card-glass p-4 border-l-4 border-l-red-600 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#888888]">Interviews Today</div>
              <div className="text-2xl lg:text-3xl font-black text-red-600">{kpis.interviewsToday}</div>
              <div className="text-[10px] text-[#888888] font-semibold">Scheduled today</div>
            </div>
          </div>

          {/* Middle Layout: Funnel + Source + Pending Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Hiring Funnel Card */}
            <div className="card-glass p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Hiring Funnel</h3>
                <p className="text-[11px] text-[#888888]">Conversion at each stage &amp; drop-off %</p>
              </div>

              <div className="space-y-2.5">
                {stages.map((s, idx) => {
                  const pct = kpis.total > 0 ? Math.round((s.val / kpis.total) * 100) : 0;
                  const prev = stages[idx - 1]?.val || 0;
                  const dropPct = idx === 0 || prev === 0 ? '' : `−${Math.round((1 - s.val / prev) * 100)}%`;

                  return (
                    <div key={s.label} className="funnel-row">
                      <div className="f-lbl">{s.label}</div>
                      <div className="f-bg">
                        <div 
                          className="f-bar" 
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: s.color }}
                        >
                          {s.val}
                        </div>
                      </div>
                      <div className="f-num">{s.val}</div>
                      <div className="f-drop">{dropPct}</div>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline Loss */}
              <div className="pt-3 border-t border-dashed border-[#e0ddd8] flex items-center gap-4 text-xs font-bold">
                <span className="text-[10px] uppercase text-[#888888] tracking-wider">Pipeline Loss:</span>
                <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-800 text-[11px]">
                  🔴 Rejected: {kpis.rejected}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[11px]">
                  🟡 On Hold: {kpis.hold}
                </span>
              </div>
            </div>

            {/* Pending Actions Feed */}
            <div className="card-glass p-5 space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-sm flex items-center gap-2">
                    <span>Pending Actions</span>
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                      {pendingActions.filter(i => i.priority === 'urgent').length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#888888]">Requires your attention</p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                {pendingActions.length > 0 ? (
                  pendingActions.map((item, idx) => {
                    const isUrgent = item.priority === 'urgent';
                    const isWarn = item.priority === 'warn';

                    return (
                      <div
                        key={idx}
                        className={`
                          p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2
                          ${isUrgent 
                            ? 'bg-red-50/70 border-red-200 text-red-900 font-semibold' 
                            : isWarn 
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900 font-medium' 
                            : 'bg-blue-50/70 border-blue-200 text-blue-900'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-600' : isWarn ? 'bg-amber-500' : 'bg-blue-600'}`} />
                          <span>{item.text}</span>
                        </div>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${isUrgent ? 'bg-red-200 text-red-900' : 'bg-white/80'}`}>
                          {item.priority}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-[#888888] font-semibold space-y-1">
                    <div className="text-xl">✅</div>
                    <div>All clear! No pending alerts</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Candidates Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Recent Candidates</h3>
                <p className="text-[11px] text-[#888888]">Showing {filteredCandidates.length} candidate(s)</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, phone, app no..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-xs text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] w-48"
                  />
                </div>

                <button
                  onClick={() => navigate('/candidates')}
                  className="px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] flex items-center gap-1.5"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888] tracking-wider">
                    <th className="py-2.5 px-3">App No</th>
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Days In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {paginatedCandidates.length > 0 ? (
                    paginatedCandidates.map((c) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#666666]">{c.appNo}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#1E2D4E] text-white font-black text-[10px] flex items-center justify-center">
                              {c.initials}
                            </div>
                            <span className="font-bold text-[#1E2D4E]">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#555555]">{c.desig}</td>
                        <td className="py-3 px-3 text-[#555555]">{c.source}</td>
                        <td className="py-3 px-3 text-[#666666] whitespace-nowrap">{c.date}</td>
                        <td className="py-3 px-3">
                          <span className={`badge ${
                            c.status === 'New' ? 'b-new' :
                            c.status === 'Shortlisted' ? 'b-short' :
                            c.status === 'Selected' ? 'b-sel' :
                            c.status === 'Joined' ? 'b-sel' :
                            c.status === 'Rejected' ? 'b-rej' : 'b-info'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#666666]">{c.daysIn}d</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#888888] font-semibold">
                        No recent candidates found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-[#888888]">
                Showing {paginatedCandidates.length} of {filteredCandidates.length}
              </span>

              <div className="flex items-center gap-2 font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1 rounded-md border border-[#e0ddd8] bg-white text-[#1E2D4E] disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span>{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1 rounded-md border border-[#e0ddd8] bg-white text-[#1E2D4E] disabled:opacity-40"
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
