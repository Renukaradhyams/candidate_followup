import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { 
  Settings, Users, Eye, EyeOff, HelpCircle, Tag, Plus, Trash2, Key, Shield, Check, X, RefreshCw,
  ArrowRightLeft, ArrowRight, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Search, Info, Hash
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'emp_numbers' | 'visibility' | 'questions' | 'roles'>('users');

  // Change Employee Number State
  const [singleOldNo, setSingleOldNo] = useState('');
  const [singleNewNo, setSingleNewNo] = useState('');
  const [singleReason, setSingleReason] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candSearchTerm, setCandSearchTerm] = useState('');
  const [showCandDropdown, setShowCandDropdown] = useState(false);

  // Bulk Import State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<Array<{
    oldAppNo: string;
    newAppNo: string;
    reason?: string;
    matchedName?: string;
    status: 'ready' | 'invalid';
    error?: string;
  }>>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    successCount: number;
    failCount: number;
    results: any[];
  } | null>(null);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newUname, setNewUname] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newRole, setNewRole] = useState('HR');

  // Page Visibility
  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>({});

  // Questions
  const [questions, setQuestions] = useState<any[]>([]);
  const [qDesig, setQDesig] = useState('Sales Executive');
  const [qRound, setQRound] = useState('HR');
  const [qText, setQText] = useState('');
  const [qMax, setQMax] = useState(10);

  // Designations
  const [designations, setDesignations] = useState<string[]>([]);
  const [newDesigInput, setNewDesigInput] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [uData, pData, qData, dData] = await Promise.all([
        API.getUsers(),
        API.getPageSettings(),
        API.call('getAllInterviewQuestions'),
        API.getDesignations()
      ]);

      if (uData && uData.users) setUsers(uData.users);
      if (pData) setPageSettings(pData);
      if (qData && qData.questions) setQuestions(qData.questions);
      if (dData && dData.designations) setDesignations(dData.designations);
    } catch (err: any) {
      showToast('Error loading settings', 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role !== 'Admin' && sess?.role !== 'Super Admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSession(sess);
    loadAll();
  }, [navigate, loadAll]);

  // Users Handlers
  const handleAddUser = async () => {
    if (!newName.trim() || !newUname.trim() || !newPwd.trim()) {
      showToast('All fields required', 'error');
      return;
    }
    try {
      await API.addUser({ fullName: newName, username: newUname, password: newPwd, role: newRole });
      showToast('User added!', 'success');
      setNewName(''); setNewUname(''); setNewPwd('');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleToggleUser = async (u: any) => {
    try {
      await API.updateUser({ username: u.username, active: !u.active });
      showToast('User status updated', 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleChangeUserRole = async (username: string, role: string) => {
    try {
      await API.updateUser({ username, role });
      showToast(`Updated role for user ${username} to ${role}`, 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error updating role: ' + e.message, 'error');
    }
  };

  // Reset Password Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleOpenResetModal = (user: any) => {
    setResetTargetUser(user);
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setShowPassword(false);
    setResetError('');
    setResetModalOpen(true);
  };

  const handleConfirmResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetTargetUser) return;
    const pwd = newPasswordInput.trim();
    const conf = confirmPasswordInput.trim();

    if (!pwd) {
      setResetError('Please enter a new password');
      return;
    }
    if (pwd.length < 4) {
      setResetError('Password must be at least 4 characters');
      return;
    }
    if (pwd !== conf) {
      setResetError('Passwords do not match');
      return;
    }

    try {
      setResetSubmitting(true);
      setResetError('');
      await API.updateUser({ id: resetTargetUser.id, username: resetTargetUser.username, password: pwd });
      showToast(`Password for ${resetTargetUser.fullName || resetTargetUser.username} updated successfully! 🎉`, 'success');
      setResetModalOpen(false);
      loadAll();
    } catch (err: any) {
      setResetError(err.message || 'Failed to update password');
      showToast('Error resetting password: ' + err.message, 'error');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Page Settings Handlers
  const handleSaveVisibility = async () => {
    try {
      await API.savePageSettings(pageSettings);
      showToast('Page visibility saved!', 'success');
    } catch (e: any) {
      showToast('Error saving visibility', 'error');
    }
  };

  // Question Handlers
  const handleAddQuestion = async () => {
    if (!qText.trim()) {
      showToast('Question text required', 'error');
      return;
    }
    try {
      await API.call('addInterviewQuestion', { desig: qDesig, round: qRound, text: qText, max: qMax });
      showToast('Question added!', 'success');
      setQText('');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await API.call('deleteInterviewQuestion', { id });
      showToast('Question deleted!', 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error deleting question', 'error');
    }
  };

  // Designation Handlers
  const handleAddDesig = async () => {
    if (!newDesigInput.trim()) return;
    try {
      await API.addDesignation(newDesigInput.trim());
      showToast('Designation added!', 'success');
      setNewDesigInput('');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteDesig = async (name: string) => {
    try {
      await API.deleteDesignation(name);
      showToast(`Designation ${name} deleted!`, 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error deleting designation', 'error');
    }
  };

  // ── Change Employee Number Handlers ──
  const loadCandidatesForLookup = useCallback(async () => {
    try {
      setLoadingCandidates(true);
      const res: any = await API.getCandidates({ limit: 5000 });
      if (res && res.candidates) {
        setAllCandidates(res.candidates);
      } else if (Array.isArray(res)) {
        setAllCandidates(res);
      }
    } catch (e) {
      console.error('Failed to load candidate directory for employee lookup', e);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'emp_numbers' && allCandidates.length === 0) {
      loadCandidatesForLookup();
    }
  }, [activeTab, allCandidates.length, loadCandidatesForLookup]);

  const matchedCandidate = allCandidates.find(
    (c) => (c.app_no || '').trim().toLowerCase() === singleOldNo.trim().toLowerCase()
  );

  const filteredCandidates = candSearchTerm.trim()
    ? allCandidates.filter((c) => {
        const q = candSearchTerm.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.app_no || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.designation || '').toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  const handleSingleChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const oldNo = singleOldNo.trim();
    const newNo = singleNewNo.trim();
    if (!oldNo || !newNo) {
      showToast('Both existing and new employee numbers are required', 'error');
      return;
    }
    if (oldNo === newNo) {
      showToast('New employee number must be different from existing number', 'error');
      return;
    }

    try {
      setSingleLoading(true);
      const res: any = await API.changeEmployeeNumber({
        oldAppNo: oldNo,
        newAppNo: newNo,
        reason: singleReason.trim()
      });
      if (res && res.success) {
        showToast(res.message || `Successfully updated employee number from ${oldNo} to ${newNo}!`, 'success');
        setSingleOldNo('');
        setSingleNewNo('');
        setSingleReason('');
        setCandSearchTerm('');
        loadCandidatesForLookup();
      } else {
        showToast(res?.message || res?.error || 'Failed to update employee number', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + (err.message || 'Failed to change employee number'), 'error');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Existing Employee Number': 'BSC-2024-001',
        'New Employee Number': 'BSC-2024-101',
        'Reason (Optional)': 'Employee Code Realignment'
      },
      {
        'Existing Employee Number': 'BSC-2024-002',
        'New Employee Number': 'BSC-2024-102',
        'Reason (Optional)': 'Prefix Correction'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee_Number_Change');
    XLSX.writeFile(wb, 'BSC_Change_Employee_Number_Template.xlsx');
    showToast('Sample Excel template downloaded!', 'success');
  };

  const processUploadedFile = (file: File) => {
    setBulkFile(file);
    setBulkResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          showToast('Spreadsheet contains no worksheets', 'error');
          return;
        }
        const ws = wb.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          showToast('Uploaded spreadsheet is empty', 'error');
          setBulkRows([]);
          return;
        }

        const parsed = rawRows.map((r) => {
          const keys = Object.keys(r);
          const oldKey = keys.find(k => /existing|old|current|from/i.test(k)) || keys[0] || '';
          const newKey = keys.find(k => /new|to/i.test(k)) || keys[1] || '';
          const reasonKey = keys.find(k => /reason|remark|note/i.test(k)) || keys[2] || '';

          const oldAppNo = String(r[oldKey] ?? '').trim();
          const newAppNo = String(r[newKey] ?? '').trim();
          const reason = String(r[reasonKey] ?? '').trim();

          if (!oldAppNo && !newAppNo) return null;

          let status: 'ready' | 'invalid' = 'ready';
          let error = '';

          if (!oldAppNo) {
            status = 'invalid';
            error = 'Missing Existing Employee Number';
          } else if (!newAppNo) {
            status = 'invalid';
            error = 'Missing New Employee Number';
          } else if (oldAppNo === newAppNo) {
            status = 'invalid';
            error = 'Existing and New numbers are identical';
          }

          const cand = allCandidates.find(
            c => (c.app_no || '').trim().toLowerCase() === oldAppNo.toLowerCase()
          );

          return {
            oldAppNo,
            newAppNo,
            reason,
            matchedName: cand?.name,
            status,
            error
          };
        }).filter(Boolean) as Array<{
          oldAppNo: string;
          newAppNo: string;
          reason?: string;
          matchedName?: string;
          status: 'ready' | 'invalid';
          error?: string;
        }>;

        setBulkRows(parsed);
        const validCount = parsed.filter(p => p.status === 'ready').length;
        showToast(`Parsed ${parsed.length} rows (${validCount} valid)`, 'info');
      } catch (err: any) {
        showToast('Error reading spreadsheet: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExecuteBulkChange = async () => {
    const validRows = bulkRows.filter(r => r.status === 'ready');
    if (validRows.length === 0) {
      showToast('No valid rows found to update', 'error');
      return;
    }

    try {
      setBulkLoading(true);
      const payload = validRows.map(r => ({
        oldAppNo: r.oldAppNo,
        newAppNo: r.newAppNo,
        reason: r.reason
      }));

      const res: any = await API.bulkChangeEmployeeNumber(payload);
      if (res) {
        setBulkResults({
          successCount: res.successCount || 0,
          failCount: res.failCount || 0,
          results: res.results || []
        });

        if (res.successCount > 0) {
          showToast(`Successfully updated ${res.successCount} employee numbers! 🎉`, 'success');
          loadCandidatesForLookup();
        }
        if (res.failCount > 0) {
          showToast(`${res.failCount} items failed to update`, 'error');
        }
      }
    } catch (err: any) {
      showToast('Bulk update error: ' + err.message, 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const tabs = [
    { key: 'users', label: 'User Accounts & Access', icon: Users },
    { key: 'emp_numbers', label: 'Change Employee Number', icon: ArrowRightLeft },
    { key: 'visibility', label: 'Page Visibility Matrix', icon: Eye },
    { key: 'questions', label: 'Interview Question Bank', icon: HelpCircle },
    { key: 'roles', label: 'Designations Master', icon: Tag }
  ];

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="System Settings &amp; Governance"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#C9952A]" />
                <span>Enterprise Administration Hub</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">Manage user credentials, role permissions, interview evaluation rubrics &amp; company designations.</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#e2dfd7] pb-1 overflow-x-auto scrollbar-none text-xs font-bold">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    px-4 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 shadow-xs whitespace-nowrap
                    ${activeTab === t.key 
                      ? 'bg-[#1E2D4E] text-white shadow-md font-extrabold' 
                      : 'bg-white text-[#555555] border border-[#e2dfd7] hover:bg-[#F9F7F4]'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card-glass p-6 space-y-4">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C9952A]" />
                  <span>Add New System User Account</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Rahul Sharma)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-modern"
                  />
                  <input
                    type="text"
                    placeholder="Username / Email"
                    value={newUname}
                    onChange={(e) => setNewUname(e.target.value)}
                    className="input-modern"
                  />
                  <input
                    type="password"
                    placeholder="Initial Password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="input-modern"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="select-modern font-bold"
                  >
                    <option value="HR">HR Specialist</option>
                    <option value="Manager">Store Manager</option>
                    <option value="Admin">Administrator</option>
                    <option value="Batch Leader">Batch Leader</option>
                    <option value="Recruiter">Recruiter</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleAddUser} className="btn-primary text-xs shadow-md">
                    Create User Account
                  </button>
                </div>
              </div>

              <div className="card-glass p-5 space-y-4">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm tracking-tight">Registered User Accounts &amp; Role Management</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] bg-[#F9F7F4]/60">
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Assigned Role</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]/60">
                      {users.map(u => (
                        <tr key={u.username} className="hover:bg-black/5 font-medium">
                          <td className="py-3.5 px-4 font-extrabold text-[#1E2D4E]">{u.fullName}</td>
                          <td className="py-3.5 px-4 text-[#555555] font-mono">{u.username}</td>
                          <td className="py-3.5 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeUserRole(u.username, e.target.value)}
                              className="p-1.5 rounded-xl border border-[#1E2D4E]/30 bg-white font-bold text-[#1E2D4E] text-xs shadow-xs"
                            >
                              <option value="Admin">Admin</option>
                              <option value="HR">HR</option>
                              <option value="Manager">Store Manager</option>
                              <option value="Batch Leader">Batch Leader</option>
                              <option value="Recruiter">Recruiter</option>
                              <option value="Interviewer">Interviewer</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {u.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleUser(u)}
                                className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] ${u.active ? 'border-amber-600 text-amber-700 hover:bg-amber-50' : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'}`}
                              >
                                {u.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleOpenResetModal(u)}
                                className="px-3 py-1.5 rounded-xl border border-[#1E2D4E] text-[#1E2D4E] font-bold text-[11px] hover:bg-[#1E2D4E] hover:text-white transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5 text-[#C9952A]" /> Reset Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAGE VISIBILITY */}
          {activeTab === 'visibility' && (
            <div className="card-glass p-6 space-y-5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#e2dfd7] pb-3">
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-base">Role-Based Page Visibility Matrix</h3>
                  <p className="text-xs text-[#777777] font-medium mt-0.5">Control module access permissions per role</p>
                </div>
                <button onClick={handleSaveVisibility} className="btn-primary text-xs shadow-md">
                  Save Visibility Settings
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {['HR', 'Manager', 'Batch Leader', 'Recruiter', 'Interviewer'].map(roleName => (
                  <div key={roleName} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-3">
                    <div className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 uppercase tracking-wider">{roleName} Access Matrix</div>
                    <div className="space-y-2">
                      {['dashboard', 'candidates', 'interview', 'offer', 'openings', 'onboarding', 'employees', 'joining_call_desk', 'not_joined', 'doj_planning', 'workforce_analytics', 'dept_hiring', 'section_allocation', 'batch_plan', 'batch_attendance', 'exit', 'form', 'broadcast', 'settings'].map(pageKey => {
                        const key = `${roleName}_${pageKey}`;
                        const allowed = pageSettings[key] !== false;

                        return (
                          <label key={pageKey} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#e2dfd7] cursor-pointer font-bold text-[#1E2D4E]">
                            <span className="capitalize">{pageKey.replace(/_/g, ' ')} Module</span>
                            <input
                              type="checkbox"
                              checked={allowed}
                              onChange={(e) => setPageSettings({ ...pageSettings, [key]: e.target.checked })}
                              className="accent-[#1E2D4E] rounded cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card-glass p-6 space-y-4">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm uppercase tracking-wider">Add Interview Rubric Question</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select value={qDesig} onChange={(e) => setQDesig(e.target.value)} className="select-modern font-bold">
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={qRound} onChange={(e) => setQRound(e.target.value)} className="select-modern font-bold">
                    <option value="HR">HR Round</option>
                    <option value="Round 2">Round 2 Technical</option>
                  </select>
                  <input type="text" placeholder="Question / Evaluation Criteria" value={qText} onChange={(e) => setQText(e.target.value)} className="input-modern sm:col-span-2" />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleAddQuestion} className="btn-primary text-xs shadow-md">
                    Add Question
                  </button>
                </div>
              </div>

              <div className="card-glass p-5 space-y-4">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Active Evaluation Questions</h3>
                <div className="space-y-2 text-xs">
                  {questions.map((q) => (
                    <div key={q.id} className="p-3.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-[#1E2D4E]">{typeof q === 'string' ? q : (q?.text || q?.question || '')}</div>
                        <div className="text-[10px] text-[#777777] font-semibold">{q.designation} · {q.round} · Max Score: {q.max_score || 10}</div>
                      </div>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESIGNATIONS */}
          {activeTab === 'roles' && (
            <div className="card-glass p-6 space-y-5 animate-fade-in">
              <h3 className="font-extrabold text-[#1E2D4E] text-sm uppercase tracking-wider">Company Designations Master List</h3>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="New Designation Name (e.g. Floor Manager)"
                  value={newDesigInput}
                  onChange={(e) => setNewDesigInput(e.target.value)}
                  className="input-modern max-w-sm"
                />
                <button onClick={handleAddDesig} className="btn-primary text-xs shadow-md">
                  Add Designation
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                {designations.map((d) => (
                  <div key={d} className="p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-between font-bold text-[#1E2D4E]">
                    <span>{d}</span>
                    <button onClick={() => handleDeleteDesig(d)} className="text-rose-600 hover:text-rose-800 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: CHANGE EMPLOYEE NUMBER & BULK IMPORT */}
          {activeTab === 'emp_numbers' && (
            <div className="space-y-6 animate-fade-in">
              {/* Informational Hero Banner */}
              <div className="card-glass p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-[#C9952A]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#C9952A]/15 text-[#C9952A]">
                      <ArrowRightLeft className="w-5 h-5" />
                    </span>
                    <h3 className="font-extrabold text-[#1E2D4E] text-base">
                      Employee Number Management &amp; Reassignment
                    </h3>
                  </div>
                  <p className="text-xs text-[#666666]">
                    Modify employee/candidate identification numbers individually or bulk update via spreadsheet import.
                    All associated records across all tables (Candidates, Employees, Selection Offers, Section Allocations, Joining Desk, Attendance, etc.) are atomically migrated.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-stretch md:self-auto">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-[#C9952A]/40 bg-[#C9952A]/10 hover:bg-[#C9952A]/20 text-[#1E2D4E] text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#C9952A]" />
                    <span>Download Excel Template</span>
                  </button>
                </div>
              </div>

              {/* Grid: Option 1 (Single) and Option 2 (Bulk Import) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── CARD 1: SINGLE EMPLOYEE NUMBER CHANGE (5 Cols) ── */}
                <div className="lg:col-span-5 card-glass p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#1E2D4E] text-white flex items-center justify-center">
                        <Hash className="w-4 h-4 text-[#C9952A]" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#1E2D4E]">Direct Number Change</h4>
                        <p className="text-[11px] text-[#777]">Single employee update</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                      Single
                    </span>
                  </div>

                  {/* Candidate Quick Search Lookup */}
                  <div className="space-y-1.5 relative">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                      Quick Candidate / Employee Search
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                      <input
                        type="text"
                        placeholder="Search by Name, App No or Phone..."
                        value={candSearchTerm}
                        onChange={(e) => {
                          setCandSearchTerm(e.target.value);
                          setShowCandDropdown(true);
                        }}
                        onFocus={() => setShowCandDropdown(true)}
                        className="w-full text-xs font-semibold pl-9 pr-4 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                      />
                      {loadingCandidates && (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[#888]" />
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showCandDropdown && candSearchTerm.trim().length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#e2dfd7] max-h-56 overflow-y-auto divide-y divide-[#f0ede6]">
                        {filteredCandidates.length > 0 ? (
                          filteredCandidates.map((cand) => (
                            <button
                              key={cand.id || cand.app_no}
                              type="button"
                              onClick={() => {
                                setSingleOldNo(cand.app_no);
                                setCandSearchTerm(`${cand.name} (${cand.app_no})`);
                                setShowCandDropdown(false);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-[#F9F7F4] transition-colors flex items-center justify-between group cursor-pointer"
                            >
                              <div>
                                <div className="text-xs font-bold text-[#1E2D4E] group-hover:text-[#C9952A] transition-colors">
                                  {cand.name}
                                </div>
                                <div className="text-[11px] text-[#777] font-mono">
                                  {cand.app_no} &bull; {cand.designation || 'No Role'} {cand.phone ? `&bull; ${cand.phone}` : ''}
                                </div>
                              </div>
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#1E2D4E]/5 text-[#1E2D4E]">
                                Select
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-[#888]">
                            No matching employee found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSingleChange} className="space-y-4">
                    {/* Existing App No */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                        Existing Employee Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BSC-2024-001"
                        value={singleOldNo}
                        onChange={(e) => setSingleOldNo(e.target.value.toUpperCase())}
                        className="w-full text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs uppercase"
                        required
                      />
                    </div>

                    {/* Matched Live Candidate Card */}
                    {matchedCandidate && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-[#C9952A] flex items-center justify-center font-black text-xs flex-shrink-0">
                          {matchedCandidate.name ? matchedCandidate.name.charAt(0).toUpperCase() : 'E'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-[#1E2D4E] truncate">
                              {matchedCandidate.name}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Verified
                            </span>
                          </div>
                          <div className="text-[11px] text-[#666] font-medium truncate mt-0.5">
                            {matchedCandidate.designation || 'Staff'} {matchedCandidate.department ? `&bull; ${matchedCandidate.department}` : ''}
                          </div>
                          {matchedCandidate.phone && (
                            <div className="text-[10px] text-[#888] font-mono mt-0.5">
                              Ph: {matchedCandidate.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* New App No */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                        New Employee Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BSC-2024-500"
                        value={singleNewNo}
                        onChange={(e) => setSingleNewNo(e.target.value.toUpperCase())}
                        className="w-full text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs uppercase"
                        required
                      />
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                        Reason / Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ID series realignment, typo correction"
                        value={singleReason}
                        onChange={(e) => setSingleReason(e.target.value)}
                        className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                      />
                    </div>

                    {/* Visual Comparison Arrow */}
                    {singleOldNo && singleNewNo && (
                      <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-3 text-xs font-mono font-bold">
                        <span className="text-slate-600 line-through">{singleOldNo}</span>
                        <ArrowRight className="w-4 h-4 text-[#C9952A]" />
                        <span className="text-[#1E2D4E] font-black">{singleNewNo}</span>
                      </div>
                    )}

                    {/* Warning Note */}
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span>
                        Cascades automatically across candidates, employees, selection offers, section allocations, attendance, and logs.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={singleLoading || !singleOldNo.trim() || !singleNewNo.trim()}
                      className="w-full btn-primary text-xs py-3 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {singleLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Updating System Records...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Apply Number Change</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* ── CARD 2: BULK IMPORT OPTION VIA SPREADSHEET (7 Cols) ── */}
                <div className="lg:col-span-7 card-glass p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#1E2D4E]">Bulk Import Option</h4>
                        <p className="text-[11px] text-[#777]">Upload Excel or CSV spreadsheet</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Excel / CSV
                    </span>
                  </div>

                  {/* Drag and Drop File Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setBulkDragOver(true); }}
                    onDragLeave={() => setBulkDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setBulkDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processUploadedFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2
                      ${bulkDragOver 
                        ? 'border-[#C9952A] bg-[#C9952A]/10 scale-[1.01]' 
                        : 'border-[#d0ccc2] bg-[#F9F7F4] hover:bg-[#f3efe8]'}
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processUploadedFile(file);
                      }}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-[#e2dfd7] flex items-center justify-center text-[#1E2D4E]">
                      <Upload className="w-6 h-6 text-[#C9952A]" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#1E2D4E]">
                        {bulkFile ? bulkFile.name : 'Click to upload or drag & drop spreadsheet'}
                      </p>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        Supports .xlsx, .xls, .csv with columns: Existing Employee Number, New Employee Number
                      </p>
                    </div>
                    {bulkFile && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#1E2D4E] text-white">
                        {(bulkFile.size / 1024).toFixed(1)} KB &bull; Change File
                      </span>
                    )}
                  </div>

                  {/* Parsed Preview Table */}
                  {bulkRows.length > 0 && (
                    <div className="space-y-3">
                      {/* Summary Chips */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 font-bold text-[11px]">
                            Total: {bulkRows.length}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            Ready: {bulkRows.filter(r => r.status === 'ready').length}
                          </span>
                          {bulkRows.some(r => r.status === 'invalid') && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px]">
                              Invalid: {bulkRows.filter(r => r.status === 'invalid').length}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setBulkRows([]);
                            setBulkFile(null);
                            setBulkResults(null);
                          }}
                          className="text-[11px] text-[#888] hover:text-rose-600 font-bold transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Scrollable Table */}
                      <div className="border border-[#e2dfd7] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1E2D4E] text-white text-[11px] font-black uppercase sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Existing No</th>
                              <th className="py-2.5 px-3">Candidate / Name</th>
                              <th className="py-2.5 px-3">New No</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e2dfd7] bg-white">
                            {bulkRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#F9F7F4] transition-colors">
                                <td className="py-2 px-3 text-[#777] font-mono text-[11px]">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{row.oldAppNo || '—'}</td>
                                <td className="py-2 px-3 text-[#1E2D4E] font-medium">
                                  {row.matchedName ? (
                                    <span className="font-bold">{row.matchedName}</span>
                                  ) : (
                                    <span className="text-[#888] italic">Lookup on submit</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono font-black text-[#1E2D4E]">{row.newAppNo || '—'}</td>
                                <td className="py-2 px-3">
                                  {row.status === 'ready' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Ready
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800" title={row.error}>
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      {row.error || 'Invalid'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Execute Button */}
                      <button
                        type="button"
                        onClick={handleExecuteBulkChange}
                        disabled={bulkLoading || bulkRows.filter(r => r.status === 'ready').length === 0}
                        className="w-full btn-primary text-xs py-3 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {bulkLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Bulk Updates...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Execute Bulk Change ({bulkRows.filter(r => r.status === 'ready').length} records)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Bulk Execution Results Banner */}
                  {bulkResults && (
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-[#f0ede6] pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h5 className="font-extrabold text-xs text-[#1E2D4E]">Bulk Migration Execution Summary</h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            Success: {bulkResults.successCount}
                          </span>
                          {bulkResults.failCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                              Failed: {bulkResults.failCount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detailed Results List */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                        {bulkResults.results.map((res: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] ${
                              res.success 
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
                                : 'bg-rose-50/60 border-rose-200 text-rose-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-bold">{res.oldAppNo}</span>
                              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                              <span className="font-black">{res.newAppNo}</span>
                              {res.name && <span className="font-sans text-[11px] opacity-80">({res.name})</span>}
                            </div>
                            <span className="font-bold">
                              {res.success ? 'Updated' : (res.error || 'Failed')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Reset Password Modal ── */}
      {resetModalOpen && resetTargetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setResetModalOpen(false); }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#e2dfd7] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between border-b border-[#C9952A]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C9952A] text-slate-900 flex items-center justify-center font-black shadow-md">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">Reset User Password</h3>
                  <p className="text-[11px] text-[#C9952A] font-semibold mt-0.5">Admin Security Control</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Info Banner */}
            <div className="bg-[#F9F7F4] px-6 py-3.5 border-b border-[#e2dfd7] flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-[#1E2D4E]">{resetTargetUser.fullName || resetTargetUser.username}</div>
                <div className="text-[11px] text-[#777] font-mono font-semibold">@{resetTargetUser.username}</div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1E2D4E]/10 text-[#1E2D4E] border border-[#1E2D4E]/20">
                {resetTargetUser.role}
              </span>
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmResetPassword} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => { setNewPasswordInput(e.target.value); setResetError(''); }}
                    placeholder="Enter at least 4 characters"
                    className="w-full text-xs font-semibold pl-4 pr-10 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777] hover:text-[#1E2D4E] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E2D4E]">
                  Confirm New Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPasswordInput}
                  onChange={(e) => { setConfirmPasswordInput(e.target.value); setResetError(''); }}
                  placeholder="Re-enter new password"
                  className="w-full text-xs font-semibold px-4 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] focus:bg-white transition-all shadow-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2dfd7]">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#555] hover:bg-[#F9F7F4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {resetSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {resetSubmitting ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
