import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { FileText, Phone, Calendar, CheckCircle2, XCircle, UserCheck, Trash2, X, Briefcase, DollarSign, Image as ImageIcon, FileCheck } from 'lucide-react';

export default function OfferProcessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

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
    setFiltered(list);
  }, [offers, activeFilter]);

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

  const handleChangeStatus = async (appNo: string) => {
    if (saving) return;
    const newStatus = prompt('Enter new status (Pending Accept, Accepted, Joined, Offer Rejected, Declined):');
    if (!newStatus) return;
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Notice Period</th>
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
                        <td className="py-3 px-3">{o.noticePd || '—'}</td>
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
                            <button
                              onClick={(e) => { e.stopPropagation(); handleChangeStatus(o.appNo); }}
                              className="px-2.5 py-1 rounded bg-blue-700 text-white font-bold text-[11px]"
                            >
                              Status
                            </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1E2D4E]/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border border-[#C9952A]/40">
            {/* Sticky Header */}
            <div className="bg-[#1E2D4E] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#C9952A]/30 sticky top-0 z-20">
              <div className="flex items-center gap-3.5">
                {fileUrl(drawerOffer.photoUrl) ? (
                  <img
                    src={fileUrl(drawerOffer.photoUrl)!}
                    alt={drawerOffer.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-[#C9952A] shadow-md bg-white p-0.5"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1E2D4E] to-[#2A3F6D] text-white font-black text-xl flex items-center justify-center border-2 border-[#C9952A] shadow-md">
                    {drawerOffer.initials}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-white text-lg sm:text-xl tracking-tight leading-none">{drawerOffer.name}</h2>
                    <StatusBadge status={drawerOffer.status} size="sm" />
                  </div>
                  <div className="text-xs text-[#C9952A] font-extrabold font-mono mt-1.5 flex flex-wrap items-center gap-2">
                    <span>{drawerOffer.appNo}</span>
                    <span>•</span>
                    <span className="text-white font-bold">{drawerOffer.desig}</span>
                    <span>•</span>
                    <span className="text-white/80 font-normal">Applied: {drawerOffer.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerOffer(null)}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs Navigation Bar */}
            <div className="flex items-center gap-1.5 p-2 sm:px-5 bg-[#F9F7F4] border-b border-[#e2dfd7] overflow-x-auto text-xs font-bold scrollbar-none sticky top-[80px] z-10">
              {[
                { id: 'overview', label: '👤 Overview' },
                { id: 'personal', label: '📋 Personal Info' },
                { id: 'address', label: '🏠 Address' },
                { id: 'family', label: '👨‍👩‍👧 Family' },
                { id: 'education', label: '🎓 Education' },
                { id: 'employment', label: '💼 Employment' },
                { id: 'languages', label: '🗣️ Languages' },
                { id: 'documents', label: '📄 Documents' },
                { id: 'activity', label: '⏱️ Activity Log' }
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
              {/* Tab 1: Profile Overview */}
              {(drawerTab === 'overview' || (drawerTab as string) === 'profile') && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Application No</span>
                      <div className="text-base font-mono font-black text-[#1E2D4E]">{drawerOffer.appNo}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Position Applied</span>
                      <div className="text-base font-extrabold text-[#1E2D4E]">{drawerOffer.desig || '—'}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Recruitment Source</span>
                      <div className="text-base font-extrabold text-[#C9952A]">{drawerOffer.source || 'Walk-in'}</div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#C9952A]" />
                      <span>Primary Contact &amp; Application Meta</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><span className="text-[#777777]">Mobile Phone:</span> <span className="font-extrabold text-[#1E2D4E] font-mono ml-1">{drawerOffer.phone}</span></div>
                      <div><span className="text-[#777777]">Email Address:</span> <span className="font-extrabold text-[#1E2D4E] ml-1">{drawerOffer.email || '—'}</span></div>
                      <div><span className="text-[#777777]">Application Date:</span> <span className="font-bold text-[#1E2D4E] ml-1">{drawerOffer.date}</span></div>
                      <div><span className="text-[#777777]">Days in Pipeline:</span> <span className="font-bold text-emerald-800 ml-1">{drawerOffer.daysIn} Days</span></div>
                      <div><span className="text-[#777777]">Referrer Info:</span> <span className="font-bold text-[#1E2D4E] ml-1">{drawerOffer.referrer ? `${drawerOffer.referrer} (${drawerOffer.referrerEmpNo || ''})` : '—'}</span></div>
                      <div><span className="text-[#777777]">Current Status:</span> <span className="font-bold text-sky-800 ml-1">{drawerOffer.status}</span></div>
                    </div>
                  </div>

                  {/* Salary & Offer Details */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#C9952A]" />
                      <span>Salary &amp; Offer Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.expectedSalary ? `₹ ${drawerOffer.expectedSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerOffer.previousSalary || drawerOffer.currentSalary) ? `₹ ${drawerOffer.previousSalary || drawerOffer.currentSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Notice Period</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.noticePeriod || drawerOffer.offeredDoj || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Allocated Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.department || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Designation Role</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.desig || drawerOffer.designation || '—'}</span></div>
                    </div>
                  </div>

                  {/* Work Experience Details */}
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
                      <div><span className="text-[#777777] block text-[10.5px]">Referrer Information</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.referrer ? `${drawerOffer.referrer} (${drawerOffer.referrerEmpNo || ''})` : '—'}</span></div>
                    </div>
                    {drawerOffer.remarks && (
                      <div className="pt-2 border-t border-[#e2dfd7]/60">
                        <span className="text-[#777777] block text-[10.5px] mb-0.5">Remarks / HR Notes:</span>
                        <span className="font-medium text-[#1E2D4E] block leading-relaxed italic">{drawerOffer.remarks}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Personal Information */}
              {(drawerTab as string) === 'personal' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#C9952A]" />
                    <span>Personal Profile Information</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div><span className="text-[#777777] block text-[10.5px]">Full Applicant Name:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerOffer.name}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Mobile Phone Number:</span><span className="font-extrabold text-[#1E2D4E] font-mono text-sm">{drawerOffer.phone}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Email Address:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.email || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Gender:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.gender || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Date of Birth:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.dob || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Blood Group:</span><span className="font-bold text-rose-700">{drawerOffer.bloodGroup || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Aadhaar Number (12 Digits):</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.aadhaarNumber || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Religion:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.religion || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Caste / Category:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.caste || drawerOffer.religionCaste || '—'}</span></div>
                  </div>
                </div>
              )}

              {/* Tab 3: Address Information */}
              {(drawerTab as string) === 'address' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#C9952A]" />
                    <span>Residential Address &amp; Location Details</span>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[#777777] block text-[10.5px] mb-1">Complete Residential Address:</span>
                      <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] font-semibold text-[#1E2D4E] leading-relaxed">
                        {drawerOffer.address || drawerOffer.cityState || '—'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><span className="text-[#777777] block text-[10.5px]">City / Location:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.cityState || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">State / Region:</span><span className="font-bold text-[#1E2D4E]">Karnataka</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Family Information */}
              {(drawerTab as string) === 'family' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C9952A]" />
                    <span>Family &amp; Parental Background</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1">
                      <span className="text-[#777777] text-[10.5px] font-bold block">Father's Name &amp; Occupation</span>
                      <span className="font-extrabold text-[#1E2D4E] block">{drawerOffer.fatherDetails || '—'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1">
                      <span className="text-[#777777] text-[10.5px] font-bold block">Mother's Name &amp; Occupation</span>
                      <span className="font-extrabold text-[#1E2D4E] block">{drawerOffer.motherDetails || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Educational Details */}
              {(drawerTab as string) === 'education' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#C9952A]" />
                    <span>Educational Qualifications</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerOffer.qualification || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerOffer.experience || '—'}</span></div>
                  </div>
                </div>
              )}

              {/* Tab 6: Employment Details */}
              {(drawerTab as string) === 'employment' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#C9952A]" />
                    <span>Work Experience &amp; Salary Details</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div><span className="text-[#777777] block text-[10.5px]">Total Experience:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.experience || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Prior Work / Retail Experience:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.retailExperience || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Employer / Store:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.previousCompany || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Designation:</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.previousDesignation || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Monthly Salary:</span><span className="font-extrabold text-emerald-800">₹ {drawerOffer.currentSalary || drawerOffer.previousSalary || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Expected Monthly Salary:</span><span className="font-extrabold text-emerald-800">₹ {drawerOffer.expectedSalary || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Earliest Date of Joining:</span><span className="font-bold text-amber-800">{drawerOffer.offeredDoj || drawerOffer.noticePeriod || '—'}</span></div>
                  </div>
                </div>
              )}

              {/* Tab 7: Languages */}
              {(drawerTab as string) === 'languages' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C9952A]" />
                    <span>Languages Known</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(drawerOffer.languagesKnown) ? drawerOffer.languagesKnown : (drawerOffer.languagesKnown ? JSON.parse(drawerOffer.languagesKnown) : [])).map((lang: string) => (
                      <span key={lang} className="px-3.5 py-1.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] font-extrabold text-xs text-[#1E2D4E] shadow-2xs">
                        🗣️ {lang}
                      </span>
                    )) || 'No languages specified'}
                  </div>
                </div>
              )}

              {/* Tab 8: Documents */}
              {(drawerTab as string) === 'documents' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#C9952A]" />
                    <span>Verified Applicant Documents</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {fileUrl(drawerOffer.photoUrl) ? (
                      <a href={fileUrl(drawerOffer.photoUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">Passport Photo</span>
                        <span className="text-[10px] text-[#777777] group-hover:text-white/80 underline">View Document ↗</span>
                      </a>
                    ) : <div className="p-4 text-center text-[#aaa] border rounded-2xl bg-[#F9F7F4] font-bold">No Photo Uploaded</div>}

                    {fileUrl(drawerOffer.aadhaarUrl || drawerOffer.aadharUrl) ? (
                      <a href={fileUrl(drawerOffer.aadhaarUrl || drawerOffer.aadharUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
                        <span className="text-2xl">📄</span>
                        <span className="text-xs">Aadhaar Card</span>
                        <span className="text-[10px] text-[#777777] group-hover:text-white/80 underline">View Document ↗</span>
                      </a>
                    ) : <div className="p-4 text-center text-[#aaa] border rounded-2xl bg-[#F9F7F4] font-bold">No Aadhaar Uploaded</div>}

                    {fileUrl(drawerOffer.resumeUrl) ? (
                      <a href={fileUrl(drawerOffer.resumeUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
                        <span className="text-2xl">📑</span>
                        <span className="text-xs">Resume / CV</span>
                        <span className="text-[10px] text-[#777777] group-hover:text-white/80 underline">View Document ↗</span>
                      </a>
                    ) : <div className="p-4 text-center text-[#aaa] border rounded-2xl bg-[#F9F7F4] font-bold">No Resume Uploaded</div>}
                  </div>
                </div>
              )}

              {/* Tab 9: Activity Timeline */}
              {drawerTab === 'activity' && (
                <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-4 animate-fade-in">
                  <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C9952A]" />
                    <span>Activity &amp; Interaction Audit Log</span>
                  </h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {activityLog.length > 0 ? (
                      activityLog.map((a, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-1">
                          <div className="flex items-center justify-between font-extrabold text-[#1E2D4E]">
                            <span>{a.label || a.action_type}</span>
                            <span className="text-[10px] text-[#777777] font-mono">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                          </div>
                          {a.remarks && <p className="text-[#666666] italic text-[11px]">{a.remarks}</p>}
                        </div>
                      ))
                    ) : <p className="text-center py-8 text-[#888888] font-semibold">No activity logs recorded yet for this applicant.</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 bg-white border-t border-[#e2dfd7] flex flex-wrap items-center justify-between gap-2 sticky bottom-0 z-20">
              <button
                onClick={() => handleDeleteCandidate(drawerOffer.appNo)}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-600 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Applicant</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleStatusChange('schedule', drawerOffer)}
                  className="px-3.5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs hover:bg-[#162340] transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Interview</span>
                </button>
                <button
                  onClick={() => handleStatusChange('shortlist', drawerOffer)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-extrabold text-xs hover:bg-emerald-800 transition-colors shadow-xs"
                >
                  Shortlist
                </button>
                <button
                  onClick={() => handleStatusChange('hold', drawerOffer)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white font-extrabold text-xs hover:bg-amber-700 transition-colors shadow-xs"
                >
                  Hold
                </button>
                <button
                  onClick={() => handleStatusChange('reject', drawerOffer)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 transition-colors shadow-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
