import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { 
  Search, FileText, Phone, Calendar, CheckCircle2, XCircle, 
  UserCheck, Trash2, X, Briefcase, DollarSign, Image as ImageIcon, 
  FileCheck, ChevronRight, TrendingUp, Filter, User, Building, MapPin, Loader2, ArrowRight, Clock, Award, Calculator, Layers
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

  // Edit Modal State
  const [detailOffer, setDetailOffer] = useState<any | null>(null);
  const [noticePd, setNoticePd] = useState('');
  const [estDoj, setEstDoj] = useState('');
  const [salaryOffered, setSalaryOffered] = useState('');
  const [incentiveOffered, setIncentiveOffered] = useState('');
  const [finalDesignation, setFinalDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [otherSection, setOtherSection] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));

  // Profile Modal State
  const [profileOffer, setProfileOffer] = useState<any | null>(null);

  // Helper to parse salary and incentive
  const parseSalaryAndIncentive = (val: any) => {
    if (!val) return { base: 0, incentive: 0, total: 0, rawBase: '', rawIncentive: '' };
    const str = String(val).trim();
    if (str.includes('|')) {
      const parts = str.split('|');
      const base = parseFloat(parts[0]) || 0;
      const inc = parseFloat(parts[1]) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: parts[0] || '', rawIncentive: parts[1] || '' };
    }
    if (str.includes('+')) {
      const parts = str.split('+');
      const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      return { base, incentive: inc, total: base + inc, rawBase: String(base), rawIncentive: String(inc) };
    }
    const base = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return { base, incentive: 0, total: base, rawBase: str, rawIncentive: '' };
  };

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
    let list = [...(offers || [])];
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
    const list = offers || [];
    const pending = list.filter(o => o.status === 'Pending Accept').length;
    const accepted = list.filter(o => o.status === 'Accepted').length;
    const rejected = list.filter(o => o.status === 'Declined' || o.status === 'Offer Rejected').length;
    const joined = list.filter(o => o.status === 'Joined').length;
    const totalPkgSum = list.reduce((acc, curr) => acc + parseSalaryAndIncentive(curr.salary).total, 0);
    const avgSalary = list.length ? totalPkgSum / list.length : 0;
    return { pending, accepted, rejected, joined, avgSalary };
  }, [offers]);

  const handleSaveDetails = async () => {
    if (!detailOffer || saving) return;
    if (!salaryOffered || !estDoj || !department || !finalDesignation) {
      showToast('Salary Offered, DOJ, Finalized Role, and Allocated Department are mandatory fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      const combinedSalary = incentiveOffered.trim() 
        ? `${salaryOffered.trim()}|${incentiveOffered.trim()}`
        : salaryOffered.trim();

      await API.updateOfferDetails({ 
        appNo: detailOffer.appNo, 
        noticePd, 
        estDoj, 
        salaryOffered: combinedSalary, 
        department, 
        otherSection, 
        finalDesignation 
      });
      showToast('Offer joining details saved successfully! 🎉', 'success');
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
    const remarks = window.prompt('Reason for rejection (optional):') ?? '';
    if (remarks === null) return;
    setSaving(true);
    try {
      await API.rejectOffer({ appNo, remarks });
      showToast('Offer marked as Rejected', 'error');
      setProfileOffer(null);
      loadOffers();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkJoined = async (appNo: string) => {
    if (saving) return;
    const joiningDate = window.prompt('Enter Actual Date of Joining (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!joiningDate) return;
    setSaving(true);
    try {
      await API.markJoined({ appNo, joiningDate });
      showToast('Candidate marked as Joined! 🎉 Moving to Employee directory...', 'success');
      setProfileOffer(null);
      setTimeout(() => { navigate('/employees'); }, 1500);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOfferStatus = async (appNo: string, status: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await API.updateOfferStatus({ appNo, status });
      showToast(`Offer status updated to ${status}`, 'success');
      setProfileOffer(prev => prev ? { ...prev, status } : null);
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
    
    const parsed = parseSalaryAndIncentive(o.salary);
    setSalaryOffered(parsed.rawBase || (parsed.base ? String(parsed.base) : ''));
    setIncentiveOffered(parsed.rawIncentive || (parsed.incentive ? String(parsed.incentive) : ''));
    
    setFinalDesignation(o.desig || '');
    setDepartment(o.department || '');
    setOtherSection('');
  };

  const renderStatusBadge = (status: string) => {
    let classes = "px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border transition-colors inline-block text-center shadow-2xs ";
    switch(status) {
      case 'Accepted': classes += "bg-emerald-100 text-emerald-800 border-emerald-200"; break;
      case 'Joined': classes += "bg-teal-100 text-teal-800 border-teal-200"; break;
      case 'Pending Accept': classes += "bg-blue-100 text-blue-800 border-blue-200"; break;
      case 'Declined':
      case 'Offer Rejected': classes += "bg-rose-100 text-rose-800 border-rose-200"; break;
      default: classes += "bg-slate-100 text-slate-800 border-slate-200";
    }
    return <span className={classes}>{status || 'Pending'}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar with mobile off-canvas & backdrop */}
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content Area (lg:pl-64 prevents sidebar overlap) */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 transition-all duration-300">
        <Topbar 
          title="Offer Desk"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Offer Desk' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          
          {/* Page Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <span>Core Workspace</span> 
                <ChevronRight className="w-3.5 h-3.5 text-slate-400"/> 
                <span className="text-slate-800 font-bold">Offer Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Offer Management Desk</h1>
              <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">Configure candidate compensation packages, track acceptances, and finalize onboarding.</p>
            </div>
          </div>

          {/* Analytics Summary Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {[
              { label: 'Pending Offers', value: stats.pending, icon: <Clock className="w-5 h-5 text-blue-600"/>, bg: 'bg-blue-50/80 border-blue-100' },
              { label: 'Accepted Offers', value: stats.accepted, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600"/>, bg: 'bg-emerald-50/80 border-emerald-100' },
              { label: 'Joined Directory', value: stats.joined, icon: <UserCheck className="w-5 h-5 text-teal-600"/>, bg: 'bg-teal-50/80 border-teal-100' },
              { label: 'Rejected Offers', value: stats.rejected, icon: <XCircle className="w-5 h-5 text-rose-600"/>, bg: 'bg-rose-50/80 border-rose-100' },
              { label: 'Avg Package', value: `₹ ${Math.round(stats.avgSalary || 0).toLocaleString('en-IN')}`, icon: <DollarSign className="w-5 h-5 text-amber-600"/>, bg: 'bg-amber-50/80 border-amber-100' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-2xl border bg-white shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 ${stat.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100">{stat.icon}</div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mb-0.5">{stat.value}</div>
                <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Sticky Search & Filter Bar */}
          <div className="sticky top-16 z-20 bg-slate-50/90 backdrop-blur-md py-3 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 ${
                    activeFilter === t.key 
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name, App No..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-800 focus:ring-2 ring-slate-800/10 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Content Body: Table (Desktop) / Cards (Mobile) */}
          {loading ? (
            <div className="grid gap-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <>
              {/* Desktop High-Fidelity Table */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[10.5px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3.5 px-4">Candidate</th>
                        <th className="py-3.5 px-4">Role & Dept</th>
                        <th className="py-3.5 px-4">Compensation Breakdown</th>
                        <th className="py-3.5 px-4">Est. Joining</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filtered || []).map(o => {
                        const sal = parseSalaryAndIncentive(o.salary);
                        return (
                          <tr key={o.appNo} onClick={() => setProfileOffer(o)} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-xs bg-${o.color}-600`}>
                                  {o.initials}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">{o.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{o.appNo}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800">{o.desig || '—'}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{o.department || '—'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase text-slate-400 font-extrabold">Salary:</span>
                                  <span className="font-bold text-slate-800 font-mono">₹{sal.base.toLocaleString('en-IN')}</span>
                                </div>
                                {sal.incentive > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase text-slate-400 font-extrabold">Incentive:</span>
                                    <span className="font-bold text-emerald-600 font-mono">+₹{sal.incentive.toLocaleString('en-IN')}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 border-t border-slate-100 pt-0.5 mt-0.5">
                                  <span className="text-[10px] uppercase text-amber-700 font-extrabold">Total Pkg:</span>
                                  <span className="font-black text-slate-900 font-mono text-xs">₹{sal.total.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800">{o.estDoj || o.actualDoj || '—'}</div>
                              {o.noticePd && <div className="text-[10px] text-slate-400 font-medium">NP: {o.noticePd}</div>}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(o.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => openDetailModal(o)}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 shadow-2xs transition-colors"
                                >
                                  Edit Details
                                </button>
                                {o.status === 'Pending Accept' && (
                                  <button
                                    onClick={() => handleAcceptOffer(o.appNo)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xs hover:bg-emerald-700 transition-colors"
                                  >
                                    Accept
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(filtered || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">No candidate offers match your filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards (No Horizontal Scroll) */}
              <div className="md:hidden grid gap-4 animate-fade-in">
                {(filtered || []).map(o => {
                  const sal = parseSalaryAndIncentive(o.salary);
                  return (
                    <div key={o.appNo} onClick={() => setProfileOffer(o)} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs relative cursor-pointer active:scale-[0.99] transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-xs bg-${o.color}-600`}>
                            {o.initials}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{o.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{o.appNo} • {o.desig}</div>
                          </div>
                        </div>
                        <div>{renderStatusBadge(o.status)}</div>
                      </div>

                      {/* Salary Breakdown Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[9px] uppercase font-black text-slate-400">Salary</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">₹{sal.base.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-black text-slate-400">Incentive</div>
                          <div className="text-xs font-bold text-emerald-600 font-mono">{sal.incentive > 0 ? `+₹${sal.incentive.toLocaleString('en-IN')}` : '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-black text-amber-700">Total Pkg</div>
                          <div className="text-xs font-black text-slate-900 font-mono">₹{sal.total.toLocaleString('en-IN')}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                        <div className="text-slate-500 font-medium">Est DOJ: <span className="font-bold text-slate-800">{o.estDoj || '—'}</span></div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => openDetailModal(o)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white shadow-2xs"
                          >
                            Edit
                          </button>
                          {o.status === 'Pending Accept' && (
                            <button
                              onClick={() => handleAcceptOffer(o.appNo)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xs"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(filtered || []).length === 0 && (
                  <div className="py-12 text-center text-slate-400 font-semibold bg-white rounded-2xl border border-slate-200">No offers found.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Edit Details Centered Modal (Responsive: Full-screen mobile, Centered desktop) */}
      {detailOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 lg:p-6 overflow-y-auto">
          {/* Backdrop Blur */}
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => !saving && setDetailOffer(null)}></div>
          
          <div className="bg-slate-50 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl rounded-none sm:rounded-3xl shadow-2xl relative flex flex-col animate-scale-in overflow-hidden z-10 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold bg-${detailOffer.color}-600 shadow-md`}>
                  {detailOffer.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">Configure Offer Details</h3>
                  <div className="text-xs font-mono text-slate-500">{detailOffer.name} • {detailOffer.appNo}</div>
                </div>
              </div>
              <button onClick={() => !saving && setDetailOffer(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Section Cards (2 Columns desktop) */}
              <div className="lg:col-span-2 space-y-5">
                
                {/* Compensation Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Compensation & Financials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Offered Salary (₹) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                        <input 
                          type="text" 
                          value={salaryOffered} 
                          onChange={(e) => setSalaryOffered(e.target.value)} 
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 ring-emerald-500/20 transition-all" 
                          placeholder="e.g. 18000" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Offered Incentive (₹)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-xs">+₹</span>
                        <input 
                          type="text" 
                          value={incentiveOffered} 
                          onChange={(e) => setIncentiveOffered(e.target.value)} 
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-emerald-700 font-bold text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 ring-emerald-500/20 transition-all" 
                          placeholder="e.g. 2000 (Monthly / Performance)" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Live Total */}
                  <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900">Total Computed Package:</span>
                    <span className="font-black text-emerald-700 font-mono text-sm">
                      ₹{(parseFloat(salaryOffered || '0') + parseFloat(incentiveOffered || '0')).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Role & Allocation Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Role & Allocation Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Final Designation *</label>
                      <select 
                        value={finalDesignation} 
                        onChange={(e) => setFinalDesignation(e.target.value)} 
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Select Designation</option>
                        {(designations || []).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Allocated Department *</label>
                      <select 
                        value={department} 
                        onChange={(e) => setDepartment(e.target.value)} 
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Select Department</option>
                        <option value="SAARE">SAARE</option>
                        <option value="LADIES">LADIES</option>
                        <option value="KIDS">KIDS</option>
                        <option value="MENS">MENS</option>
                        <option value="HOME FURNISHING">HOME FURNISHING</option>
                        <option value="Finance">Finance</option>
                        <option value="Sales">Sales</option>
                        <option value="OTHERS">OTHERS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Est. Date of Joining *</label>
                      <input 
                        type="date" 
                        value={estDoj} 
                        onChange={(e) => setEstDoj(e.target.value)} 
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Notice Period</label>
                      <input 
                        type="text" 
                        value={noticePd} 
                        onChange={(e) => setNoticePd(e.target.value)} 
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all" 
                        placeholder="e.g. 15 Days / Immediate" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement 4: OFFER SUMMARY CARD */}
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-purple-600" />
                    Offer Summary Card
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate Name</span>
                      <span className="font-extrabold text-slate-900">{detailOffer.name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Application No</span>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">{detailOffer.appNo}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Designation</span>
                        <span className="font-bold text-slate-800">{finalDesignation || detailOffer.desig || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                        <span className="font-bold text-slate-800">{department || detailOffer.department || '—'}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch / Location</span>
                      <span className="font-bold text-slate-800">{detailOffer.location || 'Main Branch (The Textile Mall)'}</span>
                    </div>

                    {/* Salary & Incentive Professional Cards */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Base Salary</span>
                        <span className="font-bold text-slate-800 font-mono">₹{parseFloat(salaryOffered || '0').toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800">Incentive</span>
                        <span className="font-bold text-emerald-700 font-mono">+₹{parseFloat(incentiveOffered || '0').toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-black text-amber-900">Total Package</span>
                        <span className="font-black text-slate-900 font-mono text-sm">₹{(parseFloat(salaryOffered || '0') + parseFloat(incentiveOffered || '0')).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Joining Date</span>
                        <span className="font-bold text-slate-800">{estDoj || '—'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</span>
                        {renderStatusBadge(detailOffer.status)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="border-t border-slate-200 p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md z-10">
              <button 
                onClick={() => setDetailOffer(null)} 
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveDetails} 
                disabled={saving} 
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Offer...</span>
                  </>
                ) : (
                  <span>Save Offer Details</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Preview Centered Modal */}
      {profileOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setProfileOffer(null)}></div>
          
          <div className="bg-slate-50 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl rounded-none sm:rounded-3xl shadow-2xl relative flex flex-col animate-scale-in overflow-hidden z-10 my-auto">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative shadow-2xs z-10">
              <button onClick={() => setProfileOffer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl bg-${profileOffer.color}-600 shadow-md border-4 border-white`}>
                  {profileOffer.initials}
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-xl sm:text-2xl tracking-tight">{profileOffer.name}</h2>
                  <div className="text-xs font-bold text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{profileOffer.appNo}</span>
                    <span>•</span>
                    <span className="text-slate-700">{profileOffer.desig}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-1 mt-2 sm:mt-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
                <div>{renderStatusBadge(profileOffer.status)}</div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Compensation Breakdown Card */}
                  <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200">
                    <h4 className="text-xs uppercase font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Compensation Breakdown
                    </h4>
                    {(() => {
                      const sal = parseSalaryAndIncentive(profileOffer.salary);
                      return (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-[9px] uppercase font-black text-slate-400 mb-1">Base Salary</div>
                            <div className="text-sm font-bold text-slate-800 font-mono">₹{sal.base.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                            <div className="text-[9px] uppercase font-black text-emerald-800 mb-1">Incentive</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono">{sal.incentive > 0 ? `+₹${sal.incentive.toLocaleString('en-IN')}` : '—'}</div>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-2xs">
                            <div className="text-[9px] uppercase font-black text-amber-900 mb-1">Total Package</div>
                            <div className="text-sm font-black text-slate-900 font-mono">₹{sal.total.toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Personal & Recruitment Details */}
                  <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200">
                    <h4 className="text-xs uppercase font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      Candidate Profile Information
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Department</span><span className="font-bold text-slate-800">{profileOffer.department || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Est Joining</span><span className="font-bold text-slate-800">{profileOffer.estDoj || profileOffer.actualDoj || '—'}</span></div>
                      <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Notice Period</span><span className="font-bold text-slate-800">{profileOffer.noticePd || '—'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Status Timeline */}
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200">
                    <h4 className="text-xs uppercase font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      Offer Journey Timeline
                    </h4>
                    
                    <div className="relative pl-5 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 text-xs">
                      <div className="relative">
                        <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs z-10"></div>
                        <div className="font-bold text-slate-800">Shortlisted</div>
                        <div className="text-[10px] font-medium text-slate-400">Moved to Offer Desk</div>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[23px] top-0.5 w-3 h-3 rounded-full border-2 border-white shadow-xs z-10 ${profileOffer.salary ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className={`font-bold ${profileOffer.salary ? 'text-slate-800' : 'text-slate-400'}`}>Package Configured</div>
                        <div className="text-[10px] font-medium text-slate-400">Salary & Incentive set</div>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[23px] top-0.5 w-3 h-3 rounded-full border-2 border-white shadow-xs z-10 ${['Accepted', 'Joined'].includes(profileOffer.status) ? 'bg-emerald-500' : profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                        <div className={`font-bold ${['Accepted', 'Joined'].includes(profileOffer.status) ? 'text-emerald-700' : profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'text-rose-700' : 'text-slate-400'}`}>
                          {profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'Offer Rejected' : 'Offer Acceptance'}
                        </div>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[23px] top-0.5 w-3 h-3 rounded-full border-2 border-white shadow-xs z-10 ${profileOffer.status === 'Joined' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className={`font-bold ${profileOffer.status === 'Joined' ? 'text-slate-800' : 'text-slate-400'}`}>Employee Directory</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-slate-200 p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md z-10">
              <button onClick={() => setProfileOffer(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Close
              </button>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Status Update Dropdown */}
                <select
                  value={profileOffer.status || 'Pending Accept'}
                  disabled={saving}
                  onChange={(e) => handleUpdateOfferStatus(profileOffer.appNo, e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-slate-50 cursor-pointer outline-none focus:border-slate-600 focus:ring-2 ring-slate-300 transition-all shadow-2xs disabled:opacity-50"
                >
                  <option value="Pending Accept">⏳ Pending Accept</option>
                  <option value="Accepted">✅ Accepted</option>
                  <option value="Declined">❌ Declined</option>
                  <option value="Joined">🎉 Joined</option>
                </select>
                {/* Reject Offer */}
                {(profileOffer.status === 'Pending Accept' || profileOffer.status === 'Accepted') && (
                  <button
                    onClick={() => handleRejectOffer(profileOffer.appNo)}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                )}
                {/* Mark as Joined */}
                {profileOffer.status === 'Accepted' && (
                  <button
                    onClick={() => handleMarkJoined(profileOffer.appNo)}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-extrabold hover:bg-teal-700 shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Mark Joined
                  </button>
                )}
                {/* Accept Offer */}
                {profileOffer.status === 'Pending Accept' && (
                  <button
                    onClick={() => { setProfileOffer(null); handleAcceptOffer(profileOffer.appNo); }}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accept Offer
                  </button>
                )}
                {/* Edit Details */}
                <button
                  onClick={() => { setProfileOffer(null); openDetailModal(profileOffer); }}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 shadow-md transition-colors flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" /> Edit Details
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
