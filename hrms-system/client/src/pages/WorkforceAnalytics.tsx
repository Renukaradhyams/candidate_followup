import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Users, Building2, Briefcase, Calendar, Download, Search, Filter,
  RotateCcw, ChevronDown, ChevronUp, ChevronRight, SlidersHorizontal,
  PieChart, BarChart3, TrendingUp, Sparkles, User, Layers, ArrowUpRight,
  Printer, FileSpreadsheet, FileText, CheckCircle2, Award
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface EmployeeRecord {
  appNo: string;
  name: string;
  gender: string;
  department: string;
  section: string;
  designation: string;
  doj: string;
}

interface OverviewData {
  totalEmployees: number;
  totalDepartments: number;
  totalDesignations: number;
  totalMale: number;
  totalFemale: number;
  malePct: number;
  femalePct: number;
  newestDeptHiring: string;
  lastJoinedEmployee: EmployeeRecord | null;
}

interface DeptAnalytic {
  department: string;
  total: number;
  male: number;
  female: number;
  malePct: number;
  femalePct: number;
  companyWorkforcePct: number;
}

interface DesigAnalytic {
  designation: string;
  total: number;
  male: number;
  female: number;
  malePct: number;
  femalePct: number;
  companyWorkforcePct: number;
  departments: { department: string; count: number }[];
}

interface TreeNode {
  department: string;
  total: number;
  male: number;
  female: number;
  designations: { designation: string; total: number; male: number; female: number }[];
}

interface HeatmapNode {
  department: string;
  male: number;
  female: number;
  total: number;
}

interface HiringTrend {
  ym: string;
  label: string;
  total: number;
  male: number;
  female: number;
}

