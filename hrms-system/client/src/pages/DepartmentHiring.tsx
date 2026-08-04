import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import ManageSectionsModal from '../components/ManageSectionsModal';
import { BSC_DEPARTMENT_SECTIONS, BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';
import { 
  Building2, 
  Search, 
  Filter, 
  Edit3, 
  Save, 
  X, 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function DepartmentHiringPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<string, { required: number; target: number; remarks: string }>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [dbSections, setDbSections] = useState<any[]>([]);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);

  // Filter States
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedDesig, setSelectedDesig] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEmpType, setSelectedEmpType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Edit Modal State
  const [editModal, setEditModal] = useState<{
    open: boolean;
    rowKey: string;
    department: string;
    section: string;
    designation: string;
    required: number;
    target: number;
    remarks: string;
  }>({
    open: false,
    rowKey: '',
    department: '',
    section: '',
    designation: '',
    required: 10,
    target: 10,
    remarks: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, eRes, sRes] = await Promise.all([
        API.getHiringTargets(),
        API.getEmployees(),
        API.getDepartmentSections()
      ]);

      if (tRes && tRes.targets) {
        const targetMap: Record<string, { required: number; target: number; remarks: string }> = {};
        tRes.targets.forEach((t: any) => {
          const key = `${t.department}||${t.section}||${t.designation}`;
          targetMap[key] = {
            required: t.required_openings || 10,
            target: t.hiring_target || 10,
            remarks: t.remarks || ''
          };
        });
        setTargets(targetMap);
      }

      if (eRes && Array.isArray(eRes)) {
        setEmployees(eRes);
      } else if (eRes && eRes.employees) {
        setEmployees(eRes.employees);
      }

      if (sRes && sRes.sections) {
        setDbSections(sRes.sections);
      }
    } catch (err: any) {
      console.warn('Load Department Hiring data warning:', err.message);
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
    loadData();
  }, [navigate, loadData]);

  // Combined DB & default sections map
  const activeDeptSectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    BSC_DEPARTMENTS.forEach(d => {
      map[d] = [...(BSC_DEPARTMENT_SECTIONS[d] || [])];
    });

    dbSections.forEach(s => {
      if (s.department && s.section_name) {
        if (!map[s.department]) map[s.department] = [];
        if (!map[s.department].includes(s.section_name)) {
          map[s.department].push(s.section_name);
        }
      }
    });

    return map;
  }, [dbSections]);

  // Generate complete table data across BSC TEXTILES departments and sections
  const fullTableData = useMemo(() => {
    const defaultDesignations = ['Floor Manager', 'Section Supervisor', 'Senior Sales Staff', 'Junior Sales Staff', 'Billing Cashier', 'Trainee / Helper'];

    const rows: Array<{
      key: string;
      department: string;
      section: string;
      designation: string;
      required: number;
      joined: number;
      remaining: number;
      percentage: number;
      status: 'Completed' | 'Almost Full' | 'Hiring in Progress' | 'Vacant';
      remarks: string;
      updatedAt: string;
    }> = [];

    const countMap: Record<string, number> = {};
    employees.forEach(emp => {
      const dept = emp.department || 'Mens';
      const sec = emp.section || (activeDeptSectionsMap[dept] ? activeDeptSectionsMap[dept][0] : 'General');
      const desig = emp.desig || emp.designation || 'Sales Staff';

      const exactKey = `${dept}||${sec}||${desig}`;
      countMap[exactKey] = (countMap[exactKey] || 0) + 1;

      const fallbackKey = `${dept}||${desig}`;
      countMap[fallbackKey] = (countMap[fallbackKey] || 0) + 1;
    });

    Object.keys(activeDeptSectionsMap).forEach(dept => {
      const sections = activeDeptSectionsMap[dept] || ['General'];
      sections.forEach(sec => {
        const desigs = defaultDesignations.slice(0, 3);
        desigs.forEach(desig => {
          const rowKey = `${dept}||${sec}||${desig}`;
          const customTarget = targets[rowKey];

          const req = customTarget ? customTarget.required : 10;
          const joinedCount = countMap[rowKey] || Math.min(req, (countMap[`${dept}||${desig}`] || 0));
          const remaining = Math.max(0, req - joinedCount);
          const pct = req > 0 ? Math.round((joinedCount / req) * 100) : 0;

          let status: 'Completed' | 'Almost Full' | 'Hiring in Progress' | 'Vacant' = 'Hiring in Progress';
          if (pct >= 100) status = 'Completed';
          else if (pct >= 75) status = 'Almost Full';
          else if (pct > 0) status = 'Hiring in Progress';
          else status = 'Vacant';

          rows.push({
            key: rowKey,
            department: dept,
            section: sec,
            designation: desig,
            required: req,
            joined: joinedCount,
            remaining,
            percentage: pct,
            status,
            remarks: customTarget?.remarks || 'Active hiring drive',
            updatedAt: 'Today'
          });
        });
      });
    });

    return rows;
  }, [targets, employees, activeDeptSectionsMap]);

  // Section options dependent on selected Department
  const sectionOptions = useMemo(() => {
    if (selectedDept === 'All') {
      const allSecs = new Set<string>();
      Object.values(activeDeptSectionsMap).forEach(list => list.forEach(s => allSecs.add(s)));
      return Array.from(allSecs);
    }
    return activeDeptSectionsMap[selectedDept] || [];
  }, [selectedDept, activeDeptSectionsMap]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return fullTableData.filter(row => {
      if (selectedDept !== 'All' && row.department !== selectedDept) return false;
      if (selectedSection !== 'All' && row.section !== selectedSection) return false;
      if (selectedDesig !== 'All' && row.designation !== selectedDesig) return false;
      if (selectedStatus !== 'All' && row.status !== selectedStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = row.department.toLowerCase().includes(q) || 
                        row.section.toLowerCase().includes(q) || 
                        row.designation.toLowerCase().includes(q) ||
                        row.remarks.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [fullTableData, selectedDept, selectedSection, selectedDesig, selectedStatus, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const depts = new Set(filteredRows.map(r => r.department)).size;
    const totalRequired = filteredRows.reduce((sum, r) => sum + r.required, 0);
    const totalJoined = filteredRows.reduce((sum, r) => sum + r.joined, 0);
    const totalRemaining = filteredRows.reduce((sum, r) => sum + r.remaining, 0);
    const overallPct = totalRequired > 0 ? Math.round((totalJoined / totalRequired) * 100) : 0;

    return {
      departmentsCount: depts,
      totalRequired,
      totalJoined,
      totalRemaining,
      overallPct
    };
  }, [filteredRows]);

  // Chart Data: Department-wise Required vs Joined
  const deptChartData = useMemo(() => {
    const map: Record<string, { department: string; required: number; joined: number }> = {};
    filteredRows.forEach(r => {
      if (!map[r.department]) {
        map[r.department] = { department: r.department, required: 0, joined: 0 };
      }
      map[r.department].required += r.required;
      map[r.department].joined += r.joined;
    });
    return Object.values(map);
  }, [filteredRows]);

  // Save Target Edit
  const handleSaveEdit = async () => {
    try {
      const res = await API.saveHiringTarget({
        department: editModal.department,
        section: editModal.section,
        designation: editModal.designation,
        requiredOpenings: editModal.required,
        hiringTarget: editModal.target,
        remarks: editModal.remarks
      });

      if (res && res.success !== false) {
        showToast('Hiring target updated successfully', 'success');
        setTargets(prev => ({
          ...prev,
          [editModal.rowKey]: {
            required: editModal.required,
            target: editModal.target,
            remarks: editModal.remarks
          }
        }));
        setEditModal(prev => ({ ...prev, open: false }));
      } else {
        showToast(res.error || 'Failed to update hiring target', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Save error', 'error');
    }
  };

  const isHR = session?.role === 'HR' || session?.role === 'Admin' || session?.role === 'Super Admin';

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
          title="Department Hiring Status" 
          breadcrumbs={[{ label: 'Talent Management' }, { label: 'Department Hiring Status' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#C9952A]" />
                <span>BSC Textiles - Hiring Progress Monitor</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">
                Department-wise, section-wise and designation-wise required vs filled workforce metrics.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isHR && (
                <button
                  onClick={() => setManageSectionsOpen(true)}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Manage Sections</span>
                </button>
              )}
              <button
                onClick={() => navigate('/openings')}
                className="btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>Manpower Requisitions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Active Departments"
              value={summary.departmentsCount}
              subtext="BSC Textiles sections"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Total Openings"
              value={summary.totalRequired}
              subtext="Required workforce target"
              icon={Layers}
              color="navy"
            />
            <MetricCard
              title="Filled Positions"
              value={summary.totalJoined}
              subtext="Successfully onboarded"
              icon={CheckCircle2}
              color="emerald"
            />
            <MetricCard
              title="Remaining Positions"
              value={summary.totalRemaining}
              subtext="Pending recruitment"
              icon={Clock}
              color="rose"
            />
            <MetricCard
              title="Overall Hiring %"
              value={`${summary.overallPct}%`}
              subtext="Fill rate completion"
              icon={TrendingUp}
              color="indigo"
            />
          </div>

          {/* Filter Bar */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-2.5">
              <div className="text-xs font-black text-[#1E2D4E] uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#C9952A]" />
                <span>Filter Department Hiring Status</span>
              </div>
              <span className="text-[11px] text-[#777777] font-semibold">
                Showing {filteredRows.length} section positions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Department */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => { setSelectedDept(e.target.value); setSelectedSection('All'); }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                >
                  <option value="All">All Departments</option>
                  {BSC_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Section</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                >
                  <option value="All">All Sections</option>
                  {sectionOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Designation</label>
                <select
                  value={selectedDesig}
                  onChange={(e) => setSelectedDesig(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                >
                  <option value="All">All Designations</option>
                  <option value="Floor Manager">Floor Manager</option>
                  <option value="Section Supervisor">Section Supervisor</option>
                  <option value="Senior Sales Staff">Senior Sales Staff</option>
                  <option value="Junior Sales Staff">Junior Sales Staff</option>
                  <option value="Billing Cashier">Billing Cashier</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Hiring Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed (100%)</option>
                  <option value="Almost Full">Almost Full (75%+)</option>
                  <option value="Hiring in Progress">Hiring in Progress</option>
                  <option value="Vacant">Vacant (0%)</option>
                </select>
              </div>

              {/* Employment Type */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Employment Type</label>
                <select
                  value={selectedEmpType}
                  onChange={(e) => setSelectedEmpType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                >
                  <option value="All">All Types</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Trainee">Trainee</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dept, section..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Department Hiring Progress Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight">Department &amp; Section Hiring Breakdown</h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">Real-time required vs filled staff position targets.</p>
              </div>
              {isHR && (
                <div className="text-xs text-[#777777] font-semibold bg-[#F9F7F4] px-3 py-1 rounded-full border border-[#e2dfd7]">
                  💡 Click <span className="font-bold text-[#1E2D4E]">Edit</span> to adjust hiring targets
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/60">
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Section</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4 text-center">Required</th>
                    <th className="py-3.5 px-4 text-center">Filled</th>
                    <th className="py-3.5 px-4 text-center">Remaining</th>
                    <th className="py-3.5 px-4 w-60">Hiring Progress</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => {
                      let badgeColor = 'blue';
                      if (row.status === 'Completed') badgeColor = 'green';
                      else if (row.status === 'Almost Full') badgeColor = 'gold';
                      else if (row.status === 'Vacant') badgeColor = 'red';

                      return (
                        <tr key={row.key} className="hover:bg-black/5 transition-colors font-medium">
                          <td className="py-3.5 px-4 font-black text-[#1E2D4E]">{row.department}</td>
                          <td className="py-3.5 px-4 font-bold text-[#C9952A]">{row.section}</td>
                          <td className="py-3.5 px-4 text-[#444444] font-semibold">{row.designation}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-[#1E2D4E]">{row.required}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-emerald-700">{row.joined}</td>
                          <td className="py-3.5 px-4 text-center font-extrabold text-rose-700">{row.remaining}</td>
                          
                          {/* Progress Bar Column */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-extrabold text-[#1E2D4E]">
                                <span>{row.joined} / {row.required} Filled</span>
                                <span>{row.percentage}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-[#e2dfd7] rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    row.percentage >= 100 ? 'bg-emerald-600' :
                                    row.percentage >= 75 ? 'bg-[#C9952A]' :
                                    row.percentage > 0 ? 'bg-sky-600' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(row.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <StatusBadge status={row.status} color={badgeColor} size="sm" />
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isHR ? (
                              <button
                                onClick={() => setEditModal({
                                  open: true,
                                  rowKey: row.key,
                                  department: row.department,
                                  section: row.section,
                                  designation: row.designation,
                                  required: row.required,
                                  target: row.required,
                                  remarks: row.remarks
                                })}
                                className="px-2.5 py-1 rounded-lg bg-[#1E2D4E]/10 text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white font-bold text-xs transition-colors flex items-center gap-1 ml-auto"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#888888]">View Only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-xs text-[#777777] font-semibold">
                        No matching department hiring records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Recharts Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dept Bar Chart */}
            <div className="card-glass p-5 space-y-4">
              <h3 className="font-extrabold text-[#1E2D4E] text-sm tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C9952A]" />
                <span>Department-Wise Required vs Filled Positions</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2dfd7" />
                    <XAxis dataKey="department" tick={{ fontSize: 10, fontWeight: 700, fill: '#1E2D4E' }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#1E2D4E' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1E2D4E', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar dataKey="required" name="Required Openings" fill="#1E2D4E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="joined" name="Filled Staff" fill="#C9952A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overall Progress Distribution Pie */}
            <div className="card-glass p-5 space-y-4">
              <h3 className="font-extrabold text-[#1E2D4E] text-sm tracking-tight flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-[#C9952A]" />
                <span>Hiring Status Distribution</span>
              </h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: filteredRows.filter(r => r.status === 'Completed').length, color: '#16a34a' },
                        { name: 'Almost Full', value: filteredRows.filter(r => r.status === 'Almost Full').length, color: '#d97706' },
                        { name: 'In Progress', value: filteredRows.filter(r => r.status === 'Hiring in Progress').length, color: '#0284c7' },
                        { name: 'Vacant', value: filteredRows.filter(r => r.status === 'Vacant').length, color: '#dc2626' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { color: '#16a34a' },
                        { color: '#d97706' },
                        { color: '#0284c7' },
                        { color: '#dc2626' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E2D4E', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Target Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#EDE8DE] rounded-2xl border border-[#e2dfd7] shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base">Edit Hiring Target</h3>
                <p className="text-xs text-[#777777] font-medium">
                  {editModal.department} · {editModal.section} ({editModal.designation})
                </p>
              </div>
              <button 
                onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full bg-[#1E2D4E]/10 hover:bg-[#1E2D4E] hover:text-white text-[#1E2D4E] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-[#1E2D4E]">
              <div>
                <label className="block text-[11px] font-black uppercase mb-1">Required Openings Target</label>
                <input
                  type="number"
                  min={1}
                  value={editModal.required}
                  onChange={(e) => setEditModal(prev => ({ ...prev, required: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-1">Hiring Target Remarks</label>
                <textarea
                  rows={3}
                  value={editModal.remarks}
                  onChange={(e) => setEditModal(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter target notes or urgency..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white font-medium text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
              <button
                onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] font-bold text-xs hover:bg-[#F9F7F4]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Hiring Target</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Manage Sections Modal */}
      <ManageSectionsModal
        isOpen={manageSectionsOpen}
        onClose={() => setManageSectionsOpen(false)}
        onSectionsUpdated={loadData}
      />
    </div>
  );
}
