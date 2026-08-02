import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { 
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase, 
  FileText, CheckCircle, Trash2, Edit3, X, ExternalLink, UserCheck, DollarSign
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
          title="Employees Directory"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Header Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card-glass p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E2D4E]/10 text-[#1E2D4E] flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Total Hired</div>
                <div className="text-xl font-black text-[#1E2D4E]">{employees.length}</div>
              </div>
            </div>

            <div className="card-glass p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Joined</div>
                <div className="text-xl font-black text-emerald-700">
                  {employees.filter(e => e.status === 'Joined').length}
                </div>
              </div>
            </div>

            <div className="card-glass p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Offer Accepted</div>
                <div className="text-xl font-black text-amber-700">
                  {employees.filter(e => e.status === 'Offer Accepted' || e.status === 'Selected').length}
                </div>
              </div>
            </div>

            <div className="card-glass p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-700 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Roles Covered</div>
                <div className="text-xl font-black text-purple-700">{uniqueDesigs.length}</div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="card-glass p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                <input
                  type="text"
                  placeholder="Search by name, app no, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] text-xs font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={desigFilter}
                  onChange={(e) => setDesigFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
                >
                  <option value="">All Designations</option>
                  {uniqueDesigs.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888] tracking-wider">
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3 text-emerald-800">Salary Offered</th>
                    <th className="py-3 px-3 text-amber-800">DOJ Offered</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {filtered.length > 0 ? (
                    filtered.map((emp) => (
                      <tr key={emp.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#C9952A] font-black text-white flex items-center justify-center text-xs shadow-sm">
                              {emp.initials}
                            </div>
                            <div>
                              <button 
                                onClick={() => setDrawerEmp(emp)}
                                className="font-bold text-[#1E2D4E] hover:underline text-left"
                              >
                                {emp.name}
                              </button>
                              <div className="text-[10px] text-[#888888] font-mono">{emp.appNo}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-semibold text-[#1E2D4E]">{emp.desig}</td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-bold text-[#1E2D4E]">{emp.phone}</span>
                            <span className="text-[#888888] text-[10px]">{emp.email || '—'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ₹{emp.salary}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-700" />
                            {emp.offeredDoj || emp.estDoj || emp.actualDoj || '—'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            emp.status === 'Joined' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : emp.status === 'Offer Accepted' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {emp.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDrawerEmp(emp)}
                              className="px-2 py-1 rounded bg-[#1E2D4E] text-white font-bold text-[10px] hover:bg-[#162340]"
                              title="View Details & Documents"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="px-2 py-1 rounded bg-emerald-700 text-white font-bold text-[10px] hover:bg-emerald-800 flex items-center gap-1"
                              title="Edit Employee Details"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.appNo, emp.name)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-bold text-[10px] hover:bg-red-700"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#888888] font-semibold">
                        No employees found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Employee Drawer */}
      {drawerEmp && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerEmp(null)} />

          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C9952A] font-black text-white flex items-center justify-center text-sm">
                  {drawerEmp.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">{drawerEmp.name}</h3>
                  <div className="text-[11px] text-white/60 mt-0.5">{drawerEmp.appNo} · {drawerEmp.desig}</div>
                </div>
              </div>

              <button onClick={() => setDrawerEmp(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-800">Salary Offered</div>
                  <div className="text-base font-black text-emerald-900">₹{drawerEmp.salary}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-amber-800">DOJ Offered</div>
                  <div className="text-base font-black text-amber-900">{drawerEmp.offeredDoj || drawerEmp.estDoj || drawerEmp.actualDoj || '—'}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Contact &amp; Personal Info</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-[#888888]">Phone:</span> <b className="text-[#1E2D4E]">{drawerEmp.phone}</b></div>
                  <div><span className="text-[#888888]">Email:</span> <b>{drawerEmp.email || '—'}</b></div>
                  <div><span className="text-[#888888]">DOB:</span> <b>{drawerEmp.dob || '—'}</b></div>
                  <div><span className="text-[#888888]">Gender:</span> <b>{drawerEmp.gender || '—'}</b></div>
                  <div><span className="text-[#888888]">City / State:</span> <b>{drawerEmp.cityState || '—'}</b></div>
                  <div><span className="text-[#888888]">Address:</span> <b>{drawerEmp.address || '—'}</b></div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Professional Info</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-[#888888]">Experience:</span> <b>{drawerEmp.experience || '—'}</b></div>
                  <div><span className="text-[#888888]">Qualification:</span> <b>{drawerEmp.qualification || '—'}</b></div>
                  <div><span className="text-[#888888]">Previous Company:</span> <b>{drawerEmp.previousCompany || '—'}</b></div>
                  <div><span className="text-[#888888]">Aadhaar No:</span> <b>{drawerEmp.aadhaarNumber || '—'}</b></div>
                </div>
              </div>

              {/* Documents */}
              <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-3">
                <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Employee Documents</div>
                <div className="flex flex-col gap-2">
                  {fileUrl(drawerEmp.resumeUrl) ? (
                    <a
                      href={fileUrl(drawerEmp.resumeUrl)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                    >
                      <FileText className="w-4 h-4" />
                      <span>View Resume PDF</span>
                    </a>
                  ) : (
                    <div className="text-[#888888] italic text-[11px]">No resume uploaded</div>
                  )}

                  {fileUrl(drawerEmp.photoUrl) ? (
                    <a
                      href={fileUrl(drawerEmp.photoUrl)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Photo</span>
                    </a>
                  ) : (
                    <div className="text-[#888888] italic text-[11px]">No photo uploaded</div>
                  )}

                  {fileUrl(drawerEmp.aadharUrl || drawerEmp.aadhaarUrl) ? (
                    <a
                      href={fileUrl(drawerEmp.aadharUrl || drawerEmp.aadhaarUrl)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs hover:bg-[#162340]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View Aadhaar Card</span>
                    </a>
                  ) : (
                    <div className="text-[#888888] italic text-[11px]">No Aadhaar uploaded</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#e0ddd8] bg-[#F9F7F4] flex gap-2">
              <button
                onClick={() => handleOpenEdit(drawerEmp)}
                className="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-800"
              >
                <Edit3 className="w-4 h-4" /> Edit Employee Details
              </button>
              <button
                onClick={() => handleDeleteEmployee(drawerEmp.appNo, drawerEmp.name)}
                className="py-2.5 px-4 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e0ddd8] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">Edit Employee — {editModal.emp?.appNo}</h3>
              <button onClick={() => setEditModal({ open: false, emp: null })} className="text-[#888888] hover:text-[#1E2D4E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Designation</label>
                <input
                  type="text"
                  value={editForm.desig}
                  onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Salary Offered (₹)</label>
                <input
                  type="text"
                  value={editForm.salary}
                  onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                  placeholder="e.g. 25000"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">DOJ Offered</label>
                <input
                  type="date"
                  value={editForm.offeredDoj}
                  onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold text-amber-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold"
                >
                  <option value="Joined">Joined</option>
                  <option value="Offer Accepted">Offer Accepted</option>
                  <option value="Selected">Selected</option>
                  <option value="Offer Sent">Offer Sent</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e0ddd8]">
              <button
                onClick={() => setEditModal({ open: false, emp: null })}
                className="px-4 py-2 rounded-lg border border-[#e0ddd8] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
