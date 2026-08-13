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
  Printer, FileSpreadsheet, FileText, CheckCircle2, Award, AlertTriangle,
  X, Phone, CheckSquare, ShieldCheck, Eye, ArrowRight, ArrowUpDown
} from 'lucide-react';

// ─── Approved Departments Whitelist ───────────────────────────────────────────
const APPROVED_DEPARTMENTS = [
  'Mens',
  'Ladies',
  'Kids',
  'Ground Floor Saree',
  'First Floor Saree',
  'Art & Raw Silk Saree',
  'Home Furnishing',
  'Others',
];

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface EmployeeRecord {
  appNo: string;
  empId?: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  gender: string;
  department: string;
  rawDepartment?: string;
  section: string;
  designation: string;
  doj: string;
  status?: string;
}

interface OverviewData {
  totalEmployees: number;
  totalDepartments: number;
  totalDesignations: number;
  totalMale: number;
  totalFemale: number;
  malePct: number;
  femalePct: number;
  avgEmployeesPerDept: number;
  largestDepartment: { name: string; total: number; male: number; female: number };
  largestDesignation: { name: string; total: number };
  allRecordsCount?: number;
  unverifiedCount?: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
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

// ─── Department Employee Verification Drawer ──────────────────────────────────
function DepartmentDrawer({
  department,
  initialDesignation = '',
  employees,
  onClose
}: {
  department: string;
  initialDesignation?: string;
  employees: EmployeeRecord[];
  onClose: () => void;
}) {
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedDesig, setSelectedDesig] = useState(initialDesignation);
  const [sortBy, setSortBy] = useState<'doj_desc' | 'doj_asc' | 'name_asc' | 'desig_asc'>('doj_desc');

  const deptEmployees = useMemo(() => {
    return employees.filter(e => e.department === department);
  }, [employees, department]);

  const maleCount = useMemo(() => deptEmployees.filter(e => e.gender === 'Male').length, [deptEmployees]);
  const femaleCount = useMemo(() => deptEmployees.filter(e => e.gender === 'Female').length, [deptEmployees]);

