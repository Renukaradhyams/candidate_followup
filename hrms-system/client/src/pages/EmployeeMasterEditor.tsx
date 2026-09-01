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
  FileCheck2
} from 'lucide-react';
import { API, Auth, UserSession } from '../services/api';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import StatusBadge from '../components/ui/StatusBadge';
import { BSC_DEPARTMENTS, getSectionsForDepartment } from '../utils/bscDepartments';
import { formatName } from '../utils/formatName';
import * as XLSX from 'xlsx';

// Standard 12-item pre-onboarding document verification checklist
const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'aadhaar', label: 'Aadhaar Card (Self-Attested Copy)', mandatory: true },
  { id: 'pan', label: 'PAN Card Copy', mandatory: true },
  { id: 'bank', label: 'Bank Passbook / Cancelled Cheque', mandatory: true },
  { id: 'sslc', label: '10th / SSLC Marks Card', mandatory: true },
  { id: 'puc_degree', label: '12th / Degree / Highest Edu Certificate', mandatory: true },
  { id: 'relieving', label: 'Previous Relieving / Experience Letter', mandatory: false },
  { id: 'photos', label: 'Passport Size Photographs (3 copies)', mandatory: true },
  { id: 'medical', label: 'Blood Group / Fitness Report', mandatory: false },
  { id: 'offer_signed', label: 'Signed Offer Letter Acceptance', mandatory: true },
  { id: 'declaration', label: 'BSC Employment & Code Declaration', mandatory: true },
  { id: 'pf_form11', label: 'PF Form 11 / Nominee Declaration', mandatory: false },
  { id: 'esi_form1', label: 'ESI Form 1 Declaration', mandatory: false }
];

