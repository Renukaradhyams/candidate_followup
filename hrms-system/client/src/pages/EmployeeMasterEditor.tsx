import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Save,
  Download,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  CreditCard,
  Briefcase,
  UserCheck,
  MapPin,
  Store,
  RefreshCw,
  FileCheck2,
  X,
  ChevronRight,
  Edit3
} from 'lucide-react';
import { API, Auth, UserSession } from '../services/api';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import StatusBadge from '../components/ui/StatusBadge';
import { BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';
import { formatName } from '../utils/formatName';
import * as XLSX from 'xlsx';

const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'aadhaar',     label: 'Aadhaar Card (Self-Attested Copy)',          mandatory: true  },
  { id: 'pan',         label: 'PAN Card Copy',                              mandatory: true  },
  { id: 'bank',        label: 'Bank Passbook / Cancelled Cheque',           mandatory: true  },
  { id: 'sslc',        label: '10th / SSLC Marks Card',                    mandatory: true  },
  { id: 'puc_degree',  label: '12th / Degree / Highest Edu Certificate',   mandatory: true  },
  { id: 'relieving',   label: 'Previous Relieving / Experience Letter',     mandatory: false },
  { id: 'photos',      label: 'Passport Size Photographs (3 copies)',       mandatory: true  },
  { id: 'medical',     label: 'Blood Group / Fitness Report',               mandatory: false },
  { id: 'offer_signed',label: 'Signed Offer Letter Acceptance',             mandatory: true  },
  { id: 'declaration', label: 'BSC Employment & Code Declaration',          mandatory: true  },
  { id: 'pf_form11',   label: 'PF Form 11 / Nominee Declaration',          mandatory: false },
  { id: 'esi_form1',   label: 'ESI Form 1 Declaration',                    mandatory: false },
];

const TABS = [
  { id: 'personal',   label: 'Personal & Identity',   emoji: '👤' },
  { id: 'contact',    label: 'Contact & Address',      emoji: '📞' },
  { id: 'official',   label: 'Store & Section',        emoji: '🏪' },
  { id: 'banking',    label: 'Bank & greytHR CTC',     emoji: '💳' },
  { id: 'checklist',  label: 'Document Checklist',     emoji: '📋' },
  { id: 'experience', label: 'Experience & Education', emoji: '💼' },
] as const;
type TabId = typeof TABS[number]['id'];

const EMPTY_FORM = {
  appNo: '', name: '', gender: 'MALE', dob: '', bloodGroup: '', maritalStatus: 'Single',
  religion: 'Hindu', caste: '', fatherDetails: '', motherDetails: '',
  emergencyContact: '', emergencyPhone: '',
  phone: '', altPhone: '', email: '', address: '', permanentAddress: '',
  desig: '', department: '', section: '', branch: 'Main Branch (The Textile Mall)',
  reportingManager: '', offeredDoj: '', status: 'Joined',
  salary: '', incentive: '',
  panNumber: '', bankName: '', bankAccountNo: '', bankIfsc: '', uanNumber: '', esiNumber: '',
  qualification: '', experience: '', retailExperience: '',
  previousCompany: '', previousDesignation: '', previousSalary: '', expectedSalary: '',
  noticePeriod: '', languagesKnown: [] as string[], remarks: '',
  photoUrl: '', aadhaarUrl: '', resumeUrl: '',
  documentsChecklist: {} as Record<string, { received: boolean; date?: string; remarks?: string }>,
  greythrSynced: false,
  greythrReady: false,
};