  const uniqueDesignations = useMemo(() => {
    const counts = new Map<string, number>();
    deptEmployees.forEach(e => {
      counts.set(e.designation, (counts.get(e.designation) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [deptEmployees]);

  const filteredList = useMemo(() => {
    let list = [...deptEmployees];
    if (selectedDesig) {
      list = list.filter(e => e.designation === selectedDesig);
    }
    if (drawerSearch.trim()) {
      const q = drawerSearch.trim().toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.appNo.toLowerCase().includes(q) ||
        (e.empId && e.empId.toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q)) ||
        e.designation.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'doj_desc') return (b.doj || '').localeCompare(a.doj || '');
      if (sortBy === 'doj_asc') return (a.doj || '').localeCompare(b.doj || '');
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'desig_asc') return a.designation.localeCompare(b.designation);
      return 0;
    });

    return list;
  }, [deptEmployees, selectedDesig, drawerSearch, sortBy]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:w-[540px] md:w-[620px] bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left border-l border-[#e2dfd7]">
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-[#1E2D4E] to-[#2a3f6e] p-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#C9952A]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#C9952A]">Department Verification Drawer</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-black tracking-tight leading-none">{department} Department</h2>
              <p className="text-white/70 text-xs font-semibold mt-1">Management Verification & Employee Directory Audit</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-white/10 text-white text-xs font-black border border-white/20">
                {deptEmployees.length} Total
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-200 text-xs font-black border border-blue-400/30">
                👨 {maleCount} Male
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-200 text-xs font-black border border-pink-400/30">
                👩 {femaleCount} Female
              </span>
            </div>
          </div>

          {/* Designation Hierarchy Filter Pills */}
          {uniqueDesignations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/15">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/60 mb-2">Designation Drill-down Filter</div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedDesig('')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex-shrink-0 ${!selectedDesig ? 'bg-[#C9952A] text-white shadow-md' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>
                  All ({deptEmployees.length})
                </button>
                {uniqueDesignations.map(([desig, count]) => (
                  <button
                    key={desig}
                    onClick={() => setSelectedDesig(selectedDesig === desig ? '' : desig)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex-shrink-0 flex items-center gap-1 ${selectedDesig === desig ? 'bg-[#C9952A] text-white shadow-md ring-2 ring-white/50' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>
                    <span>{desig}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Controls Bar */}
        <div className="p-4 bg-[#F9F7F4] border-b border-[#e2dfd7] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={drawerSearch}
              onChange={e => setDrawerSearch(e.target.value)}
              placeholder="Search employee name, app no, ID, phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
            />
            {drawerSearch && (
              <button onClick={() => setDrawerSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#1E2D4E]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs font-bold text-[#666]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#C9952A]" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]">
              <option value="doj_desc">DOJ (Newest First)</option>
              <option value="doj_asc">DOJ (Oldest First)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="desig_asc">Designation</option>
            </select>
          </div>
        </div>

        {/* Employee Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f6f4f0]/50">
          {filteredList.length === 0 ? (
            <div className="text-center py-16 text-[#888]">
              <Users className="w-12 h-12 text-[#ccc] mx-auto mb-3" />
              <p className="font-bold text-sm text-[#555]">No employees matching filter criteria</p>
              <p className="text-xs text-[#888] mt-1">Try resetting search or designation filter</p>
            </div>
          ) : (
            filteredList.map((emp, idx) => {
              const photo = fileUrl(emp.photoUrl);
              return (
                <div
                  key={emp.appNo + '_' + idx}
                  className="card-glass p-3.5 rounded-2xl border border-[#e2dfd7] bg-white hover:shadow-md transition-all flex items-center gap-3.5">
                  {photo ? (
                    <img src={photo} alt={emp.name} className="w-12 h-12 rounded-xl object-cover border border-[#e2dfd7] flex-shrink-0 shadow-xs" onError={e => { (e.target as any).style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-center text-white font-black text-base shadow-xs flex-shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-black text-[#1E2D4E] text-sm truncate">
                        <HighlightMatch text={emp.name} query={drawerSearch} />
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${emp.gender === 'Female' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {emp.gender}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#666] flex-wrap">
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-[#1E2D4E]">
                        App: <HighlightMatch text={emp.appNo} query={drawerSearch} />
                      </span>
                      <span className="font-bold text-[#1E2D4E] truncate">
                        <HighlightMatch text={emp.designation} query={drawerSearch} />
                      </span>
                      <span className="text-[#888]">·</span>
                      <span className="font-medium text-[#777] truncate">{emp.section || 'General'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-[10.5px]">
                      <div className="flex items-center gap-1 text-[#555] font-semibold">
                        <Phone className="w-3 h-3 text-[#C9952A]" />
                        <span><HighlightMatch text={emp.phone || '—'} query={drawerSearch} /></span>
                      </div>
                      <div className="flex items-center gap-1 text-[#555] font-semibold">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        <span>DOJ: {fmtDate(emp.doj)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-white border-t border-[#e2dfd7] flex items-center justify-between text-xs font-bold text-[#666] flex-shrink-0">
          <span>Showing {filteredList.length} of {deptEmployees.length} employees</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white font-black hover:bg-[#162340] transition-colors">
            Done Verifying
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Data Verification Drawer for Unverified Records ──────────────────────────
function UnverifiedVerificationDrawer({
  unverifiedList,
  onClose
}: {
  unverifiedList: EmployeeRecord[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return unverifiedList;
    const q = search.toLowerCase();
    return unverifiedList.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.appNo.toLowerCase().includes(q) ||
      (e.rawDepartment && e.rawDepartment.toLowerCase().includes(q)) ||
      e.designation.toLowerCase().includes(q)
    );
  }, [unverifiedList, search]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:w-[500px] bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left border-l border-[#e2dfd7]">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-200" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-100">Data Verification Panel</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-xl font-black">Records Requiring Verification</h2>
          <p className="text-amber-100 text-xs font-medium mt-1">
            {unverifiedList.length} employees with raw/unassigned department entries requiring department assignment in Employee Directory
          </p>
        </div>

        <div className="p-3 bg-[#F9F7F4] border-b border-[#e2dfd7]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search unverified employees..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-semibold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f7f4]">
          {filtered.map((emp, idx) => (
            <div key={emp.appNo + '_' + idx} className="card-glass p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-[#1E2D4E] text-sm">{emp.name}</h4>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-800 text-[10px] font-black">
                  Raw: {emp.rawDepartment || emp.department}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-[#555]">
                <div>App No: <span className="font-mono font-bold text-[#1E2D4E]">{emp.appNo}</span></div>
                <div>Designation: <span className="font-bold text-[#1E2D4E]">{emp.designation}</span></div>
                <div>Section: <span className="font-semibold">{emp.section}</span></div>
                <div>DOJ: <span className="font-semibold">{fmtDate(emp.doj)}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-[#e2dfd7] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white font-black text-xs">
            Close Panel
          </button>
        </div>
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
  const [insights, setInsights] = useState<string[]>([]);
  const [rawEmployees, setRawEmployees] = useState<EmployeeRecord[]>([]);
  const [unverifiedEmployees, setUnverifiedEmployees] = useState<EmployeeRecord[]>([]);

  // Selected Department Drawer State
  const [activeDeptDrawer, setActiveDeptDrawer] = useState<string | null>(null);
  const [drawerDesignationFilter, setDrawerDesignationFilter] = useState('');

  // Unverified Audit Panel Drawer State
  const [showUnverifiedDrawer, setShowUnverifiedDrawer] = useState(false);

  // Header Filters
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
        setInsights(res.executiveInsights || []);
        setRawEmployees(res.rawEmployees || []);
        setUnverifiedEmployees(res.unverifiedEmployees || []);
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

  // Filtered employees dataset based on header filters
  const filteredEmployees = useMemo(() => {
    let list = [...rawEmployees];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.appNo.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        (e.phone && e.phone.includes(q))
      );
    }
    if (filterDept) list = list.filter(e => e.department === filterDept);
    if (filterDesig) list = list.filter(e => e.designation === filterDesig);
    if (filterGender) list = list.filter(e => e.gender === filterGender);
    if (filterSection) list = list.filter(e => e.section === filterSection);
    if (filterMonth) list = list.filter(e => (e.doj || '').startsWith(filterMonth));
    return list;
  }, [rawEmployees, search, filterDept, filterDesig, filterGender, filterSection, filterMonth]);

  // Unique options for filter dropdowns
  const uniqueDepts = APPROVED_DEPARTMENTS;
  const uniqueDesigs = useMemo(() => [...new Set(rawEmployees.map(e => e.designation).filter(Boolean))].sort(), [rawEmployees]);
  const uniqueSections = useMemo(() => [...new Set(rawEmployees.map(e => e.section).filter(Boolean))].sort(), [rawEmployees]);

  // Export functions
  const exportToCSV = (filename: string, rows: any[]) => {
    if (!rows || !rows.length) {
      showToast('No data available to export', 'error');
      return;
    }
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
      Phone: e.phone || 'N/A',
      DOJ: e.doj || 'N/A',
    }));
    exportToCSV('Full_Employee_Workforce_Report', data);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const openDepartmentDrawer = (deptName: string, desigName: string = '') => {
    setActiveDeptDrawer(deptName);
    setDrawerDesignationFilter(desigName);
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#1E2D4E] flex flex-col font-sans">
      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />

      <div className="lg:pl-64 flex-1 flex flex-col">
        <Topbar session={session} onMenuClick={() => setSidebarOpen(true)} title="Workforce Analytics V2" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Workforce Analytics' }]} />

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#e2dfd7] shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C9952A]">
                <ShieldCheck className="w-4 h-4" />
                <span>Management Verification Dashboard</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E2D4E] tracking-tight mt-1">
                Employee Workforce Analytics V2
              </h1>
              <p className="text-xs text-[#777] font-semibold mt-1">
                Interactive department drill-down, designation hierarchy, and workforce data verification
              </p>
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowFilterBar(b => !b)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black border transition-all flex items-center gap-2 ${showFilterBar ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#1E2D4E] border-[#e2dfd7] hover:border-[#1E2D4E]'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {(filterDept || filterDesig || filterGender || filterSection || filterMonth) && (
                  <span className="w-2 h-2 rounded-full bg-[#C9952A]" />
                )}
              </button>

              <div className="relative group">
                <button className="px-4 py-2 rounded-2xl bg-[#1E2D4E] text-white text-xs font-black hover:bg-[#162340] transition-colors flex items-center gap-2 shadow-md">
                  <Download className="w-3.5 h-3.5" />
                  Export Reports
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-2xl shadow-xl border border-[#e2dfd7] p-2 hidden group-hover:block z-30">
                  <button onClick={handleExportDepartmentReport} className="w-full text-left px-3 py-2 text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] rounded-xl flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Dept Summary (CSV)
                  </button>
                  <button onClick={handleExportDesignationReport} className="w-full text-left px-3 py-2 text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] rounded-xl flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Designation Summary
                  </button>
                  <button onClick={handleExportFullReport} className="w-full text-left px-3 py-2 text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] rounded-xl flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#C9952A]" /> Full Employee List
                  </button>
                  <button onClick={handlePrintPDF} className="w-full text-left px-3 py-2 text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] rounded-xl flex items-center gap-2 border-t border-[#e2dfd7] mt-1 pt-2">
                    <Printer className="w-3.5 h-3.5 text-purple-600" /> Print Management PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filter Bar (Collapsible) */}
          {showFilterBar && (
            <div className="bg-white p-4 rounded-3xl border border-[#e2dfd7] shadow-xs space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#777]">Interactive Data Filters</span>
                {(filterDept || filterDesig || filterGender || filterSection || filterMonth || search) && (
                  <button
                    onClick={() => {
                      setFilterDept('');
                      setFilterDesig('');
                      setFilterGender('');
                      setFilterSection('');
                      setFilterMonth('');
                      setSearch('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Reset All Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, app, phone..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                  />
                </div>

                {/* Department Filter */}
                <select
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]">
                  <option value="">All Approved Depts</option>
                  {uniqueDepts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Designation Filter */}
                <select
                  value={filterDesig}
                  onChange={e => setFilterDesig(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]">
                  <option value="">All Designations</option>
                  {uniqueDesigs.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Gender Filter */}
                <select
                  value={filterGender}
                  onChange={e => setFilterGender(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]">
                  <option value="">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>

                {/* Section Filter */}
                <select
                  value={filterSection}
                  onChange={e => setFilterSection(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]">
                  <option value="">All Sections</option>
                  {uniqueSections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Joining Month Filter */}
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>
            </div>
          )}

          {/* 10 Management KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2.5">
            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="flex items-center justify-between text-[#1E2D4E]">
                <Users className="w-4 h-4 text-[#1E2D4E]" />
              </div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{overview?.totalEmployees || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Total Employees</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="flex items-center justify-between text-[#C9952A]">
                <Building2 className="w-4 h-4 text-[#C9952A]" />
              </div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{overview?.totalDepartments || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Approved Depts</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="flex items-center justify-between text-indigo-600">
                <Briefcase className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{overview?.totalDesignations || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Designations</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-blue-50/60 border border-blue-200">
              <div className="flex items-center justify-between text-blue-700">
                <User className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-blue-900 mt-1">{overview?.totalMale || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-blue-700 mt-0.5 truncate">Male Employees</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-pink-50/60 border border-pink-200">
              <div className="flex items-center justify-between text-pink-700">
                <User className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-pink-900 mt-1">{overview?.totalFemale || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-pink-700 mt-0.5 truncate">Female Employees</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="text-xl font-black text-blue-700 mt-1">{overview?.malePct || 0}%</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Male %</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="text-xl font-black text-pink-700 mt-1">{overview?.femalePct || 0}%</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Female %</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-white border border-[#e2dfd7]">
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{overview?.avgEmployeesPerDept || 0}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[#888] mt-0.5 truncate">Avg / Dept</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-amber-50/60 border border-amber-200">
              <div className="text-xs font-black text-amber-900 truncate mt-1">{overview?.largestDepartment?.name || '—'}</div>
              <div className="text-[10px] font-bold text-amber-700">{overview?.largestDepartment?.total || 0} emps</div>
              <div className="text-[8.5px] font-black uppercase tracking-wider text-amber-800 mt-0.5 truncate">Largest Dept</div>
            </div>

            <div className="card-glass rounded-2xl p-3 bg-purple-50/60 border border-purple-200">
              <div className="text-xs font-black text-purple-900 truncate mt-1">{overview?.largestDesignation?.name || '—'}</div>
              <div className="text-[10px] font-bold text-purple-700">{overview?.largestDesignation?.total || 0} emps</div>
              <div className="text-[8.5px] font-black uppercase tracking-wider text-purple-800 mt-0.5 truncate">Top Designation</div>
            </div>
          </div>

          {/* Data Verification Alert Banner (if unverified records exist) */}
          {unverifiedEmployees.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-amber-900 text-sm">
                    {unverifiedEmployees.length} Employee Record{unverifiedEmployees.length > 1 ? 's' : ''} Require Department Verification
                  </h3>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    Unassigned or non-standard raw department values detected. Isolated from approved workforce analytics.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnverifiedDrawer(true)}
                className="px-4 py-2 rounded-2xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-md">
                <Eye className="w-3.5 h-3.5" />
                Audit Unverified Data
              </button>
            </div>
          )}

          {/* SECTION 1: Department Workforce Cards (Premium Replace Plain Charts) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1E2D4E] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#C9952A]" />
                  Approved Department Workforce Cards
                </h2>
                <p className="text-xs text-[#777] font-semibold mt-0.5">
                  Click any department card to verify exact employee list & designation hierarchy
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {deptAnalytics.map(dept => {
                return (
                  <div
                    key={dept.department}
                    onClick={() => openDepartmentDrawer(dept.department)}
                    className="card-glass p-5 rounded-3xl border border-[#e2dfd7] bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-black text-[#1E2D4E] text-base group-hover:text-[#C9952A] transition-colors">
                          {dept.department}
                        </h3>
                        <span className="px-2.5 py-1 rounded-xl bg-[#1E2D4E]/5 text-[#1E2D4E] text-xs font-black border border-[#1E2D4E]/10">
                          {dept.companyWorkforcePct}% share
                        </span>
                      </div>

                      <div className="text-3xl font-black text-[#1E2D4E] tracking-tight">
                        {dept.total} <span className="text-xs font-bold text-[#888] uppercase tracking-wider">employees</span>
                      </div>

                      {/* Male / Female breakdown row */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#e2dfd7]/60">
                        <div className="bg-blue-50/80 rounded-xl p-2 text-center border border-blue-100">
                          <span className="text-[10px] font-black uppercase text-blue-700 block">Male</span>
                          <span className="text-sm font-black text-blue-900">{dept.male}</span>
                          <span className="text-[9.5px] font-semibold text-blue-600 block">({dept.malePct}%)</span>
                        </div>
                        <div className="bg-pink-50/80 rounded-xl p-2 text-center border border-pink-100">
                          <span className="text-[10px] font-black uppercase text-pink-700 block">Female</span>
                          <span className="text-sm font-black text-pink-900">{dept.female}</span>
                          <span className="text-[9.5px] font-semibold text-pink-600 block">({dept.femalePct}%)</span>
                        </div>
                      </div>

                      {/* Gender Ratio Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] font-bold text-[#777] mb-1">
                          <span>Gender Ratio</span>
                          <span>{dept.malePct}% M / {dept.femalePct}% F</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-pink-200 overflow-hidden flex">
                          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${dept.malePct}%` }} />
                          <div className="h-full bg-pink-500 transition-all duration-700" style={{ width: `${dept.femalePct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-[#e2dfd7] flex items-center justify-between text-xs font-black text-[#C9952A] group-hover:translate-x-1 transition-transform">
                      <span>View Employees</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Interactive Charts (Distribution & Gender Comparison) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Horizontal Bar Chart: Department Workforce Distribution */}
            <div className="card-glass p-5 rounded-3xl border border-[#e2dfd7] bg-white space-y-4">
              <div>
                <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#1E2D4E]" />
                  Department Workforce Distribution (Clickable)
                </h3>
                <p className="text-xs text-[#777] font-semibold mt-0.5">
                  Click any department bar to launch employee verification
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {deptAnalytics.map(d => {
                  const maxTotal = deptAnalytics[0]?.total || 1;
                  const barWidth = Math.max((d.total / maxTotal) * 100, 8);
                  return (
                    <div
                      key={d.department}
                      onClick={() => openDepartmentDrawer(d.department)}
                      className="group cursor-pointer">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-[#1E2D4E] group-hover:text-[#C9952A] transition-colors">{d.department}</span>
                        <span className="font-black text-[#1E2D4E]">{d.total} employees ({d.companyWorkforcePct}%)</span>
                      </div>
                      <div className="w-full h-7 rounded-xl bg-[#F4F1EA] overflow-hidden flex p-0.5 border border-[#e2dfd7]/60 group-hover:border-[#C9952A] transition-colors">
                        <div
                          className="h-full rounded-lg bg-gradient-to-r from-[#1E2D4E] to-[#2a3f6e] flex items-center justify-end px-2 text-[10.5px] font-black text-white transition-all duration-700"
                          style={{ width: `${barWidth}%` }}>
                          {d.total > 0 && d.total}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stacked Gender Comparison Chart */}
            <div className="card-glass p-5 rounded-3xl border border-[#e2dfd7] bg-white space-y-4">
              <div>
                <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-pink-600" />
                  Gender Composition Stacked Comparison
                </h3>
                <p className="text-xs text-[#777] font-semibold mt-0.5">
                  Male vs Female proportion across approved departments
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {deptAnalytics.map(d => (
                  <div key={d.department} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#1E2D4E]">
                      <span>{d.department}</span>
                      <span className="text-[11px] font-semibold">
                        <span className="text-blue-700 font-bold">{d.male} Male</span> / <span className="text-pink-700 font-bold">{d.female} Female</span>
                      </span>
                    </div>
                    <div className="w-full h-5 rounded-xl bg-slate-100 overflow-hidden flex border border-slate-200">
                      {d.total > 0 ? (
                        <>
                          <div className="h-full bg-blue-500 transition-all duration-700 flex items-center justify-center text-[9px] font-black text-white" style={{ width: `${d.malePct}%` }}>
                            {d.male > 0 && `${d.malePct}%`}
                          </div>
                          <div className="h-full bg-pink-500 transition-all duration-700 flex items-center justify-center text-[9px] font-black text-white" style={{ width: `${d.femalePct}%` }}>
                            {d.female > 0 && `${d.femalePct}%`}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[9px] text-[#888] font-bold">0 Employees</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: Designation Distribution Chart */}
          <div className="card-glass p-5 rounded-3xl border border-[#e2dfd7] bg-white space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-black text-[#1E2D4E] text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Top Designation Distribution
                </h3>
                <p className="text-xs text-[#777] font-semibold mt-0.5">
                  Click any designation to verify matching employees
                </p>
              </div>
              <span className="text-xs font-bold text-[#777]">Showing {desigAnalytics.length} Designations</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {desigAnalytics.map(des => (
                <div
                  key={des.designation}
                  onClick={() => {
                    const topDept = des.departments[0]?.department || rawEmployees.find(e => e.designation === des.designation)?.department || 'Mens';
                    openDepartmentDrawer(topDept, des.designation);
                  }}

                  className="card-glass p-3.5 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] hover:border-[#1E2D4E] hover:bg-white transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-[#1E2D4E] text-xs group-hover:text-[#C9952A] transition-colors truncate">
                      {des.designation}
                    </h4>
                    <span className="px-2 py-0.5 rounded-lg bg-[#1E2D4E] text-white text-[10.5px] font-black">
                      {des.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#777] mt-2 pt-2 border-t border-[#e2dfd7]">
                    <span>{des.male} Male / {des.female} Female</span>
                    <span className="font-bold text-[#C9952A] group-hover:translate-x-0.5 transition-transform">Verify &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Interactive Department Employee Drawer */}
      {activeDeptDrawer && (
        <DepartmentDrawer
          department={activeDeptDrawer}
          initialDesignation={drawerDesignationFilter}
          employees={filteredEmployees}
          onClose={() => setActiveDeptDrawer(null)}
        />
      )}

      {/* Unverified Audit Drawer */}
      {showUnverifiedDrawer && (
        <UnverifiedVerificationDrawer
          unverifiedList={unverifiedEmployees}
          onClose={() => setShowUnverifiedDrawer(false)}
        />
      )}
    </div>
  );
}
