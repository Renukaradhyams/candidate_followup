import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { Search, FileText, Phone, Calendar, CheckCircle2, XCircle, UserCheck, Trash2, X, Briefcase, DollarSign, Image as ImageIcon, FileCheck } from 'lucide-react';

export default function OfferProcessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [drawerOffer, setDrawerOffer] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');

  const [detailOffer, setDetailOffer] = useState<any | null>(null);
  const [noticePd, setNoticePd] = useState('');
  const [estDoj, setEstDoj] = useState('');
  const [salaryOffered, setSalaryOffered] = useState('');
  const [finalDesignation, setFinalDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [otherSection, setOtherSection] = useState('');
  const [designations, setDesignations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));

  const loadOffers = useCallback(async () => {
    try {
      const res = await API.getOffers();
      if (res && res.offers) {
        setOffers(res.offers);
      }
    } catch (err: any) {
      showToast('Could not load offers: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadOffers();
    API.getDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});
  }, [navigate, loadOffers]);

  useEffect(() => {
    let list = [...offers];
    if (activeFilter === 'Pending Accept') list = list.filter(o => o.status === 'Pending Accept');
    if (activeFilter === 'Accepted') list = list.filter(o => o.status === 'Accepted');
    if (activeFilter === 'Declined') list = list.filter(o => o.status === 'Declined' || o.status === 'Offer Rejected');
    if (activeFilter === 'Joined') list = list.filter(o => o.status === 'Joined');
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => 
        (o.name && o.name.toLowerCase().includes(q)) || 
        (o.appNo && o.appNo.toLowerCase().includes(q)) || 
        (o.desig && o.desig.toLowerCase().includes(q))
      );
    }
    setFiltered(list);
  }, [offers, activeFilter, searchQuery]);

  const handleSaveDetails = async () => {
    if (!detailOffer || saving) return;
    if (!salaryOffered || !estDoj || !department || !finalDesignation) {
      showToast('Salary Offered, DOJ, Finalized Role, and Allocated Department are mandatory fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      await API.updateOfferDetails({ appNo: detailOffer.appNo, noticePd, estDoj, salaryOffered, department, otherSection, finalDesignation });
      showToast('Offer joining details saved', 'success');
      loadOffers();
      setDetailOffer(null);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptOffer = async (appNo: string) => {
    if (saving) return;
    const remarks = prompt('Remarks for offer acceptance (optional):');
    if (remarks === null) return;

    const inputDate = prompt('Enter Actual Date of Joining (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (inputDate === null) return;

    setSaving(true);
    try {
      await API.acceptOffer({ appNo, remarks, joiningDate: inputDate });
      showToast('Offer accepted & marked Joined! 🎉 Moving to Employee directory...', 'success');
      setTimeout(() => {
        navigate('/employees');
      }, 1200);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkJoined = async (appNo: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await API.markJoined({ appNo, joiningDate });
      showToast('Employee marked as Joined! 🎉 Moving to Employee directory...', 'success');
      setTimeout(() => {
        navigate('/employees');
      }, 1200);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffer = async (appNo: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete candidate "${name}" (${appNo})?`)) return;
    try {
      await API.deleteCandidate(appNo);
      showToast(`Candidate ${name} deleted completely`, 'success');
      loadOffers();
    } catch (err: any) {
      showToast('Error deleting candidate: ' + err.message, 'error');
    }
  };

  const handleRejectOffer = async (appNo: string) => {
    if (saving) return;
    const remarks = prompt('Reason for rejection:');
    if (remarks === null) return;
    setSaving(true);
    try {
      await API.rejectOffer({ appNo, remarks });
      showToast('Offer rejected', 'success');
      loadOffers();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (appNo: string, newStatus: string) => {
    if (saving || !newStatus) return;
    setSaving(true);
    try {
      await API.updateOfferStatus({ appNo, status: newStatus });
      showToast('Status updated to ' + newStatus, 'success');
      loadOffers();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Offer Process"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Offer Process' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'Pending Accept', label: 'Pending' },
              { key: 'Accepted', label: 'Accepted' },
              { key: 'Declined', label: 'Declined' },
              { key: 'Joined', label: 'Joined' }
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveFilter(t.key)}
                className={`px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
                  activeFilter === t.key ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-white text-[#666666] border-[#e0ddd8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Offer Table */}
          <div className="card-glass p-4 space-y-4">
            <div className="flex items-center gap-3 bg-white border border-[#e2dfd7] rounded-xl px-3 py-1.5 w-full md:max-w-xs shadow-xs focus-within:ring-2 ring-emerald-500/20">
                <Search className="w-4 h-4 text-[#888888]" />
                <input 
                  type="text"
                  placeholder="Search by name, ID or designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold text-[#1E2D4E] w-full placeholder:text-[#AAAAAA]"
                />
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Offered Salary</th>
                    <th className="py-2.5 px-3">Est. DOJ</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {filtered.length > 0 ? (
                    filtered.map(o => (
                      <tr key={o.appNo} className="hover:bg-black/5 font-medium cursor-pointer transition-colors" onClick={() => setDrawerOffer(o)}>
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#1E2D4E]">{o.name}</div>
                          <div className="text-[10px] text-[#888888] font-mono">{o.appNo}</div>
                        </td>
                        <td className="py-3 px-3">{o.desig}</td>
                        <td className="py-3 px-3 font-mono font-bold text-[#1E2D4E]">{o.salary ? `₹ ${o.salary}` : '—'}</td>
                        <td className="py-3 px-3">{o.estDoj || '—'}</td>
                        <td className="py-3 px-3">
                          <span className={`badge ${
                            o.status === 'Accepted' ? 'b-sel' :
                            o.status === 'Joined' ? 'b-sel' :
                            o.status === 'Pending Accept' ? 'b-offer' : 'b-rej'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailOffer(o);
                                setNoticePd(o.noticePd || '');
                                setEstDoj(o.estDoj || '');
                                setSalaryOffered(o.salary || '');
                                setFinalDesignation(o.desig || '');
                                setDepartment(o.department || '');
                                setOtherSection('');
                              }}
                              className="px-2.5 py-1 rounded bg-[#1E2D4E] text-white font-bold text-[11px]"
                            >
                              Edit Details
                            </button>
                            {o.status === 'Pending Accept' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAcceptOffer(o.appNo); }}
                                className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold text-[11px]"
                              >
                                Accept Offer
                              </button>
                            )}
                            {o.status === 'Pending Accept' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRejectOffer(o.appNo); }}
                                className="px-2.5 py-1 rounded bg-rose-700 text-white font-bold text-[11px]"
                              >
                                Reject Offer
                              </button>
                            )}
                            <select
                                value={o.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); handleChangeStatus(o.appNo, e.target.value); }}
                                className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[11px] outline-none cursor-pointer"
                              >
                                <option value="Pending Accept">Pending Accept</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Joined">Joined</option>
                                <option value="Offer Rejected">Offer Rejected</option>
                                <option value="Declined">Declined</option>
                              </select>
                            {o.status === 'Accepted' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkJoined(o.appNo); }}
                                className="px-2.5 py-1 rounded bg-teal-700 text-white font-bold text-[11px]"
                              >
                                Mark Joined
                              </button>
                            )}
                            {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteOffer(o.appNo, o.name); }}
                              className="p-1.5 rounded border border-red-200 text-red-600 font-bold text-[11px] hover:bg-red-50 transition-colors"
                              title="Delete Candidate completely"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="py-8 text-center text-[#888888]">No offers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Details Drawer */}
      {detailOffer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailOffer(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-5 flex flex-col z-10 space-y-4">
            <h3 className="font-extrabold text-[#1E2D4E] text-base border-b border-[#e2dfd7] pb-3">Offer Details — {detailOffer.name}</h3>

            <div className="space-y-4 overflow-y-auto pr-2 pb-2 text-xs flex-1">
              
              {/* Evaluation History Section */}
              <div className="space-y-3 pb-3 border-b border-[#e2dfd7]">
                <h4 className="font-extrabold text-[#777777] text-[10px] uppercase tracking-wider">Interview Evaluation History</h4>
                
                {detailOffer.hrScore ? (
                  <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-[#1E2D4E] text-[11px] uppercase tracking-wider">HR Round 1</span>
                      <span className="font-black text-[#C9952A]">{detailOffer.hrScore.total} / {detailOffer.hrScore.maxTotal}</span>
                    </div>
                    <p className="text-[#555555] font-medium text-xs italic">"{detailOffer.hrScore.remarks || 'No remarks provided.'}"</p>
                  </div>
                ) : (
                  <div className="text-[#888888] italic text-xs">No HR Round scores found.</div>
                )}

                {detailOffer.assignedScore && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-[#1E2D4E] text-[11px] uppercase tracking-wider">Round 2 Management</span>
                      <span className="font-black text-blue-700">{detailOffer.assignedScore.total} / {detailOffer.assignedScore.maxTotal}</span>
                    </div>
                    <p className="text-[#555555] font-medium text-xs italic">"{detailOffer.assignedScore.remarks || 'No remarks provided.'}"</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Salary Offered (₹)</label>
                <input
                  type="text"
                  value={salaryOffered}
                  onChange={(e) => setSalaryOffered(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Notice Period</label>
                <input
                  type="text"
                  value={noticePd}
                  onChange={(e) => setNoticePd(e.target.value)}
                  placeholder="e.g. Immediate, 15 days"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Est. Date of Joining</label>
                <input
                  type="date"
                  value={estDoj}
                  onChange={(e) => setEstDoj(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold text-amber-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Finalized Role (Designation)</label>
                <select
                  value={finalDesignation}
                  onChange={(e) => setFinalDesignation(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold"
                >
                  <option value="">Select Designation</option>
                  {designations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Allocated Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold"
                >
                  <option value="">Select Department</option>
                  <option value="SAARE">SAARE</option>
                  <option value="LADIES">LADIES</option>
                  <option value="KIDS">KIDS</option>
                  <option value="MENS">MENS</option>
                  <option value="HOME FURNISHING">HOME FURNISHING</option>
                  <option value="OTHERS">OTHERS</option>
                </select>
              </div>

              {department === 'OTHERS' && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Other Section (Optional)</label>
                  <input
                    type="text"
                    value={otherSection}
                    onChange={(e) => setOtherSection(e.target.value)}
                    placeholder="Enter section name"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDetailOffer(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#e0ddd8] font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
{drawerOffer && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOffer(null)} />
          <div className="relative w-full max-w-2xl bg-[#EDE8DE] h-full shadow-2xl flex flex-col z-10 animate-slide-in">
            <div className="bg-[#1E2D4E] text-white p-4 lg:p-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-lg lg:text-xl tracking-tight">{drawerOffer.name}</h3>
                <div className="text-white/70 text-xs font-mono font-medium flex gap-3 mt-1">
                  <span>{drawerOffer.appNo}</span>
                  <span>{drawerOffer.email}</span>
                </div>
              </div>
              <button onClick={() => setDrawerOffer(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#C9952A]" />
                  <span>Salary & Offer Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
{drawerOffer.remarks && (
                  <div className="col-span-1 sm:col-span-2 mb-2">
                    <span className="text-[#777777] block text-[10.5px]">Shortlist Remarks</span>
                    <span className="font-medium text-[#1E2D4E] text-xs italic">{drawerOffer.remarks}</span>
                  </div>
                )}
                  <div><span className="text-[#777777] block text-[10.5px]">Offered Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono text-emerald-700">{drawerOffer.salary ? `₹ ${drawerOffer.salary}` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Estimated Date of Joining</span><span className="font-extrabold text-[#1E2D4E] text-amber-700">{drawerOffer.estDoj || drawerOffer.offeredDoj || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.expectedSalary ? `₹ ${drawerOffer.expectedSalary}` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerOffer.previousSalary || drawerOffer.currentSalary) ? `₹ ${drawerOffer.previousSalary || drawerOffer.currentSalary}` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Allocated Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.department || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Designation Role</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.desig || drawerOffer.designation || '—'}</span></div>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#C9952A]" />
                  <span>Work Experience Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.experience || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Prior / Retail Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.retailExperience || drawerOffer.retail_experience || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Company / Employer</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.previousCompany || drawerOffer.previous_company || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Role / Designation</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.previousDesignation || drawerOffer.previous_designation || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.qualification || '—'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
