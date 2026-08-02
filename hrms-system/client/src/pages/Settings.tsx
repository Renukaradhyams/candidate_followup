import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { Settings, Users, Eye, HelpCircle, Tag, Plus, Trash2, Key } from 'lucide-react';

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
    if (sess?.role !== 'Admin') {
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

  const pages = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'interview', label: 'Interview Panel' },
    { key: 'offer', label: 'Offer Process' },
    { key: 'settings', label: 'Settings' }
  ];
  const roles = ['HR', 'Manager', 'Admin'];

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Settings"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="flex items-center gap-2 text-xs font-bold border-b border-[#e0ddd8] pb-3 overflow-x-auto">
            {[
              { key: 'users', label: 'User Management', icon: Users },
              { key: 'visibility', label: 'Page Visibility', icon: Eye },
              { key: 'questions', label: 'Interview Questions', icon: HelpCircle },
              { key: 'roles', label: 'Designations', icon: Tag }
            ].map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap
                    ${activeTab === t.key 
                      ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm' 
                      : 'bg-white text-[#666666] border-[#e0ddd8] hover:bg-black/5'}
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5 space-y-3">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Add New System User</h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                  <input
                    type="text"
                    placeholder="Username / Email"
                    value={newUname}
                    onChange={(e) => setNewUname(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                  <input
                    type="password"
                    placeholder="Initial Password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold"
                  >
                    <option value="HR">HR</option>
                    <option value="Manager">Store Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAddUser}
                    className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                  >
                    Add User
                  </button>
                </div>
              </div>

              <div className="card-glass p-4 space-y-3">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">All Registered Users</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Username</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0ddd8]/50">
                      {users.map(u => (
                        <tr key={u.username} className="hover:bg-black/5 font-medium">
                          <td className="py-3 px-3 font-bold text-[#1E2D4E]">{u.fullName}</td>
                          <td className="py-3 px-3 text-[#666666] font-mono">{u.username}</td>
                          <td className="py-3 px-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeUserRole(u.username, e.target.value)}
                              className="p-1 rounded border border-[#1E2D4E]/30 bg-white font-bold text-[#1E2D4E] text-xs shadow-sm"
                            >
                              <option value="Admin">Admin</option>
                              <option value="HR">HR</option>
                              <option value="Manager">Store Manager</option>
                              <option value="Recruiter">Recruiter</option>
                              <option value="Interviewer">Interviewer</option>
                            </select>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`badge ${u.active ? 'b-sel' : 'b-rej'}`}>
                              {u.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleUser(u)}
                                className={`px-2.5 py-1 rounded border font-bold text-[11px] ${u.active ? 'border-amber-600 text-amber-700 hover:bg-amber-50' : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'}`}
                              >
                                {u.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleResetUserPassword(u.username)}
                                className="px-2.5 py-1 rounded border border-[#1E2D4E] text-[#1E2D4E] font-bold text-[11px] hover:bg-[#1E2D4E] hover:text-white transition-colors flex items-center gap-1"
                              >
                                <Key className="w-3 h-3" /> Reset Password
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
            <div className="card-glass p-5 space-y-4 animate-fade-in">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Page Visibility per Role</h3>
                <p className="text-[11px] text-[#888888]">Control navigation access per role</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                      <th className="py-2.5 px-3">Page</th>
                      {roles.map(r => <th key={r} className="py-2.5 px-3 text-center">{r}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0ddd8]/50">
                    {pages.map(pg => (
                      <tr key={pg.key} className="hover:bg-black/5 font-medium">
                        <td className="py-3 px-3 font-bold text-[#1E2D4E]">{pg.label}</td>
                        {roles.map(r => {
                          const key = `${r}_${pg.key}`;
                          const isChecked = pageSettings[key] !== false;

                          return (
                            <td key={r} className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setPageSettings(prev => ({ ...prev, [key]: e.target.checked }));
                                }}
                                className="w-4 h-4 accent-[#1E2D4E]"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveVisibility}
                  className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                >
                  Save Visibility Settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: INTERVIEW QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glass p-5 space-y-3">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Add Interview Question</h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select
                    value={qDesig}
                    onChange={(e) => setQDesig(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-medium"
                  >
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>

                  <select
                    value={qRound}
                    onChange={(e) => setQRound(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-medium"
                  >
                    <option value="HR">HR Round</option>
                    <option value="Round 2">Round 2</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Question text..."
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    className="p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] sm:col-span-2"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAddQuestion}
                    className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                  >
                    Add Question
                  </button>
                </div>
              </div>

              <div className="card-glass p-4 space-y-3">
                <h3 className="font-extrabold text-[#1E2D4E] text-sm">Question Bank</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                        <th className="py-2.5 px-3">Designation</th>
                        <th className="py-2.5 px-3">Round</th>
                        <th className="py-2.5 px-3">Question</th>
                        <th className="py-2.5 px-3">Max Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0ddd8]/50">
                      {questions.map((q, idx) => (
                        <tr key={idx} className="hover:bg-black/5 font-medium">
                          <td className="py-3 px-3 text-[#666666]">{q.desig || 'All'}</td>
                          <td className="py-3 px-3"><span className="badge b-info">{q.round}</span></td>
                          <td className="py-3 px-3 font-bold text-[#1E2D4E]">{q.text}</td>
                          <td className="py-3 px-3 font-bold">{q.max}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESIGNATIONS */}
          {activeTab === 'roles' && (
            <div className="card-glass p-5 space-y-4 animate-fade-in">
              <h3 className="font-extrabold text-[#1E2D4E] text-sm">Designations / Job Roles</h3>

              <div className="space-y-2 max-w-md">
                {designations.map(d => (
                  <div key={d} className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] flex items-center justify-between font-bold text-xs">
                    <span>{d}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 max-w-md text-xs">
                <input
                  type="text"
                  placeholder="New designation..."
                  value={newDesigInput}
                  onChange={(e) => setNewDesigInput(e.target.value)}
                  className="flex-1 p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
                <button
                  onClick={handleAddDesig}
                  className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
