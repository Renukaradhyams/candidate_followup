import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import {
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase,
  FileText, CheckCircle, Trash2, Edit3, X, ExternalLink, UserCheck, DollarSign, Image as ImageIcon, FileCheck, Upload, Download, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { isDateInRange, getBusinessDate } from '../utils/dateUtils';
import { BSC_DEPARTMENTS, getUniqueDepartments } from '../utils/bscDepartments';
import { formatName } from '../utils/formatName';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'salary'>('name');

  // Recruitment Analytics & Pipeline Date Range Filter State
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Drawer
  const [drawerEmp, setDrawerEmp] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);

  // Edit Modal State
  const [editModal, setEditModal] = useState<{ open: boolean; emp: any | null }>({ open: false, emp: null });
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    desig: '',
    department: '',
    section: '',
    salary: '',
    incentive: '',
    offeredDoj: '',
    status: '',
    branch: '',
    reportingManager: '',
    remarks: ''
  });
  const [saving, setSaving] = useState(false);

  const parseSalaryAndIncentive = (val: any) => {
    if (!val) return { base: 0, incentive: 0, total: 0, rawBase: '', rawIncentive: '' };
    const str = String(val).trim();
    if (str.includes('|')) {
      const parts = str.split('|');
      const base = parseFloat(parts[0]) || 0;
      const inc = parseFloat(parts[1]) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: parts[0] || '', rawIncentive: parts[1] || '' };
    }
    if (str.includes('+')) {
      const parts = str.split('+');
      const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: String(base), rawIncentive: String(inc) };
    }
    const base = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return { base, incentive: 0, total: base, rawBase: str, rawIncentive: '' };
  };

  const newestEmployee = useMemo(() => {
    if (!employees || employees.length === 0) return null;
    return [...employees].sort((a, b) => {
      const dateA = a.actualDoj || a.offeredDoj || a.date ? new Date(a.actualDoj || a.offeredDoj || a.date).getTime() : 0;
      const dateB = b.actualDoj || b.offeredDoj || b.date ? new Date(b.actualDoj || b.offeredDoj || b.date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return String(b.appNo || '').localeCompare(String(a.appNo || ''));
    })[0];
  }, [employees]);

  const loadEmployees = useCallback(async () => {
    try {
      const d = await API.getEmployees();
      if (d && d.employees) {
        setEmployees(d.employees);
      }
    } catch (err: any) {
      showToast('Could not load employees: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadEmployees();
  }, [navigate, loadEmployees]);

  // Filtering & Alphabetical Sorting (A-Z)
  useEffect(() => {
    let list = [...employees];

    if (activeRange && activeRange !== 'all') {
      list = list.filter(e => isDateInRange(getBusinessDate(e, 'EMPLOYEES'), activeRange, fromDate, toDate));
    }

    if (deptFilter) {
      list = list.filter(e => (e.department || '').toLowerCase().trim() === deptFilter.toLowerCase().trim());
    }

    if (sectionFilter) {
      list = list.filter(e => (e.section || '').toLowerCase().trim() === sectionFilter.toLowerCase().trim());
    }

    if (desigFilter) {
      list = list.filter(e => e.desig === desigFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.appNo || '').toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q)
      );
    }

    // Dynamic Sorting
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => {
        const dateA = a.actualDoj || a.offeredDoj || a.date ? new Date(a.actualDoj || a.offeredDoj || a.date).getTime() : 0;
        const dateB = b.actualDoj || b.offeredDoj || b.date ? new Date(b.actualDoj || b.offeredDoj || b.date).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return String(b.appNo || '').localeCompare(String(a.appNo || ''));
      });
    } else if (sortBy === 'salary') {
      list.sort((a, b) => parseSalaryAndIncentive(b.salary).total - parseSalaryAndIncentive(a.salary).total);
    }

    setFiltered(list);
  }, [employees, deptFilter, sectionFilter, desigFilter, searchQuery, sortBy, activeRange, fromDate, toDate]);

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

    if (clean.startsWith('uploads/')) {
      clean = `/${clean}`;
    }

    const filename = clean.split('/').pop() || clean;

    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;

    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  };

  const handleOpenEdit = (emp: any) => {
    setEditModal({ open: true, emp });
    const parsedSal = parseSalaryAndIncentive(emp.salary);
    setEditForm({
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      desig: emp.desig || emp.designation || '',
      department: emp.department || '',
      section: emp.section || '',
      salary: parsedSal.rawBase || (parsedSal.base ? String(parsedSal.base) : ''),
      incentive: parsedSal.rawIncentive || (parsedSal.incentive ? String(parsedSal.incentive) : ''),
      offeredDoj: emp.offeredDoj || emp.estDoj || emp.actualDoj || '',
      status: emp.status || 'Joined',
      branch: emp.branch || 'Main Branch (The Textile Mall)',
      reportingManager: emp.reportingManager || '',
      remarks: emp.remarks || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.emp) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      showToast('Name and Phone are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const combinedSalary = editForm.incentive && editForm.incentive.trim()
        ? `${editForm.salary.trim()}|${editForm.incentive.trim()}`
        : editForm.salary.trim();

      await API.updateCandidate(editModal.emp.appNo, {
        isFullEdit: true,
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        desig: editForm.desig,
        department: editForm.department,
        section: editForm.section,
        salary: combinedSalary,
        offeredDoj: editForm.offeredDoj,
        status: editForm.status,
        branch: editForm.branch,
        reportingManager: editForm.reportingManager,
        remarks: editForm.remarks
      });

      showToast('Employee details updated successfully!', 'success');
      setEditModal({ open: false, emp: null });
      if (drawerEmp && drawerEmp.appNo === editModal.emp.appNo) {
        setDrawerEmp(null);
      }
      loadEmployees();
    } catch (err: any) {
      showToast('Error updating employee: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (appNo: string, empName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete employee ${empName} (${appNo})?`)) return;
    try {
      await API.deleteCandidate(appNo);
      showToast('Employee record deleted', 'success');
      setDrawerEmp(null);
      loadEmployees();
    } catch (err: any) {
      showToast('Failed to delete employee: ' + err.message, 'error');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          showToast('No data found in excel sheet', 'error');
          setSaving(false);
          return;
        }

        const res = await fetch('/api/employees/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.token}`
          },
          body: JSON.stringify({ employees: data })
        });
        
        const json = await res.json();
        if (json.success) {
          showToast(`Successfully imported ${json.addedCount} employees`, 'success');
          loadEmployees();
        } else {
          showToast(`Failed: ${json.error}`, 'error');
        }
      } catch (err: any) {
        showToast('Error reading Excel: ' + err.message, 'error');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([{
      Name: 'John Doe',
      Phone: '9876543210',
      Email: 'john@example.com',
      Gender: 'MALE',
      DOB: '1990-01-01',
      BloodGroup: 'O+',
      Religion: 'Hindu',
      Caste: 'General',
      Designation: 'Cashier',
      Salary: '20000',
      DOJ: '2023-01-15'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "Sample_Employee_Import.xlsx");
  };

  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';
  const uniqueDesigs = Array.from(new Set(employees.map(e => e.desig).filter(Boolean)));
  const uniqueSections = Array.from(new Set(employees.map(e => e.section).filter(Boolean)));
  const uniqueDepts = useMemo(() => {
    return getUniqueDepartments(employees.map(e => e.department));
  }, [employees]);

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />

      {/* High-Res Photo Lightbox Viewer */}
      {expandedPhotoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setExpandedPhotoUrl(null)}>
          <button
            onClick={() => setExpandedPhotoUrl(null)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
            title="Close Lightbox"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl max-h-[85vh] p-3 bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-[#C9952A]" onClick={(e) => e.stopPropagation()}>
            <img src={expandedPhotoUrl} alt="Expanded Employee Photo" className="w-full h-full object-contain max-h-[80vh] rounded-2xl" />
          </div>
        </div>
      )}
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Employee Master Directory"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Recruitment Analytics & Pipeline Banner */}
          <div className="card-glass p-5 space-y-4 border-2 border-[#1E2D4E]/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2dfd7] pb-3.5">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#C9952A]" />
                  <span>Recruitment Analytics &amp; Pipeline</span>
                </h3>
                <p className="text-xs text-[#777777] font-medium mt-0.5">
                  Real-time candidate metrics, funnel conversion &amp; team performance.
                </p>
              </div>

              {/* Date Filter Quick Range Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Last Month' }
                ].map(range => (
                  <button
                    key={range.key}
                    onClick={() => { setActiveRange(range.key as any); setFromDate(''); setToDate(''); }}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeRange === range.key
                        ? 'bg-[#1E2D4E] text-white font-extrabold shadow-xs'
                        : 'bg-[#F9F7F4] text-[#555555] border border-[#e2dfd7] hover:bg-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex flex-wrap items-center gap-3 bg-[#F9F7F4] p-3 rounded-2xl border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E]">
              <span className="text-[#777777] uppercase text-[10.5px] font-black">Custom Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
                <span className="text-[#777777] font-extrabold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
              </div>
              {(fromDate || toDate || activeRange !== 'all') && (
                <button
                  onClick={() => { setActiveRange('all'); setFromDate(''); setToDate(''); }}
                  className="text-rose-600 hover:underline text-[11px] font-extrabold ml-auto"
                >
                  Reset Date Filter
                </button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#1a8a84]" />
                <span>Onboarded Staff Directory</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5 font-sans">Active company workforce records, offered DOJ, salary packages &amp; uploaded documents.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadSample}
                  className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Sample
                </button>
                <label className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold cursor-pointer hover:bg-[#162340] flex items-center gap-1.5 shadow-xs">
                  <Upload className="w-3.5 h-3.5" /> Import
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} disabled={saving} />
                </label>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee, phone, app no..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] w-56 shadow-xs"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Departments</option>
                {uniqueDepts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Sections</option>
                {uniqueSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Designations</option>
                {uniqueDesigs.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="newest">Sort: Newest Joined</option>
                <option value="salary">Sort: Highest Package</option>
              </select>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Total Active Employees"
              value={employees.length}
              subtext="Fully onboarded staff"
              icon={UserCheck}
              color="teal"
            />
            <MetricCard
              title="Designations Covered"
              value={uniqueDesigs.length}
              subtext="Active company roles"
              icon={Briefcase}
              color="navy"
            />
            <MetricCard
              title="Newest Joined"
              value={newestEmployee ? newestEmployee.name : '—'}
              subtext={newestEmployee ? `DOJ: ${newestEmployee.actualDoj || newestEmployee.offeredDoj || 'Recent'}` : 'No records'}
              icon={Users}
              color="gold"
            />
          </div>

          {/* Employee Directory DataGrid */}
          <div className="card-glass p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/60">
                    <th className="py-3 px-3 text-center w-12">SL.NO</th>
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4">Offered Salary</th>
                    <th className="py-3 px-4">DOJ Offered</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filtered.map((emp, idx) => (
                    <tr key={emp.appNo} onClick={() => setDrawerEmp(emp)} className="hover:bg-black/5 cursor-pointer transition-colors font-medium">
                      <td className="py-3.5 px-3 text-center font-bold text-[#666666]">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono text-[#555555] font-bold">{emp.appNo}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 group text-left">
                          {fileUrl(emp.photoUrl) ? (
                            <img
                              src={fileUrl(emp.photoUrl)!}
                              alt={emp.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover border-2 border-[#C9952A] shadow-xs flex-shrink-0 bg-white"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                              {emp.initials}
                            </div>
                          )}
                          <div>
                            <span className="font-extrabold text-[#1E2D4E] group-hover:underline block">{formatName(emp.name)}</span>
                            {emp.email && <span className="text-[10px] text-[#888888] font-semibold truncate max-w-[150px] block">{emp.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#1E2D4E] font-extrabold">{emp.desig}</td>
                      <td className="py-3.5 px-4 text-[#555555] font-semibold">{emp.department || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-[#555555]">{emp.phone}</td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const sal = parseSalaryAndIncentive(emp.salary);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase text-[#777777] font-extrabold">Base:</span>
                                <span className="font-extrabold text-[#1E2D4E] font-mono">₹{sal.base.toLocaleString('en-IN')}</span>
                              </div>
                              {sal.incentive > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase text-emerald-600 font-extrabold">Inc:</span>
                                  <span className="font-bold text-emerald-700 font-mono">+₹{sal.incentive.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 border-t border-[#e2dfd7]/60 pt-0.5 mt-0.5">
                                <span className="text-[10px] uppercase text-amber-800 font-extrabold">Pkg:</span>
                                <span className="font-black text-[#1E2D4E] font-mono text-xs">₹{sal.total.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#666666]">
                        {emp.offeredDoj || emp.estDoj || emp.actualDoj || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={emp.status || 'Joined'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors shadow-xs"
                            title="Edit Employee Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          )}
                          {isAdmin && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.appNo, emp.name)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors shadow-xs"
                            title="Delete Employee Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-[#888888] font-semibold">
                        No employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">Edit Employee — {editModal.emp?.name}</h3>
              <button onClick={() => setEditModal({ open: false, emp: null })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Full Employee Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-modern font-bold text-[#1E2D4E]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Phone Number *</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-modern font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Email Address</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-modern" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Designation Role</label>
                  <input type="text" value={editForm.desig} onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })} className="input-modern font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Allocated Department</label>
                  <select value={editForm.department || ''} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="select-modern font-bold">
                    <option value="">Select Department</option>
                    <option value="Ground Floor Saree">Ground Floor Saree</option>
                    <option value="First Floor Saree">First Floor Saree</option>
                    <option value="Art & Raw Silk Saree">Art & Raw Silk Saree</option>
                    <option value="Ladies">Ladies</option>
                    <option value="Kids">Kids</option>
                    <option value="Mens">Mens</option>
                    <option value="Home Furnishing">Home Furnishing</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Allocated Section / Floor Area</label>
                  <input type="text" value={editForm.section || ''} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })} placeholder="e.g. Counter 3" className="input-modern font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered Monthly Base Salary (₹)</label>
                  <input type="text" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} placeholder="e.g. 25000" className="input-modern font-mono font-bold text-emerald-800" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered Monthly Incentive (₹)</label>
                  <input type="text" value={editForm.incentive} onChange={(e) => setEditForm({ ...editForm, incentive: e.target.value })} placeholder="e.g. 2000" className="input-modern font-mono font-bold text-emerald-700" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Date of Joining (DOJ)</label>
                  <input type="date" value={editForm.offeredDoj} onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })} className="input-modern font-bold text-amber-800" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Employee Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="select-modern font-bold"
                  >
                    <option value="Joined">Joined</option>
                    <option value="Offer Accepted">Offer Accepted</option>
                    <option value="Selected">Selected</option>
                    <option value="Offer Sent">Offer Sent</option>
                    <option value="Probation">Probation</option>
                    <option value="Resigned">Resigned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Branch Location</label>
                  <input type="text" value={editForm.branch} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })} placeholder="Main Branch" className="input-modern" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Reporting Manager</label>
                  <input type="text" value={editForm.reportingManager} onChange={(e) => setEditForm({ ...editForm, reportingManager: e.target.value })} placeholder="Store Manager" className="input-modern" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Shortlisting & Recruiter Remarks</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Enter employee notes, HR remarks, or special package terms..."
                  className="input-modern"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
              <button onClick={() => setEditModal({ open: false, emp: null })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary text-xs shadow-md disabled:opacity-50">
                {saving ? 'Saving Changes...' : 'Save Employee Details'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 360° Complete Employee Detail Modal */}
      {drawerEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1E2D4E]/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border border-[#C9952A]/40">
            
            {/* Sticky Header */}
            <div className="bg-[#1E2D4E] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#C9952A]/30 sticky top-0 z-20">
              <div className="flex items-center gap-3.5">
                {fileUrl(drawerEmp.photoUrl) ? (
                  <div className="relative group flex-shrink-0 cursor-pointer" onClick={() => setExpandedPhotoUrl(fileUrl(drawerEmp.photoUrl)!)} title="Click to view full enlarged photo">
                    <img
                      src={fileUrl(drawerEmp.photoUrl)!}
                      alt={drawerEmp.name}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-3 border-[#C9952A] shadow-xl bg-white p-0.5 group-hover:scale-105 transition-transform"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-extrabold">
                      🔍 Expand
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#1E2D4E] to-[#2A3F6D] text-white font-black text-2xl sm:text-3xl flex items-center justify-center border-3 border-[#C9952A] shadow-xl flex-shrink-0">
                    {drawerEmp.initials || drawerEmp.name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-white text-lg sm:text-xl tracking-tight leading-none">{formatName(drawerEmp.name)}</h2>
                    <StatusBadge status={drawerEmp.status || 'Joined'} size="sm" />
                  </div>
                  <div className="text-xs text-[#C9952A] font-extrabold font-mono mt-1.5 flex flex-wrap items-center gap-2">
                    <span>{drawerEmp.appNo}</span>
                    <span>•</span>
                    <span className="text-white font-bold">{drawerEmp.desig || '—'}</span>
                    <span>•</span>
                    <span className="text-white/80 font-normal">DOJ: {drawerEmp.offeredDoj || drawerEmp.estDoj || drawerEmp.actualDoj || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerEmp(null)}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs Navigation Bar */}
            <div className="flex items-center gap-1.5 p-2 sm:px-5 bg-[#F9F7F4] border-b border-[#e2dfd7] overflow-x-auto text-xs font-bold scrollbar-none sticky top-[80px] z-10">
              {[
                { id: 'overview', label: '👤 Employment Overview' },
                { id: 'personal', label: '📋 Personal & Contact' },
                { id: 'professional', label: '💼 Professional Info' },
                { id: 'documents', label: '📄 Verified Documents' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                    drawerTab === tab.id
                      ? 'bg-[#1E2D4E] text-white shadow-sm'
                      : 'text-[#555555] hover:bg-white hover:text-[#1E2D4E]'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs bg-[#EDE8DE]">
              
              {/* Tab 1: Employment Overview */}
              {drawerTab === 'overview' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Offered Salary</span>
                      <div className="text-base font-mono font-black text-emerald-800">
                        {drawerEmp.salary && drawerEmp.salary !== '—' ? `₹ ${drawerEmp.salary}` : '—'}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Date of Joining (DOJ)</span>
                      <div className="text-base font-extrabold text-[#1E2D4E]">{drawerEmp.offeredDoj || drawerEmp.estDoj || drawerEmp.actualDoj || '—'}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Recruitment Source</span>
                      <div className="text-base font-extrabold text-[#C9952A]">{drawerEmp.source || '—'}</div>
                    </div>
                  </div>

                  {/* Salary & Offer Details */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#C9952A]" />
                      <span>Compensation & Package Breakdown</span>
                    </h4>
                    {(() => {
                      const sal = parseSalaryAndIncentive(drawerEmp.salary);
                      return (
                        <div className="grid grid-cols-3 gap-3 text-center mb-3">
                          <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]">
                            <div className="text-[9px] uppercase font-black text-[#777777] mb-1">Base Salary</div>
                            <div className="text-sm font-bold text-[#1E2D4E] font-mono">₹{sal.base.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                            <div className="text-[9px] uppercase font-black text-emerald-800 mb-1">Monthly Incentive</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono">{sal.incentive > 0 ? `+₹${sal.incentive.toLocaleString('en-IN')}` : 'Not Set'}</div>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-2xs">
                            <div className="text-[9px] uppercase font-black text-amber-900 mb-1">Total Package</div>
                            <div className="text-sm font-black text-slate-900 font-mono">₹{sal.total.toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerEmp.expectedSalary ? `₹ ${drawerEmp.expectedSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerEmp.previousSalary || drawerEmp.currentSalary) ? `₹ ${drawerEmp.previousSalary || drawerEmp.currentSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Notice Period</span><span className="font-bold text-[#1E2D4E]">{drawerEmp.noticePeriod || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Allocated Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.department || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Designation Role</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.desig || drawerEmp.designation || '—'}</span></div>
                    </div>
                  </div>

                  {/* Work Experience Details */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#C9952A]" />
                      <span>Work Experience Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Prior / Retail Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.retailExperience || drawerEmp.retail_experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Company / Employer</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.previousCompany || drawerEmp.previous_company || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Role / Designation</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.previousDesignation || drawerEmp.previous_designation || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.qualification || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Referrer Information</span><span className="font-bold text-[#1E2D4E]">{drawerEmp.referrer ? `${drawerEmp.referrer} (${drawerEmp.referrerEmpNo || ''})` : '—'}</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#e2dfd7]/60">
                      <span className="text-[#777777] block text-[10.5px] mb-1 font-bold uppercase">Shortlisting &amp; HR Remarks:</span>
                      <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-xs font-semibold text-[#1E2D4E] italic">
                        {drawerEmp.remarks || 'No remarks recorded.'}
                      </div>
                    </div>
                  </div>

                  {/* Optional Interview Questions & Evaluation Section */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#C9952A]" />
                      <span>Interview Questions &amp; Evaluation Notes (Optional)</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      {drawerEmp.questionNotes || drawerEmp.evaluationNotes ? (
                        <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-[#1E2D4E] font-medium whitespace-pre-wrap">
                          {drawerEmp.questionNotes || drawerEmp.evaluationNotes}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-[#777777] text-center font-medium italic">
                          No interview question evaluations recorded (Optional).
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Personal & Contact */}
              {drawerTab === 'personal' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C9952A]" />
                      <span>Contact &amp; Demographics</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Mobile Phone</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerEmp.phone}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Email Address</span><span className="font-extrabold text-[#1E2D4E] truncate block">{drawerEmp.email || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Gender</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.gender || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Date of Birth</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.dob ? drawerEmp.dob.split('T')[0] : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Blood Group</span><span className="font-extrabold text-rose-700">{drawerEmp.bloodGroup || drawerEmp.blood_group || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Aadhaar Number</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerEmp.aadhaarNumber || drawerEmp.aadhaar_number || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Religion</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.religion || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Caste / Category</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.caste || drawerEmp.religionCaste || drawerEmp.religion_caste || '—'}</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#e2dfd7]/60">
                      <span className="text-[#777777] block text-[10.5px] mb-0.5">Complete Residential Address:</span>
                      <span className="font-semibold text-[#1E2D4E] block leading-relaxed bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/50 mt-1">{drawerEmp.address || drawerEmp.cityState || '—'}</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#C9952A]" />
                      <span>Family &amp; Languages</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Father's Details</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.fatherDetails || drawerEmp.father_details || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Mother's Details</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.motherDetails || drawerEmp.mother_details || '—'}</span></div>
                    </div>
                    <div className="pt-2 border-t border-[#e2dfd7]/60">
                      <span className="text-[#777777] block text-[10.5px] mb-1.5">Languages Known:</span>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(drawerEmp.languagesKnown) ? drawerEmp.languagesKnown : (drawerEmp.languagesKnown ? JSON.parse(drawerEmp.languagesKnown) : [])).map((lang: string) => (
                          <span key={lang} className="px-3 py-1 rounded-lg bg-[#F9F7F4] border border-[#e2dfd7] font-extrabold text-[11px] text-[#1E2D4E] shadow-2xs">
                            {lang}
                          </span>
                        )) || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Professional Info */}
              {drawerTab === 'professional' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#C9952A]" />
                      <span>Professional Experience &amp; Qualification</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-[#777777] block text-[10.5px]">Finalized Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.department || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Branch / Store</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.branch || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Reporting Manager</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.reportingManager || drawerEmp.reporting_manager || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.qualification || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Prior Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.retailExperience || drawerEmp.retail_experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Employer / Store</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.previousCompany || drawerEmp.previous_company || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Role / Designation</span><span className="font-extrabold text-[#1E2D4E]">{drawerEmp.previousDesignation || drawerEmp.previous_designation || '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Documents */}
              {drawerTab === 'documents' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#C9952A]" />
                    <span>Verified Employee Documents</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {fileUrl(drawerEmp.photoUrl) ? (
                      <div className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] flex flex-col items-center gap-3 shadow-2xs">
                        <img
                          src={fileUrl(drawerEmp.photoUrl)!}
                          alt="Employee Photo"
                          onClick={() => setExpandedPhotoUrl(fileUrl(drawerEmp.photoUrl)!)}
                          className="w-36 h-36 object-cover rounded-2xl border-2 border-[#C9952A] shadow-md cursor-pointer hover:scale-105 transition-transform"
                        />
                        <span className="text-xs">Employee Passport Photo</span>
                        <button
                          type="button"
                          onClick={() => setExpandedPhotoUrl(fileUrl(drawerEmp.photoUrl)!)}
                          className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-[11px] font-extrabold hover:bg-[#162340] transition-colors"
                        >
                          🔍 Expand Photo
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl border border-dashed border-[#e2dfd7] bg-black/5 text-center flex flex-col items-center justify-center gap-2 text-[#aaa] font-bold">
                        <span>No Photo Uploaded</span>
                      </div>
                    )}

                    {fileUrl(drawerEmp.aadhaarUrl || drawerEmp.aadharUrl) ? (
                      <a href={fileUrl(drawerEmp.aadhaarUrl || drawerEmp.aadharUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-xl border-2 border-[#e2dfd7] bg-[#F9F7F4] hover:border-[#1E2D4E] hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group h-24">
                        <FileCheck className="w-6 h-6 text-[#1E2D4E] group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-[#1E2D4E] text-xs">📄 Aadhaar</span>
                      </a>
                    ) : (
                      <div className="p-4 rounded-xl border-2 border-dashed border-[#e2dfd7] bg-black/5 text-center flex flex-col items-center justify-center gap-2 h-24 text-[#aaa]">
                        <span className="font-bold text-[10px] uppercase">No Aadhaar</span>
                      </div>
                    )}

                    {fileUrl(drawerEmp.resumeUrl) ? (
                      <a href={fileUrl(drawerEmp.resumeUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-xl border-2 border-[#e2dfd7] bg-[#F9F7F4] hover:border-[#1E2D4E] hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group h-24">
                        <FileText className="w-6 h-6 text-[#1E2D4E] group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-[#1E2D4E] text-xs">📑 Resume</span>
                      </a>
                    ) : (
                      <div className="p-4 rounded-xl border-2 border-dashed border-[#e2dfd7] bg-black/5 text-center flex flex-col items-center justify-center gap-2 h-24 text-[#aaa]">
                        <span className="font-bold text-[10px] uppercase">No Resume</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-end gap-3 z-20 sticky bottom-0">
              <button
                onClick={() => setDrawerEmp(null)}
                className="px-5 py-2.5 rounded-xl border-2 border-[#e2dfd7] bg-white text-[#555555] font-extrabold hover:bg-black/5 transition-colors"
              >
                Close
              </button>
              {isAdmin && (
              <button
                onClick={() => handleDeleteEmployee(drawerEmp.appNo, drawerEmp.name)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-colors shadow-md flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              )}
              {isAdmin && (
              <button
                onClick={() => handleOpenEdit(drawerEmp)}
                className="px-5 py-2.5 rounded-xl bg-[#1E2D4E] text-white font-black hover:bg-[#162340] transition-colors shadow-md flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" /> Quick Edit
              </button>
              )}
              {isAdmin && (
              <button
                onClick={() => navigate(`/candidate-entry?edit=${drawerEmp.appNo}`)}
                className="px-5 py-2.5 rounded-xl bg-[#C9952A] text-white font-black hover:bg-[#b07d20] transition-colors shadow-md flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Edit Full Profile
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