interface CompCategory {
  category: string;
  count: number;
  pct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

// ─── Gender Donut Chart (SVG) ─────────────────────────────────────────────────
function DonutChart({ male, female, total }: { male: number; female: number; total: number }) {
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const malePct = total > 0 ? male / total : 0;
  const femalePct = total > 0 ? female / total : 0;

  const maleOffset = circ * (1 - malePct);
  const femaleOffset = circ * (1 - femalePct);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Base background ring */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1ede6" strokeWidth={stroke} />
        {/* Female Segment (Pink/Purple) */}
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ec4899" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={femaleOffset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        {/* Male Segment (Blue/Indigo) */}
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3b82f6" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={maleOffset}
          style={{ transformOrigin: 'center', transform: `rotate(${femalePct * 360}deg)` }}
          strokeLinecap="round" className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-[#1E2D4E] leading-none">{total}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] mt-1">Workforce</span>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function WorkforceAnalytics() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Raw data from API
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [deptAnalytics, setDeptAnalytics] = useState<DeptAnalytic[]>([]);
  const [desigAnalytics, setDesigAnalytics] = useState<DesigAnalytic[]>([]);
  const [treeView, setTreeView] = useState<TreeNode[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapNode[]>([]);
  const [hiringTrends, setHiringTrends] = useState<HiringTrend[]>([]);
  const [composition, setComposition] = useState<CompCategory[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [dataAudit, setDataAudit] = useState<{ departmentVariations: { canonical: string; variations: string[] }[]; designationVariations: { canonical: string; variations: string[] }[] } | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [rawEmployees, setRawEmployees] = useState<EmployeeRecord[]>([]);

  // Main Segmented View Control
  const [activeView, setActiveView] = useState<'department' | 'designation' | 'gender'>('department');

  // Interactive Tree View state (expanded departments)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Designation chart expansion (top 10 vs all)
  const [showAllDesigs, setShowAllDesigs] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getWorkforceAnalytics();
      if (res?.success) {
        setOverview(res.overview);
        setDeptAnalytics(res.departmentAnalytics || []);
        setDesigAnalytics(res.designationAnalytics || []);
        setTreeView(res.treeView || []);
        setHeatmap(res.departmentHeatmap || []);
        setHiringTrends(res.hiringTrends || []);
        setComposition(res.workforceComposition || []);
        setInsights(res.executiveInsights || []);
        setDataAudit(res.dataQualityAudit || null);
        setRawEmployees(res.rawEmployees || []);
      }
    } catch (err: any) {
      showToast('Failed to load workforce analytics: ' + err.message, 'error');
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
    fetchAnalytics();
  }, [navigate, fetchAnalytics]);

  // Expand / collapse department tree node
  const toggleTreeDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  // Filtered employees dataset based on header filters
  const filteredEmployees = useMemo(() => {
    let list = [...rawEmployees];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.appNo.toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q));
    }
    if (filterDept) list = list.filter(e => e.department === filterDept);
    if (filterDesig) list = list.filter(e => e.designation === filterDesig);
    if (filterGender) list = list.filter(e => e.gender === filterGender);
    if (filterSection) list = list.filter(e => e.section === filterSection);
    if (filterMonth) list = list.filter(e => (e.doj || '').startsWith(filterMonth));
    return list;
  }, [rawEmployees, search, filterDept, filterDesig, filterGender, filterSection, filterMonth]);

  // Unique options for filter dropdowns
  const uniqueDepts = useMemo(() => [...new Set(rawEmployees.map(e => e.department).filter(Boolean))].sort(), [rawEmployees]);
  const uniqueDesigs = useMemo(() => [...new Set(rawEmployees.map(e => e.designation).filter(Boolean))].sort(), [rawEmployees]);
  const uniqueSections = useMemo(() => [...new Set(rawEmployees.map(e => e.section).filter(Boolean))].sort(), [rawEmployees]);

  // Export functions
  const exportToCSV = (filename: string, rows: any[]) => {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows
        .map(row => {
          return keys
            .map(k => {
              let cell = row[k] === null || row[k] === undefined ? '' : row[k];
              cell = cell.toString().replace(/"/g, '""');
              if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
              return cell;
            })
            .join(separator);
        })
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    showToast(`Exported ${rows.length} rows to CSV`, 'success');
  };

  const handleExportDepartmentReport = () => {
    const data = deptAnalytics.map(d => ({
      Department: d.department,
      'Total Employees': d.total,
      Male: d.male,
      Female: d.female,
      'Male %': `${d.malePct}%`,
      'Female %': `${d.femalePct}%`,
      'Workforce %': `${d.companyWorkforcePct}%`,
    }));
    exportToCSV('Department_Workforce_Report', data);
  };

  const handleExportDesignationReport = () => {
    const data = desigAnalytics.map(d => ({
      Designation: d.designation,
      'Total Employees': d.total,
      Male: d.male,
      Female: d.female,
      'Male %': `${d.malePct}%`,
      'Female %': `${d.femalePct}%`,
      'Workforce %': `${d.companyWorkforcePct}%`,
    }));
    exportToCSV('Designation_Workforce_Report', data);
  };

  const handleExportFullReport = () => {
    const data = filteredEmployees.map(e => ({
      'App No': e.appNo,
      Name: e.name,
      Gender: e.gender,
      Department: e.department,
      Section: e.section,
      Designation: e.designation,
      DOJ: e.doj || 'N/A',
    }));
    exportToCSV('Complete_Workforce_Analytics_Report', data);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const maxDeptCount = useMemo(() => Math.max(...deptAnalytics.map(d => d.total), 1), [deptAnalytics]);
  const displayedDesigs = showAllDesigs ? desigAnalytics : desigAnalytics.slice(0, 10);
  const maxDesigCount = useMemo(() => Math.max(...desigAnalytics.map(d => d.total), 1), [desigAnalytics]);

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Topbar
          title="Employee Workforce Analytics"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Talent Management' }, { label: 'Workforce Analytics' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Sticky Filter & Export Bar */}
        <div className="sticky top-16 z-30 bg-[#EDE8DE]/95 backdrop-blur-md border-b border-[#e2dfd7] px-4 py-3 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9952A]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, App No, department, designation..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] shadow-xs"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilterBar(f => !f)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                showFilterBar || filterDept || filterDesig || filterGender || filterSection || filterMonth
                  ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]'
                  : 'bg-white text-[#555] border-[#e2dfd7] hover:border-[#1E2D4E]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {(filterDept || filterDesig || filterGender || filterSection || filterMonth) && ' ●'}
            </button>

            {/* Export Toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportFullReport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs"
                title="Export Complete Analytics to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={handleExportDepartmentReport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-xs"
                title="Export Department Report"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dept CSV</span>
              </button>

              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] text-xs font-bold hover:border-[#1E2D4E] transition-all shadow-xs"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={fetchAnalytics}
                className="p-2 rounded-xl border border-[#e2dfd7] bg-white text-[#555] hover:border-[#1E2D4E] transition-all shadow-xs"
                title="Refresh Analytics"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded Filter Panel */}
          {showFilterBar && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3 pt-3 border-t border-[#e2dfd7] animate-fade-in">
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none"
              >
                <option value="">All Departments</option>
                {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={filterDesig}
                onChange={e => setFilterDesig(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none"
              >
                <option value="">All Designations</option>
                {uniqueDesigs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={filterGender}
                onChange={e => setFilterGender(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              <select
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none"
              >
                <option value="">All Sections</option>
                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                title="Joining Month"
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] outline-none"
              />
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">

          {/* Header Banner */}
          <div className="card-glass p-5 border-2 border-[#1E2D4E]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-[#C9952A]" />
                <h1 className="text-xl font-black text-[#1E2D4E]">Employee Workforce Analytics</h1>
              </div>
              <p className="text-xs font-semibold text-[#666] mt-1">
                Real-time workforce distribution, gender ratios, department breakdowns, and hiring growth trends.
              </p>
            </div>

            {/* Segmented Control Switcher */}
            <div className="inline-flex p-1 rounded-2xl bg-[#1E2D4E]/10 border border-[#e2dfd7] self-start md:self-auto">
              {(
                [
                  ['department', 'Department View', Building2],
                  ['designation', 'Designation View', Briefcase],
                  ['gender', 'Gender View', Users],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setActiveView(key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                    activeView === key
                      ? 'bg-[#1E2D4E] text-white shadow-md'
                      : 'text-[#555] hover:text-[#1E2D4E]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="card-glass p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-[#C9952A] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-[#777]">Calculating workforce metrics...</p>
            </div>
          )}

          {!loading && overview && (
            <>
              {/* Top Overview KPI Strip (9 Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
                <div className="card-glass p-3.5 rounded-2xl bg-[#1E2D4E]/5">
                  <div className="flex items-center justify-between">
                    <Users className="w-4 h-4 text-[#1E2D4E]" />
                  </div>
                  <div className="text-2xl font-black text-[#1E2D4E] mt-1">{overview.totalEmployees}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Total Employees</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-blue-50">
                  <div className="flex items-center justify-between">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-700 mt-1">{overview.totalDepartments}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Departments</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-amber-50">
                  <div className="flex items-center justify-between">
                    <Briefcase className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-1">{overview.totalDesignations}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Designations</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-indigo-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">👨</span>
                  </div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">{overview.totalMale}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Male Employees</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-pink-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">👩</span>
                  </div>
                  <div className="text-2xl font-black text-pink-700 mt-1">{overview.totalFemale}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Female Employees</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-sky-50">
                  <div className="flex items-center justify-between">
                    <PieChart className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-2xl font-black text-sky-700 mt-1">{overview.malePct}%</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Male Ratio</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-purple-50">
                  <div className="flex items-center justify-between">
                    <PieChart className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-purple-700 mt-1">{overview.femalePct}%</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Female Ratio</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-emerald-50">
                  <div className="flex items-center justify-between">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-sm font-black text-emerald-800 truncate mt-1">{overview.newestDeptHiring}</div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">Newest Hiring Dept</div>
                </div>

                <div className="card-glass p-3.5 rounded-2xl bg-rose-50">
                  <div className="flex items-center justify-between">
                    <Award className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-xs font-black text-rose-800 truncate mt-1">
                    {overview.lastJoinedEmployee ? overview.lastJoinedEmployee.name : '—'}
                  </div>
                  <div className="text-[9.5px] font-black uppercase tracking-wider text-[#888] mt-0.5">
                    {overview.lastJoinedEmployee ? fmtDate(overview.lastJoinedEmployee.doj) : 'Last Joined'}
                  </div>
                </div>
              </div>

              {/* Executive Insights Box */}
              {insights.length > 0 && (
                <div className="card-glass p-4 rounded-2xl border-l-4 border-l-[#C9952A] bg-gradient-to-r from-amber-500/5 to-transparent">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C9952A]" /> Executive Insights Summary
                    </h3>
                    {dataAudit && (
                      <button
                        onClick={() => setShowAuditPanel(v => !v)}
                        className="text-[10.5px] font-black text-[#1E2D4E] bg-white border border-[#e2dfd7] px-2.5 py-1 rounded-lg hover:border-[#C9952A] transition-all"
                      >
                        {showAuditPanel ? 'Hide Data Audit' : '📋 View Data Quality Audit'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {insights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-[#e2dfd7] text-xs text-[#333]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span dangerouslySetInnerHTML={{ __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Quality Normalization Audit Panel */}
              {showAuditPanel && dataAudit && (
                <div className="card-glass p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-[#1E2D4E] text-sm flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-600" /> Internal Data Quality Normalization Audit
                      </h3>
                      <p className="text-xs text-[#666] font-medium mt-0.5">
                        Raw database string variations automatically consolidated into canonical Title Case standards without altering historical rows.
                      </p>
                    </div>
                    <button onClick={() => setShowAuditPanel(false)} className="text-xs font-bold text-[#888] hover:text-[#1E2D4E]">Close</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Department Audit */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 space-y-2">
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wider block">Department Variations Consolidated</span>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {dataAudit.departmentVariations.map(d => (
                          <div key={d.canonical} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="font-black text-[#1E2D4E] block">Standardized: {d.canonical}</span>
                            <span className="text-[10px] text-[#777] font-medium block mt-0.5">
                              Raw DB Variations ({d.variations.length}): {d.variations.map(v => `"${v}"`).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Designation Audit */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 space-y-2">
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wider block">Designation Variations Consolidated</span>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {dataAudit.designationVariations.map(d => (
                          <div key={d.canonical} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="font-black text-[#1E2D4E] block">Standardized: {d.canonical}</span>
                            <span className="text-[10px] text-[#777] font-medium block mt-0.5">
                              Raw DB Variations ({d.variations.length}): {d.variations.map(v => `"${v}"`).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC VIEW SECTIONS */}

              {/* SECTION A: DEPARTMENT VIEW */}
              {activeView === 'department' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Department Bar Chart (2 cols) */}
                    <div className="lg:col-span-2 card-glass p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-600" /> Department Workforce Distribution
                          </h3>
                          <p className="text-xs text-[#777] font-medium mt-0.5">Stacked Male vs Female employee breakdown by department</p>
                        </div>
                        <span className="text-xs font-black text-[#1E2D4E] bg-blue-50 px-2.5 py-1 rounded-lg">
                          {deptAnalytics.length} Depts
                        </span>
                      </div>

                      <div className="space-y-3 pt-2">
                        {deptAnalytics.map(d => {
                          const malePctWidth = d.total > 0 ? (d.male / d.total) * 100 : 0;
                          const femalePctWidth = d.total > 0 ? (d.female / d.total) * 100 : 0;
                          const barWidthPct = (d.total / maxDeptCount) * 100;

                          return (
                            <div key={d.department} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-[#1E2D4E] font-black">{d.department}</span>
                                <span className="text-[#555]">{d.total} employees <span className="text-[#888] font-normal">({d.companyWorkforcePct}% of company)</span></span>
                              </div>
                              <div className="h-6 bg-[#f1ede6] rounded-xl overflow-hidden flex relative" style={{ width: `${Math.max(barWidthPct, 15)}%` }}>
                                {d.male > 0 && (
                                  <div
                                    style={{ width: `${malePctWidth}%` }}
                                    className="bg-blue-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 truncate transition-all duration-500"
                                    title={`Male: ${d.male} (${d.malePct}%)`}
                                  >
                                    {d.male > 3 ? `${d.male} M` : ''}
                                  </div>
                                )}
                                {d.female > 0 && (
                                  <div
                                    style={{ width: `${femalePctWidth}%` }}
                                    className="bg-pink-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 truncate transition-all duration-500"
                                    title={`Female: ${d.female} (${d.femalePct}%)`}
                                  >
                                    {d.female > 3 ? `${d.female} F` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gender Donut Card (1 col) */}
                    <div className="card-glass p-5 flex flex-col items-center justify-center text-center space-y-4">
                      <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-purple-600" /> Overall Gender Split
                      </h3>
                      {overview && <DonutChart male={overview.totalMale} female={overview.totalFemale} total={overview.totalEmployees} />}
                      <div className="grid grid-cols-2 gap-3 w-full pt-2">
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                          <span className="text-xs font-black text-blue-700 block">Male</span>
                          <span className="text-xl font-black text-blue-900">{overview.totalMale}</span>
                          <span className="text-[10px] text-blue-600 font-bold block">{overview.malePct}%</span>
                        </div>
                        <div className="bg-pink-50 border border-pink-200 p-3 rounded-2xl">
                          <span className="text-xs font-black text-pink-700 block">Female</span>
                          <span className="text-xl font-black text-pink-900">{overview.totalFemale}</span>
                          <span className="text-[10px] text-pink-600 font-bold block">{overview.femalePct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Tree View (Department -> Designation Drilldown) */}
                  <div className="card-glass p-5 space-y-4">
                    <div>
                      <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#C9952A]" /> Department vs Designation Tree Drilldown
                      </h3>
                      <p className="text-xs text-[#777] font-medium mt-0.5">Click any department to expand designations and gender distribution</p>
                    </div>

                    <div className="space-y-2">
                      {treeView.map(t => {
                        const isExpanded = expandedDepts.has(t.department);
                        return (
                          <div key={t.department} className="border border-[#e2dfd7] rounded-2xl overflow-hidden bg-white/70">
                            <button
                              onClick={() => toggleTreeDept(t.department)}
                              className="w-full p-3.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-[#C9952A]" /> : <ChevronDown className="w-4 h-4 text-[#777]" />}
                                <span className="font-black text-[#1E2D4E] text-sm">{t.department}</span>
                                <span className="text-xs font-bold bg-[#1E2D4E]/10 text-[#1E2D4E] px-2 py-0.5 rounded-full">
                                  {t.total} employees
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs font-bold">
                                <span className="text-blue-600">👨 {t.male}</span>
                                <span className="text-pink-600">👩 {t.female}</span>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-[#e2dfd7] bg-[#F9F7F4] p-3 pl-8 space-y-2 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {t.designations.map(sub => (
                                    <div key={sub.designation} className="bg-white p-3 rounded-xl border border-[#e2dfd7] flex items-center justify-between">
                                      <div>
                                        <span className="font-black text-xs text-[#1E2D4E] block">{sub.designation}</span>
                                        <span className="text-[10px] text-[#888] font-bold">{sub.total} staff</span>
                                      </div>
                                      <div className="text-[11px] font-bold flex gap-2">
                                        <span className="text-blue-600">👨 {sub.male}</span>
                                        <span className="text-pink-600">👩 {sub.female}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION B: DESIGNATION VIEW */}
              {activeView === 'designation' && (
                <div className="space-y-6">
                  {/* Ranked Designations Chart */}
                  <div className="card-glass p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-amber-600" /> Ranked Designations by Workforce Count
                        </h3>
                        <p className="text-xs text-[#777] font-medium mt-0.5">Top employee designations across the entire organization</p>
                      </div>
                      <button
                        onClick={() => setShowAllDesigs(v => !v)}
                        className="text-xs font-black text-[#C9952A] hover:underline"
                      >
                        {showAllDesigs ? 'Show Top 10 Only' : `Expand All (${desigAnalytics.length})`}
                      </button>
                    </div>

                    <div className="space-y-3 pt-2">
                      {displayedDesigs.map((des, index) => {
                        const pctWidth = (des.total / maxDesigCount) * 100;
                        return (
                          <div key={des.designation} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-[#1E2D4E] font-black">
                                <span className="text-[#888] font-normal mr-2">#{index + 1}</span>
                                {des.designation}
                              </span>
                              <span className="text-[#555]">
                                {des.total} employees <span className="text-[#888] font-normal">({des.companyWorkforcePct}% of company)</span>
                              </span>
                            </div>
                            <div className="h-5 bg-[#f1ede6] rounded-xl overflow-hidden relative" style={{ width: `${Math.max(pctWidth, 10)}%` }}>
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-[#1E2D4E] rounded-xl flex items-center justify-end pr-2 text-[10px] font-black text-white"
                                style={{ width: '100%' }}
                              >
                                👨{des.male} / 👩{des.female}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Designation Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {desigAnalytics.map(d => (
                      <div key={d.designation} className="card-glass p-4 rounded-2xl space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-black text-[#1E2D4E] text-sm">{d.designation}</h4>
                            <span className="text-[10px] text-[#888] font-bold">{d.companyWorkforcePct}% of total workforce</span>
                          </div>
                          <span className="text-xs font-black bg-[#1E2D4E] text-white px-2.5 py-1 rounded-xl">
                            {d.total}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-[#F9F7F4] p-2.5 rounded-xl border border-[#e2dfd7] text-center">
                          <div>
                            <span className="text-[10px] text-[#888] font-bold uppercase block">Male</span>
                            <span className="text-sm font-black text-blue-600">{d.male} <span className="text-[10px] text-[#666]">({d.malePct}%)</span></span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#888] font-bold uppercase block">Female</span>
                            <span className="text-sm font-black text-pink-600">{d.female} <span className="text-[10px] text-[#666]">({d.femalePct}%)</span></span>
                          </div>
                        </div>

                        {d.departments.length > 0 && (
                          <div className="text-[10.5px] text-[#666] font-medium">
                            <span className="font-bold text-[#1E2D4E]">Depts: </span>
                            {d.departments.map(dp => `${dp.department} (${dp.count})`).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION C: GENDER & COMPOSITION VIEW */}
              {activeView === 'gender' && (
                <div className="space-y-6">
                  {/* Department Gender Heatmap Matrix */}
                  <div className="card-glass p-5 space-y-4">
                    <div>
                      <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" /> Department Gender Ratio Heatmap Matrix
                      </h3>
                      <p className="text-xs text-[#777] font-medium mt-0.5">Intensity matrix comparing gender balances across all departments</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-[#1E2D4E] text-white">
                            <th className="p-3 font-black rounded-tl-xl">Department</th>
                            <th className="p-3 font-black text-center">Male Employees</th>
                            <th className="p-3 font-black text-center">Female Employees</th>
                            <th className="p-3 font-black text-center rounded-tr-xl">Total Employees</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2dfd7]">
                          {heatmap.map(h => {
                            const maleIntensity = Math.min(1, h.male / (maxDeptCount || 1));
                            const femaleIntensity = Math.min(1, h.female / (maxDeptCount || 1));

                            return (
                              <tr key={h.department} className="hover:bg-white/80 transition-colors">
                                <td className="p-3 font-black text-[#1E2D4E]">{h.department}</td>
                                <td
                                  className="p-3 font-bold text-center text-blue-900"
                                  style={{ backgroundColor: `rgba(59, 130, 246, ${Math.max(0.08, maleIntensity * 0.4)})` }}
                                >
                                  {h.male}
                                </td>
                                <td
                                  className="p-3 font-bold text-center text-pink-900"
                                  style={{ backgroundColor: `rgba(236, 72, 153, ${Math.max(0.08, femaleIntensity * 0.4)})` }}
                                >
                                  {h.female}
                                </td>
                                <td className="p-3 font-black text-center text-[#1E2D4E] bg-slate-100/50">
                                  {h.total}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Workforce Composition Categories */}
                  <div className="card-glass p-5 space-y-4">
                    <div>
                      <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" /> Workforce Category Composition
                      </h3>
                      <p className="text-xs text-[#777] font-medium mt-0.5">Functional organization breakdown across business divisions</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {composition.map(c => (
                        <div key={c.category} className="bg-white p-4 rounded-2xl border border-[#e2dfd7] space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-xs text-[#1E2D4E]">{c.category}</span>
                            <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg">{c.count}</span>
                          </div>
                          <div className="h-2 bg-[#f1ede6] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.pct}%` }} />
                          </div>
                          <span className="text-[10px] text-[#888] font-bold block text-right">{c.pct}% of workforce</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hiring Growth Timeline */}
                  <div className="card-glass p-5 space-y-4">
                    <div>
                      <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#C9952A]" /> Employee Hiring Growth Timeline
                      </h3>
                      <p className="text-xs text-[#777] font-medium mt-0.5">Historical monthly joining volume and gender ratios</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {hiringTrends.map(t => (
                        <div key={t.ym} className="bg-white p-3 rounded-xl border border-[#e2dfd7] text-center space-y-1">
                          <span className="text-[10px] font-black text-[#888] block uppercase">{t.label}</span>
                          <span className="text-lg font-black text-[#1E2D4E] block">{t.total}</span>
                          <div className="text-[10px] font-bold text-[#555] flex justify-center gap-1.5">
                            <span className="text-blue-600">👨{t.male}</span>
                            <span className="text-pink-600">👩{t.female}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DETAILED ANALYTICS TABLE */}
              <div className="card-glass p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#1E2D4E]" /> Detailed Employee Analytics Table
                    </h3>
                    <p className="text-xs text-[#777] font-medium mt-0.5">
                      Showing {filteredEmployees.length} matching employee record(s)
                    </p>
                  </div>
                  <button
                    onClick={handleExportFullReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Filtered Table
                  </button>
                </div>

                <div className="overflow-x-auto border border-[#e2dfd7] rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-[#1E2D4E] text-white font-black">
                        <th className="p-3">App No</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Gender</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Section</th>
                        <th className="p-3">Designation</th>
                        <th className="p-3">Date of Joining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7] bg-white">
                      {filteredEmployees.slice(0, 100).map(e => (
                        <tr key={e.appNo} className="hover:bg-[#F9F7F4] transition-colors">
                          <td className="p-3 font-mono font-bold text-[#555]">{e.appNo}</td>
                          <td className="p-3 font-black text-[#1E2D4E]">{e.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${e.gender === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                              {e.gender}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-[#333]">{e.department}</td>
                          <td className="p-3 text-[#666]">{e.section}</td>
                          <td className="p-3 font-bold text-[#1E2D4E]">{e.designation}</td>
                          <td className="p-3 font-semibold text-[#555]">{fmtDate(e.doj)}</td>
                        </tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[#888] font-bold">
                            No employees match the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredEmployees.length > 100 && (
                  <p className="text-[11px] text-center text-[#888] font-semibold">
                    Showing top 100 records. Export to CSV to view all {filteredEmployees.length} records.
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
