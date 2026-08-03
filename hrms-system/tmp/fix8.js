const fs = require('fs');

const code = `import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { 
  Search, FileText, Phone, Calendar, CheckCircle2, XCircle, 
  UserCheck, Trash2, X, Briefcase, DollarSign, Image as ImageIcon, 
  FileCheck, ChevronRight, TrendingUp, Filter, User, Building, MapPin, Loader2, ArrowRight, Clock
} from 'lucide-react';

export default function OfferProcessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designations, setDesignations] = useState<string[]>([]);

  const [detailOffer, setDetailOffer] = useState<any | null>(null);
  const [noticePd, setNoticePd] = useState('');
  const [estDoj, setEstDoj] = useState('');
  const [salaryOffered, setSalaryOffered] = useState('');
  const [finalDesignation, setFinalDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [otherSection, setOtherSection] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));

  const [profileOffer, setProfileOffer] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.getOffers();
      if (res && res.offers) {
        setOffers(res.offers);
      }
    } catch (err: any) {
      showToast('Could not load offers: ' + err.message, 'error');
    } finally {
      setLoading(false);
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

  const stats = useMemo(() => {
    return {
      pending: offers.filter(o => o.status === 'Pending Accept').length,
      accepted: offers.filter(o => o.status === 'Accepted').length,
      rejected: offers.filter(o => o.status === 'Declined' || o.status === 'Offer Rejected').length,
      joined: offers.filter(o => o.status === 'Joined').length,
      today: offers.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
      avgSalary: offers.reduce((acc, curr) => acc + (parseFloat(curr.salary) || 0), 0) / (offers.length || 1),
    };
  }, [offers]);

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
      }, 1500);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
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

  const handleMarkJoined = async (appNo: string) => {
    if (saving) return;
    const inputDate = prompt('Enter Actual Date of Joining (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (inputDate === null) return;
    setSaving(true);
    try {
      await API.markJoined({ appNo, joiningDate: inputDate });
      showToast('Offer marked as Joined! 🎉 Moving to Employee directory...', 'success');
      setTimeout(() => {
        navigate('/employees');
      }, 1500);
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

  const openDetailModal = (o: any) => {
    setDetailOffer(o);
    setNoticePd(o.noticePd || '');
    setEstDoj(o.estDoj || '');
    setSalaryOffered(o.salary || '');
    setFinalDesignation(o.desig || '');
    setDepartment(o.department || '');
    setOtherSection('');
  };

  const renderStatusBadge = (status: string) => {
    let classes = "px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border transition-colors inline-block text-center ";
    switch(status) {
      case 'Accepted': classes += "bg-emerald-100 text-emerald-800 border-emerald-200"; break;
      case 'Joined': classes += "bg-teal-100 text-teal-800 border-teal-200"; break;
      case 'Pending Accept': classes += "bg-blue-100 text-blue-800 border-blue-200"; break;
      case 'Declined':
      case 'Offer Rejected': classes += "bg-rose-100 text-rose-800 border-rose-200"; break;
      default: classes += "bg-slate-100 text-slate-800 border-slate-200";
    }
    return <span className={classes}>{status}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col gap-1 animate-fade-in-up">
            <div className="text-sm font-semibold text-slate-500">Home <ChevronRight className="inline w-4 h-4 mx-1"/> Offer Desk</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Offer Desk</h1>
            <p className="text-slate-500 font-medium">Manage candidate offers, approvals and employee onboarding.</p>
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            {[
              { label: 'Pending Offers', value: stats.pending, icon: <Clock className="w-5 h-5 text-blue-600"/>, bg: 'bg-blue-50' },
              { label: 'Accepted', value: stats.accepted, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600"/>, bg: 'bg-emerald-50' },
              { label: 'Joined', value: stats.joined, icon: <UserCheck className="w-5 h-5 text-teal-600"/>, bg: 'bg-teal-50' },
              { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-5 h-5 text-rose-600"/>, bg: 'bg-rose-50' },
              { label: 'Avg Salary', value: \`₹ \${Math.round(stats.avgSalary || 0).toLocaleString()}\`, icon: <DollarSign className="w-5 h-5 text-amber-600"/>, bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className={\`p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1\`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={\`p-2 rounded-xl \${stat.bg}\`}>{stat.icon}</div>
                </div>
                <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter Bar */}
          <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md py-3 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-slate-200">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
              {[
                { key: 'all', label: 'All Offers' },
                { key: 'Pending Accept', label: 'Pending' },
                { key: 'Accepted', label: 'Accepted' },
                { key: 'Joined', label: 'Joined' },
                { key: 'Declined', label: 'Rejected' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveFilter(t.key)}
                  className={\`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border \${
                    activeFilter === t.key 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }\`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-full px-4 py-2 w-full md:max-w-xs shadow-sm focus-within:ring-2 ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-semibold text-slate-900 w-full placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Table / Cards Area */}
          {loading ? (
            <div className="grid gap-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Offered Salary</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Joining Date</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(o => (
                      <tr key={o.appNo} onClick={() => setProfileOffer(o)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={\`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm bg-\${o.color}-600 shadow-sm\`}>
                              {o.initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{o.name}</div>
                              <div className="text-xs text-slate-500 font-mono">{o.appNo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-semibold text-slate-800">{o.desig}</div>
                          <div className="text-xs text-slate-500">{o.department}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-bold text-emerald-700 font-mono">{o.salary ? \`₹ \${o.salary}\` : '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-bold text-slate-800">{o.estDoj || o.actualDoj || '—'}</div>
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-start gap-1">
                            {renderStatusBadge(o.status)}
                            <select
                              value={o.status}
                              onChange={(e) => handleChangeStatus(o.appNo, e.target.value)}
                              className="text-[10px] font-bold text-slate-500 bg-transparent cursor-pointer border-none outline-none hover:text-slate-800 transition-colors"
                            >
                              <option value="Pending Accept">Pending</option>
                              <option value="Accepted">Accepted</option>
                              <option value="Joined">Joined</option>
                              <option value="Offer Rejected">Rejected</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => openDetailModal(o)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors mr-2 shadow-sm"
                          >
                            Edit
                          </button>
                          {o.status === 'Pending Accept' && (
                            <button
                              onClick={() => handleAcceptOffer(o.appNo)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
                            >
                              Accept
                            </button>
                          )}
                          {o.status === 'Accepted' && (
                            <button
                              onClick={() => handleMarkJoined(o.appNo)}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm"
                            >
                              Mark Joined
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-semibold">No offers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden grid gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                {filtered.map(o => (
                  <div key={o.appNo} onClick={() => setProfileOffer(o)} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-\${o.color}-600 shadow-sm\`}>
                          {o.initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{o.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{o.appNo}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="col-span-2 flex justify-between items-center border-b border-slate-200 pb-2 mb-1">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Status</div>
                        <div onClick={(e)=>e.stopPropagation()}>{renderStatusBadge(o.status)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Designation</div>
                        <div className="text-sm font-semibold text-slate-800 truncate">{o.desig}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Salary</div>
                        <div className="text-sm font-bold text-emerald-700 font-mono">{o.salary ? \`₹ \${o.salary}\` : '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Joining Date</div>
                        <div className="text-sm font-bold text-slate-800">{o.estDoj || o.actualDoj || '—'}</div>
                      </div>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => openDetailModal(o)}
                        className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
                      >
                        Edit Details
                      </button>
                      {o.status === 'Pending Accept' && (
                        <button
                          onClick={() => handleAcceptOffer(o.appNo)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-slate-500 font-semibold bg-white rounded-2xl border border-slate-200">No offers found.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Edit Details Centered Modal */}
      {detailOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !saving && setDetailOffer(null)}></div>
          
          <div className="bg-slate-50 w-full max-w-4xl rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh] animate-fade-in-scale overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-\${detailOffer.color}-600 shadow-sm\`}>
                  {detailOffer.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Edit Offer</h3>
                  <div className="text-xs font-mono text-slate-500">{detailOffer.name} • {detailOffer.appNo}</div>
                </div>
              </div>
              <button onClick={() => !saving && setDetailOffer(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col md:flex-row gap-6">
              {/* Form Section */}
              <div className="flex-1 space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    Offer & Salary Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                    <div className="relative">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">Salary Offered (₹)</label>
                      <input type="text" value={salaryOffered} onChange={(e) => setSalaryOffered(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-emerald-700 font-bold outline-none focus:border-emerald-500 focus:ring-2 ring-emerald-500/20 transition-all hover:bg-white" placeholder="e.g. 25000" />
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">Est. Joining Date</label>
                      <input type="date" value={estDoj} onChange={(e) => setEstDoj(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold outline-none focus:border-blue-500 focus:ring-2 ring-blue-500/20 transition-all hover:bg-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    Role Allocation
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">Final Designation</label>
                      <select value={finalDesignation} onChange={(e) => setFinalDesignation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold outline-none focus:border-blue-500 focus:ring-2 ring-blue-500/20 transition-all cursor-pointer hover:bg-white">
                        <option value="">Select Designation</option>
                        {designations.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">Department</label>
                      <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold outline-none focus:border-blue-500 focus:ring-2 ring-blue-500/20 transition-all cursor-pointer hover:bg-white">
                        <option value="">Select Department</option>
                        <option value="SAARE">SAARE</option>
                        <option value="Finance">Finance</option>
                        <option value="Sales">Sales</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Sidebar inside modal */}
              <div className="w-full md:w-72 space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 mb-2">Current Status</div>
                    <div>{renderStatusBadge(detailOffer.status)}</div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 mb-1">Previous Salary</div>
                    <div className="font-bold text-slate-800 font-mono text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">{detailOffer.currentSalary ? \`₹ \${detailOffer.currentSalary}\` : '—'}</div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 mb-1">Expected Salary</div>
                    <div className="font-bold text-slate-800 font-mono text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">{detailOffer.expectedSalary ? \`₹ \${detailOffer.expectedSalary}\` : '—'}</div>
                  </div>
                  
                  {detailOffer.remarks && (
                    <div className="border-t border-slate-100 pt-4">
                      <div className="text-[10px] uppercase font-extrabold text-slate-400 mb-2">Shortlist Remarks</div>
                      <div className="text-sm font-medium text-amber-900 italic bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm">{detailOffer.remarks}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button onClick={() => setDetailOffer(null)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <div className="flex w-full sm:w-auto gap-2">
                <button onClick={handleSaveDetails} disabled={saving} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 shadow-md disabled:opacity-50 transition-colors">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Preview Centered Modal */}
      {profileOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setProfileOffer(null)}></div>
          
          <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] animate-fade-in-scale overflow-hidden">
            {/* Header / Cover */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-5 relative shadow-sm z-10">
              <button onClick={() => setProfileOffer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-5">
                <div className={\`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl bg-\${profileOffer.color}-600 shadow-lg border-4 border-white\`}>
                  {profileOffer.initials}
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-2xl sm:text-3xl tracking-tight leading-tight">{profileOffer.name}</h2>
                  <div className="text-sm font-bold text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{profileOffer.appNo}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">{profileOffer.desig}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2 mt-4 sm:mt-0">
                <div className="text-[10px] uppercase font-extrabold text-slate-400">Current Status</div>
                <div>{renderStatusBadge(profileOffer.status)}</div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Offer Info Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      Offer Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 transition-colors hover:border-emerald-200">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 mb-1.5">Offered Salary</div>
                        <div className="text-xl font-black text-emerald-700 font-mono">{profileOffer.salary ? \`₹ \${profileOffer.salary}\` : '—'}</div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 transition-colors hover:border-blue-200">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 mb-1.5">Expected DOJ</div>
                        <div className="text-lg font-bold text-slate-800">{profileOffer.estDoj || profileOffer.actualDoj || '—'}</div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 mb-1.5">Department</div>
                        <div className="text-sm font-bold text-slate-800">{profileOffer.department || '—'}</div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 mb-1.5">Role</div>
                        <div className="text-sm font-bold text-slate-800">{profileOffer.desig || '—'}</div>
                      </div>
                    </div>
                    {profileOffer.remarks && (
                      <div className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-100 shadow-inner">
                        <div className="text-[10px] uppercase font-extrabold text-amber-800 mb-2">Shortlist Remarks</div>
                        <div className="text-sm font-medium text-amber-900 italic">"{profileOffer.remarks}"</div>
                      </div>
                    )}
                  </div>

                  {/* Personal Info Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Candidate Details
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Phone</span><span className="font-bold text-slate-800 text-sm">{profileOffer.phone || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Email</span><span className="font-bold text-slate-800 text-sm truncate block" title={profileOffer.email}>{profileOffer.email || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Gender</span><span className="font-bold text-slate-800 text-sm">{profileOffer.gender || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">DOB</span><span className="font-bold text-slate-800 text-sm">{profileOffer.dob || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Location</span><span className="font-bold text-slate-800 text-sm">{profileOffer.location || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Experience</span><span className="font-bold text-slate-800 text-sm">{profileOffer.experience || '—'}</span></div>
                    </div>
                  </div>

                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  
                  {/* Timeline / Status Flow */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      Status Timeline
                    </h4>
                    
                    <div className="relative pl-5 space-y-7 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                      
                      <div className="relative">
                        <div className="absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm z-10"></div>
                        <div className="text-sm font-bold text-slate-800">Shortlisted</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Moved to Offer Desk</div>
                      </div>

                      <div className="relative">
                        <div className={\`absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 \${profileOffer.salary ? 'bg-emerald-500' : 'bg-slate-300'}\`}></div>
                        <div className={\`text-sm font-bold \${profileOffer.salary ? 'text-slate-800' : 'text-slate-400'}\`}>Offer Finalized</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Salary & DOJ configured</div>
                      </div>

                      <div className="relative">
                        <div className={\`absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 \${['Accepted', 'Joined'].includes(profileOffer.status) ? 'bg-emerald-500' : profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'bg-rose-500' : 'bg-slate-300'}\`}></div>
                        <div className={\`text-sm font-bold \${['Accepted', 'Joined'].includes(profileOffer.status) ? 'text-emerald-700' : profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'text-rose-700' : 'text-slate-400'}\`}>
                          {profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'Offer Rejected' : 'Offer Accepted'}
                        </div>
                      </div>

                      <div className="relative">
                        <div className={\`absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 \${profileOffer.status === 'Joined' ? 'bg-emerald-500' : 'bg-slate-300'}\`}></div>
                        <div className={\`text-sm font-bold \${profileOffer.status === 'Joined' ? 'text-slate-800' : 'text-slate-400'}\`}>Joined Directory</div>
                        {profileOffer.status === 'Joined' && <div className="text-[10px] font-bold text-emerald-600 mt-1 uppercase">{profileOffer.actualDoj}</div>}
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            </div>
            
            {/* Modal Footer Actions */}
            <div className="border-t border-slate-200 p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
              <button onClick={() => setProfileOffer(null)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Close Profile
              </button>
              <div className="flex w-full sm:w-auto gap-2">
                <button onClick={() => { setProfileOffer(null); openDetailModal(profileOffer); }} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 shadow-sm transition-colors flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Edit Details
                </button>
                {profileOffer.status === 'Pending Accept' && (
                  <button onClick={() => { setProfileOffer(null); handleAcceptOffer(profileOffer.appNo); }} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-md transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Accept Offer
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
`;

fs.writeFileSync('client/src/pages/OfferProcess.tsx', code);
console.log('Fixed OfferProcess.tsx completely');