export default function EmployeeMasterEditorPage() {
  const navigate = useNavigate();
  const [session, setSession]           = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [employees, setEmployees]       = useState<any[]>([]);
  const [searchQuery, setSearchQuery]   = useState('');
  const [deptFilter, setDeptFilter]     = useState('');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'pending'>('all');
  const [selectedAppNo, setSelectedAppNo]     = useState('');
  const [modalOpen, setModalOpen]             = useState(false);
  const [activeTab, setActiveTab]             = useState<TabId>('personal');
  const [form, setForm]                       = useState<any>(EMPTY_FORM);

  /* ── Data loading ── */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await API.getEmployees();
      const list = Array.isArray(res) ? res : (res?.employees || []);
      setEmployees(list);
      if (selectedAppNo) {
        const cur = list.find((e: any) => e.appNo === selectedAppNo);
        if (cur) populateForm(cur);
      }
    } catch (err: any) {
      showToast('Error loading employees: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAppNo]);

  useEffect(() => {
    if (!Auth.check()) { navigate('/login', { replace: true }); return; }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  /* ESC to close modal */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* Lock body scroll when modal open */
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  /* ── Populate form from employee object ── */
  const populateForm = (emp: any) => {
    if (!emp) return;
    let rawBase = '', rawInc = '';
    const s = String(emp.salary || '').trim();
    if (s.includes('|'))  { const p = s.split('|'); rawBase = p[0]; rawInc = p[1] || ''; }
    else if (s.includes('+')) { const p = s.split('+'); rawBase = p[0]?.replace(/[^0-9.]/g,'') || ''; rawInc = p[1]?.replace(/[^0-9.]/g,'') || ''; }
    else { rawBase = s.replace(/[^0-9.]/g,'') || s; }

    const cl = (emp.documentsChecklist && typeof emp.documentsChecklist === 'object') ? emp.documentsChecklist : {};
    setForm({
      appNo: emp.appNo || '',
      name: emp.name || '',
      gender: (emp.gender || 'MALE').toUpperCase(),
      dob: emp.dob || '',
      bloodGroup: emp.bloodGroup || '',
      maritalStatus: emp.maritalStatus || 'Single',
      religion: emp.religion || 'Hindu',
      caste: emp.caste || '',
      fatherDetails: emp.fatherDetails || '',
      motherDetails: emp.motherDetails || '',
      emergencyContact: emp.emergencyContact || '',
      emergencyPhone: emp.emergencyPhone || '',
      phone: emp.phone || '',
      altPhone: emp.altPhone || '',
      email: emp.email || '',
      address: emp.address || '',
      permanentAddress: emp.permanentAddress || emp.address || '',
      desig: emp.desig || emp.designation || '',
      department: emp.department || '',
      section: emp.section || '',
      branch: emp.branch || 'Main Branch (The Textile Mall)',
      reportingManager: emp.reportingManager || '',
      offeredDoj: emp.offeredDoj || emp.actualDoj || emp.estDoj || '',
      status: emp.status || 'Joined',
      salary: rawBase, incentive: rawInc,
      panNumber: emp.panNumber || '',
      bankName: emp.bankName || '',
      bankAccountNo: emp.bankAccountNo || '',
      bankIfsc: emp.bankIfsc || '',
      uanNumber: emp.uanNumber || '',
      esiNumber: emp.esiNumber || '',
      qualification: emp.qualification || '',
      experience: emp.experience || '',
      retailExperience: emp.retailExperience || emp.retail_experience || '',
      previousCompany: emp.previousCompany || emp.previous_company || '',
      previousDesignation: emp.previousDesignation || emp.previous_designation || '',
      previousSalary: emp.previousSalary || emp.currentSalary || '',
      expectedSalary: emp.expectedSalary || '',
      noticePeriod: emp.noticePeriod || '',
      languagesKnown: Array.isArray(emp.languagesKnown) ? emp.languagesKnown : [],
      remarks: emp.remarks || '',
      photoUrl: emp.photoUrl || '',
      aadhaarUrl: emp.aadhaarUrl || '',
      resumeUrl: emp.resumeUrl || '',
      documentsChecklist: cl,
      greythrSynced: Boolean(emp.greythrSynced),
      greythrReady: Boolean(emp.greythrReady),
    });
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedAppNo(emp.appNo);
    populateForm(emp);
    setActiveTab('personal');
    setModalOpen(true);
  };

  const currentDeptSections = useMemo(() => getSectionsForDepartment(form.department), [form.department]);

  /* ── greytHR Readiness Audit ── */
  const readinessAudit = useMemo(() => {
    const missing: { field: string; tab: TabId; key: string }[] = [];
    if (!form.name?.trim())          missing.push({ field: 'Full Name',       tab: 'personal', key: 'name' });
    if (!form.gender)                missing.push({ field: 'Gender',          tab: 'personal', key: 'gender' });
    if (!form.dob)                   missing.push({ field: 'Date of Birth',   tab: 'personal', key: 'dob' });
    if (!form.phone?.trim())         missing.push({ field: 'Phone Number',    tab: 'contact',  key: 'phone' });
    if (!form.offeredDoj)            missing.push({ field: 'Date of Joining', tab: 'official', key: 'offeredDoj' });
    if (!form.department)            missing.push({ field: 'Department',      tab: 'official', key: 'department' });
    if (!form.desig)                 missing.push({ field: 'Designation',     tab: 'official', key: 'desig' });
    if (!form.salary)                missing.push({ field: 'Monthly Salary',  tab: 'banking',  key: 'salary' });
    if (!form.panNumber?.trim())     missing.push({ field: 'PAN Card No',     tab: 'banking',  key: 'panNumber' });
    if (!form.bankAccountNo?.trim()) missing.push({ field: 'Bank Account No', tab: 'banking',  key: 'bankAccountNo' });
    if (!form.bankIfsc?.trim())      missing.push({ field: 'Bank IFSC Code',  tab: 'banking',  key: 'bankIfsc' });
    const completed = 11 - missing.length;
    const percent   = Math.round((completed / 11) * 100);
    return { percent, isReady: missing.length === 0, missing, completed };
  }, [form]);

  /* ── Document checklist ── */
  const checklistAudit = useMemo(() => {
    let receivedCount = 0;
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
      if (form.documentsChecklist?.[item.id]?.received) receivedCount++;
    });
    return { receivedCount, total: DEFAULT_CHECKLIST_ITEMS.length };
  }, [form.documentsChecklist]);

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.appNo)                          { showToast('Please select an employee first', 'error'); return; }
    if (!form.name.trim() || !form.phone.trim()) { showToast('Name and Phone are mandatory', 'error'); return; }
    try {
      setSaving(true);
      const combinedSalary = form.incentive && String(form.incentive).trim()
        ? `${String(form.salary).trim()}|${String(form.incentive).trim()}`
        : String(form.salary).trim();
      const payload = {
        isFullEdit: true,
        name: form.name, gender: form.gender, dob: form.dob, bloodGroup: form.bloodGroup,
        maritalStatus: form.maritalStatus, religion: form.religion, caste: form.caste,
        fatherDetails: form.fatherDetails, motherDetails: form.motherDetails,
        emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
        phone: form.phone, altPhone: form.altPhone, email: form.email,
        address: form.address, permanentAddress: form.permanentAddress,
        desig: form.desig, department: form.department, section: form.section,
        branch: form.branch, reportingManager: form.reportingManager,
        offeredDoj: form.offeredDoj, status: form.status, salary: combinedSalary,
        panNumber: form.panNumber, bankName: form.bankName, bankAccountNo: form.bankAccountNo,
        bankIfsc: form.bankIfsc, uanNumber: form.uanNumber, esiNumber: form.esiNumber,
        qualification: form.qualification, experience: form.experience,
        retailExperience: form.retailExperience, previousCompany: form.previousCompany,
        previousDesignation: form.previousDesignation, previousSalary: form.previousSalary,
        expectedSalary: form.expectedSalary, noticePeriod: form.noticePeriod,
        languagesKnown: form.languagesKnown, remarks: form.remarks,
        documentsChecklist: form.documentsChecklist, greythrSynced: form.greythrSynced,
        greythrReady: form.greythrReady,
      };
      await API.updateCandidate(form.appNo, payload);
      showToast(`Master profile for ${form.name} saved! 🎉`, 'success');
      setEmployees(prev => prev.map(e => e.appNo === form.appNo ? { ...e, ...payload } : e));
    } catch (err: any) {
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Checklist helpers ── */
  const handleToggleChecklist = (docId: string) => {
    setForm((prev: any) => {
      const cur = prev.documentsChecklist?.[docId] || {};
      return { ...prev, documentsChecklist: { ...prev.documentsChecklist, [docId]: {
        received: !cur.received,
        date: !cur.received ? new Date().toISOString().slice(0,10) : '',
        remarks: cur.remarks || '',
      }}};
    });
  };
  const handleChecklistRemarkChange = (docId: string, remarks: string) => {
    setForm((prev: any) => ({
      ...prev,
      documentsChecklist: { ...prev.documentsChecklist, [docId]: {
        ...(prev.documentsChecklist?.[docId] || { received: true, date: new Date().toISOString().slice(0,10) }),
        remarks,
      }},
    }));
  };

  /* ── greytHR Excel export ── */
  const handleExportGreythrExcel = () => {
    if (employees.length === 0) { showToast('No employees to export', 'error'); return; }
    const rows = employees.map(emp => {
      let base = '', inc = '';
      const s = String(emp.salary || '').trim();
      if (s.includes('|')) { const p = s.split('|'); base = p[0]; inc = p[1]||''; }
      else { base = s.replace(/[^0-9.]/g,'') || s; }
      return {
        'Employee Number': emp.appNo || '',
        'Employee Name': emp.name || '',
        'Gender': (emp.gender || 'MALE').toUpperCase(),
        'Date of Birth': emp.dob || '',
        'Date of Joining': emp.offeredDoj || emp.actualDoj || emp.estDoj || '',
        'Department': emp.department || '',
        'Section': emp.section || '',
        'Designation': emp.desig || emp.designation || '',
        'Branch / Location': emp.branch || 'Main Branch',
        'Reporting Manager': emp.reportingManager || '',
        'Employee Status': emp.status || 'Joined',
        'Base Monthly Salary': base, 'Monthly Incentive': inc,
        'Bank Account Number': emp.bankAccountNo || '',
        'Bank Name': emp.bankName || '',
        'Bank IFSC Code': emp.bankIfsc || '',
        'PAN Number': emp.panNumber || '',
        'Aadhaar Number': emp.aadhaarNumber || '',
        'UAN Number': emp.uanNumber || '',
        'ESI Number': emp.esiNumber || '',
        'Mobile Phone': emp.phone || '',
        'Email Address': emp.email || '',
        'Present Address': emp.address || '',
        'Permanent Address': emp.permanentAddress || emp.address || '',
        'Blood Group': emp.bloodGroup || '',
        'Marital Status': emp.maritalStatus || 'Single',
        'Religion': emp.religion || 'Hindu',
        'Caste': emp.caste || '',
        'Father Name': emp.fatherDetails || '',
        'Mother Name': emp.motherDetails || '',
        'Emergency Contact Person': emp.emergencyContact || '',
        'Emergency Phone': emp.emergencyPhone || '',
        'Highest Qualification': emp.qualification || '',
        'Total Experience': emp.experience || '',
        'Prior Retail Exp': emp.retailExperience || emp.retail_experience || '',
        'Previous Company': emp.previousCompany || emp.previous_company || '',
        'Previous Designation': emp.previousDesignation || emp.previous_designation || '',
        'greytHR Onboarding Status': emp.greythrReady ? 'READY' : 'NOT READY',
        'greytHR Sync Status': emp.greythrSynced ? 'SYNCED' : 'PENDING',
        'Export Timestamp': new Date().toLocaleString('en-IN'),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'greytHR_Employee_Master');
    XLSX.writeFile(wb, `greytHR_BSC_Employees_Master_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`Exported ${rows.length} records for greytHR! 🚀`, 'success');
  };

  /* ── Filtered list ── */
  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    const matchQ = !q || (emp.name||'').toLowerCase().includes(q) || (emp.appNo||'').toLowerCase().includes(q) || (emp.phone||'').includes(q) || (emp.desig||'').toLowerCase().includes(q);
    const matchDept = !deptFilter || (emp.department||'').toLowerCase() === deptFilter.toLowerCase();
    let matchR = true;
    if (readinessFilter === 'ready')   matchR = Boolean(emp.greythrReady);
    if (readinessFilter === 'pending') matchR = !emp.greythrReady;
    return matchQ && matchDept && matchR;
  }), [employees, searchQuery, deptFilter, readinessFilter]);

  const stats = useMemo(() => ({
    total: employees.length,
    ready: employees.filter(e => Boolean(e.greythrReady)).length,
    docsComplete: employees.filter(e => {
      const cl = e.documentsChecklist;
      if (!cl || typeof cl !== 'object') return false;
      return DEFAULT_CHECKLIST_ITEMS.filter(i => i.mandatory).every(i => cl[i.id]?.received);
    }).length,
  }), [employees]);

  const selectedEmp = useMemo(() => employees.find(e => e.appNo === selectedAppNo), [employees, selectedAppNo]);

  /* ── Styling helpers ── */
  const inp = 'w-full px-3 py-2 text-[13px] font-medium bg-[#F9F7F4] border border-[#DDD9D0] rounded-xl outline-none focus:border-[#C9952A] focus:bg-white transition-colors text-[#1E2D4E]';
  const sel = 'w-full px-3 py-2 text-[13px] font-medium bg-[#F9F7F4] border border-[#DDD9D0] rounded-xl outline-none focus:border-[#C9952A] focus:bg-white transition-colors text-[#1E2D4E] cursor-pointer';
  const lbl = 'block text-[11px] font-black text-[#1E2D4E] mb-1 uppercase tracking-wide';

  /* helper for field wrappers */
  const F = (label: string, children: React.ReactNode, span2 = false) => (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#EDE8DE] flex font-sans">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        <Topbar
          title="Employee Master & greytHR Pre-Onboarding Hub"
          breadcrumbs={[{ label: 'Talent Management', href: '/employees' }, { label: 'Employee Master (greytHR)' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 p-3 sm:p-6 space-y-4 overflow-y-auto">

          {/* Page header */}
          <div className="bg-white rounded-2xl p-4 border border-[#C9952A]/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1E2D4E] text-[#C9952A]"><UserCheck className="w-5 h-5" /></div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-[#1E2D4E] tracking-tight">Employee Master Data & greytHR Pre-Onboarding</h1>
                <p className="text-[11px] text-[#666] font-semibold mt-0.5">Select any employee to open their full master profile editor, verify documents & export for greytHR.</p>
              </div>
            </div>
            <button onClick={handleExportGreythrExcel} className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs transition-all shadow">
              <Download className="w-3.5 h-3.5" /> Export greytHR (.xlsx)
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Employees',  value: stats.total,        bg: 'bg-[#1E2D4E]'   },
              { label: 'greytHR Ready',    value: stats.ready,        bg: 'bg-emerald-700'  },
              { label: 'Docs Complete',    value: stats.docsComplete, bg: 'bg-[#C9952A]'   },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center text-white shadow-md`}>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-[11px] font-bold mt-0.5 opacity-90">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

            {/* Employee list – 4 cols */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E2DFD7] shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2DFD7] flex items-center justify-between bg-[#F9F7F4]">
                <span className="font-black text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#C9952A]" /> Employees ({filteredEmployees.length})
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">{stats.ready} Ready</span>
              </div>

              <div className="p-3 space-y-2 border-b border-[#E2DFD7]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, phone, App ID..." className="w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-xl bg-[#F9F7F4] border border-[#E2DFD7] text-[#1E2D4E] outline-none focus:border-[#C9952A]" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="text-[11px] font-bold p-1.5 rounded-lg bg-[#F9F7F4] border border-[#E2DFD7] text-[#1E2D4E] outline-none">
                    <option value="">All Departments</option>
                    {BSC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={readinessFilter} onChange={e => setReadinessFilter(e.target.value as any)} className="text-[11px] font-bold p-1.5 rounded-lg bg-[#F9F7F4] border border-[#E2DFD7] text-[#1E2D4E] outline-none">
                    <option value="all">All Profiles</option>
                    <option value="ready">greytHR Ready ✅</option>
                    <option value="pending">Missing Info ⚠️</option>
                  </select>
                </div>
              </div>

              <div className="max-h-[calc(100vh-360px)] overflow-y-auto divide-y divide-[#F0EDE8]">
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#C9952A] mx-auto mb-2" />
                    <p className="text-xs text-[#888] font-semibold">Loading employees...</p>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#888] font-bold">No matching employees.</div>
                ) : filteredEmployees.map(emp => {
                  const isSel   = emp.appNo === selectedAppNo;
                  const isGReady = Boolean(emp.greythrReady);
                  return (
                    <div key={emp.appNo} onClick={() => handleSelectEmployee(emp)}
                      className={`px-4 py-3 cursor-pointer transition-all flex items-center gap-3 group ${isSel ? 'bg-[#1E2D4E]' : 'bg-white hover:bg-[#F9F7F4]'}`}>
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-xs ${isSel ? 'bg-[#C9952A] text-slate-900' : 'bg-[#1E2D4E] text-white'}`}>
                        {emp.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black text-[13px] truncate ${isSel ? 'text-white' : 'text-[#1E2D4E]'}`}>{formatName(emp.name)}</div>
                        <div className={`text-[10px] font-mono truncate ${isSel ? 'text-[#C9952A]' : 'text-[#888]'}`}>{emp.appNo} · {emp.desig || emp.department || 'Staff'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <StatusBadge status={emp.status || 'Joined'} size="sm" />
                        {isGReady
                          ? <span className={`text-[9px] font-black uppercase flex items-center gap-0.5 ${isSel ? 'text-emerald-300' : 'text-emerald-600'}`}><CheckCircle2 className="w-2.5 h-2.5" /> gHR Ready</span>
                          : <span className={`text-[9px] font-bold uppercase flex items-center gap-0.5 ${isSel ? 'text-slate-400' : 'text-slate-400'}`}>○ Not Ready</span>
                        }
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSel ? 'text-white/40' : 'text-[#CCC] group-hover:text-[#1E2D4E]'} transition-colors`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right panel – 8 cols */}
            <div className="lg:col-span-8 space-y-4">
              {!selectedAppNo ? (
                /* Placeholder when nothing selected */
                <div className="bg-white rounded-2xl border border-[#E2DFD7] shadow-md p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#1E2D4E] text-[#C9952A] mx-auto flex items-center justify-center mb-4"><UserCheck className="w-8 h-8" /></div>
                  <h3 className="text-base font-black text-[#1E2D4E] mb-2">Select an Employee to Edit</h3>
                  <p className="text-xs text-[#888] font-semibold max-w-xs mx-auto">Click any employee from the list to open their complete master profile in a full-screen editor modal.</p>
                  <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto text-[11px] text-[#666] font-bold">
                    {['👤 Personal & Identity','💳 Bank & greytHR CTC','📋 Document Checklist'].map(t => (
                      <div key={t} className="bg-[#F9F7F4] rounded-xl p-3 text-center leading-tight">{t}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected employee summary card */}
                  <div className="bg-white rounded-2xl border border-[#E2DFD7] shadow-md p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        {form.photoUrl
                          ? <img src={form.photoUrl} alt={form.name} onError={e => {(e.target as HTMLImageElement).style.display='none';}} className="w-16 h-16 rounded-2xl object-cover border-2 border-[#C9952A] shadow-md flex-shrink-0" />
                          : <div className="w-16 h-16 rounded-2xl bg-[#1E2D4E] text-white flex items-center justify-center font-black text-xl flex-shrink-0">{form.name?.slice(0,2).toUpperCase()}</div>
                        }
                        <div>
                          <h2 className="text-lg font-black text-[#1E2D4E]">{formatName(form.name)}</h2>
                          <p className="text-xs font-mono text-[#C9952A] font-bold">{form.appNo}</p>
                          <p className="text-xs text-[#666] font-semibold">{form.desig || form.department || '—'}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <StatusBadge status={form.status || 'Joined'} size="sm" />
                            {readinessAudit.isReady
                              ? <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> greytHR Ready</span>
                              : <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> {readinessAudit.missing.length} Fields Missing</span>
                            }
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setModalOpen(true)}
                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white font-black text-xs transition-all shadow-md border border-[#C9952A]/40">
                        <Edit3 className="w-3.5 h-3.5 text-[#C9952A]" /> Edit Full Profile
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-[#1E2D4E]">greytHR Profile Completeness: {readinessAudit.percent}%</span>
                        <span className="font-bold text-[#666]">Docs Verified: {checklistAudit.receivedCount}/{checklistAudit.total}</span>
                      </div>
                      <div className="w-full bg-[#EDE8DE] h-2 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${readinessAudit.isReady ? 'bg-emerald-600' : readinessAudit.percent > 70 ? 'bg-[#C9952A]' : 'bg-rose-500'}`} style={{ width: `${readinessAudit.percent}%` }} />
                      </div>
                      {readinessAudit.missing.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-extrabold text-[#777]">Quick Fill:</span>
                          {readinessAudit.missing.map(m => (
                            <button key={m.key} onClick={() => { setActiveTab(m.tab); setModalOpen(true); }}
                              className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors">
                              + {m.field}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="bg-white rounded-2xl border border-[#E2DFD7] shadow-md p-4">
                    <h3 className="text-xs font-black text-[#1E2D4E] uppercase tracking-wider mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#C9952A]" /> greytHR Pre-Onboarding Status</h3>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Total employees loaded',   val: `${stats.total} employees`, done: stats.total > 0 },
                        { label: 'PAN + Bank details filled', val: `${stats.ready} of ${stats.total}`, done: stats.ready === stats.total },
                        { label: 'Mandatory docs received',  val: `${stats.docsComplete} of ${stats.total}`, done: stats.docsComplete === stats.total },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between text-[12px]">
                          <span className="flex items-center gap-1.5 text-[#555] font-semibold">
                            {row.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            {row.label}
                          </span>
                          <span className={`font-black text-xs ${row.done ? 'text-emerald-700' : 'text-amber-700'}`}>{row.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════
          EMPLOYEE MASTER EDITOR MODAL
      ════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5"
          style={{ background: 'rgba(15,25,50,0.72)', backdropFilter: 'blur(5px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl border border-[#C9952A]/20 flex flex-col overflow-hidden"
            style={{ width: '92vw', maxWidth: '1380px', height: '91vh', maxHeight: '880px' }}
            onClick={e => e.stopPropagation()}
          >

            {/* Modal header */}
            <div className="flex-shrink-0 bg-[#1E2D4E] px-5 py-3.5 flex items-center gap-4">
              {form.photoUrl
                ? <img src={form.photoUrl} alt={form.name} onError={e => {(e.target as HTMLImageElement).style.display='none';}} className="w-11 h-11 rounded-xl object-cover border-2 border-[#C9952A] flex-shrink-0" />
                : <div className="w-11 h-11 rounded-xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black text-sm flex-shrink-0">{form.name?.slice(0,2).toUpperCase()||'EM'}</div>
              }
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-black text-[15px] truncate leading-tight">{formatName(form.name)||'Employee Profile'}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[#C9952A] text-[11px] font-mono font-bold">{form.appNo}</span>
                  {form.desig && <span className="text-white/60 text-[11px] font-semibold">{form.desig}</span>}
                  {form.department && <span className="text-white/40 text-[11px]">· {form.department}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {readinessAudit.isReady
                  ? <span className="hidden sm:flex text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/30 items-center gap-1"><CheckCircle2 className="w-3 h-3" /> greytHR Ready</span>
                  : <span className="hidden sm:flex text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2.5 py-1 rounded-full border border-amber-500/30 items-center gap-1"><AlertTriangle className="w-3 h-3" /> {readinessAudit.missing.length} Missing</span>
                }
                <button onClick={handleSave} disabled={saving || !form.appNo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b8831e] text-slate-900 font-black text-xs transition-all disabled:opacity-50 shadow">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setModalOpen(false)} title="Close (ESC)"
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── greytHR Readiness Status Segmented Control ── */}
            <div className="flex-shrink-0 bg-[#F0EDE8] border-b border-[#DDD9D0] px-5 py-2.5 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-black text-[#1E2D4E] uppercase tracking-widest flex-shrink-0">greytHR Onboarding Status</span>
              <div className="flex items-center rounded-xl overflow-hidden border border-[#C9952A]/40 shadow-sm flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setForm({...form, greythrReady: true})}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black transition-all ${
                    form.greythrReady
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-[#666] hover:bg-emerald-50 hover:text-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Ready for greytHR
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, greythrReady: false})}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black transition-all border-l border-[#C9952A]/30 ${
                    !form.greythrReady
                      ? 'bg-[#1E2D4E] text-white'
                      : 'bg-white text-[#666] hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 inline-flex items-center justify-center rounded-full border-2 border-current text-[7px]">○</span>
                  Not Ready
                </button>
              </div>
              <span className="text-[10px] text-[#888] font-semibold hidden sm:block">Saved when you click "Save Changes"</span>
            </div>

            {/* Quick-fill bar */}
            {readinessAudit.missing.length > 0 && (
              <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-5 py-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-extrabold text-amber-800 flex-shrink-0">Quick Fill:</span>
                {readinessAudit.missing.map(m => (
                  <button key={m.key} onClick={() => setActiveTab(m.tab)}
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors">
                    + {m.field}
                  </button>
                ))}
                <span className="ml-auto text-[10px] font-black text-amber-700 flex-shrink-0">{readinessAudit.percent}% · Docs {checklistAudit.receivedCount}/{checklistAudit.total}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex-shrink-0 bg-[#F9F7F4] border-b border-[#E2DFD7] px-3 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-0 min-w-max">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-black whitespace-nowrap border-b-2 transition-all ${activeTab === t.id ? 'border-[#C9952A] text-[#1E2D4E] bg-white' : 'border-transparent text-[#777] hover:text-[#1E2D4E] hover:bg-white/60'}`}>
                    <span>{t.emoji}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable form area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7">

              {/* ── Personal & Identity ── */}
              {activeTab === 'personal' && (
                <div className="space-y-5">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Users className="w-4 h-4 text-[#C9952A]" /> Candidate Identity & Family Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Full Legal Name *', <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inp} />)}
                    {F('Gender *',
                      <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className={sel}>
                        <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                      </select>
                    )}
                    {F('Date of Birth (DOB) *', <input type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className={inp} />)}
                    {F('Blood Group',
                      <select value={form.bloodGroup} onChange={e => setForm({...form, bloodGroup: e.target.value})} className={sel}>
                        <option value="">Select Blood Group</option>
                        {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )}
                    {F('Marital Status',
                      <select value={form.maritalStatus} onChange={e => setForm({...form, maritalStatus: e.target.value})} className={sel}>
                        {['Single','Married','Divorced','Widowed'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {F('Religion',
                      <select value={form.religion} onChange={e => setForm({...form, religion: e.target.value})} className={sel}>
                        {['Hindu','Muslim','Christian','Jain','Sikh','Buddhist','Other'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {F('Caste / Category', <input type="text" value={form.caste} onChange={e => setForm({...form, caste: e.target.value})} placeholder="e.g. General, OBC, SC, ST..." className={inp} />)}
                    {F("Father's Name & Details", <input type="text" value={form.fatherDetails} onChange={e => setForm({...form, fatherDetails: e.target.value})} placeholder="Father's full name & occupation" className={inp} />)}
                    {F("Mother's Name & Details", <input type="text" value={form.motherDetails} onChange={e => setForm({...form, motherDetails: e.target.value})} placeholder="Mother's full name" className={inp} />)}
                    <div>
                      <label className={lbl}>Emergency Contact Person & Phone</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={form.emergencyContact} onChange={e => setForm({...form, emergencyContact: e.target.value})} placeholder="Contact person name" className={inp} />
                        <input type="text" value={form.emergencyPhone} onChange={e => setForm({...form, emergencyPhone: e.target.value})} placeholder="Emergency phone" className={inp + ' font-mono'} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Contact & Address ── */}
              {activeTab === 'contact' && (
                <div className="space-y-5">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <MapPin className="w-4 h-4 text-[#C9952A]" /> Contact Details & Residential Addresses
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Primary Mobile Phone *', <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inp + ' font-mono'} />)}
                    {F('Alternate Phone Number', <input type="text" value={form.altPhone} onChange={e => setForm({...form, altPhone: e.target.value})} placeholder="Optional alternate mobile" className={inp + ' font-mono'} />)}
                    {F('Official / Personal Email', <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="employee@example.com" className={inp} />, true)}
                    {F('Present / Current Residential Address', <textarea rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Door No, Street, Landmark, Area, City..." className={inp} />, true)}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className={lbl}>Permanent Hometown Address</label>
                        <button type="button" onClick={() => setForm({...form, permanentAddress: form.address})} className="text-[10.5px] font-extrabold text-[#C9952A] hover:underline">Copy from Present Address</button>
                      </div>
                      <textarea rows={2} value={form.permanentAddress} onChange={e => setForm({...form, permanentAddress: e.target.value})} placeholder="Permanent native place address..." className={inp} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Store & Section ── */}
              {activeTab === 'official' && (
                <div className="space-y-5">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Store className="w-4 h-4 text-[#C9952A]" /> Store Deployment & Designation Role
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Designation Role *', <input type="text" value={form.desig} onChange={e => setForm({...form, desig: e.target.value})} placeholder="e.g. Sales Executive, Cashier..." className={inp} />)}
                    {F('Allocated Department *',
                      <select value={form.department} onChange={e => {
                        const nd = e.target.value;
                        const secs = getSectionsForDepartment(nd);
                        setForm({...form, department: nd, section: secs.includes(form.section) ? form.section : (secs[0]||'')});
                      }} className={sel}>
                        <option value="">Select Department</option>
                        {BSC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={lbl}>Allocated Section / Counter Area</label>
                        <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Dept Section</span>
                      </div>
                      <div className="space-y-1.5">
                        <select value={form.section} onChange={e => setForm({...form, section: e.target.value})} className={sel}>
                          <option value="">-- Select Section --</option>
                          {currentDeptSections.map(s => <option key={s} value={s}>{s}</option>)}
                          {form.section && !currentDeptSections.includes(form.section) && <option value={form.section}>{form.section} (Custom)</option>}
                        </select>
                        <input type="text" value={form.section} onChange={e => setForm({...form, section: e.target.value})} placeholder="Or enter custom section..." className={inp + ' text-xs'} />
                      </div>
                    </div>
                    {F('Date of Joining (DOJ) *', <input type="date" value={form.offeredDoj} onChange={e => setForm({...form, offeredDoj: e.target.value})} className={inp + ' font-bold text-amber-800'} />)}
                    {F('Employee Status',
                      <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={sel}>
                        <option value="Successfully Joined Store">🏪 Successfully Joined Store</option>
                        <option value="Joined">Joined</option>
                        <option value="Joined Store">Joined Store</option>
                        <option value="Offer Accepted">Offer Accepted</option>
                        <option value="Selected">Selected</option>
                        <option value="Probation">Probation</option>
                        <option value="Resigned">Resigned</option>
                      </select>
                    )}
                    {F('Store / Branch Location', <input type="text" value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className={inp} />)}
                    {F('Reporting Manager', <input type="text" value={form.reportingManager} onChange={e => setForm({...form, reportingManager: e.target.value})} placeholder="e.g. Store Manager" className={inp} />)}
                    <div className="sm:col-span-2">
                      <label className={lbl}>greytHR Sync Status</label>
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="checkbox" id="greythrSynced" checked={form.greythrSynced} onChange={e => setForm({...form, greythrSynced: e.target.checked})} className="w-4 h-4 rounded text-emerald-600 cursor-pointer" />
                        <span className="text-[13px] font-bold text-[#1E2D4E]">Mark as Uploaded / Synced in greytHR Software</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Bank & greytHR CTC ── */}
              {activeTab === 'banking' && (
                <div className="space-y-5">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <CreditCard className="w-4 h-4 text-[#C9952A]" /> Compensation, Banking & Statutory IDs (greytHR Ready)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#F9F7F4] rounded-2xl border border-[#E2DFD7]">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#777] mb-1">Monthly Base Salary (₹) *</label>
                      <input type="text" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} placeholder="e.g. 20000" className={inp + ' font-mono font-black text-emerald-800'} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#777] mb-1">Monthly Incentive (₹)</label>
                      <input type="text" value={form.incentive} onChange={e => setForm({...form, incentive: e.target.value})} placeholder="e.g. 2000" className={inp + ' font-mono font-bold text-emerald-700'} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">Total Monthly Gross Package</label>
                      <div className="py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-black text-slate-900 font-mono">
                        ₹{((parseFloat(form.salary)||0)+(parseFloat(form.incentive)||0)).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Bank Name *', <input type="text" value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} placeholder="e.g. State Bank of India, HDFC Bank..." className={inp} />)}
                    {F('Bank Account Number *', <input type="text" value={form.bankAccountNo} onChange={e => setForm({...form, bankAccountNo: e.target.value})} placeholder="Account Number" className={inp + ' font-mono'} />)}
                    {F('Bank IFSC Code *', <input type="text" value={form.bankIfsc} onChange={e => setForm({...form, bankIfsc: e.target.value.toUpperCase()})} placeholder="e.g. SBIN0001234" className={inp + ' font-mono uppercase'} />)}
                    {F('PAN Card Number *', <input type="text" value={form.panNumber} onChange={e => setForm({...form, panNumber: e.target.value.toUpperCase()})} placeholder="e.g. ABCDE1234F" maxLength={10} className={inp + ' font-mono uppercase'} />)}
                    {F('PF UAN (Universal Account Number)', <input type="text" value={form.uanNumber} onChange={e => setForm({...form, uanNumber: e.target.value})} placeholder="12-digit UAN" maxLength={12} className={inp + ' font-mono'} />)}
                    {F('ESI IP (Insurance Number)', <input type="text" value={form.esiNumber} onChange={e => setForm({...form, esiNumber: e.target.value})} placeholder="ESI IP Number" className={inp + ' font-mono'} />)}
                  </div>
                </div>
              )}

              {/* ── Document Checklist ── */}
              {activeTab === 'checklist' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-2">
                    <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-[#C9952A]" /> Pre-Onboarding Document Verification Checklist
                    </h4>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">{checklistAudit.receivedCount} of {checklistAudit.total} Verified</span>
                  </div>
                  <div className="border border-[#E2DFD7] rounded-2xl overflow-hidden divide-y divide-[#E2DFD7]/70">
                    {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => {
                      const status = form.documentsChecklist?.[item.id] || { received: false, date: '', remarks: '' };
                      return (
                        <div key={item.id} className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${status.received ? 'bg-emerald-50/40' : 'bg-white'}`}>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => handleToggleChecklist(item.id)} className="focus:outline-none flex-shrink-0">
                              {status.received ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-[#999] hover:text-[#1E2D4E]" />}
                            </button>
                            <div>
                              <span className={`text-[13px] font-bold block ${status.received ? 'text-emerald-950 font-black' : 'text-[#1E2D4E]'}`}>{idx+1}. {item.label}</span>
                              {item.mandatory && <span className="text-[10px] text-amber-800 font-extrabold uppercase">Required for greytHR</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                            <input type="date" value={status.date||''} title="Date Received"
                              onChange={e => setForm((prev: any) => ({ ...prev, documentsChecklist: { ...prev.documentsChecklist, [item.id]: { ...(prev.documentsChecklist?.[item.id]||{received:true}), date: e.target.value }}}))}
                              className="text-[11px] p-1.5 rounded-lg border border-[#E2DFD7] bg-white font-mono" />
                            <input type="text" value={status.remarks||''} onChange={e => handleChecklistRemarkChange(item.id, e.target.value)}
                              placeholder="Verification remarks..." className="text-[11px] p-1.5 rounded-lg border border-[#E2DFD7] bg-white w-full sm:w-44 font-medium" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Experience & Education ── */}
              {activeTab === 'experience' && (
                <div className="space-y-5">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Briefcase className="w-4 h-4 text-[#C9952A]" /> Education, Past Retail Experience & HR Notes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Highest Educational Qualification', <input type="text" value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value})} placeholder="e.g. 10th, 12th / PUC, B.Com, BA..." className={inp} />)}
                    {F('Total Work Experience', <input type="text" value={form.experience} onChange={e => setForm({...form, experience: e.target.value})} placeholder="e.g. 2 Years, Fresher..." className={inp} />)}
                    {F('Prior Retail Experience', <input type="text" value={form.retailExperience} onChange={e => setForm({...form, retailExperience: e.target.value})} placeholder="e.g. 1 Year in Garments / Textiles" className={inp} />)}
                    {F('Previous Company / Employer', <input type="text" value={form.previousCompany} onChange={e => setForm({...form, previousCompany: e.target.value})} placeholder="Previous company name" className={inp} />)}
                    {F('Previous Role / Designation', <input type="text" value={form.previousDesignation} onChange={e => setForm({...form, previousDesignation: e.target.value})} placeholder="Previous role" className={inp} />)}
                    {F('Previous Salary (₹)', <input type="text" value={form.previousSalary} onChange={e => setForm({...form, previousSalary: e.target.value})} placeholder="Previous salary" className={inp + ' font-mono'} />)}
                    {F('HR & Onboarding Remarks', <textarea rows={3} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Internal onboarding notes, verification status..." className={inp} />, true)}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex-shrink-0 bg-[#F9F7F4] border-t border-[#E2DFD7] px-5 py-3 flex items-center justify-between">
              <div className="text-xs text-[#777] font-semibold">
                Editing: <span className="font-black text-[#1E2D4E]">{form.name} ({form.appNo})</span>
                {' · '}
                <span className={readinessAudit.isReady ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>{readinessAudit.percent}% greytHR Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-[#DDD9D0] text-[#555] font-bold text-xs hover:bg-white transition-colors">Close</button>
                <button onClick={handleSave} disabled={saving || !form.appNo}
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white font-black text-xs transition-all shadow flex items-center gap-1.5 border border-[#C9952A]/40 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C9952A]" /> : <Save className="w-3.5 h-3.5 text-[#C9952A]" />}
                  {saving ? 'Saving to Database...' : 'Save All Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

