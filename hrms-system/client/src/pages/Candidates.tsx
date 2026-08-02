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
  FileText, CheckCircle, XCircle, Plus, Clock, ExternalLink, MessageSquare, ChevronRight, X, Trash2, Edit3, ShieldAlert, FileCheck
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
  
  const [callModal, setCallModal] = useState<{ open: boolean; candidate: any | null; step: number; callStatus: any }>({ open: false, candidate: null, step: 1, callStatus: null });
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [callRemarks, setCallRemarks] = useState('');

  // Selected / Rejected Panel View
  const [selRejPanel, setSelRejPanel] = useState<'selected' | 'rejected' | null>(null);
  const [selRejData, setSelRejData] = useState<any[]>([]);

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
    const clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

    const filename = clean.split('/').pop() || clean;

    if (filename.startsWith('photo')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume')) return `/uploads/candidate-resumes/${filename}`;
    if (filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) return `/uploads/employee-documents/${filename}`;

    if (clean.startsWith('/uploads/')) return clean;
    if (clean.startsWith('uploads/')) return `/${clean}`;

    return `/uploads/${filename}`;
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

  const handleOpenRemarkModal = (action: string, candidate: any) => {
    setRemarkModal({ open: true, action, candidate });
    setRemarksText('');
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

  const handleConfirmRemark = async () => {
    if (!remarksText.trim() || remarksText.trim().length < 5) {
      showToast('Remarks are required (min 5 characters)', 'error');
      return;
    }
    const { action, candidate } = remarkModal;
    if (!candidate) return;

    try {
      if (action === 'reject') {
        await API.rejectCandidate({ appNo: candidate.appNo, remarks: remarksText, candName: candidate.name });
        showToast(`${candidate.name} rejected`, 'warn');
      } else {
        const statusMap: Record<string, string> = {
          shortlist: 'Shortlisted',
          hold: 'Hold',
          reactivate: 'New',
          reengage: 'New'
        };
        await API.updateCandidate(candidate.appNo, { status: statusMap[action], remarks: remarksText });
        showToast(`${candidate.name} updated to ${statusMap[action]}`, 'success');
      }

      setRemarkModal({ open: false, action: '', candidate: null });
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleOpenCallModal = async (c: any) => {
    try {
      const status = await API.getCallStatus(c.appNo);
      const step = (status.step || 0) + 1;
      setCallModal({ open: true, candidate: c, step, callStatus: status });
      setCallDate(new Date().toISOString().slice(0, 10));
      setCallRemarks('');
    } catch (e) {
      setCallModal({ open: true, candidate: c, step: 1, callStatus: null });
    }
  };

  const handleConfirmCallStep = async () => {
    if (!callDate || !callRemarks.trim()) {
      showToast('Date and remarks are required', 'error');
      return;
    }
    const { candidate, step } = callModal;
    if (!candidate) return;

    try {
      await API.saveCallStep({
        appNo: candidate.appNo,
        candidate: candidate.name,
        desig: candidate.desig,
        step,
        date: callDate,
        remarks: callRemarks
      });

      showToast(step === 2 ? 'Interview Scheduled!' : '1st call logged ✓', 'success');
      setCallModal({ open: false, candidate: null, step: 1, callStatus: null });
      setDrawerCandidate(null);
      loadCandidates();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
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

  const isViewOnly = session?.role === 'Manager';

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
                {Array.from(new Set(candidates.map(c => c.desig).filter(Boolean))).map(d => (
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
                    filtered.map((c) => (
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
                          {isViewOnly ? (
                            <span className="text-[10px] text-[#aaa] italic">View only</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {c.status === 'New' && (
                                <button
                                  onClick={() => handleOpenRemarkModal('shortlist', c)}
                                  className="px-2.5 py-1 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] font-bold hover:bg-[#1E2D4E] hover:text-white transition-all text-[11px]"
                                >
                                  Shortlist
                                </button>
                              )}
                              {(c.status === 'Shortlisted') && (
                                <button
                                  onClick={() => handleOpenCallModal(c)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all text-[11px] shadow-xs"
                                >
                                  📞 1st Call
                                </button>
                              )}
                              {(c.status === '1st Call') && (
                                <button
                                  onClick={() => handleOpenCallModal(c)}
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
                              <button
                                onClick={() => handleDeleteCandidate(c.appNo)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                                title="Delete Candidate Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
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
                    {selRejData.map((c, idx) => (
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

      {/* Candidate Details Drawer */}
      {drawerCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setDrawerCandidate(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col z-10 space-y-5 animate-fade-in overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1E2D4E] text-white font-black text-sm flex items-center justify-center shadow-md">
                  {drawerCandidate.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-base leading-tight">{drawerCandidate.name}</h3>
                  <div className="text-xs text-[#777777] font-mono mt-0.5">{drawerCandidate.appNo} · {drawerCandidate.desig}</div>
                </div>
              </div>
              <button onClick={() => setDrawerCandidate(null)} className="text-[#888888] hover:text-[#1E2D4E] p-1.5 rounded-lg border border-[#e2dfd7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-[#e2dfd7] pb-2 text-xs font-bold">
              {['overview', 'details', 'activity'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab as any)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${drawerTab === tab ? 'bg-[#1E2D4E] text-white' : 'text-[#666666] hover:bg-[#F9F7F4]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {drawerTab === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7]">
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#777777] block">Status</span>
                    <StatusBadge status={drawerCandidate.status} size="sm" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#777777] block">Phone</span>
                    <span className="font-bold text-[#1E2D4E] font-mono">{drawerCandidate.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#777777] block">Email</span>
                    <span className="font-bold text-[#1E2D4E]">{drawerCandidate.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#777777] block">Qualification</span>
                    <span className="font-bold text-[#1E2D4E]">{drawerCandidate.qualification || '—'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1E2D4E] block">Uploaded Documents</span>
                  <div className="grid grid-cols-3 gap-2">
                    {fileUrl(drawerCandidate.photoUrl) ? (
                      <a href={fileUrl(drawerCandidate.photoUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">
                        📷 Photo
                      </a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Photo</span>}

                    {fileUrl(drawerCandidate.aadhaarUrl) ? (
                      <a href={fileUrl(drawerCandidate.aadhaarUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">
                        📄 Aadhaar
                      </a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Aadhaar</span>}

                    {fileUrl(drawerCandidate.resumeUrl) ? (
                      <a href={fileUrl(drawerCandidate.resumeUrl)!} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-center font-bold text-[#1E2D4E] hover:bg-white transition-colors">
                        📑 Resume
                      </a>
                    ) : <span className="p-2 text-center text-[#aaa] border rounded-xl">No Resume</span>}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'activity' && (
              <div className="space-y-3 text-xs overflow-y-auto max-h-80 pr-1">
                {activityLog.length > 0 ? (
                  activityLog.map((a, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-1">
                      <div className="flex items-center justify-between font-bold text-[#1E2D4E]">
                        <span>{a.label || a.action_type}</span>
                        <span className="text-[10px] text-[#777777] font-mono">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      {a.remarks && <p className="text-[#666666] italic">{a.remarks}</p>}
                    </div>
                  ))
                ) : <p className="text-center py-6 text-[#888888]">No activity logged yet.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remark Modal */}
      {remarkModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base capitalize">
                {remarkModal.action} — {remarkModal.candidate?.name}
              </h3>
              <button onClick={() => setRemarkModal({ open: false, action: '', candidate: null })} className="text-[#888888] hover:text-[#1E2D4E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Enter HR Remarks / Feedback *</label>
              <textarea
                rows={3}
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                placeholder="Reasoning for this status update..."
                className="input-modern"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setRemarkModal({ open: false, action: '', candidate: null })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmRemark} className="btn-primary text-xs">
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Log Modal */}
      {callModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <h3 className="font-extrabold text-[#1E2D4E] text-base">
                Log {callModal.step === 1 ? '1st Call' : 'Interview Schedule'} — {callModal.candidate?.name}
              </h3>
              <button onClick={() => setCallModal({ open: false, candidate: null, step: 1, callStatus: null })} className="text-[#888888]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Date *</label>
                <input
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  className="input-modern"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1E2D4E] mb-1">Call Notes / Schedule Remarks *</label>
                <textarea
                  rows={3}
                  value={callRemarks}
                  onChange={(e) => setCallRemarks(e.target.value)}
                  placeholder="Candidate availability, expected timing, interview details..."
                  className="input-modern"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e2dfd7]">
              <button onClick={() => setCallModal({ open: false, candidate: null, step: 1, callStatus: null })} className="px-4 py-2 rounded-xl border border-[#e2dfd7] text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmCallStep} className="btn-primary text-xs">
                Save Call Step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
