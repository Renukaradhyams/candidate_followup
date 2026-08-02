import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { Settings, Users, Eye, HelpCircle, Tag, Plus, Trash2, Key, Shield, Check, X } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'visibility' | 'questions' | 'roles'>('users');

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

  const handleResetUserPassword = async (username: string) => {
    const newPassword = window.prompt(`Enter new password for user ${username}:`);
    if (!newPassword || !newPassword.trim()) return;
    try {
      await API.updateUser({ username, password: newPassword.trim() });
      showToast(`Password for user ${username} updated successfully!`, 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error resetting password: ' + e.message, 'error');
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

  const tabs = [
    { key: 'users', label: 'User Accounts & Access', icon: Users },
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
                                onClick={() => handleResetUserPassword(u.username)}
                                className="px-3 py-1.5 rounded-xl border border-[#1E2D4E] text-[#1E2D4E] font-bold text-[11px] hover:bg-[#1E2D4E] hover:text-white transition-all flex items-center gap-1 shadow-xs"
                              >
                                <Key className="w-3.5 h-3.5" /> Reset Password
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
                {['HR', 'Manager', 'Recruiter', 'Interviewer'].map(roleName => (
                  <div key={roleName} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-3">
                    <div className="font-black text-sm text-[#1E2D4E] border-b border-[#e2dfd7] pb-2 uppercase tracking-wider">{roleName} Access</div>
                    <div className="space-y-2">
                      {['dashboard', 'candidates', 'interview', 'offer', 'openings', 'onboarding', 'employees', 'exit', 'settings'].map(pageKey => {
                        const key = `${roleName.toLowerCase()}_${pageKey}`;
                        const allowed = pageSettings[key] !== false;

                        return (
                          <label key={pageKey} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#e2dfd7] cursor-pointer font-bold text-[#1E2D4E]">
                            <span className="capitalize">{pageKey} Module</span>
                            <input
                              type="checkbox"
                              checked={allowed}
                              onChange={(e) => setPageSettings({ ...pageSettings, [key]: e.target.checked })}
                              className="accent-[#1E2D4E] rounded"
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
                        <div className="font-extrabold text-[#1E2D4E]">{q.question}</div>
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
        </main>
      </div>
    </div>
  );
}
