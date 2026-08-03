import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { 
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase, 
  FileText, CheckCircle, XCircle, Plus, Clock, ExternalLink, MessageSquare, ChevronRight, X, Trash2, Edit3, ShieldAlert, FileCheck, Image as ImageIcon, UserCheck, DollarSign
} from 'lucide-react';

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Drawer
  const [drawerCandidate, setDrawerCandidate] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'details' | 'questions' | 'activity'>('overview');
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Modals
  const [remarkModal, setRemarkModal] = useState<{ open: boolean; action: string; candidate: any | null }>({ open: false, action: '', candidate: null });
  const [remarksText, setRemarksText] = useState('');
  
  const [directOfferModal, setDirectOfferModal] = useState<{ open: boolean; candidate: any | null }>({ open: false, candidate: null });
  const [offerForm, setOfferForm] = useState({ salary: "", incentive: "", doj: "", desig: "", department: "", remarks: "" });
  const [designations, setDesignations] = useState<string[]>([]);
  
  const [callModal, setCallModal] = useState<{ open: boolean; candidate: any | null; step: number; callStatus: any }>({ open: false, candidate: null, step: 1, callStatus: null });
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [callRemarks, setCallRemarks] = useState('');

  // Selected / Rejected Panel View
  const [selRejPanel, setSelRejPanel] = useState<'selected' | 'rejected' | null>(null);
  const [selRejData, setSelRejData] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadCandidates = useCallback(async () => {
    try {
      const d = await API.getCandidates({ limit: 500 });
      if (d && d.candidates) {
        setCandidates(d.candidates);
      }
    } catch (err: any) {
      showToast('Could not load candidates: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadCandidates();
    API.getDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});
  }, [navigate, loadCandidates]);

  // Filtering
  useEffect(() => {
    let list = [...candidates];

    if (activeStatus !== 'all') {
      list = list.filter(c => c.status === activeStatus);
    }
    if (desigFilter) {
      list = list.filter(c => c.desig === desigFilter);
    }
    if (sourceFilter) {
      list = list.filter(c => c.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.appNo.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }

    list.sort((a, b) => sortDir === 'asc' ? (a.rawDate || 0) - (b.rawDate || 0) : (b.rawDate || 0) - (a.rawDate || 0));

    setFiltered(list);
  }, [candidates, activeStatus, desigFilter, sourceFilter, searchQuery, sortDir]);

  const maskPhone = (ph: string) => {
    const p = String(ph || '').replace(/\D/g, '');
    return p ? p.slice(0, 5) + ' XXXXX' : '—';
  };

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

    if (clean.startsWith('uploads/')) {
      clean = `/${clean}`;
    }

    const filename = clean.split('/').pop() || clean;

    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;

    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  };

  const openDrawer = async (c: any) => {
    setDrawerCandidate(c);
    setDrawerTab('overview');
    setActivityLog([]);
    try {
      const d = await API.getActivityFull(c.appNo);
      if (d && d.activity) setActivityLog(d.activity);
    } catch (e) {}
  };

  const handleDeleteCandidate = async (appNo: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this candidate?')) return;
    try {
      await API.deleteCandidate(appNo);
      showToast('Candidate deleted successfully', 'success');
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err) {
      showToast('Failed to delete candidate', 'error');
    }
  };

  const handleStatusChange = async (action: string, candidate: any) => {
    if (!candidate || actionLoading) return;
    
    if (action === 'shortlist') {
      setDirectOfferModal({ open: true, candidate });
      setOfferForm({ salary: "", incentive: "", doj: "", desig: candidate.desig || "", department: candidate.department || "", remarks: "" });
      return;
    }
    
    setActionLoading(true);
    try {
      if (action === 'reject') {
        if (!window.confirm(`Are you sure you want to reject ${candidate.name}?`)) {
          setActionLoading(false);
          return;
        }
        await API.rejectCandidate({ appNo: candidate.appNo, remarks: 'Rejected from Shortlisting phase', candName: candidate.name });
        showToast(`${candidate.name} rejected`, 'warn');
      } else {
        const statusMap: Record<string, string> = {
          shortlist: 'Shortlisted',
          hold: 'Hold',
          reactivate: 'New',
          schedule: 'Interview Scheduled'
        };
        await API.updateCandidate(candidate.appNo, { status: statusMap[action], remarks: '' });
        showToast(`${candidate.name} updated to ${statusMap[action]}`, 'success');
      }

      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewSelRej = async (type: 'selected' | 'rejected') => {
    setSelRejPanel(type);
    try {
      const res = type === 'selected' ? await API.getSelectedCandidates() : await API.getRejectedCandidates();
      setSelRejData(res.candidates || []);
    } catch (e) {
      setSelRejData([]);
    }
  };

  const handleDirectOfferSubmit = async () => {
    if (!directOfferModal.candidate) return;
    if (!offerForm.salary) {
      showToast('Offered salary is mandatory', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const combinedSalary = offerForm.incentive && offerForm.incentive.trim()
        ? `${offerForm.salary.trim()}|${offerForm.incentive.trim()}`
        : offerForm.salary.trim();

      await API.createDirectOffer({
        appNo: directOfferModal.candidate.appNo,
        salaryOffered: combinedSalary,
        estDoj: offerForm.doj,
        designation: offerForm.desig,
        department: offerForm.department,
        remarks: offerForm.remarks
      });
      showToast('Candidate moved to Offer Desk successfully', 'success');
      setDirectOfferModal({ open: false, candidate: null });
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const canDelete = session?.role === 'Admin' || session?.role === 'Super Admin';

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Candidate CRM"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Candidates' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <button
              onClick={() => window.open('/candidate-entry', '_blank')}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Register Candidate</span>
            </button>
          }
        />

        <main className="p-4 lg:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Status Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold scrollbar-none">
            {[
              { key: 'all', label: 'All Candidates' },
              { key: 'New', label: 'New Applicants' },
              { key: 'Shortlisted', label: 'Shortlisted' },
              { key: '1st Call', label: '1st Call Logged' },
              { key: 'Interview Scheduled', label: 'Interview Scheduled' },
              { key: 'Interviewed', label: 'Interview Completed' },
              { key: 'Selected', label: 'Selected' },
              { key: 'Offer Sent', label: 'Offer Sent' },
              { key: 'Hold', label: 'On Hold' },
              { key: 'Rejected', label: 'Rejected' }
            ].map(p => {
              const count = p.key === 'all' ? candidates.length : candidates.filter(c => c.status === p.key).length;
              return (
                <button
                  key={p.key}
                  onClick={() => setActiveStatus(p.key)}
                  className={`
                    px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 shadow-xs
                    ${activeStatus === p.key 
                      ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm font-black' 
                      : 'bg-white text-[#555555] border-[#e2dfd7] hover:bg-[#F9F7F4] hover:text-[#1E2D4E] font-semibold'}
                  `}
                >
                  <span>{p.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeStatus === p.key ? 'bg-white/20 text-white' : 'bg-black/5 text-[#777777]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Toolbar */}
          <div className="card-glass p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, app no..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] shadow-xs"
                />
              </div>

              <select
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Designations</option>
                {Array.from(new Set((candidates || []).map(c => c.desig).filter(Boolean))).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#1E2D4E]"
              >
                <option value="">All Sources</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Employee Reference">Employee Reference</option>
                <option value="Advertisement">Advertisement</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-2 font-bold">
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-3.5 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E] hover:bg-[#F9F7F4] transition-colors shadow-xs"
              >
                {sortDir === 'asc' ? '↑ Date Applied (Asc)' : '↓ Date Applied (Desc)'}
              </button>
            </div>
          </div>

          {/* Candidate Table Grid */}
          <div className="card-glass p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777777] tracking-wider bg-[#F9F7F4]/60">
                    <th className="py-3 px-4">App No</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dfd7]/60">
                  {filtered.length > 0 ? (
                    (filtered || []).map((c) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#555555] font-bold">{c.appNo}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openDrawer(c)}
                            className="flex items-center gap-3 group text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {c.initials}
                            </div>
                            <span className="font-extrabold text-[#1E2D4E] group-hover:underline">{c.name}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#555555]">{maskPhone(c.phone)}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-semibold">{c.gender || '—'}</td>
                        <td className="py-3.5 px-4 text-[#1E2D4E] font-extrabold">{c.desig}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-medium">{c.source}</td>
                        <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={c.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === 'New' && (
                              <button
                                onClick={() => handleStatusChange('shortlist', c)}
                                className="px-2.5 py-1 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] font-bold hover:bg-[#1E2D4E] hover:text-white transition-all text-[11px]"
                              >
                                Shortlist
                              </button>
                            )}
                            {(c.status === 'Shortlisted' || c.status === '1st Call' || c.status === '2nd Call') && (
                              <button
                                onClick={() => handleStatusChange('schedule', c)}
                                className="px-2.5 py-1 rounded-lg bg-[#1E2D4E] text-white font-bold hover:bg-[#162340] transition-all text-[11px] shadow-xs"
                              >
                                📅 Schedule Interview
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/candidate-entry?edit=${c.appNo}`)}
                              className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors"
                              title="Edit Candidate Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteCandidate(c.appNo)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                                title="Delete Candidate Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-[#777777] font-semibold">
                        No candidates found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Panel Views */}
            <div className="pt-3 border-t border-[#e2dfd7] flex items-center gap-3">
              <button
                onClick={() => handleViewSelRej('selected')}
                className="px-3.5 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>View Selected Candidates</span>
              </button>
              <button
                onClick={() => handleViewSelRej('rejected')}
                className="px-3.5 py-1.5 rounded-xl border border-rose-600 text-rose-700 font-bold hover:bg-rose-50 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>View Rejected Candidates</span>
              </button>
            </div>
          </div>

          {/* Selected / Rejected Quick View Modal */}
          {selRejPanel && (
            <div className="card-glass p-5 space-y-4 animate-fade-in border-2 border-[#1E2D4E]/20">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <h3 className="font-extrabold text-[#1E2D4E] text-base capitalize flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#C9952A]" />
                  <span>{selRejPanel} Candidates</span>
                </h3>
                <button onClick={() => setSelRejPanel(null)} className="text-[#888888] hover:text-[#1E2D4E] p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2dfd7] text-[10px] font-black uppercase text-[#777777]">
                      <th className="py-2.5 px-3">App No</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2dfd7]/50">
                    {(selRejData || []).map((c, idx) => (
                      <tr key={idx} className="hover:bg-black/5 font-medium">
                        <td className="py-2.5 px-3 font-mono">{c.appNo}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1E2D4E]">{c.name}</td>
                        <td className="py-2.5 px-3">{c.desig}</td>
                        <td className="py-2.5 px-3 font-mono">{c.phone}</td>
                      </tr>
                    ))}
                    {selRejData.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-[#888888]">No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Centered Enterprise Candidate Profile Modal */}
      {drawerCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1E2D4E]/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border border-[#C9952A]/40">
            {/* Sticky Header */}
            <div className="bg-[#1E2D4E] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#C9952A]/30 sticky top-0 z-20">
              <div className="flex items-center gap-3.5">
                {fileUrl(drawerCandidate.photoUrl) ? (
                  <img
                    src={fileUrl(drawerCandidate.photoUrl)!}
                    alt={drawerCandidate.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-[#C9952A] shadow-md bg-white p-0.5"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1E2D4E] to-[#2A3F6D] text-white font-black text-xl flex items-center justify-center border-2 border-[#C9952A] shadow-md">
                    {drawerCandidate.initials}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-white text-lg sm:text-xl tracking-tight leading-none">{drawerCandidate.name}</h2>
                    <StatusBadge status={drawerCandidate.status} size="sm" />
                  </div>
                  <div className="text-xs text-[#C9952A] font-extrabold font-mono mt-1.5 flex flex-wrap items-center gap-2">
                    <span>{drawerCandidate.appNo}</span>
                    <span>•</span>
                    <span className="text-white font-bold">{drawerCandidate.desig}</span>
                    <span>•</span>
                    <span className="text-white/80 font-normal">Applied: {drawerCandidate.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerCandidate(null)}
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
                      <div className="text-base font-mono font-black text-[#1E2D4E]">{drawerCandidate.appNo}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Position Applied</span>
                      <div className="text-base font-extrabold text-[#1E2D4E]">{drawerCandidate.desig || '—'}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-[#777777]">Recruitment Source</span>
                      <div className="text-base font-extrabold text-[#C9952A]">{drawerCandidate.source || 'Walk-in'}</div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#C9952A]" />
                      <span>Primary Contact &amp; Application Meta</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><span className="text-[#777777]">Mobile Phone:</span> <span className="font-extrabold text-[#1E2D4E] font-mono ml-1">{drawerCandidate.phone}</span></div>
                      <div><span className="text-[#777777]">Email Address:</span> <span className="font-extrabold text-[#1E2D4E] ml-1">{drawerCandidate.email || '—'}</span></div>
                      <div><span className="text-[#777777]">Application Date:</span> <span className="font-bold text-[#1E2D4E] ml-1">{drawerCandidate.date}</span></div>
                      <div><span className="text-[#777777]">Days in Pipeline:</span> <span className="font-bold text-emerald-800 ml-1">{drawerCandidate.daysIn} Days</span></div>
                      <div><span className="text-[#777777]">Referrer Info:</span> <span className="font-bold text-[#1E2D4E] ml-1">{drawerCandidate.referrer ? `${drawerCandidate.referrer} (${drawerCandidate.referrerEmpNo || ''})` : '—'}</span></div>
                      <div><span className="text-[#777777]">Current Status:</span> <span className="font-bold text-sky-800 ml-1">{drawerCandidate.status}</span></div>
                    </div>
                  </div>

                  {/* Salary & Offer Details */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#C9952A]" />
                      <span>Salary &amp; Offer Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerCandidate.expectedSalary ? `₹ ${drawerCandidate.expectedSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerCandidate.previousSalary || drawerCandidate.currentSalary) ? `₹ ${drawerCandidate.previousSalary || drawerCandidate.currentSalary}` : '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Notice Period</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.noticePeriod || drawerCandidate.offeredDoj || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Allocated Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.department || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Designation Role</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.desig || drawerCandidate.designation || '—'}</span></div>
                    </div>
                  </div>

                  {/* Work Experience Details */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                    <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#C9952A]" />
                      <span>Work Experience Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Prior / Retail Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.retailExperience || drawerCandidate.retail_experience || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Company / Employer</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.previousCompany || drawerCandidate.previous_company || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Previous Role / Designation</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.previousDesignation || drawerCandidate.previous_designation || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification</span><span className="font-extrabold text-[#1E2D4E]">{drawerCandidate.qualification || '—'}</span></div>
                      <div><span className="text-[#777777] block text-[10.5px]">Referrer Information</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.referrer ? `${drawerCandidate.referrer} (${drawerCandidate.referrerEmpNo || ''})` : '—'}</span></div>
                    </div>
                    {drawerCandidate.remarks && (
                      <div className="pt-2 border-t border-[#e2dfd7]/60">
                        <span className="text-[#777777] block text-[10.5px] mb-0.5">Remarks / HR Notes:</span>
                        <span className="font-medium text-[#1E2D4E] block leading-relaxed italic">{drawerCandidate.remarks}</span>
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
                    <div><span className="text-[#777777] block text-[10.5px]">Full Applicant Name:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerCandidate.name}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Mobile Phone Number:</span><span className="font-extrabold text-[#1E2D4E] font-mono text-sm">{drawerCandidate.phone}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Email Address:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.email || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Gender:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.gender || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Date of Birth:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.dob || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Blood Group:</span><span className="font-bold text-rose-700">{drawerCandidate.bloodGroup || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Aadhaar Number (12 Digits):</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerCandidate.aadhaarNumber || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Religion:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.religion || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Caste / Category:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.caste || drawerCandidate.religionCaste || '—'}</span></div>
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
                        {drawerCandidate.address || drawerCandidate.cityState || '—'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><span className="text-[#777777] block text-[10.5px]">City / Location:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.cityState || '—'}</span></div>
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
                      <span className="font-extrabold text-[#1E2D4E] block">{drawerCandidate.fatherDetails || '—'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-1">
                      <span className="text-[#777777] text-[10.5px] font-bold block">Mother's Name &amp; Occupation</span>
                      <span className="font-extrabold text-[#1E2D4E] block">{drawerCandidate.motherDetails || '—'}</span>
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
                    <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerCandidate.qualification || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience:</span><span className="font-extrabold text-[#1E2D4E] text-sm">{drawerCandidate.experience || '—'}</span></div>
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
                    <div><span className="text-[#777777] block text-[10.5px]">Total Experience:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.experience || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Prior Work / Retail Experience:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.retailExperience || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Employer / Store:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.previousCompany || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Designation:</span><span className="font-bold text-[#1E2D4E]">{drawerCandidate.previousDesignation || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Previous Monthly Salary:</span><span className="font-extrabold text-emerald-800">₹ {drawerCandidate.currentSalary || drawerCandidate.previousSalary || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Expected Monthly Salary:</span><span className="font-extrabold text-emerald-800">₹ {drawerCandidate.expectedSalary || '—'}</span></div>
                    <div><span className="text-[#777777] block text-[10.5px]">Earliest Date of Joining:</span><span className="font-bold text-amber-800">{drawerCandidate.offeredDoj || drawerCandidate.noticePeriod || '—'}</span></div>
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
                    {(Array.isArray(drawerCandidate.languagesKnown) ? drawerCandidate.languagesKnown : (drawerCandidate.languagesKnown ? JSON.parse(drawerCandidate.languagesKnown) : [])).map((lang: string) => (
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
                    {fileUrl(drawerCandidate.photoUrl) ? (
                      <a href={fileUrl(drawerCandidate.photoUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">Passport Photo</span>
                        <span className="text-[10px] text-[#777777] group-hover:text-white/80 underline">View Document ↗</span>
                      </a>
                    ) : <div className="p-4 text-center text-[#aaa] border rounded-2xl bg-[#F9F7F4] font-bold">No Photo Uploaded</div>}

                    {fileUrl(drawerCandidate.aadhaarUrl || drawerCandidate.aadharUrl) ? (
                      <a href={fileUrl(drawerCandidate.aadhaarUrl || drawerCandidate.aadharUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
                        <span className="text-2xl">📄</span>
                        <span className="text-xs">Aadhaar Card</span>
                        <span className="text-[10px] text-[#777777] group-hover:text-white/80 underline">View Document ↗</span>
                      </a>
                    ) : <div className="p-4 text-center text-[#aaa] border rounded-2xl bg-[#F9F7F4] font-bold">No Aadhaar Uploaded</div>}

                    {fileUrl(drawerCandidate.resumeUrl) ? (
                      <a href={fileUrl(drawerCandidate.resumeUrl)!} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-extrabold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-all flex flex-col items-center gap-2 shadow-2xs group">
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
                      (activityLog || []).map((a, idx) => (
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
                onClick={() => handleDeleteCandidate(drawerCandidate.appNo)}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold text-xs hover:bg-rose-600 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Applicant</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleStatusChange('schedule', drawerCandidate)}
                  className="px-3.5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs hover:bg-[#162340] transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Interview</span>
                </button>
                <button
                  onClick={() => handleStatusChange('shortlist', drawerCandidate)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-extrabold text-xs hover:bg-emerald-800 transition-colors shadow-xs"
                >
                  Shortlist
                </button>
                <button
                  onClick={() => handleStatusChange('hold', drawerCandidate)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white font-extrabold text-xs hover:bg-amber-700 transition-colors shadow-xs"
                >
                  Hold
                </button>
                <button
                  onClick={() => handleStatusChange('reject', drawerCandidate)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 transition-colors shadow-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Offer Modal */}
      {directOfferModal.open && directOfferModal.candidate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">Direct Offer to Desk — {directOfferModal.candidate.name}</h3>
              <button onClick={() => setDirectOfferModal({ open: false, candidate: null })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Offered Monthly Salary (₹) *</label>
                <input type="text" value={offerForm.salary} onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })} placeholder="e.g. 25000" className="input-modern font-bold text-emerald-800" />
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Offered Incentive (₹) (Optional)</label>
                <input type="text" value={offerForm.incentive || ''} onChange={(e) => setOfferForm({ ...offerForm, incentive: e.target.value })} placeholder="e.g. 2000 (Monthly / Performance)" className="input-modern font-bold text-emerald-700" />
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Estimated Date of Joining</label>
                <input type="date" value={offerForm.doj} onChange={(e) => setOfferForm({ ...offerForm, doj: e.target.value })} className="input-modern font-bold text-amber-800" />
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Finalized Designation Role</label>
                <select value={offerForm.desig} onChange={(e) => setOfferForm({ ...offerForm, desig: e.target.value })} className="select-modern font-bold">
                  <option value="">Select Designation</option>
                  {(designations || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Allocated Department</label>
                <select value={offerForm.department} onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })} className="select-modern font-bold">
                  <option value="">Select Department</option>
                  <option value="SAARE">SAARE</option>
                  <option value="LADIES">LADIES</option>
                  <option value="KIDS">KIDS</option>
                  <option value="MENS">MENS</option>
                  <option value="HOME FURNISHING">HOME FURNISHING</option>
                  <option value="OTHERS">OTHERS</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#e2dfd7]">
              <button onClick={() => setDirectOfferModal({ open: false, candidate: null })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs">
                Cancel
              </button>
              <button onClick={handleDirectOfferSubmit} disabled={actionLoading} className="btn-primary text-xs shadow-md disabled:opacity-50">
                {actionLoading ? 'Processing...' : 'Send to Offer Desk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
