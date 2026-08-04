import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  Search, FileText, Phone, Calendar, CheckCircle2, XCircle,
  UserCheck, X, Briefcase, DollarSign,
  FileCheck, ChevronRight, TrendingUp, User,
  Loader2, Clock, Award, Edit3,
  GraduationCap, CheckCheck, AlertTriangle, Activity, Banknote, Star
} from 'lucide-react';

export default function OfferProcessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('filter') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designations, setDesignations] = useState<string[]>([]);

  // Recruitment Analytics & Pipeline Date Range Filter State
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Edit Modal State
  const [detailOffer, setDetailOffer] = useState<any | null>(null);
  const [noticePd, setNoticePd] = useState('');
  const [estDoj, setEstDoj] = useState('');
  const [salaryOffered, setSalaryOffered] = useState('');
  const [incentiveOffered, setIncentiveOffered] = useState('');
  const [finalDesignation, setFinalDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [otherSection, setOtherSection] = useState('');
  const [offerRemarks, setOfferRemarks] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));

  // Profile Modal State
  const [profileOffer, setProfileOffer] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'offer' | 'candidate' | 'timeline' | 'history'>('overview');
  const [candidateData, setCandidateData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [imgError, setImgError] = useState(false);

  const openProfile = async (o: any) => {
    setProfileOffer(o);
    setProfileTab('overview');
    setCandidateData(null);
    setImgError(false);
    setLoadingProfile(true);
    try {
      const res = await API.getCandidates({ limit: 500 });
      if (res?.candidates) {
        const match = (res.candidates as any[]).find((c: any) => c.appNo === o.appNo);
        if (match) setCandidateData(match);
      }
    } catch (e) {}
    setLoadingProfile(false);
  };


  // ─── Helpers ───────────────────────────────────────────────────────────────
  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('uploads/')) clean = `/${clean}`;
    const filename = clean.split('/').pop() || clean;
    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;
    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  };

  const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const renderOfferStatus = (status: string) => {
    const map: Record<string, string> = {
      'Pending Accept': 'bg-blue-50 text-blue-700 border-blue-200',
      'Accepted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Joined': 'bg-teal-50 text-teal-700 border-teal-200',
      'Declined': 'bg-rose-50 text-rose-700 border-rose-200',
      'Offer Rejected': 'bg-rose-50 text-rose-700 border-rose-200',
    };
    const cls = map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
    const em = status === 'Pending Accept' ? '⏳' : status === 'Accepted' ? '✅' : status === 'Joined' ? '🎉' : (status === 'Declined' || status === 'Offer Rejected') ? '❌' : '';
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>{em} {status || 'Pending'}</span>;
  };

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

    const getItemDateStr = (item: any): string => {
      if (item.status === 'Joined' && item.actualDoj && typeof item.actualDoj === 'string' && item.actualDoj.length >= 10 && item.actualDoj.includes('-')) {
        return item.actualDoj.slice(0, 10);
      }
      const refMs = item.rawDate || (item.createdAt ? new Date(item.createdAt).getTime() : 0);
      if (refMs) {
        const d = new Date(refMs);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return '';
    };

    const getItemTimestamp = (item: any): number => {
      const dateStr = getItemDateStr(item);
      if (dateStr) {
        const parts = dateStr.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      }
      return 0;
    };

    if (activeRange === 'today') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      list = list.filter(o => getItemDateStr(o) === todayStr);
    } else if (activeRange === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      list = list.filter(o => getItemDateStr(o) === yestStr);
    } else if (activeRange === 'week') {
      const weekAgo = Date.now() - 7 * 86400000;
      list = list.filter(o => getItemTimestamp(o) >= weekAgo);
    } else if (activeRange === 'month') {
      const monthAgo = Date.now() - 30 * 86400000;
      list = list.filter(o => getItemTimestamp(o) >= monthAgo);
    } else if (activeRange === 'last_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0).getTime();
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      list = list.filter(o => {
        const t = getItemTimestamp(o);
        return t >= firstDay && t <= lastDay;
      });
    } else if (activeRange === 'custom' && fromDate) {
      const fParts = fromDate.split('-').map(Number);
      const start = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0).getTime();
      let end = start + 86400000 - 1;
      if (toDate) {
        const tParts = toDate.split('-').map(Number);
        end = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
      }
      list = list.filter(o => {
        const t = getItemTimestamp(o);
        return t >= start && t <= end;
      });
    }

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
  }, [offers, activeFilter, searchQuery, activeRange, fromDate, toDate]);

  const stats = useMemo(() => {
    const list = filtered || [];
    const pending = list.filter(o => o.status === 'Pending Accept').length;
    const accepted = list.filter(o => o.status === 'Accepted').length;
    const rejected = list.filter(o => o.status === 'Declined' || o.status === 'Offer Rejected').length;
    const joined = list.filter(o => o.status === 'Joined').length;
    const totalPkgSum = list.reduce((acc, curr) => acc + parseSalaryAndIncentive(curr.salary).total, 0);
    const avgSalary = list.length ? totalPkgSum / list.length : 0;
    return { pending, accepted, rejected, joined, avgSalary };
  }, [filtered]);

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
        finalDesignation,
        remarks: offerRemarks
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
    setSaving(true);
    try {
      const matched = (offers || []).find(o => o.appNo === appNo);
      const joiningDate = matched?.estDoj || new Date().toISOString().slice(0, 10);
      await API.acceptOffer({ appNo, remarks: 'Accepted via Offer Desk', joiningDate });
      showToast('Offer accepted & candidate Joined! 🎉 Redirecting to Employees...', 'success');
      loadOffers();
      setTimeout(() => {
        navigate('/employees');
      }, 1200);
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
    setOfferRemarks(o.remarks || '');
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

          {/* Recruitment Analytics & Pipeline Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3.5">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#C9952A]" />
                  <span>Recruitment Analytics &amp; Pipeline</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real-time candidate metrics, funnel conversion &amp; team performance.
                </p>
              </div>

              {/* Date Filter Quick Range Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'last_month', label: 'Last Month' }
                ].map(range => (
                  <button
                    key={range.key}
                    onClick={() => { setActiveRange(range.key as any); setFromDate(''); setToDate(''); }}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      activeRange === range.key
                        ? 'bg-[#1E2D4E] text-white font-extrabold shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-900">
              <span className="text-slate-500 uppercase text-[10.5px] font-black">Custom Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
                <span className="text-slate-500 font-extrabold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setActiveRange('custom'); }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold outline-none text-xs"
                  placeholder="dd-mm-yyyy"
                />
              </div>
              {(fromDate || toDate || activeRange !== 'all') && (
                <button
                  onClick={() => { setActiveRange('all'); setFromDate(''); setToDate(''); }}
                  className="text-rose-600 hover:underline text-[11px] font-extrabold ml-auto"
                >
                  Reset Date Filter
                </button>
              )}
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
                        <th className="py-3.5 px-3 text-center w-12">SL.NO</th>
                        <th className="py-3.5 px-4">Candidate</th>
                        <th className="py-3.5 px-4">Role &amp; Dept</th>
                        <th className="py-3.5 px-4">Compensation Breakdown</th>
                        <th className="py-3.5 px-4">Est. Joining</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filtered || []).map((o, idx) => {
                        const sal = parseSalaryAndIncentive(o.salary);
                        return (
                          <tr key={o.appNo} onClick={() => openProfile(o)} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                            <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs shadow-xs flex items-center justify-center border border-[#C9952A]/30 flex-shrink-0">
                                  {o.initials || o.name?.substring(0, 2).toUpperCase()}
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
                    <div key={o.appNo} onClick={() => openProfile(o)} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs relative cursor-pointer active:scale-[0.99] transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-sm shadow-xs flex items-center justify-center border border-[#C9952A]/30 flex-shrink-0">
                            {o.initials || o.name?.substring(0, 2).toUpperCase()}
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
                <div className="w-10 h-10 rounded-2xl bg-[#1E2D4E] text-white font-extrabold flex items-center justify-center shadow-md border border-[#C9952A]/30 flex-shrink-0">
                  {detailOffer.initials || detailOffer.name?.substring(0, 2).toUpperCase()}
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
                        <option value="Ground Floor Saree">Ground Floor Saree</option>
                        <option value="First Floor Saree">First Floor Saree</option>
                        <option value="Art & Raw Silk Saree">Art & Raw Silk Saree</option>
                        <option value="Ladies">Ladies</option>
                        <option value="Kids">Kids</option>
                        <option value="Mens">Mens</option>
                        <option value="Home Furnishing">Home Furnishing</option>
                        <option value="Others">Others</option>
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

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">Shortlisting & Recruiter Remarks</label>
                      <textarea 
                        rows={2}
                        value={offerRemarks} 
                        onChange={(e) => setOfferRemarks(e.target.value)} 
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all" 
                        placeholder="Enter shortlisting notes, recruiter remarks or special conditions..." 
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

      {/* Profile Preview Centered Modal (Enterprise Upgrade) */}
      {profileOffer && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6 bg-[#1E2D4E]/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#EDE8DE] w-full h-[96vh] sm:h-auto sm:max-h-[94vh] sm:max-w-6xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 border border-[#C9952A]/30 transition-all transform animate-scale-in">
            
            {/* Header / Banner */}
            <div className="bg-gradient-to-br from-[#1E2D4E] via-[#1E2D4E] to-[#253966] text-white p-5 sm:p-7 relative flex-shrink-0">
              <button 
                onClick={() => setProfileOffer(null)} 
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pr-10">
                {/* Photo / Avatar */}
                {!imgError && fileUrl(candidateData?.photoUrl) ? (
                  <img
                    src={fileUrl(candidateData?.photoUrl)!}
                    alt={profileOffer.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#C9952A] shadow-md bg-white p-0.5 flex-shrink-0"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#C9952A] to-[#A67820] flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg border-2 border-[#C9952A]/50 flex-shrink-0">
                    {profileOffer.initials || profileOffer.name?.substring(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{profileOffer.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                        <span className="font-mono text-[#C9952A] font-bold bg-[#C9952A]/15 px-2.5 py-0.5 rounded border border-[#C9952A]/40">
                          {profileOffer.appNo}
                        </span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/80 font-bold">{profileOffer.desig || 'Not Assigned'}</span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/60 font-semibold">{profileOffer.department || 'Not Assigned'}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 mt-2 sm:mt-0">
                      {renderOfferStatus(profileOffer.status)}
                    </div>
                  </div>

                  {/* Compensation Quick Bar */}
                  {(() => {
                    const sal = parseSalaryAndIncentive(profileOffer.salary);
                    return (
                      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 backdrop-blur-xs">
                          <div className="text-[9px] uppercase font-bold text-white/60">Base Salary</div>
                          <div className="text-xs sm:text-sm font-black font-mono text-white">{fmtINR(sal.base)}</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 backdrop-blur-xs">
                          <div className="text-[9px] uppercase font-bold text-[#C9952A]">Monthly Incentive</div>
                          <div className="text-xs sm:text-sm font-black font-mono text-[#C9952A]">
                            {sal.incentive > 0 ? `+${fmtINR(sal.incentive)}` : 'Not Set'}
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 backdrop-blur-xs">
                          <div className="text-[9px] uppercase font-bold text-emerald-300">Total Package (CTC)</div>
                          <div className="text-xs sm:text-sm font-black font-mono text-emerald-300">{fmtINR(sal.total)}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-[#e2dfd7] px-3 sm:px-6 flex items-center gap-1 overflow-x-auto hide-scrollbar flex-shrink-0">
              {[
                { id: 'overview', label: '📊 Overview' },
                { id: 'offer', label: '💼 Offer Configuration' },
                { id: 'candidate', label: '👤 Candidate Details' },
                { id: 'timeline', label: '🕐 Offer Timeline' },
                { id: 'history', label: '📞 Call Logs' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setProfileTab(tab.id as any)}
                  className={`px-4 py-3.5 text-xs font-extrabold whitespace-nowrap border-b-2 transition-all duration-200 ${
                    profileTab === tab.id
                      ? 'border-[#1E2D4E] text-[#1E2D4E] bg-[#1E2D4E]/5'
                      : 'border-transparent text-[#777777] hover:text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              
              {/* TAB 1: OVERVIEW */}
              {profileTab === 'overview' && (() => {
                const sal = parseSalaryAndIncentive(profileOffer.salary);
                return (
                  <div className="space-y-4 animate-fade-in">
                    {/* Hero Cards */}
                    <div>
                      <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider mb-2 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-[#C9952A]" /> Financial & Package Overview
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl border border-[#e2dfd7] p-5 shadow-xs text-center space-y-1">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2 text-[#1E2D4E]">
                            <Banknote className="w-5 h-5" />
                          </div>
                          <div className="text-[10px] font-black uppercase text-slate-400">Offered Monthly Base</div>
                          <div className="text-2xl font-black text-[#1E2D4E] font-mono">{fmtINR(sal.base)}</div>
                          <div className="text-[10px] text-slate-400 font-medium">Standard Monthly Salary</div>
                        </div>

                        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 shadow-xs text-center space-y-1">
                          <div className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center mx-auto mb-2 text-emerald-600">
                            <Star className="w-5 h-5" />
                          </div>
                          <div className="text-[10px] font-black uppercase text-emerald-600">Performance Incentive</div>
                          <div className="text-2xl font-black text-emerald-700 font-mono">
                            {sal.incentive > 0 ? `+${fmtINR(sal.incentive)}` : <span className="text-lg text-slate-400">Not Set</span>}
                          </div>
                          <div className="text-[10px] text-emerald-500 font-medium">Target / Monthly Bonus</div>
                        </div>

                        <div className="bg-gradient-to-br from-[#C9952A]/10 to-[#A67820]/5 rounded-2xl border border-[#C9952A]/30 p-5 shadow-xs text-center space-y-1">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#C9952A]/20 flex items-center justify-center mx-auto mb-2 text-[#C9952A]">
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="text-[10px] font-black uppercase text-[#C9952A]">Total Package (CTC)</div>
                          <div className="text-2xl font-black text-[#1E2D4E] font-mono">{fmtINR(sal.total)}</div>
                          <div className="text-[10px] text-[#C9952A]/80 font-medium">Total Monthly Compensation</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Metadata */}
                    <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-3">
                      <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider flex items-center gap-1.5 border-b border-[#e2dfd7] pb-2">
                        <FileCheck className="w-3.5 h-3.5 text-[#C9952A]" /> Key Placement Parameters
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block">Status</span>
                          {renderOfferStatus(profileOffer.status)}
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Est. Joining Date</span>
                          <span className="font-bold text-[#1E2D4E]">{profileOffer.estDoj || 'Not Set'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Notice Period</span>
                          <span className="font-bold text-[#1E2D4E]">{profileOffer.noticePd || 'Not Provided'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Actual Joining Date</span>
                          <span className="font-bold text-[#1E2D4E]">{profileOffer.actualDoj || 'Pending'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Role</span>
                          <span className="font-bold text-[#1E2D4E]">{profileOffer.desig || 'Not Assigned'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Department</span>
                          <span className="font-bold text-[#1E2D4E]">{profileOffer.department || 'Not Assigned'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-0.5">Branch Location</span>
                          <span className="font-bold text-[#1E2D4E]">Main Branch (The Textile Mall)</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-[#777777] block mb-1">Shortlisting & Recruiter Remarks</span>
                          <span className="font-semibold text-[#1E2D4E] italic bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7] block">
                            {profileOffer.remarks || candidateData?.remarks || 'No remarks recorded.'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: OFFER DETAILS */}
              {profileTab === 'offer' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                      <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#C9952A]" /> Complete Offer Specifications
                      </div>
                      <button
                        onClick={() => { setProfileOffer(null); openDetailModal(profileOffer); }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-[11px] font-extrabold hover:bg-[#162340] transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Configuration
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      {(() => {
                        const sal = parseSalaryAndIncentive(profileOffer.salary);
                        return [
                          { label: 'Application Number', value: profileOffer.appNo, mono: true },
                          { label: 'Candidate Name', value: profileOffer.name },
                          { label: 'Offer Status', value: profileOffer.status || 'Pending Accept', isStatus: true },
                          { label: 'Finalized Designation', value: profileOffer.desig || 'Not Assigned' },
                          { label: 'Allocated Department', value: profileOffer.department || 'Not Assigned' },
                          { label: 'Notice Period Required', value: profileOffer.noticePd || 'Not Provided' },
                          { label: 'Estimated Joining Date', value: profileOffer.estDoj || 'Not Set' },
                          { label: 'Actual Joining Date', value: profileOffer.actualDoj || 'Pending' },
                          { label: 'Offered Monthly Base Salary', value: fmtINR(sal.base), mono: true, hl: 'emerald' },
                          { label: 'Monthly Incentive Amount', value: sal.incentive > 0 ? `+${fmtINR(sal.incentive)}` : 'Not Set', mono: true, hl: 'emerald' },
                          { label: 'Total Compensation Package', value: fmtINR(sal.total), mono: true, hl: 'gold' },
                          { label: 'Offer Remarks / Notes', value: profileOffer.remarks || 'None' },
                        ].map((item, i) => (
                          <div key={i} className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1">
                            <div className="text-[10px] font-black uppercase text-[#777777]">{item.label}</div>
                            {item.isStatus ? renderOfferStatus(item.value) : (
                              <div className={`font-bold text-sm ${item.mono ? 'font-mono' : ''} ${
                                item.hl === 'gold' ? 'text-[#C9952A]' :
                                item.hl === 'emerald' ? 'text-emerald-700' :
                                'text-[#1E2D4E]'
                              }`}>{item.value}</div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CANDIDATE DETAILS */}
              {profileTab === 'candidate' && (
                <div className="space-y-4 animate-fade-in">
                  {loadingProfile ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-[#e2dfd7] animate-pulse" />)}
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-3">
                        <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#C9952A]" /> Personal Contact & Bio Data
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                          {[
                            { label: 'Full Candidate Name', value: profileOffer.name },
                            { label: 'Application Number', value: profileOffer.appNo, mono: true },
                            { label: 'Designation Role', value: profileOffer.desig || candidateData?.desig || 'Not Provided' },
                            { label: 'Phone / Mobile', value: candidateData?.phone || 'Available in Candidate CRM' },
                            { label: 'Email Address', value: candidateData?.email || 'Not Provided' },
                            { label: 'Gender', value: candidateData?.gender || 'Not Provided' },
                            { label: 'Date of Birth', value: candidateData?.dob || 'Not Provided' },
                            { label: 'Blood Group', value: candidateData?.bloodGroup || 'Not Provided' },
                            { label: 'Recruitment Source', value: candidateData?.source || 'Walk-in' },
                          ].map((item, i) => (
                            <div key={i} className="space-y-1">
                              <div className="text-[10px] uppercase font-black text-[#777777]">{item.label}</div>
                              <div className={`font-bold text-[#1E2D4E] ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-3">
                          <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#C9952A]" /> Work Experience Summary
                          </div>
                          <div className="space-y-2 text-xs">
                            {[
                              { label: 'Total Work Experience', value: candidateData?.experience },
                              { label: 'Retail Experience', value: candidateData?.retailExperience },
                              { label: 'Previous Company', value: candidateData?.previousCompany },
                              { label: 'Previous Designation', value: candidateData?.previousDesignation },
                              { label: 'Previous Salary', value: candidateData?.currentSalary ? `₹ ${candidateData.currentSalary}` : null },
                              { label: 'Expected Salary', value: candidateData?.expectedSalary ? `₹ ${candidateData.expectedSalary}` : null },
                            ].map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="text-[#777777] font-medium">{item.label}:</span>
                                <span className="font-bold text-[#1E2D4E]">{item.value || 'Not Provided'}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-3">
                          <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#C9952A]" /> Education & Location
                          </div>
                          <div className="space-y-2 text-xs">
                            {[
                              { label: 'Highest Qualification', value: candidateData?.qualification },
                              { label: 'City / Location', value: candidateData?.cityState },
                              { label: 'Referrer Name', value: candidateData?.referrer },
                              { label: 'Application Date', value: candidateData?.date },
                              { label: 'Days in Pipeline', value: candidateData?.daysIn ? `${candidateData.daysIn} Days` : null },
                            ].map((item, i) => (
                              <div key={i} className="flex justify-between gap-2">
                                <span className="text-[#777777] font-medium flex-shrink-0">{item.label}:</span>
                                <span className="font-bold text-[#1E2D4E] text-right">{item.value || 'Not Provided'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: TIMELINE */}
              {profileTab === 'timeline' && (() => {
                const isAcc = ['Accepted', 'Joined'].includes(profileOffer.status);
                const isRej = profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected';
                const isJoined = profileOffer.status === 'Joined';
                const steps = [
                  { label: 'Candidate Registered', sub: 'Application submitted to Candidate CRM', done: true },
                  { label: 'Shortlisted & Interviewed', sub: 'Evaluated by recruitment team', done: true },
                  { label: 'Offer Extended', sub: 'Moved to Offer Desk with compensation package', done: true },
                  { label: 'Pending Candidate Acceptance', sub: 'Awaiting candidate response', done: profileOffer.status !== 'Pending Accept', active: profileOffer.status === 'Pending Accept' },
                  { label: isRej ? 'Offer Declined' : 'Offer Accepted', sub: isRej ? 'Candidate rejected the offer' : 'Candidate accepted the offer', done: isAcc || isRej, rejected: isRej },
                  { label: 'Joined Employee Directory', sub: 'Onboarded into active employees', done: isJoined },
                ];
                return (
                  <div className="animate-fade-in">
                    <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 sm:p-7 space-y-4">
                      <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider flex items-center gap-1.5 border-b border-[#e2dfd7] pb-3">
                        <Activity className="w-3.5 h-3.5 text-[#C9952A]" /> Offer Workflow Progress
                      </div>
                      <div className="relative pl-2">
                        <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-[#e2dfd7]" />
                        <div className="space-y-6">
                          {steps.map((step, i) => (
                            <div key={i} className={`relative flex items-start gap-4 ${step.done || step.active ? '' : 'opacity-40'}`}>
                              <div className={`relative z-10 w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border-2 transition-all ${
                                step.rejected ? 'bg-rose-100 border-rose-300 text-rose-700 font-bold' :
                                step.done ? 'bg-[#1E2D4E] border-[#1E2D4E] text-white' :
                                step.active ? 'bg-[#C9952A] border-[#C9952A] text-white animate-pulse' :
                                'bg-white border-[#e2dfd7] text-slate-400'
                              }`}>
                                {step.done && !step.rejected ? <CheckCheck className="w-4 h-4" /> :
                                 step.rejected ? <XCircle className="w-4 h-4" /> :
                                 step.active ? <Clock className="w-4 h-4" /> :
                                 <span className="text-xs font-mono">{i + 1}</span>}
                              </div>
                              <div className="flex-1 pt-1">
                                <div className={`text-xs font-extrabold ${step.rejected ? 'text-rose-700' : step.done ? 'text-[#1E2D4E]' : step.active ? 'text-[#C9952A]' : 'text-[#888888]'}`}>
                                  {step.label}
                                </div>
                                <div className="text-[11px] text-[#777777] font-medium">{step.sub}</div>
                              </div>
                              {step.done && (
                                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${step.rejected ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {step.rejected ? 'Declined' : 'Done'}
                                </div>
                              )}
                              {step.active && (
                                <div className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#C9952A]/20 text-[#C9952A]">
                                  Active
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 5: CALL LOGS */}
              {profileTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-[#e2dfd7] shadow-xs p-5 space-y-4">
                    <div className="text-[10px] font-black uppercase text-[#777777] tracking-wider border-b border-[#e2dfd7] pb-3 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#C9952A]" /> Logged Communication & Follow-Ups
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Initial Contact Call (Call 1)', date: profileOffer.call1, remarks: profileOffer.call1Remarks, bg: 'bg-blue-50/50 border-blue-200' },
                        { label: 'Secondary Follow-up Call (Call 2)', date: profileOffer.call2, remarks: profileOffer.call2Remarks, bg: 'bg-indigo-50/50 border-indigo-200' },
                        { label: 'Offer Confirmation Call', date: profileOffer.confirm, remarks: profileOffer.confirmRemarks, bg: 'bg-emerald-50/50 border-emerald-200' },
                      ].map((call, i) => (
                        <div key={i} className={`p-4 rounded-2xl border ${call.bg} space-y-2`}>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[#1E2D4E] text-xs">{call.label}</span>
                            <span className="text-[11px] font-mono text-[#777777] font-semibold">{call.date && call.date !== '—' ? call.date : 'Not Logged'}</span>
                          </div>
                          {call.remarks && (
                            <p className="text-xs text-[#555555] italic bg-white/70 p-2.5 rounded-xl border border-white">"{call.remarks}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="border-t border-[#e2dfd7] bg-white px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0 shadow-md">
              <button 
                onClick={() => setProfileOffer(null)} 
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] transition-colors"
              >
                Close Profile
              </button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Premium Color-Coded Status Dropdown */}
                <select
                  value={profileOffer.status || 'Pending Accept'}
                  disabled={saving}
                  onChange={(e) => handleUpdateOfferStatus(profileOffer.appNo, e.target.value)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer outline-none transition-all shadow-2xs disabled:opacity-50 ${
                    profileOffer.status === 'Accepted' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                    profileOffer.status === 'Joined' ? 'bg-teal-50 border-teal-300 text-teal-800' :
                    profileOffer.status === 'Declined' || profileOffer.status === 'Offer Rejected' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                    'bg-blue-50 border-blue-300 text-blue-800'
                  }`}
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
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject Offer
                  </button>
                )}

                {/* Mark Joined */}
                {profileOffer.status === 'Accepted' && (
                  <button
                    onClick={() => handleMarkJoined(profileOffer.appNo)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-extrabold hover:bg-teal-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Mark Joined
                  </button>
                )}

                {/* Accept Offer */}
                {profileOffer.status === 'Pending Accept' && (
                  <button
                    onClick={() => { setProfileOffer(null); handleAcceptOffer(profileOffer.appNo); }}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accept Offer
                  </button>
                )}

                {/* Edit Details */}
                <button
                  onClick={() => { setProfileOffer(null); openDetailModal(profileOffer); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340] shadow-sm transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Details
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
