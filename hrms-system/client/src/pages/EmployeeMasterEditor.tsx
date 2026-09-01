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
  Edit3,
  Filter,
  Check,
  AlertCircle
} from 'lucide-react';
import { API, Auth, UserSession } from '../services/api';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import StatusBadge from '../components/ui/StatusBadge';
import { BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';
import { formatName } from '../utils/formatName';
import * as XLSX from 'xlsx';

// ONLY 5 REQUIRED PRE-ONBOARDING DOCUMENTS
const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'aadhaar',     label: 'Aadhaar Card (Self-Attested Copy)',        sub: 'Required for greytHR', mandatory: true  },
  { id: 'pan',         label: 'PAN Card Copy',                            sub: 'Required for greytHR', mandatory: true  },
  { id: 'bank',        label: 'Bank Passbook / Cancelled Cheque',         sub: 'Required for greytHR', mandatory: true  },
  { id: 'relieving',   label: 'Previous Relieving / Experience Letter',   sub: '',                     mandatory: false },
  { id: 'photos',      label: 'Passport Size Photographs (3 copies)',     sub: 'Required for greytHR', mandatory: true  },
];

const TABS = [
  { id: 'personal',   label: 'Personal & Identity',    emoji: '👤' },
  { id: 'contact',    label: 'Contact & Address',       emoji: '📞' },
  { id: 'official',   label: 'Store & Section',         emoji: '🏪' },
  { id: 'banking',    label: 'Bank & greytHR',          emoji: '💳' },
  { id: 'checklist',  label: 'Document Verification',   emoji: '📋' },
  { id: 'experience', label: 'Experience & Education',  emoji: '💼' },
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
  const [kpiFilter, setKpiFilter]       = useState<'all' | 'ready' | 'not_ready' | 'attention'>('all');
  const [selectedAppNo, setSelectedAppNo] = useState('');
  const [modalOpen, setModalOpen]       = useState(false);
  const [activeTab, setActiveTab]       = useState<TabId>('personal');
  const [form, setForm]                 = useState<any>(EMPTY_FORM);

  /* ── Helper: check if profile needs attention (missing key fields) ── */
  const needsAttention = useCallback((emp: any) => {
    return !emp.name?.trim() ||
           !emp.phone?.trim() ||
           !emp.dob ||
           !emp.department ||
           !emp.desig ||
           !emp.panNumber?.trim() ||
           !emp.bankAccountNo?.trim() ||
           !emp.bankIfsc?.trim();
  }, []);

  /* ── Data loading (ONLY Joined Store Employees) ── */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await API.getEmployees({ storeOnly: true });
      const rawList = Array.isArray(res) ? res : (res?.employees || []);
      // Strictly include only employees who are in the Joined Store
      const list = rawList.filter((e: any) => {
        const s = (e.status || '').toLowerCase().trim();
        const os = (e.offer_status || e.offerStatus || '').toLowerCase().trim();
        return s.includes('store') || s === 'successfully joined store' || s === 'joined store' ||
               os.includes('store') || os === 'successfully joined store' || os === 'joined store';
      });
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

  /* ── Document checklist count (factual count only, NO percentages) ── */
  const checklistAudit = useMemo(() => {
    let receivedCount = 0;
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
      if (form.documentsChecklist?.[item.id]?.received) receivedCount++;
    });
    return {
      receivedCount,
      pendingCount: DEFAULT_CHECKLIST_ITEMS.length - receivedCount,
      total: DEFAULT_CHECKLIST_ITEMS.length
    };
  }, [form.documentsChecklist]);

  /* ── Missing Profile Information for Quick Indicators ── */
  const missingProfileFields = useMemo(() => {
    const missing: { field: string; tab: TabId; key: string }[] = [];
    if (!form.name?.trim())          missing.push({ field: 'Full Name',       tab: 'personal', key: 'name' });
    if (!form.dob)                   missing.push({ field: 'Date of Birth',   tab: 'personal', key: 'dob' });
    if (!form.phone?.trim())         missing.push({ field: 'Phone Number',    tab: 'contact',  key: 'phone' });
    if (!form.offeredDoj)            missing.push({ field: 'Date of Joining', tab: 'official', key: 'offeredDoj' });
    if (!form.department)            missing.push({ field: 'Department',      tab: 'official', key: 'department' });
    if (!form.desig)                 missing.push({ field: 'Designation',     tab: 'official', key: 'desig' });
    if (!form.salary)                missing.push({ field: 'Monthly Salary',  tab: 'banking',  key: 'salary' });
    if (!form.panNumber?.trim())     missing.push({ field: 'PAN Card No',     tab: 'banking',  key: 'panNumber' });
    if (!form.bankAccountNo?.trim()) missing.push({ field: 'Bank Account No', tab: 'banking',  key: 'bankAccountNo' });
    if (!form.bankIfsc?.trim())      missing.push({ field: 'Bank IFSC Code',  tab: 'banking',  key: 'bankIfsc' });
    return missing;
  }, [form]);

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.appNo) { showToast('Please select an employee first', 'error'); return; }
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
      showToast(`Master profile for ${form.name} saved successfully! 🎉`, 'success');
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
      const newReceived = !cur.received;
      return {
        ...prev,
        documentsChecklist: {
          ...prev.documentsChecklist,
          [docId]: {
            received: newReceived,
            date: newReceived ? (cur.date || new Date().toISOString().slice(0,10)) : '',
            remarks: cur.remarks || '',
          }
        }
      };
    });
  };

  const handleChecklistDateChange = (docId: string, date: string) => {
    setForm((prev: any) => ({
      ...prev,
      documentsChecklist: {
        ...prev.documentsChecklist,
        [docId]: {
          ...(prev.documentsChecklist?.[docId] || { received: true }),
          date,
        }
      }
    }));
  };

  const handleChecklistRemarkChange = (docId: string, remarks: string) => {
    setForm((prev: any) => ({
      ...prev,
      documentsChecklist: {
        ...prev.documentsChecklist,
        [docId]: {
          ...(prev.documentsChecklist?.[docId] || { received: true, date: new Date().toISOString().slice(0,10) }),
          remarks,
        }
      }
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

  /* ── Stats Calculations (4 Primary KPIs, NO document percentages) ── */
  const stats = useMemo(() => ({
    total: employees.length,
    ready: employees.filter(e => Boolean(e.greythrReady)).length,
    notReady: employees.filter(e => !e.greythrReady).length,
    attention: employees.filter(e => needsAttention(e)).length,
  }), [employees, needsAttention]);

  /* ── Filtered list ── */
  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    const matchQ = !q ||
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.appNo || '').toLowerCase().includes(q) ||
      (emp.phone || '').includes(q);

    const matchDept = !deptFilter || (emp.department || '').toLowerCase() === deptFilter.toLowerCase();

    let matchKpi = true;
    if (kpiFilter === 'ready')       matchKpi = Boolean(emp.greythrReady);
    if (kpiFilter === 'not_ready')   matchKpi = !emp.greythrReady;
    if (kpiFilter === 'attention')   matchKpi = needsAttention(emp);

    return matchQ && matchDept && matchKpi;
  }), [employees, searchQuery, deptFilter, kpiFilter, needsAttention]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setDeptFilter('');
    setKpiFilter('all');
  };

  const isFiltered = searchQuery.trim() !== '' || deptFilter !== '' || kpiFilter !== 'all';

  /* ── Styling helpers ── */
  const inp = 'w-full px-3.5 py-2.5 text-[13px] font-semibold bg-[#F9F7F4] border border-[#DDD9D0] rounded-xl outline-none focus:border-[#C9952A] focus:bg-white transition-colors text-[#1E2D4E]';
  const sel = 'w-full px-3.5 py-2.5 text-[13px] font-semibold bg-[#F9F7F4] border border-[#DDD9D0] rounded-xl outline-none focus:border-[#C9952A] focus:bg-white transition-colors text-[#1E2D4E] cursor-pointer';
  const lbl = 'block text-[11px] font-black text-[#1E2D4E] mb-1.5 uppercase tracking-wide';

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
          title="BSC SMG CRM — Employee Master & greytHR Pre-Onboarding Hub"
          breadcrumbs={[{ label: 'Talent Management', href: '/employees' }, { label: 'Employee Master Data' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 p-3 sm:p-6 space-y-4 overflow-y-auto">

          {/* Page header */}
          <div className="bg-white rounded-2xl p-5 border border-[#C9952A]/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[#1E2D4E] text-[#C9952A] shadow-sm"><UserCheck className="w-6 h-6" /></div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-[#1E2D4E] tracking-tight">Employee Master Data & greytHR Pre-Onboarding Hub</h1>
                <p className="text-xs text-[#666] font-semibold mt-0.5">Select any employee to open their full master profile, verify required information, manage greytHR readiness and export greytHR data.</p>
              </div>
            </div>
            <button onClick={handleExportGreythrExcel} className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs transition-all shadow-md">
              <Download className="w-4 h-4" /> Export greytHR (.xlsx)
            </button>
          </div>

          {/* ── 4 Primary Interactive KPI Cards (NO document percentages) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'all',
                label: 'TOTAL EMPLOYEES',
                sub: 'All Master Records',
                value: stats.total,
                activeBg: 'bg-[#1E2D4E] text-white ring-4 ring-[#1E2D4E]/30',
                idleBg: 'bg-white text-[#1E2D4E] hover:border-[#1E2D4E]/50',
                valColor: 'text-[#1E2D4E]',
                icon: Users,
              },
              {
                id: 'ready',
                label: 'GREYTHR READY',
                sub: 'Ready for Onboarding',
                value: stats.ready,
                activeBg: 'bg-emerald-700 text-white ring-4 ring-emerald-600/30',
                idleBg: 'bg-white text-emerald-800 hover:border-emerald-500',
                valColor: 'text-emerald-700',
                icon: CheckCircle2,
              },
              {
                id: 'not_ready',
                label: 'NOT READY',
                sub: 'Pending greytHR Approval',
                value: stats.notReady,
                activeBg: 'bg-slate-700 text-white ring-4 ring-slate-600/30',
                idleBg: 'bg-white text-slate-700 hover:border-slate-400',
                valColor: 'text-slate-700',
                icon: AlertCircle,
              },
              {
                id: 'attention',
                label: 'PROFILE ATTENTION',
                sub: 'Missing Master Fields',
                value: stats.attention,
                activeBg: 'bg-rose-700 text-white ring-4 ring-rose-600/30',
                idleBg: 'bg-white text-rose-800 hover:border-rose-400',
                valColor: 'text-rose-700',
                icon: AlertTriangle,
              },
            ].map(kpi => {
              const isActive = kpiFilter === kpi.id;
              const IconComponent = kpi.icon;
              return (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => setKpiFilter(isActive && kpi.id !== 'all' ? 'all' : kpi.id as any)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm cursor-pointer ${
                    isActive ? kpi.activeBg : `${kpi.idleBg} border-[#E2DFD7]`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10.5px] font-black uppercase tracking-wider ${isActive ? 'text-white/80' : 'text-[#777]'}`}>
                      {kpi.label}
                    </span>
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : kpi.valColor}`} />
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black mt-1 ${isActive ? 'text-white' : kpi.valColor}`}>
                    {kpi.value}
                  </div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${isActive ? 'text-white/80' : 'text-[#888]'}`}>
                    {kpi.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Search, Filters & Controls Bar ── */}
          <div className="bg-white rounded-2xl p-4 border border-[#E2DFD7] shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by employee name, phone number, or App ID (e.g. Harisha, 8197941466, BSC-2026-0006)..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl bg-[#F9F7F4] border border-[#DDD9D0] text-[#1E2D4E] outline-none focus:border-[#C9952A] focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1E2D4E]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter dropdowns */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="text-xs font-bold px-3 py-2.5 rounded-xl bg-[#F9F7F4] border border-[#DDD9D0] text-[#1E2D4E] outline-none focus:border-[#C9952A] cursor-pointer min-w-[160px]"
                >
                  <option value="">All Departments</option>
                  {BSC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <select
                  value={kpiFilter}
                  onChange={e => setKpiFilter(e.target.value as any)}
                  className="text-xs font-bold px-3 py-2.5 rounded-xl bg-[#F9F7F4] border border-[#DDD9D0] text-[#1E2D4E] outline-none focus:border-[#C9952A] cursor-pointer min-w-[170px]"
                >
                  <option value="all">All Employees ({stats.total})</option>
                  <option value="ready">🟢 greytHR Ready ({stats.ready})</option>
                  <option value="not_ready">⚪ Not Ready ({stats.notReady})</option>
                  <option value="attention">⚠️ Profile Attention ({stats.attention})</option>
                </select>

                {isFiltered && (
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-xs hover:bg-rose-100 transition-colors whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Active Filter Indicator */}
            {isFiltered && (
              <div className="flex items-center gap-2 pt-1 border-t border-[#F0EDE8] text-[11px] font-bold text-[#666] flex-wrap">
                <span className="flex items-center gap-1 text-[#1E2D4E] font-black"><Filter className="w-3 h-3 text-[#C9952A]" /> Active Filter:</span>
                {searchQuery && (
                  <span className="bg-[#EDE8DE] px-2 py-0.5 rounded-lg text-[#1E2D4E]">Search: "{searchQuery}"</span>
                )}
                {deptFilter && (
                  <span className="bg-[#EDE8DE] px-2 py-0.5 rounded-lg text-[#1E2D4E]">Dept: {deptFilter}</span>
                )}
                {kpiFilter !== 'all' && (
                  <span className="bg-[#1E2D4E] text-white px-2 py-0.5 rounded-lg">
                    {kpiFilter === 'ready' && '🟢 greytHR Ready'}
                    {kpiFilter === 'not_ready' && '⚪ Not Ready'}
                    {kpiFilter === 'attention' && '⚠️ Profile Attention'}
                  </span>
                )}
                <span className="ml-auto text-[#888]">Showing {filteredEmployees.length} of {employees.length} employees</span>
              </div>
            )}
          </div>

          {/* ── Employee List (Compact Enterprise Rows) ── */}
          <div className="bg-white rounded-2xl border border-[#E2DFD7] shadow-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2DFD7] bg-[#F9F7F4] flex items-center justify-between">
              <span className="font-black text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9952A]" /> Master Employee Directory ({filteredEmployees.length})
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#666]">Click any employee row to view/edit profile in modal</span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-[#C9952A] mx-auto mb-3" />
                <p className="text-xs text-[#666] font-bold">Loading master employee records...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-black text-[#1E2D4E]">No matching employees found.</h4>
                <p className="text-xs text-[#888] font-semibold">Try modifying your search keywords or clearing active filters.</p>
                {isFiltered && (
                  <button onClick={clearAllFilters} className="mt-2 text-xs font-black text-[#C9952A] hover:underline inline-block">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#F0EDE8]">
                {filteredEmployees.map(emp => {
                  const isGReady = Boolean(emp.greythrReady);
                  const isAttention = needsAttention(emp);

                  return (
                    <div
                      key={emp.appNo}
                      onClick={() => handleSelectEmployee(emp)}
                      className="px-5 py-3.5 cursor-pointer hover:bg-[#F9F7F4] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                    >
                      {/* Left: Photo & Info */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.name}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-[#DDD9D0] flex-shrink-0 group-hover:border-[#C9952A] transition-colors"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-[#1E2D4E] text-[#C9952A] flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm">
                            {emp.name ? emp.name.slice(0, 2).toUpperCase() : 'EM'}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-[#1E2D4E] group-hover:text-[#C9952A] transition-colors">
                              {formatName(emp.name)}
                            </span>
                            <span className="text-[11px] font-mono font-extrabold text-[#C9952A] bg-[#C9952A]/10 px-2 py-0.5 rounded-md">
                              {emp.appNo}
                            </span>
                            <StatusBadge status={emp.status || 'Joined'} size="sm" />
                          </div>

                          <div className="text-[11px] text-[#666] font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#1E2D4E]">{emp.desig || emp.designation || 'Staff Role'}</span>
                            <span className="text-[#CCC]">·</span>
                            <span>Dept: {emp.department || '—'}</span>
                            {emp.section && (
                              <>
                                <span className="text-[#CCC]">·</span>
                                <span>Section: {emp.section}</span>
                              </>
                            )}
                            {emp.phone && (
                              <>
                                <span className="text-[#CCC]">·</span>
                                <span className="font-mono text-[#777]">📞 {emp.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Action button */}
                      <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                        {/* greytHR Status badge */}
                        {isGReady ? (
                          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                            🟢 GREYTHR READY
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            ⚪ NOT READY
                          </span>
                        )}

                        {isAttention && (
                          <span className="hidden md:inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                            Needs Info
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectEmployee(emp); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F0EDE8] hover:bg-[#1E2D4E] hover:text-white text-[#1E2D4E] font-black text-xs transition-colors border border-[#DDD9D0]"
                        >
                          <Edit3 className="w-3 h-3 text-[#C9952A]" /> View / Edit
                        </button>
                        <ChevronRight className="w-4 h-4 text-[#CCC] group-hover:text-[#1E2D4E] transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════
          EMPLOYEE MASTER DETAILS & EDIT MODAL
      ════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5"
          style={{ background: 'rgba(15,25,50,0.75)', backdropFilter: 'blur(5px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl border border-[#C9952A]/30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ width: '94vw', maxWidth: '1380px', height: '92vh', maxHeight: '900px' }}
            onClick={e => e.stopPropagation()}
          >

            {/* ── Fixed Modal Header ── */}
            <div className="flex-shrink-0 bg-[#1E2D4E] px-6 py-4 flex items-center gap-4 border-b border-[#C9952A]/20">
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt={form.name}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#C9952A] shadow-md flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black text-base flex-shrink-0 shadow-md">
                  {form.name ? form.name.slice(0, 2).toUpperCase() : 'EM'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-white font-black text-base sm:text-lg truncate leading-tight">
                    {formatName(form.name) || 'Employee Profile'}
                  </h2>
                  <span className="text-[#C9952A] text-xs font-mono font-black bg-[#C9952A]/20 px-2.5 py-0.5 rounded-lg border border-[#C9952A]/30">
                    {form.appNo}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/70 font-semibold flex-wrap">
                  <span className="text-white font-bold">{form.desig || 'Staff Role'}</span>
                  <span>·</span>
                  <span>{form.department || 'No Dept'}</span>
                  {form.section && (
                    <>
                      <span>·</span>
                      <span className="text-[#C9952A]">{form.section}</span>
                    </>
                  )}
                </div>
              </div>

              {/* greytHR Status Badge in Header & Action Controls */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {form.greythrReady ? (
                  <span className="hidden sm:flex text-xs bg-emerald-500/20 text-emerald-300 font-extrabold px-3 py-1 rounded-full border border-emerald-500/30 items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 🟢 GREYTHR READY
                  </span>
                ) : (
                  <span className="hidden sm:flex text-xs bg-slate-500/20 text-slate-300 font-bold px-3 py-1 rounded-full border border-slate-500/30 items-center gap-1.5">
                    ⚪ NOT READY
                  </span>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving || !form.appNo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b8831e] text-slate-900 font-black text-xs transition-all disabled:opacity-50 shadow-md cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  onClick={() => setModalOpen(false)}
                  title="Close (ESC)"
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── greytHR Readiness Status Segmented Control ── */}
            <div className="flex-shrink-0 bg-[#F0EDE8] border-b border-[#DDD9D0] px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-black text-[#1E2D4E] uppercase tracking-wider">
                  greytHR Onboarding Status:
                </span>
                <div className="flex items-center rounded-xl overflow-hidden border border-[#C9952A]/40 shadow-sm bg-white">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, greythrReady: true })}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      form.greythrReady
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-white text-[#666] hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    🟢 Ready for greytHR
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, greythrReady: false })}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-black transition-all border-l border-[#C9952A]/30 cursor-pointer ${
                      !form.greythrReady
                        ? 'bg-[#1E2D4E] text-white shadow-sm'
                        : 'bg-white text-[#666] hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <span className="w-3 h-3 inline-flex items-center justify-center rounded-full border-2 border-current text-[8px]">○</span>
                    ⚪ Not Ready
                  </button>
                </div>
              </div>

              {missingProfileFields.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800 bg-amber-100/70 px-3 py-1 rounded-lg border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>{missingProfileFields.length} master fields missing</span>
                </div>
              )}
            </div>

            {/* ── Modal Tabs Bar ── */}
            <div className="flex-shrink-0 bg-[#F9F7F4] border-b border-[#E2DFD7] px-4 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 min-w-max">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-black whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                      activeTab === t.id
                        ? 'border-[#C9952A] text-[#1E2D4E] bg-white rounded-t-xl shadow-sm'
                        : 'border-transparent text-[#777] hover:text-[#1E2D4E] hover:bg-white/60'
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                    {t.id === 'checklist' && (
                      <span className="text-[10px] bg-slate-200 text-[#1E2D4E] px-1.5 py-0.2 rounded-full font-extrabold">
                        {checklistAudit.receivedCount}/{checklistAudit.total}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Scrollable Form Body ── */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">

              {/* 1. Personal & Identity */}
              {activeTab === 'personal' && (
                <div className="space-y-5 max-w-5xl">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Users className="w-4 h-4 text-[#C9952A]" /> Personal & Identity Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Full Legal Name *', <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} />)}
                    {F('Gender *',
                      <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={sel}>
                        <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                      </select>
                    )}
                    {F('Date of Birth (DOB) *', <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className={inp} />)}
                    {F('Blood Group',
                      <select value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value })} className={sel}>
                        <option value="">Select Blood Group</option>
                        {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )}
                    {F('Marital Status',
                      <select value={form.maritalStatus} onChange={e => setForm({ ...form, maritalStatus: e.target.value })} className={sel}>
                        {['Single','Married','Divorced','Widowed'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {F('Religion',
                      <select value={form.religion} onChange={e => setForm({ ...form, religion: e.target.value })} className={sel}>
                        {['Hindu','Muslim','Christian','Jain','Sikh','Buddhist','Other'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {F('Caste / Category', <input type="text" value={form.caste} onChange={e => setForm({ ...form, caste: e.target.value })} placeholder="e.g. General, OBC, SC, ST..." className={inp} />)}
                    {F("Father's Name & Details", <input type="text" value={form.fatherDetails} onChange={e => setForm({ ...form, fatherDetails: e.target.value })} placeholder="Father's full name & occupation" className={inp} />)}
                    {F("Mother's Name & Details", <input type="text" value={form.motherDetails} onChange={e => setForm({ ...form, motherDetails: e.target.value })} placeholder="Mother's full name" className={inp} />)}
                    <div>
                      <label className={lbl}>Emergency Contact Person & Phone</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} placeholder="Contact person name" className={inp} />
                        <input type="text" value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} placeholder="Emergency phone" className={inp + ' font-mono'} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Contact & Address */}
              {activeTab === 'contact' && (
                <div className="space-y-5 max-w-5xl">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <MapPin className="w-4 h-4 text-[#C9952A]" /> Contact Details & Residential Addresses
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Primary Mobile Phone *', <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inp + ' font-mono'} />)}
                    {F('Alternate Phone Number', <input type="text" value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value })} placeholder="Optional alternate mobile" className={inp + ' font-mono'} />)}
                    {F('Official / Personal Email', <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="employee@example.com" className={inp} />, true)}
                    {F('Present / Current Residential Address', <textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Door No, Street, Landmark, Area, City..." className={inp} />, true)}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={lbl}>Permanent Hometown Address</label>
                        <button type="button" onClick={() => setForm({ ...form, permanentAddress: form.address })} className="text-xs font-extrabold text-[#C9952A] hover:underline cursor-pointer">
                          Copy from Present Address
                        </button>
                      </div>
                      <textarea rows={2} value={form.permanentAddress} onChange={e => setForm({ ...form, permanentAddress: e.target.value })} placeholder="Permanent native place address..." className={inp} />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Store & Section */}
              {activeTab === 'official' && (
                <div className="space-y-5 max-w-5xl">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Store className="w-4 h-4 text-[#C9952A]" /> Store Deployment & Designation Role
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Designation Role *', <input type="text" value={form.desig} onChange={e => setForm({ ...form, desig: e.target.value })} placeholder="e.g. Sales Executive, Cashier..." className={inp} />)}
                    {F('Allocated Department *',
                      <select value={form.department} onChange={e => {
                        const nd = e.target.value;
                        const secs = getSectionsForDepartment(nd);
                        setForm({ ...form, department: nd, section: secs.includes(form.section) ? form.section : (secs[0] || '') });
                      }} className={sel}>
                        <option value="">Select Department</option>
                        {BSC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={lbl}>Allocated Section / Counter Area</label>
                        <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Dept Section</span>
                      </div>
                      <div className="space-y-1.5">
                        <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className={sel}>
                          <option value="">-- Select Section --</option>
                          {currentDeptSections.map(s => <option key={s} value={s}>{s}</option>)}
                          {form.section && !currentDeptSections.includes(form.section) && <option value={form.section}>{form.section} (Custom)</option>}
                        </select>
                        <input type="text" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="Or enter custom section..." className={inp + ' text-xs'} />
                      </div>
                    </div>
                    {F('Date of Joining (DOJ) *', <input type="date" value={form.offeredDoj} onChange={e => setForm({ ...form, offeredDoj: e.target.value })} className={inp + ' font-bold text-amber-800'} />)}
                    {F('Employee Status',
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={sel}>
                        <option value="Successfully Joined Store">🏪 Successfully Joined Store</option>
                        <option value="Joined">Joined</option>
                        <option value="Joined Store">Joined Store</option>
                        <option value="Offer Accepted">Offer Accepted</option>
                        <option value="Selected">Selected</option>
                        <option value="Probation">Probation</option>
                        <option value="Resigned">Resigned</option>
                      </select>
                    )}
                    {F('Store / Branch Location', <input type="text" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className={inp} />)}
                    {F('Reporting Manager', <input type="text" value={form.reportingManager} onChange={e => setForm({ ...form, reportingManager: e.target.value })} placeholder="e.g. Store Manager" className={inp} />)}
                    <div className="sm:col-span-2">
                      <label className={lbl}>greytHR Sync Status</label>
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="checkbox" id="greythrSynced" checked={form.greythrSynced} onChange={e => setForm({ ...form, greythrSynced: e.target.checked })} className="w-4 h-4 rounded text-emerald-600 cursor-pointer" />
                        <span className="text-[13px] font-bold text-[#1E2D4E]">Mark as Uploaded / Synced in greytHR Software</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Bank & greytHR */}
              {activeTab === 'banking' && (
                <div className="space-y-5 max-w-5xl">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <CreditCard className="w-4 h-4 text-[#C9952A]" /> Compensation, Banking & Statutory IDs (greytHR)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#F9F7F4] rounded-2xl border border-[#E2DFD7]">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#777] mb-1">Monthly Base Salary (₹) *</label>
                      <input type="text" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="e.g. 20000" className={inp + ' font-mono font-black text-emerald-800'} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#777] mb-1">Monthly Incentive (₹)</label>
                      <input type="text" value={form.incentive} onChange={e => setForm({ ...form, incentive: e.target.value })} placeholder="e.g. 2000" className={inp + ' font-mono font-bold text-emerald-700'} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">Total Monthly Gross Package</label>
                      <div className="py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-black text-slate-900 font-mono">
                        ₹{((parseFloat(form.salary) || 0) + (parseFloat(form.incentive) || 0)).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Bank Name *', <input type="text" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. State Bank of India, HDFC Bank..." className={inp} />)}
                    {F('Bank Account Number *', <input type="text" value={form.bankAccountNo} onChange={e => setForm({ ...form, bankAccountNo: e.target.value })} placeholder="Account Number" className={inp + ' font-mono'} />)}
                    {F('Bank IFSC Code *', <input type="text" value={form.bankIfsc} onChange={e => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} placeholder="e.g. SBIN0001234" className={inp + ' font-mono uppercase'} />)}
                    {F('PAN Card Number *', <input type="text" value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} placeholder="e.g. ABCDE1234F" maxLength={10} className={inp + ' font-mono uppercase'} />)}
                    {F('PF UAN (Universal Account Number)', <input type="text" value={form.uanNumber} onChange={e => setForm({ ...form, uanNumber: e.target.value })} placeholder="12-digit UAN" maxLength={12} className={inp + ' font-mono'} />)}
                    {F('ESI IP (Insurance Number)', <input type="text" value={form.esiNumber} onChange={e => setForm({ ...form, esiNumber: e.target.value })} placeholder="ESI IP Number" className={inp + ' font-mono'} />)}
                  </div>
                </div>
              )}

              {/* 5. Document Verification (ONLY 5 REQUIRED DOCUMENTS, NO PERCENTAGES) */}
              {activeTab === 'checklist' && (
                <div className="space-y-4 max-w-5xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E2DFD7] pb-3">
                    <div>
                      <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#C9952A]" /> Pre-Onboarding Required Document Verification
                      </h4>
                      <p className="text-xs text-[#777] font-semibold mt-0.5">Verify and update status for the 5 required onboarding documents.</p>
                    </div>
                    {/* Factual Count only, NO percentage */}
                    <div className="flex items-center gap-2 text-xs font-black bg-[#F0EDE8] px-3.5 py-1.5 rounded-xl border border-[#DDD9D0]">
                      <span className="text-[#1E2D4E]">{checklistAudit.total} Required Documents</span>
                      <span className="text-[#AAA]">·</span>
                      <span className="text-emerald-700">{checklistAudit.receivedCount} Verified</span>
                      <span className="text-[#AAA]">·</span>
                      <span className="text-amber-700">{checklistAudit.pendingCount} Pending</span>
                    </div>
                  </div>

                  <div className="border border-[#E2DFD7] rounded-2xl overflow-hidden divide-y divide-[#E2DFD7]">
                    {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => {
                      const status = form.documentsChecklist?.[item.id] || { received: false, date: '', remarks: '' };
                      return (
                        <div
                          key={item.id}
                          className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                            status.received ? 'bg-emerald-50/40' : 'bg-white'
                          }`}
                        >
                          {/* Document Title & Mandatory tag */}
                          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleChecklist(item.id)}
                              className="focus:outline-none flex-shrink-0 cursor-pointer mt-0.5 sm:mt-0"
                            >
                              {status.received ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5 text-[#999] hover:text-[#1E2D4E]" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[13.5px] font-black ${status.received ? 'text-emerald-950' : 'text-[#1E2D4E]'}`}>
                                  {idx + 1}. {item.label}
                                </span>
                                {item.mandatory && (
                                  <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-md font-extrabold uppercase">
                                    Required for greytHR
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#777] font-semibold mt-0.5 block">
                                Status: {status.received ? '✅ Verified & Received' : '⏳ Pending Submission'}
                              </span>
                            </div>
                          </div>

                          {/* Verification Date & Remarks */}
                          <div className="flex items-center gap-2.5 w-full md:w-auto flex-shrink-0 flex-wrap sm:flex-nowrap">
                            <div className="flex flex-col">
                              <span className="text-[9.5px] font-black text-[#888] uppercase mb-0.5">Verification Date</span>
                              <input
                                type="date"
                                value={status.date || ''}
                                onChange={e => handleChecklistDateChange(item.id, e.target.value)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DDD9D0] bg-white font-mono text-[#1E2D4E] outline-none focus:border-[#C9952A]"
                              />
                            </div>
                            <div className="flex flex-col flex-1 sm:w-56">
                              <span className="text-[9.5px] font-black text-[#888] uppercase mb-0.5">Verification Remarks</span>
                              <input
                                type="text"
                                value={status.remarks || ''}
                                onChange={e => handleChecklistRemarkChange(item.id, e.target.value)}
                                placeholder="e.g. Verified with original..."
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DDD9D0] bg-white font-semibold text-[#1E2D4E] outline-none focus:border-[#C9952A]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Experience & Education */}
              {activeTab === 'experience' && (
                <div className="space-y-5 max-w-5xl">
                  <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2 border-b border-[#E2DFD7] pb-2">
                    <Briefcase className="w-4 h-4 text-[#C9952A]" /> Education, Past Retail Experience & HR Notes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {F('Highest Educational Qualification', <input type="text" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. 10th, 12th / PUC, B.Com, BA..." className={inp} />)}
                    {F('Total Work Experience', <input type="text" value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 2 Years, Fresher..." className={inp} />)}
                    {F('Prior Retail Experience', <input type="text" value={form.retailExperience} onChange={e => setForm({ ...form, retailExperience: e.target.value })} placeholder="e.g. 1 Year in Garments / Textiles" className={inp} />)}
                    {F('Previous Company / Employer', <input type="text" value={form.previousCompany} onChange={e => setForm({ ...form, previousCompany: e.target.value })} placeholder="Previous company name" className={inp} />)}
                    {F('Previous Role / Designation', <input type="text" value={form.previousDesignation} onChange={e => setForm({ ...form, previousDesignation: e.target.value })} placeholder="Previous role" className={inp} />)}
                    {F('Previous Salary (₹)', <input type="text" value={form.previousSalary} onChange={e => setForm({ ...form, previousSalary: e.target.value })} placeholder="Previous salary" className={inp + ' font-mono'} />)}
                    {F('HR & Onboarding Remarks', <textarea rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Internal onboarding notes, verification status..." className={inp} />, true)}
                  </div>
                </div>
              )}
            </div>

            {/* ── Fixed Modal Action Footer ── */}
            <div className="flex-shrink-0 bg-[#F9F7F4] border-t border-[#E2DFD7] px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="text-xs text-[#666] font-semibold">
                Employee: <span className="font-black text-[#1E2D4E]">{formatName(form.name)}</span>
                <span className="text-[#AAA] mx-1.5">|</span>
                <span className="font-mono text-[#C9952A] font-bold">{form.appNo}</span>
                <span className="text-[#AAA] mx-1.5">|</span>
                <span className={form.greythrReady ? 'text-emerald-700 font-black' : 'text-slate-600 font-bold'}>
                  {form.greythrReady ? '🟢 Ready for greytHR' : '⚪ Not Ready'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DDD9D0] text-[#555] font-bold text-xs hover:bg-white hover:border-[#1E2D4E] transition-colors cursor-pointer"
                >
                  Cancel / Close
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.appNo}
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white font-black text-xs transition-all shadow-md flex items-center gap-2 border border-[#C9952A]/40 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C9952A]" /> : <Save className="w-3.5 h-3.5 text-[#C9952A]" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
