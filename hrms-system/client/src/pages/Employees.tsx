import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import { 
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase, 
  FileText, CheckCircle, Trash2, Edit3, X, ExternalLink, UserCheck, DollarSign, Image, FileCheck
} from 'lucide-react';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');

  // Drawer
  const [drawerEmp, setDrawerEmp] = useState<any | null>(null);

  // Edit Modal State
  const [editModal, setEditModal] = useState<{ open: boolean; emp: any | null }>({ open: false, emp: null });
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    desig: '',
    salary: '',
    offeredDoj: '',
    status: ''
  });
  const [saving, setSaving] = useState(false);

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

  // Filtering
  useEffect(() => {
    let list = [...employees];

    if (desigFilter) {
      list = list.filter(e => e.desig === desigFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.appNo.toLowerCase().includes(q) ||
        e.phone.includes(q)
      );
    }

    setFiltered(list);
  }, [employees, desigFilter, searchQuery]);

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('/')) return url;
    if (url.startsWith('photo')) return `/uploads/candidate-photos/${url}`;
    if (url.startsWith('resume')) return `/uploads/candidate-resumes/${url}`;
    if (url.startsWith('aadhar') || url.startsWith('pan') || url.startsWith('document')) return `/uploads/employee-documents/${url}`;
    return `/uploads/${url}`;
  };

  const handleOpenEdit = (emp: any) => {
    setEditModal({ open: true, emp });
    setEditForm({
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      desig: emp.desig || '',
      salary: emp.salary && emp.salary !== '—' ? emp.salary : (emp.expectedSalary || ''),
      offeredDoj: emp.offeredDoj || emp.estDoj || emp.actualDoj || '',
      status: emp.status || 'Joined'
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
      await API.updateCandidate(editModal.emp.appNo, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        desig: editForm.desig,
        salary: editForm.salary,
        offeredDoj: editForm.offeredDoj,
        status: editForm.status
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

  const uniqueDesigs = Array.from(new Set(employees.map(e => e.desig).filter(Boolean)));

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Employee Master Directory"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
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
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Designations</option>
                {uniqueDesigs.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
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
              value={employees.length > 0 ? employees[0]?.name : '—'}
              subtext={employees.length > 0 ? `DOJ: ${employees[0]?.actualDoj || employees[0]?.offeredDoj || 'Recent'}` : 'No records'}
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
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4">Offered Salary</th>
                    <th className="py-3 px-4">DOJ Offered</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filtered.map((emp) => (
                    <tr key={emp.appNo} className="hover:bg-black/5 transition-colors font-medium">
                      <td className="py-3.5 px-4 font-mono text-[#555555] font-bold">{emp.appNo}</td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setDrawerEmp(emp)}
                          className="flex items-center gap-3 group text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#1a8a84] text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {emp.initials}
                          </div>
                          <div>
                            <span className="font-extrabold text-[#1E2D4E] group-hover:underline block">{emp.name}</span>
                            <span className="text-[10px] text-[#777777] font-medium">{emp.email || 'No Email'}</span>
                          </div>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-[#1E2D4E] font-extrabold">{emp.desig}</td>
                      <td className="py-3.5 px-4 font-mono text-[#555555]">{emp.phone}</td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-700">
                        {emp.salary && emp.salary !== '—' ? `₹ ${emp.salary}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#666666]">
                        {emp.offeredDoj || emp.estDoj || emp.actualDoj || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={emp.status || 'Joined'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors shadow-xs"
                            title="Edit Employee Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.appNo, emp.name)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors shadow-xs"
                            title="Delete Employee Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Full Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-modern" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Phone Number *</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-modern font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Email Address</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-modern" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Designation Role</label>
                <input type="text" value={editForm.desig} onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })} className="input-modern" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered Monthly Salary (₹)</label>
                  <input type="text" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} placeholder="e.g. 25000" className="input-modern" />
                </div>
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Offered Date of Joining</label>
                  <input type="date" value={editForm.offeredDoj} onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })} className="input-modern" />
                </div>
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
                </select>
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

      {/* Drawer */}
      {drawerEmp && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setDrawerEmp(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between z-10 space-y-4 animate-fade-in overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1a8a84] text-white font-black text-sm flex items-center justify-center">
                    {drawerEmp.initials}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#1E2D4E] text-base">{drawerEmp.name}</h3>
                    <div className="text-xs text-[#777777] font-mono">{drawerEmp.appNo} · {drawerEmp.desig}</div>
                  </div>
                </div>
                <button onClick={() => setDrawerEmp(null)} className="text-[#888888]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-2">
                  <div className="flex justify-between"><span className="text-[#777777]">Phone:</span><span className="font-bold text-[#1E2D4E] font-mono">{drawerEmp.phone}</span></div>
                  <div className="flex justify-between"><span className="text-[#777777]">Email:</span><span className="font-bold text-[#1E2D4E]">{drawerEmp.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[#777777]">Salary Package:</span><span className="font-bold text-emerald-700">₹ {drawerEmp.salary || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[#777777]">Offered DOJ:</span><span className="font-bold text-[#1E2D4E]">{drawerEmp.offeredDoj || drawerEmp.estDoj || drawerEmp.actualDoj || '—'}</span></div>
                </div>

                <div className="space-y-2">
                  <span className="font-extrabold text-[#1E2D4E] block">Uploaded Documents</span>
                  <div className="grid grid-cols-3 gap-2">
                    {fileUrl(drawerEmp.photoUrl) ? (
                      <a href={fileUrl(drawerEmp.photoUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">📷 Photo</a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Photo</span>}
                    {fileUrl(drawerEmp.aadhaarUrl || drawerEmp.aadharUrl) ? (
                      <a href={fileUrl(drawerEmp.aadhaarUrl || drawerEmp.aadharUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">📄 Aadhaar</a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Aadhaar</span>}
                    {fileUrl(drawerEmp.resumeUrl) ? (
                      <a href={fileUrl(drawerEmp.resumeUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">📑 Resume</a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Resume</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e2dfd7] flex gap-2">
              <button
                onClick={() => handleOpenEdit(drawerEmp)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-800 shadow-xs"
              >
                <Edit3 className="w-4 h-4" /> Edit Employee
              </button>
              <button
                onClick={() => handleDeleteEmployee(drawerEmp.appNo, drawerEmp.name)}
                className="py-2.5 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