export default function EmployeeMasterEditorPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Workforce & Selection
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'pending'>('all');
  const [selectedAppNo, setSelectedAppNo] = useState<string>('');

  // Active Editor Tab
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'official' | 'banking' | 'checklist' | 'experience'>('personal');

  // Master Form Data State
  const [form, setForm] = useState<any>({
    appNo: '',
    name: '',
    gender: 'MALE',
    dob: '',
    bloodGroup: '',
    maritalStatus: 'Single',
    religion: 'Hindu',
    caste: '',
    fatherDetails: '',
    motherDetails: '',
    emergencyContact: '',
    emergencyPhone: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    permanentAddress: '',
    desig: '',
    department: '',
    section: '',
    branch: 'Main Branch (The Textile Mall)',
    reportingManager: '',
    offeredDoj: '',
    status: 'Joined',
    salary: '',
    incentive: '',
    panNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    uanNumber: '',
    esiNumber: '',
    qualification: '',
    experience: '',
    retailExperience: '',
    previousCompany: '',
    previousDesignation: '',
    previousSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    languagesKnown: [] as string[],
    remarks: '',
    photoUrl: '',
    aadhaarUrl: '',
    resumeUrl: '',
    documentsChecklist: {} as Record<string, { received: boolean; date?: string; remarks?: string }>,
    greythrSynced: false
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.getEmployees();
      const list = Array.isArray(res) ? res : (res?.employees || []);
      setEmployees(list);

      if (list.length > 0 && !selectedAppNo) {
        setSelectedAppNo(list[0].appNo);
        populateForm(list[0]);
      } else if (selectedAppNo) {
        const current = list.find((e: any) => e.appNo === selectedAppNo);
        if (current) populateForm(current);
      }
    } catch (err: any) {
      showToast('Error loading employees: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAppNo]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  const populateForm = (emp: any) => {
    if (!emp) return;

    // Parse salary and incentive
    let rawBase = '';
    let rawInc = '';
    const salStr = String(emp.salary || '').trim();
    if (salStr.includes('|')) {
      const parts = salStr.split('|');
      rawBase = parts[0] || '';
      rawInc = parts[1] || '';
    } else if (salStr.includes('+')) {
      const parts = salStr.split('+');
      rawBase = parts[0]?.replace(/[^0-9.]/g, '') || '';
      rawInc = parts[1]?.replace(/[^0-9.]/g, '') || '';
    } else {
      rawBase = salStr.replace(/[^0-9.]/g, '') || salStr;
    }

    // Parse checklist
    let checklistObj: Record<string, any> = {};
    if (emp.documentsChecklist && typeof emp.documentsChecklist === 'object') {
      checklistObj = emp.documentsChecklist;
    }

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
      salary: rawBase,
      incentive: rawInc,
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
      documentsChecklist: checklistObj,
      greythrSynced: Boolean(emp.greythrSynced)
    });
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedAppNo(emp.appNo);
    populateForm(emp);
  };

  // Section options dynamically derived from department
  const currentDeptSections = useMemo(() => {
    return getSectionsForDepartment(form.department);
  }, [form.department]);

  // greytHR Readiness Score & Missing Fields Calculator
  const readinessAudit = useMemo(() => {
    const missing: { field: string; tab: string; key: string }[] = [];
    if (!form.name?.trim()) missing.push({ field: 'Full Name', tab: 'personal', key: 'name' });
    if (!form.gender) missing.push({ field: 'Gender', tab: 'personal', key: 'gender' });
    if (!form.dob) missing.push({ field: 'Date of Birth', tab: 'personal', key: 'dob' });
    if (!form.phone?.trim()) missing.push({ field: 'Phone Number', tab: 'contact', key: 'phone' });
    if (!form.offeredDoj) missing.push({ field: 'Date of Joining', tab: 'official', key: 'offeredDoj' });
    if (!form.department) missing.push({ field: 'Department', tab: 'official', key: 'department' });
    if (!form.desig) missing.push({ field: 'Designation Role', tab: 'official', key: 'desig' });
    if (!form.salary) missing.push({ field: 'Monthly Salary', tab: 'banking', key: 'salary' });
    if (!form.panNumber?.trim()) missing.push({ field: 'PAN Card No', tab: 'banking', key: 'panNumber' });
    if (!form.bankAccountNo?.trim()) missing.push({ field: 'Bank Account No', tab: 'banking', key: 'bankAccountNo' });
    if (!form.bankIfsc?.trim()) missing.push({ field: 'Bank IFSC Code', tab: 'banking', key: 'bankIfsc' });

    const totalReq = 11;
    const completed = totalReq - missing.length;
    const percent = Math.round((completed / totalReq) * 100);
    const isReady = missing.length === 0;

    return { percent, isReady, missing, completed, totalReq };
  }, [form]);

  // Document checklist count
  const checklistAudit = useMemo(() => {
    let receivedCount = 0;
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
      if (form.documentsChecklist?.[item.id]?.received) {
        receivedCount++;
      }
    });
    return {
      receivedCount,
      total: DEFAULT_CHECKLIST_ITEMS.length,
      allReceived: receivedCount === DEFAULT_CHECKLIST_ITEMS.length
    };
  }, [form.documentsChecklist]);

  // Save Master Details to MySQL
  const handleSave = async () => {
    if (!form.appNo) {
      showToast('Please select an employee first', 'error');
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      showToast('Name and Phone are mandatory', 'error');
      return;
    }

    try {
      setSaving(true);
      const combinedSalary = form.incentive && String(form.incentive).trim()
        ? `${String(form.salary).trim()}|${String(form.incentive).trim()}`
        : String(form.salary).trim();

      const payload = {
        isFullEdit: true,
        name: form.name,
        gender: form.gender,
        dob: form.dob,
        bloodGroup: form.bloodGroup,
        maritalStatus: form.maritalStatus,
        religion: form.religion,
        caste: form.caste,
        fatherDetails: form.fatherDetails,
        motherDetails: form.motherDetails,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        phone: form.phone,
        altPhone: form.altPhone,
        email: form.email,
        address: form.address,
        permanentAddress: form.permanentAddress,
        desig: form.desig,
        department: form.department,
        section: form.section,
        branch: form.branch,
        reportingManager: form.reportingManager,
        offeredDoj: form.offeredDoj,
        status: form.status,
        salary: combinedSalary,
        panNumber: form.panNumber,
        bankName: form.bankName,
        bankAccountNo: form.bankAccountNo,
        bankIfsc: form.bankIfsc,
        uanNumber: form.uanNumber,
        esiNumber: form.esiNumber,
        qualification: form.qualification,
        experience: form.experience,
        retailExperience: form.retailExperience,
        previousCompany: form.previousCompany,
        previousDesignation: form.previousDesignation,
        previousSalary: form.previousSalary,
        expectedSalary: form.expectedSalary,
        noticePeriod: form.noticePeriod,
        languagesKnown: form.languagesKnown,
        remarks: form.remarks,
        documentsChecklist: form.documentsChecklist,
        greythrSynced: form.greythrSynced
      };

      await API.updateCandidate(form.appNo, payload);
      showToast(`Master profile for ${form.name} saved successfully! 🎉`, 'success');
      
      // Update local array
      setEmployees(prev => prev.map(e => e.appNo === form.appNo ? { ...e, ...payload } : e));
    } catch (err: any) {
      showToast('Failed to save details: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Document Checklist Item
  const handleToggleChecklist = (docId: string) => {
    setForm((prev: any) => {
      const current = prev.documentsChecklist?.[docId] || {};
      const updated = {
        ...prev.documentsChecklist,
        [docId]: {
          received: !current.received,
          date: !current.received ? new Date().toISOString().slice(0, 10) : '',
          remarks: current.remarks || ''
        }
      };
      return { ...prev, documentsChecklist: updated };
    });
  };

  const handleChecklistRemarkChange = (docId: string, remarks: string) => {
    setForm((prev: any) => ({
      ...prev,
      documentsChecklist: {
        ...prev.documentsChecklist,
        [docId]: {
          ...(prev.documentsChecklist?.[docId] || { received: true, date: new Date().toISOString().slice(0, 10) }),
          remarks
        }
      }
    }));
  };

  // Export greytHR standard bulk upload Excel
  const handleExportGreythrExcel = () => {
    if (employees.length === 0) {
      showToast('No employees found to export', 'error');
      return;
    }

    const rows = employees.map(emp => {
      // Parse salary
      let base = '';
      let inc = '';
      const s = String(emp.salary || '').trim();
      if (s.includes('|')) {
        const parts = s.split('|');
        base = parts[0] || '';
        inc = parts[1] || '';
      } else {
        base = s.replace(/[^0-9.]/g, '') || s;
      }

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
        'Base Monthly Salary': base,
        'Monthly Incentive': inc,
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
        'greytHR Sync Status': emp.greythrSynced ? 'SYNCED' : 'PENDING',
        'Export Timestamp': new Date().toLocaleString('en-IN')
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "greytHR_Employee_Master");
    XLSX.writeFile(wb, `greytHR_BSC_Employees_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Exported ${rows.length} employee records for greytHR software! 🚀`, 'success');
  };

  // Filtered employee sidebar list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ = !q || 
        (emp.name || '').toLowerCase().includes(q) || 
        (emp.appNo || '').toLowerCase().includes(q) || 
        (emp.phone || '').includes(q) ||
        (emp.desig || '').toLowerCase().includes(q);

      const matchDept = !deptFilter || (emp.department || '').toLowerCase() === deptFilter.toLowerCase();

      let matchReadiness = true;
      if (readinessFilter === 'ready') {
        matchReadiness = Boolean(emp.panNumber && emp.bankAccountNo && emp.bankIfsc && emp.dob && emp.offeredDoj);
      } else if (readinessFilter === 'pending') {
        matchReadiness = !emp.panNumber || !emp.bankAccountNo || !emp.bankIfsc || !emp.dob || !emp.offeredDoj;
      }

      return matchQ && matchDept && matchReadiness;
    });
  }, [employees, searchQuery, deptFilter, readinessFilter]);

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex font-sans">
      <ToastContainer />

      {/* Sidebar Navigation */}
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        <Topbar
          title="Employee Master & greytHR Pre-Onboarding Hub"
          breadcrumbs={[
            { label: 'Talent Management', href: '/employees' },
            { label: 'Employee Master (greytHR)' }
          ]}
          session={session}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Top Info & Action Header */}
          <div className="bg-white rounded-3xl p-5 border border-[#C9952A]/40 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#1E2D4E] text-[#C9952A] shadow-md">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#1E2D4E] tracking-tight">
                    Employee Master Data & greytHR Onboarding
                  </h1>
                  <p className="text-xs text-[#666666] font-semibold">
                    Complete registration details editor, document verification checklist & 1-click greytHR software export.
                  </p>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                onClick={handleExportGreythrExcel}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                title="Export all employee records directly in greytHR software bulk import format"
              >
                <Download className="w-4 h-4" />
                <span>Export for greytHR (.xlsx)</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !form.appNo}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white font-black text-xs transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 border border-[#C9952A]/40"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C9952A]" />
                    <span>Saving to DB...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-[#C9952A]" />
                    <span>Save Master Details</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Employee Selector & Directory (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-4 border border-[#e2dfd7] shadow-xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-2.5">
                <span className="font-black text-xs text-[#1E2D4E] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#C9952A]" />
                  <span>Employees ({filteredEmployees.length})</span>
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                  {employees.filter(e => e.panNumber && e.bankAccountNo).length} greytHR Ready
                </span>
              </div>

              {/* Search & Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, phone, App ID..."
                    className="w-full pl-8.5 pr-3 py-2 text-xs font-semibold rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] text-[#1E2D4E] outline-none focus:border-[#C9952A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-[#F9F7F4] border border-[#e2dfd7] text-[#1E2D4E] outline-none"
                  >
                    <option value="">All Departments</option>
                    {BSC_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={readinessFilter}
                    onChange={(e) => setReadinessFilter(e.target.value as any)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-[#F9F7F4] border border-[#e2dfd7] text-[#1E2D4E] outline-none"
                  >
                    <option value="all">All Profiles</option>
                    <option value="ready">greytHR Ready ✅</option>
                    <option value="pending">Missing Info ⚠️</option>
                  </select>
                </div>
              </div>

              {/* Employee Selection List */}
              <div className="max-h-[620px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {filteredEmployees.map(emp => {
                  const isSelected = emp.appNo === selectedAppNo;
                  const isReady = Boolean(emp.panNumber && emp.bankAccountNo && emp.bankIfsc && emp.dob);

                  return (
                    <div
                      key={emp.appNo}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-[#1E2D4E] text-white border-[#C9952A] shadow-md scale-[1.01]'
                          : 'bg-[#F9F7F4] hover:bg-white text-[#1E2D4E] border-[#e2dfd7]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                          isSelected ? 'bg-[#C9952A] text-slate-900' : 'bg-[#1E2D4E] text-white'
                        }`}>
                          {emp.initials || emp.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-black text-xs block truncate leading-tight">{formatName(emp.name)}</span>
                          <span className={`text-[10px] font-mono block ${isSelected ? 'text-[#C9952A]' : 'text-[#666666]'}`}>
                            {emp.appNo} • {emp.desig || emp.department || 'Staff'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={emp.status || 'Joined'} size="sm" />
                        {isReady ? (
                          <span className={`text-[9px] font-black uppercase flex items-center gap-0.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                          </span>
                        ) : (
                          <span className={`text-[9px] font-bold uppercase flex items-center gap-0.5 ${isSelected ? 'text-amber-300' : 'text-amber-700'}`}>
                            <AlertTriangle className="w-2.5 h-2.5" /> Incomplete
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#888888] font-bold">
                    No matching employees found.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Full Spectrum Master Editor & greytHR Tools (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* greytHR Readiness Scorecard Banner */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#e2dfd7] shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#777777] tracking-wider">greytHR Onboarding Audit</span>
                    <h3 className="text-base font-black text-[#1E2D4E] flex items-center gap-2">
                      <span>Profile Completeness: {readinessAudit.percent}%</span>
                      {readinessAudit.isReady ? (
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready for greytHR
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" /> {readinessAudit.missing.length} Missing Fields
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#555555]">Docs Verified:</span>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {checklistAudit.receivedCount} / {checklistAudit.total}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#EDE8DE] h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${readinessAudit.isReady ? 'bg-emerald-600' : readinessAudit.percent > 70 ? 'bg-[#C9952A]' : 'bg-rose-500'}`}
                    style={{ width: `${readinessAudit.percent}%` }}
                  />
                </div>

                {/* Missing Field Quick-Jump Tags */}
                {readinessAudit.missing.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10.5px] font-extrabold text-[#777777]">Quick Fill:</span>
                    {readinessAudit.missing.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setActiveTab(m.tab as any)}
                        className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1"
                      >
                        <span>+ {m.field}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="bg-white rounded-2xl p-1.5 border border-[#e2dfd7] shadow-sm flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { id: 'personal', label: '👤 Personal & Identity', icon: Users },
                  { id: 'contact', label: '📞 Contact & Address', icon: MapPin },
                  { id: 'official', label: '🏪 Store & Section', icon: Store },
                  { id: 'banking', label: '💳 Bank & greytHR CTC', icon: CreditCard },
                  { id: 'checklist', label: '📋 Document Checklist', icon: FileCheck2 },
                  { id: 'experience', label: '💼 Experience & Edu', icon: Briefcase }
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`px-3.5 py-2.5 rounded-xl whitespace-nowrap text-xs font-black flex items-center gap-1.5 transition-all ${
                        activeTab === t.id
                          ? 'bg-[#1E2D4E] text-white shadow-md'
                          : 'text-[#555555] hover:bg-[#F9F7F4] hover:text-[#1E2D4E]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${activeTab === t.id ? 'text-[#C9952A]' : ''}`} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Form Content Body */}
              <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#e2dfd7] shadow-xl space-y-5">
                
                {/* ── Tab 1: Personal & Identity ── */}
                {activeTab === 'personal' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C9952A]" />
                      <span>Candidate Identity & Family Details</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Full Legal Name *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="input-modern font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Gender *</label>
                        <select
                          value={form.gender}
                          onChange={(e) => setForm({ ...form, gender: e.target.value })}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="MALE">Male (Boy)</option>
                          <option value="FEMALE">Female (Girl)</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Date of Birth (DOB) *</label>
                        <input
                          type="date"
                          value={form.dob}
                          onChange={(e) => setForm({ ...form, dob: e.target.value })}
                          className="input-modern font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Blood Group</label>
                        <select
                          value={form.bloodGroup}
                          onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Marital Status</label>
                        <select
                          value={form.maritalStatus}
                          onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Religion</label>
                        <select
                          value={form.religion}
                          onChange={(e) => setForm({ ...form, religion: e.target.value })}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="Hindu">Hindu</option>
                          <option value="Muslim">Muslim</option>
                          <option value="Christian">Christian</option>
                          <option value="Jain">Jain</option>
                          <option value="Sikh">Sikh</option>
                          <option value="Buddhist">Buddhist</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Caste / Category</label>
                        <input
                          type="text"
                          value={form.caste}
                          onChange={(e) => setForm({ ...form, caste: e.target.value })}
                          placeholder="e.g. General, OBC, SC, ST..."
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Father's Name & Details</label>
                        <input
                          type="text"
                          value={form.fatherDetails}
                          onChange={(e) => setForm({ ...form, fatherDetails: e.target.value })}
                          placeholder="Father's full name & occupation"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Mother's Name & Details</label>
                        <input
                          type="text"
                          value={form.motherDetails}
                          onChange={(e) => setForm({ ...form, motherDetails: e.target.value })}
                          placeholder="Mother's full name"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Emergency Contact Person & Phone</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={form.emergencyContact}
                            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                            placeholder="Contact Person Name"
                            className="input-modern text-xs"
                          />
                          <input
                            type="text"
                            value={form.emergencyPhone}
                            onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                            placeholder="Emergency Phone"
                            className="input-modern text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 2: Contact & Addresses ── */}
                {activeTab === 'contact' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#C9952A]" />
                      <span>Contact Details & Residential Addresses</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Primary Mobile Phone *</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="input-modern font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Alternate Phone Number</label>
                        <input
                          type="text"
                          value={form.altPhone}
                          onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
                          placeholder="Optional alternate mobile"
                          className="input-modern font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Official / Personal Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="employee@example.com"
                          className="input-modern font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Present / Current Residential Address</label>
                        <textarea
                          rows={2}
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                          placeholder="Door No, Street, Landmark, Area, City..."
                          className="input-modern"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-black text-[#1E2D4E]">Permanent Hometown Address</label>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, permanentAddress: form.address })}
                            className="text-[10.5px] font-extrabold text-[#C9952A] hover:underline"
                          >
                            Copy from Present Address
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={form.permanentAddress}
                          onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
                          placeholder="Permanent native place address..."
                          className="input-modern"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 3: Store & Official Deployment ── */}
                {activeTab === 'official' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#C9952A]" />
                      <span>Store Deployment & Designation Role</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Designation Role *</label>
                        <input
                          type="text"
                          value={form.desig}
                          onChange={(e) => setForm({ ...form, desig: e.target.value })}
                          placeholder="e.g. Sales Executive, Cashier, Floor Incharge..."
                          className="input-modern font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Allocated Department *</label>
                        <select
                          value={form.department}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            const secs = getSectionsForDepartment(newDept);
                            setForm({
                              ...form,
                              department: newDept,
                              section: secs.includes(form.section) ? form.section : (secs[0] || '')
                            });
                          }}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="">Select Department</option>
                          {BSC_DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1 flex items-center justify-between">
                          <span>Allocated Section / Counter Area</span>
                          <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Department Section</span>
                        </label>
                        <div className="space-y-1.5">
                          <select
                            value={form.section}
                            onChange={(e) => setForm({ ...form, section: e.target.value })}
                            className="select-modern font-bold text-xs"
                          >
                            <option value="">-- Select Allocated Section --</option>
                            {currentDeptSections.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                            {form.section && !currentDeptSections.includes(form.section) && (
                              <option value={form.section}>{form.section} (Custom Section)</option>
                            )}
                          </select>
                          <input
                            type="text"
                            value={form.section}
                            onChange={(e) => setForm({ ...form, section: e.target.value })}
                            placeholder="Or enter custom section..."
                            className="input-modern text-xs placeholder:text-[#999999]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Date of Joining (DOJ) *</label>
                        <input
                          type="date"
                          value={form.offeredDoj}
                          onChange={(e) => setForm({ ...form, offeredDoj: e.target.value })}
                          className="input-modern font-bold text-amber-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Employee Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="select-modern font-bold text-xs"
                        >
                          <option value="Successfully Joined Store">🏪 Successfully Joined Store</option>
                          <option value="Joined">Joined</option>
                          <option value="Joined Store">Joined Store</option>
                          <option value="Offer Accepted">Offer Accepted</option>
                          <option value="Selected">Selected</option>
                          <option value="Probation">Probation</option>
                          <option value="Resigned">Resigned</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Store / Branch Location</label>
                        <input
                          type="text"
                          value={form.branch}
                          onChange={(e) => setForm({ ...form, branch: e.target.value })}
                          className="input-modern font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Reporting Manager</label>
                        <input
                          type="text"
                          value={form.reportingManager}
                          onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}
                          placeholder="e.g. Store Manager"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">greytHR Sync Status</label>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id="greythrSynced"
                            checked={form.greythrSynced}
                            onChange={(e) => setForm({ ...form, greythrSynced: e.target.checked })}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label htmlFor="greythrSynced" className="text-xs font-bold text-[#1E2D4E] cursor-pointer">
                            Mark as Uploaded / Synced in greytHR Software
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 4: Compensation & Banking (greytHR Ready) ── */}
                {activeTab === 'banking' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#C9952A]" />
                      <span>Compensation, Banking & Statutory IDs (greytHR Ready)</span>
                    </h4>

                    {/* Salary Summary Card */}
                    <div className="p-4 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7] grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#777777] mb-1">Monthly Base Salary (₹) *</label>
                        <input
                          type="text"
                          value={form.salary}
                          onChange={(e) => setForm({ ...form, salary: e.target.value })}
                          placeholder="e.g. 20000"
                          className="input-modern font-mono font-black text-emerald-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#777777] mb-1">Monthly Incentive (₹)</label>
                        <input
                          type="text"
                          value={form.incentive}
                          onChange={(e) => setForm({ ...form, incentive: e.target.value })}
                          placeholder="e.g. 2000"
                          className="input-modern font-mono font-bold text-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">Total Monthly Gross Package</label>
                        <div className="py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-black text-slate-900 font-mono">
                          ₹{((parseFloat(form.salary) || 0) + (parseFloat(form.incentive) || 0)).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Bank Name *</label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          placeholder="e.g. State Bank of India, HDFC Bank, ICICI..."
                          className="input-modern font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Bank Account Number *</label>
                        <input
                          type="text"
                          value={form.bankAccountNo}
                          onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                          placeholder="Account Number"
                          className="input-modern font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Bank IFSC Code *</label>
                        <input
                          type="text"
                          value={form.bankIfsc}
                          onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })}
                          placeholder="e.g. SBIN0001234"
                          className="input-modern font-mono font-bold uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">PAN Card Number *</label>
                        <input
                          type="text"
                          value={form.panNumber}
                          onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                          placeholder="e.g. ABCDE1234F"
                          maxLength={10}
                          className="input-modern font-mono font-bold uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">PF UAN (Universal Account Number)</label>
                        <input
                          type="text"
                          value={form.uanNumber}
                          onChange={(e) => setForm({ ...form, uanNumber: e.target.value })}
                          placeholder="12-digit UAN"
                          maxLength={12}
                          className="input-modern font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">ESI IP (Insurance Number)</label>
                        <input
                          type="text"
                          value={form.esiNumber}
                          onChange={(e) => setForm({ ...form, esiNumber: e.target.value })}
                          placeholder="ESI IP Number"
                          className="input-modern font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 5: Document Verification Checklist (Interactive) ── */}
                {activeTab === 'checklist' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-2">
                      <h4 className="font-black text-sm text-[#1E2D4E] flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#C9952A]" />
                        <span>Pre-Onboarding Document Verification Checklist</span>
                      </h4>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        {checklistAudit.receivedCount} of {checklistAudit.total} Verified
                      </span>
                    </div>

                    <div className="divide-y divide-[#e2dfd7]/70 border border-[#e2dfd7] rounded-2xl overflow-hidden bg-[#F9F7F4]">
                      {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => {
                        const status = form.documentsChecklist?.[item.id] || { received: false, date: '', remarks: '' };

                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              status.received ? 'bg-emerald-50/40' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleToggleChecklist(item.id)}
                                className="focus:outline-none flex-shrink-0"
                              >
                                {status.received ? (
                                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-[#999999] hover:text-[#1E2D4E]" />
                                )}
                              </button>
                              <div>
                                <span className={`text-xs font-bold block ${status.received ? 'text-emerald-950 font-black' : 'text-[#1E2D4E]'}`}>
                                  {idx + 1}. {item.label}
                                </span>
                                {item.mandatory && (
                                  <span className="text-[10px] text-amber-800 font-extrabold uppercase">Required for greytHR</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <input
                                type="date"
                                value={status.date || ''}
                                onChange={(e) => {
                                  setForm((prev: any) => ({
                                    ...prev,
                                    documentsChecklist: {
                                      ...prev.documentsChecklist,
                                      [item.id]: {
                                        ...(prev.documentsChecklist?.[item.id] || { received: true }),
                                        date: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="text-[11px] p-1.5 rounded-lg border border-[#e2dfd7] bg-white font-mono"
                                title="Date Received"
                              />
                              <input
                                type="text"
                                value={status.remarks || ''}
                                onChange={(e) => handleChecklistRemarkChange(item.id, e.target.value)}
                                placeholder="Verification remarks / verified by..."
                                className="text-[11px] p-1.5 rounded-lg border border-[#e2dfd7] bg-white w-full sm:w-48 font-medium"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Tab 6: Experience & Edu ── */}
                {activeTab === 'experience' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#C9952A]" />
                      <span>Education, Past Retail Experience & HR Notes</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Highest Educational Qualification</label>
                        <input
                          type="text"
                          value={form.qualification}
                          onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                          placeholder="e.g. 10th, 12th / PUC, B.Com, BA..."
                          className="input-modern font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Total Work Experience</label>
                        <input
                          type="text"
                          value={form.experience}
                          onChange={(e) => setForm({ ...form, experience: e.target.value })}
                          placeholder="e.g. 2 Years, Fresher..."
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Prior Retail Experience</label>
                        <input
                          type="text"
                          value={form.retailExperience}
                          onChange={(e) => setForm({ ...form, retailExperience: e.target.value })}
                          placeholder="e.g. 1 Year in Garments / Textiles"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Previous Company / Employer</label>
                        <input
                          type="text"
                          value={form.previousCompany}
                          onChange={(e) => setForm({ ...form, previousCompany: e.target.value })}
                          placeholder="Previous company name"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Previous Role / Designation</label>
                        <input
                          type="text"
                          value={form.previousDesignation}
                          onChange={(e) => setForm({ ...form, previousDesignation: e.target.value })}
                          placeholder="Previous role"
                          className="input-modern"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">Previous Salary (₹)</label>
                        <input
                          type="text"
                          value={form.previousSalary}
                          onChange={(e) => setForm({ ...form, previousSalary: e.target.value })}
                          placeholder="Previous salary"
                          className="input-modern font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-black text-[#1E2D4E] mb-1">HR & Onboarding Remarks</label>
                        <textarea
                          rows={2}
                          value={form.remarks}
                          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                          placeholder="Internal onboarding notes, verification status..."
                          className="input-modern"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Save Footer */}
                <div className="pt-4 border-t border-[#e2dfd7] flex items-center justify-between">
                  <div className="text-xs text-[#777777] font-semibold">
                    Editing Employee: <span className="font-black text-[#1E2D4E]">{form.name} ({form.appNo})</span>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving || !form.appNo}
                    className="px-6 py-2.5 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white font-black text-xs transition-all shadow-lg flex items-center gap-2 border border-[#C9952A]/40"
                  >
                    <Save className="w-4 h-4 text-[#C9952A]" />
                    <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
