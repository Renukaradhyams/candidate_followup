import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import { BSC_DEPARTMENT_SECTIONS, BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';
import { 
  Layers, 
  Users, 
  Search, 
  Filter, 
  Save, 
  X, 
  CheckSquare, 
  Square, 
  UserCheck, 
  Building2, 
  Calendar, 
  DollarSign, 
  Phone, 
  Mail, 
  FileText, 
  Briefcase, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function SectionAllocationPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedDesig, setSelectedDesig] = useState('All');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [joiningDateFilter, setJoiningDateFilter] = useState('');

  // Multi-select for Bulk Actions
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [bulkModal, setBulkModal] = useState<{ open: boolean; action: 'assign' | 'move' | 'remove'; section: string }>({
    open: false,
    action: 'assign',
    section: ''
  });

  // Employee Overview Centered Modal
  const [overviewModal, setOverviewModal] = useState<{ open: boolean; emp: any | null }>({
    open: false,
    emp: null
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eRes, aRes] = await Promise.all([
        API.getEmployees(),
        API.getSectionAllocations()
      ]);

      let empList: any[] = [];
      if (Array.isArray(eRes)) empList = eRes;
      else if (eRes && eRes.employees) empList = eRes.employees;

      setEmployees(empList);

      if (aRes && aRes.allocations) {
        const allocMap: Record<string, string> = {};
        aRes.allocations.forEach((a: any) => {
          if (a.employee_id) {
            allocMap[a.employee_id] = a.section || '';
          }
        });
        setAllocations(allocMap);
      }
    } catch (err: any) {
      console.warn('Load Section Allocation error:', err.message);
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

  // Combined employee rows with allocated section
  const formattedRows = useMemo(() => {
    return employees.map(emp => {
      const empId = String(emp.id || emp.appNo || emp.employeeCode || emp.app_no);
      const dept = emp.department || emp.dept || 'Mens';
      const allocatedSection = allocations[empId] || emp.section || '';

      return {
        ...emp,
        empId,
        appNo: emp.appNo || emp.app_no || empId,
        name: emp.name || emp.fullName || 'Employee',
        desig: emp.desig || emp.designation || 'Sales Executive',
        department: dept,
        section: allocatedSection,
        doj: emp.doj || emp.actualDoj || emp.offeredDoj || emp.date || '01-Jan-2026',
        salary: emp.salary || emp.offeredSalary || '₹25,000',
        status: emp.status || 'Active Staff',
        branch: emp.branch || 'Main Mall - MG Road',
        phone: emp.phone || emp.mobile || '+91 9876543210',
        email: emp.email || `${(emp.name || 'emp').toLowerCase().replace(/\s+/g, '.')}@bsctextiles.in`,
        initials: (emp.name || 'Emp').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
      };
    });
  }, [employees, allocations]);

  // Section Filter options dependent on selected Department
  const sectionFilterOptions = useMemo(() => {
    if (selectedDept === 'All') {
      const set = new Set<string>();
      Object.values(BSC_DEPARTMENT_SECTIONS).forEach(list => list.forEach(s => set.add(s)));
      return Array.from(set);
    }
    return getSectionsForDepartment(selectedDept);
  }, [selectedDept]);

  // Filtered Employee list
  const filteredEmployees = useMemo(() => {
    return formattedRows.filter(emp => {
      if (selectedDept !== 'All' && emp.department !== selectedDept) return false;
      if (selectedSection !== 'All' && emp.section !== selectedSection) return false;
      if (selectedDesig !== 'All' && emp.desig !== selectedDesig) return false;
      if (selectedBranch !== 'All' && emp.branch !== selectedBranch) return false;

      if (joiningDateFilter) {
        const fDate = new Date(joiningDateFilter).toDateString();
        const eDate = new Date(emp.doj).toDateString();
        if (fDate !== eDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = emp.empId.toLowerCase().includes(q) ||
                      emp.appNo.toLowerCase().includes(q) ||
                      emp.name.toLowerCase().includes(q) ||
                      emp.phone.includes(q) ||
                      emp.desig.toLowerCase().includes(q) ||
                      emp.department.toLowerCase().includes(q) ||
                      emp.section.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [formattedRows, selectedDept, selectedSection, selectedDesig, selectedBranch, joiningDateFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = filteredEmployees.length;
    const allocated = filteredEmployees.filter(e => Boolean(e.section && e.section.trim())).length;
    const notAllocated = total - allocated;
    const deptsCount = new Set(filteredEmployees.map(e => e.department)).size;

    const sectionsSet = new Set<string>();
    filteredEmployees.forEach(e => { if (e.section) sectionsSet.add(e.section); });

    return {
      total,
      allocated,
      notAllocated,
      deptsCount,
      sectionsCount: sectionsSet.size
    };
  }, [filteredEmployees]);

  // Save Single Employee Section
  const handleSaveSection = async (emp: any, newSection: string) => {
    try {
      const res = await API.saveSectionAllocation({
        employeeId: emp.empId,
        appNo: emp.appNo,
        employeeName: emp.name,
        department: emp.department,
        section: newSection,
        assignedBy: session?.fullName || 'HR'
      });

      if (res && res.success !== false) {
        setAllocations(prev => ({ ...prev, [emp.empId]: newSection }));
        showToast(`Section assigned to ${emp.name}`, 'success');
      } else {
        showToast(res.error || 'Failed to update section', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    }
  };

  // Bulk Select Toggle
  const toggleSelectAll = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map(e => e.empId));
    }
  };

  const toggleSelectEmp = (empId: string) => {
    setSelectedEmpIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Bulk Save Execution
  const handleExecuteBulkAction = async () => {
    if (selectedEmpIds.length === 0) return;

    try {
      const targetEmps = formattedRows.filter(e => selectedEmpIds.includes(e.empId));

      const res = await API.bulkSaveSectionAllocation({
        employees: targetEmps.map(e => ({
          employeeId: e.empId,
          appNo: e.appNo,
          employeeName: e.name,
          department: e.department
        })),
        section: bulkModal.action === 'remove' ? '' : bulkModal.section,
        action: bulkModal.action,
        assignedBy: session?.fullName || 'HR'
      });

      if (res && res.success !== false) {
        showToast(`Updated section for ${selectedEmpIds.length} employees`, 'success');
        const newSectionVal = bulkModal.action === 'remove' ? '' : bulkModal.section;
        setAllocations(prev => {
          const next = { ...prev };
          selectedEmpIds.forEach(id => { next[id] = newSectionVal; });
          return next;
        });
        setSelectedEmpIds([]);
        setBulkModal(prev => ({ ...prev, open: false }));
      } else {
        showToast(res.error || 'Bulk update failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Bulk update error', 'error');
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
          title="Section Allocation" 
          breadcrumbs={[{ label: 'Talent Management' }, { label: 'Section Allocation' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto pb-24">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#C9952A]" />
                <span>Internal Workforce Section Allocation</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">
                Allocate onboarded employees directly from Employee Directory to BSC Textiles floor sections.
              </p>
            </div>

            <button
              onClick={() => navigate('/employees')}
              className="btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
            >
              <span>Employee Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Top Summary Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Total Employees"
              value={summary.total}
              subtext="Directory workforce"
              icon={Users}
              color="navy"
            />
            <MetricCard
              title="Allocated Staff"
              value={summary.allocated}
              subtext="Assigned to sections"
              icon={UserCheck}
              color="emerald"
            />
            <MetricCard
              title="Not Allocated"
              value={summary.notAllocated}
              subtext="Pending section placement"
              icon={AlertCircle}
              color="rose"
            />
            <MetricCard
              title="Active Departments"
              value={summary.deptsCount}
              subtext="BSC Textiles floors"
              icon={Building2}
              color="gold"
            />
            <MetricCard
              title="Allocated Sections"
              value={summary.sectionsCount}
              subtext="Floor sections"
              icon={Layers}
              color="indigo"
            />
          </div>

          {/* Filter Bar */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-2.5">
              <div className="text-xs font-black text-[#1E2D4E] uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#C9952A]" />
                <span>Search &amp; Filter Employees</span>
              </div>
              <span className="text-[11px] text-[#777777] font-semibold">
                Showing {filteredEmployees.length} employee records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Global Search */}
              <div className="lg:col-span-2">
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">
                  Global Search (ID, App No, Name, Phone)
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, name, designation, phone..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                  />
                </div>
              </div>

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
                  {sectionFilterOptions.map(s => (
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

              {/* Joining Date */}
              <div>
                <label className="text-[10.5px] font-extrabold text-[#555555] uppercase block mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDateFilter}
                  onChange={(e) => setJoiningDateFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>
            </div>
          </div>

          {/* Employee Section Allocation Table */}
          <div className="card-glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight">Employee Directory &amp; Floor Section Assignment</h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">
                  Assign employees to department-specific sections without modifying core recruitment records.
                </p>
              </div>
              {selectedEmpIds.length > 0 && (
                <div className="text-xs font-extrabold text-[#1E2D4E] bg-[#C9952A]/20 px-3 py-1 rounded-full border border-[#C9952A]">
                  {selectedEmpIds.length} Selected for Bulk Action
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/60">
                    {isHR && (
                      <th className="py-3.5 px-3 text-center w-10">
                        <button onClick={toggleSelectAll} className="focus:outline-none">
                          {selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-[#1E2D4E]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#888888]" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4">App No</th>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Assigned Section</th>
                    <th className="py-3.5 px-4">Date of Joining</th>
                    <th className="py-3.5 px-4">Offered Salary</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmpIds.includes(emp.empId);
                      const deptSections = getSectionsForDepartment(emp.department);

                      return (
                        <tr key={emp.empId} className={`hover:bg-black/5 transition-colors font-medium ${isSelected ? 'bg-[#C9952A]/10' : ''}`}>
                          {isHR && (
                            <td className="py-3.5 px-3 text-center">
                              <button onClick={() => toggleSelectEmp(emp.empId)} className="focus:outline-none">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#1E2D4E]" />
                                ) : (
                                  <Square className="w-4 h-4 text-[#888888]" />
                                )}
                              </button>
                            </td>
                          )}

                          <td className="py-3.5 px-4 font-mono font-bold text-[#555555]">{emp.empId}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-[#777777]">{emp.appNo}</td>

                          {/* Employee Name (Clickable -> Opens Centered Overview Modal) */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => setOverviewModal({ open: true, emp })}
                              className="flex items-center gap-2.5 text-left group focus:outline-none"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                                {emp.initials}
                              </div>
                              <div>
                                <span className="font-black text-[#1E2D4E] group-hover:text-[#C9952A] group-hover:underline block transition-colors">
                                  {emp.name}
                                </span>
                                <span className="text-[10px] text-[#777777] font-medium">{emp.phone}</span>
                              </div>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-[#444444]">{emp.desig}</td>
                          <td className="py-3.5 px-4 font-extrabold text-[#1E2D4E]">{emp.department}</td>

                          {/* Interactive Section Dropdown */}
                          <td className="py-3.5 px-4">
                            {isHR ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={emp.section || ''}
                                  onChange={(e) => handleSaveSection(emp, e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:border-[#1E2D4E] shadow-xs"
                                >
                                  <option value="">-- Select {emp.department} Section --</option>
                                  {deptSections.map(sec => (
                                    <option key={sec} value={sec}>{sec}</option>
                                  ))}
                                </select>
                                {emp.section && (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-[#C9952A]">{emp.section || 'Unallocated'}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-[#666666] font-semibold whitespace-nowrap">{emp.doj}</td>
                          <td className="py-3.5 px-4 font-extrabold text-[#1E2D4E]">{emp.salary}</td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-[#777777] font-semibold">
                        No employees found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedEmpIds.length > 0 && isHR && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1E2D4E] text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-amber-400/30 flex items-center gap-4 animate-bounce-subtle">
          <span className="text-xs font-bold">
            <span className="text-[#C9952A] font-black">{selectedEmpIds.length}</span> Employees Selected
          </span>

          <div className="h-4 w-px bg-white/20" />

          <button
            onClick={() => setBulkModal({ open: true, action: 'assign', section: '' })}
            className="px-3.5 py-1.5 rounded-xl bg-[#C9952A] text-white font-bold text-xs hover:bg-amber-600 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bulk Assign Section</span>
          </button>

          <button
            onClick={() => setBulkModal({ open: true, action: 'remove', section: '' })}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/30 text-rose-200 border border-rose-400/40 font-bold text-xs hover:bg-rose-600 hover:text-white transition-all shadow-xs"
          >
            <span>Remove Section</span>
          </button>

          <button
            onClick={() => setSelectedEmpIds([])}
            className="p-1 rounded-lg text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Action Modal */}
      {bulkModal.open && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#EDE8DE] rounded-2xl border border-[#e2dfd7] shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base">Bulk Section Allocation</h3>
                <p className="text-xs text-[#777777] font-medium">
                  Updating section for {selectedEmpIds.length} selected employees
                </p>
              </div>
              <button 
                onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full bg-[#1E2D4E]/10 hover:bg-[#1E2D4E] hover:text-white text-[#1E2D4E] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-[#1E2D4E]">
              {bulkModal.action !== 'remove' ? (
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1">Target Section Name</label>
                  <input
                    type="text"
                    value={bulkModal.section}
                    onChange={(e) => setBulkModal(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="Enter section name (e.g. Ethnic Wear, Cotton...)"
                    className="w-full px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white font-bold text-xs"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  ⚠️ This will remove the allocated section for all {selectedEmpIds.length} selected employees.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
              <button
                onClick={() => setBulkModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] font-bold text-xs hover:bg-[#F9F7F4]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkAction}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Confirm Bulk Allocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Employee Overview Modal */}
      {overviewModal.open && overviewModal.emp && (
        <div className="fixed inset-0 z-50 bg-[#1E2D4E]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#EDE8DE] rounded-3xl border border-[#e2dfd7] shadow-2xl w-full max-w-2xl p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto relative animate-scale-in">
            {/* Close Button */}
            <button
              onClick={() => setOverviewModal({ open: false, emp: null })}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#1E2D4E]/10 hover:bg-[#1E2D4E] hover:text-white text-[#1E2D4E] flex items-center justify-center transition-colors shadow-xs"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-[#e2dfd7] pb-5">
              <div className="w-16 h-16 rounded-2xl bg-[#1E2D4E] text-[#C9952A] font-black text-xl flex items-center justify-center shadow-lg border-2 border-[#C9952A]">
                {overviewModal.emp.initials}
              </div>
              <div className="text-center sm:text-left flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight">{overviewModal.emp.name}</h2>
                    <p className="text-xs font-extrabold text-[#C9952A] mt-0.5">{overviewModal.emp.desig}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 self-center sm:self-auto">
                    {overviewModal.emp.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666666] font-medium mt-2">
                  <span>ID: <strong className="text-[#1E2D4E]">{overviewModal.emp.empId}</strong></span>
                  <span>•</span>
                  <span>App No: <strong className="text-[#1E2D4E]">{overviewModal.emp.appNo}</strong></span>
                  <span>•</span>
                  <span>Phone: <strong className="text-[#1E2D4E]">{overviewModal.emp.phone}</strong></span>
                </div>
              </div>
            </div>

            {/* PROMINENT HIGHLIGHT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-2xl bg-white border border-[#e2dfd7] text-center shadow-xs">
                <span className="text-[9.5px] font-black uppercase text-[#777777] block">Designation</span>
                <span className="font-extrabold text-[#1E2D4E] text-xs mt-1 block truncate">{overviewModal.emp.desig}</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#e2dfd7] text-center shadow-xs">
                <span className="text-[9.5px] font-black uppercase text-[#777777] block">Department</span>
                <span className="font-extrabold text-[#1E2D4E] text-xs mt-1 block truncate">{overviewModal.emp.department}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#C9952A]/10 border border-[#C9952A] text-center shadow-xs">
                <span className="text-[9.5px] font-black uppercase text-[#C9952A] block">Allocated Section</span>
                <span className="font-extrabold text-[#1E2D4E] text-xs mt-1 block truncate">
                  {overviewModal.emp.section || 'Unallocated'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#e2dfd7] text-center shadow-xs">
                <span className="text-[9.5px] font-black uppercase text-[#777777] block">Joining Date</span>
                <span className="font-extrabold text-[#1E2D4E] text-xs mt-1 block truncate">{overviewModal.emp.doj}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center shadow-xs col-span-2 sm:col-span-1">
                <span className="text-[9.5px] font-black uppercase text-emerald-800 block">Offered Salary</span>
                <span className="font-extrabold text-emerald-900 text-xs mt-1 block truncate">{overviewModal.emp.salary}</span>
              </div>
            </div>

            {/* Detailed Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] space-y-2.5">
                <h4 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider border-b border-[#e2dfd7] pb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#C9952A]" />
                  <span>Personal &amp; Contact Details</span>
                </h4>
                <div className="space-y-1.5 font-medium text-[#444444]">
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Full Name:</span>
                    <strong className="text-[#1E2D4E]">{overviewModal.emp.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Phone:</span>
                    <strong className="text-[#1E2D4E]">{overviewModal.emp.phone}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Email:</span>
                    <strong className="text-[#1E2D4E]">{overviewModal.emp.email}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Branch:</span>
                    <strong className="text-[#1E2D4E]">{overviewModal.emp.branch}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] space-y-2.5">
                <h4 className="font-black text-[#1E2D4E] text-xs uppercase tracking-wider border-b border-[#e2dfd7] pb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#C9952A]" />
                  <span>Employment Placement</span>
                </h4>
                <div className="space-y-1.5 font-medium text-[#444444]">
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Department:</span>
                    <strong className="text-[#1E2D4E]">{overviewModal.emp.department}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Current Section:</span>
                    <strong className="text-[#C9952A]">{overviewModal.emp.section || 'Not Assigned'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Reporting Manager:</span>
                    <strong className="text-[#1E2D4E]">Store Head / Floor Supervisor</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#777777]">Workplace:</span>
                    <strong className="text-[#1E2D4E]">BSC Textiles Mall</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-[#e2dfd7]">
              <button
                onClick={() => setOverviewModal({ open: false, emp: null })}
                className="btn-primary text-xs shadow-sm"
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
