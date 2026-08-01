"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { 
  Users, Search, Filter, Phone, Mail, Calendar, MapPin, Briefcase, 
  FileText, CheckCircle, XCircle, Plus, Clock, ExternalLink, MessageSquare, ChevronRight, X
} from 'lucide-react';

export default function CandidatesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Selection
  const [selectedAppNos, setSelectedAppNos] = useState<string[]>([]);

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
      router.replace('/login');
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadCandidates();
  }, [router, loadCandidates]);

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
      const res = await API.saveCallStep({
        appNo: candidate.appNo,
        candidate: candidate.name,
        desig: candidate.desig,
        step,
        date: callDate,
        remarks: callRemarks
      });

      showToast(step === 3 ? 'Interview Scheduled!' : `${step === 1 ? '1st' : '2nd'} call logged ✓`, 'success');
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
          title="Candidates"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Candidates' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <button
              onClick={() => window.open('/candidate-entry', '_blank')}
              className="px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Walk-in</span>
            </button>
          }
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Status Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs font-bold scrollbar-none">
            {[
              { key: 'all', label: 'All' },
              { key: 'New', label: 'New' },
              { key: 'Shortlisted', label: 'Shortlisted' },
              { key: '1st Call Done', label: '1st Call' },
              { key: '2nd Call Done', label: '2nd Call' },
              { key: 'Interview Scheduled', label: 'Interview Scheduled' },
              { key: 'Interviewed', label: 'Interviewed' },
              { key: 'Selected', label: 'Selected' },
              { key: 'Offer Sent', label: 'Offer Sent' },
              { key: 'Hold', label: 'Hold' },
              { key: 'Rejected', label: 'Rejected' }
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setActiveStatus(p.key)}
                className={`
                  px-3 py-1.5 rounded-full border whitespace-nowrap transition-all
                  ${activeStatus === p.key 
                    ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-sm' 
                    : 'bg-white text-[#666666] border-[#e0ddd8] hover:bg-black/5'}
                `}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="card-glass p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, app no..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>

              <select
                value={desigFilter}
                onChange={(e) => setDesigFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-[#1E2D4E] font-medium"
              >
                <option value="">All Designations</option>
                {['Sales Executive', 'Floor Manager', 'Cashier', 'Billing Executive', 'Store Keeper'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-[#1E2D4E] font-medium"
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
                className="px-3 py-1.5 rounded-lg border border-[#e0ddd8] bg-white text-[#1E2D4E] hover:bg-black/5"
              >
                {sortDir === 'asc' ? '↑ Oldest First' : '↓ Newest First'}
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="card-glass p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888] tracking-wider">
                    <th className="py-2.5 px-3">App No</th>
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Gender</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {filtered.length > 0 ? (
                    filtered.map((c) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#666666]">{c.appNo}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => openDrawer(c)}
                            className="flex items-center gap-2.5 hover:underline text-[#1E2D4E] font-bold text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-[#1E2D4E] text-white font-black text-[10px] flex items-center justify-center">
                              {c.initials}
                            </div>
                            <span>{c.name}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#666666]">{maskPhone(c.phone)}</td>
                        <td className="py-3 px-3 text-[#555555]">{c.gender || '—'}</td>
                        <td className="py-3 px-3 text-[#555555]">{c.desig}</td>
                        <td className="py-3 px-3 text-[#555555]">{c.source}</td>
                        <td className="py-3 px-3 text-[#666666] whitespace-nowrap">{c.date}</td>
                        <td className="py-3 px-3">
                          <span className={`badge ${
                            c.status === 'New' ? 'b-new' :
                            c.status === 'Shortlisted' ? 'b-short' :
                            c.status === 'Selected' ? 'b-sel' :
                            c.status === 'Joined' ? 'b-sel' :
                            c.status === 'Rejected' ? 'b-rej' : 'b-info'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {isViewOnly ? (
                            <span className="text-[10px] text-[#aaa] italic">View only</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {c.status === 'New' && (
                                <button
                                  onClick={() => handleOpenRemarkModal('shortlist', c)}
                                  className="px-2.5 py-1 rounded-md border border-[#1E2D4E] text-[#1E2D4E] font-bold hover:bg-[#1E2D4E] hover:text-white transition-all text-[11px]"
                                >
                                  Shortlist
                                </button>
                              )}
                              {(c.status === 'Shortlisted' || c.status === '1st Call Done') && (
                                <button
                                  onClick={() => handleOpenCallModal(c)}
                                  className="px-2.5 py-1 rounded-md bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all text-[11px]"
                                >
                                  📞 Call Step
                                </button>
                              )}
                              {c.status === '2nd Call Done' && (
                                <button
                                  onClick={() => handleOpenCallModal(c)}
                                  className="px-2.5 py-1 rounded-md bg-[#1E2D4E] text-white font-bold hover:bg-[#162340] transition-all text-[11px]"
                                >
                                  📅 Schedule Interview
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-[#888888] font-semibold">
                        No candidates found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom View Selected / Rejected Buttons */}
            <div className="pt-3 border-t border-[#e0ddd8] flex items-center gap-3">
              <button
                onClick={() => handleViewSelRej('selected')}
                className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 text-xs flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>View Selected Candidates</span>
              </button>
              <button
                onClick={() => handleViewSelRej('rejected')}
                className="px-3 py-1.5 rounded-lg border border-red-600 text-red-700 font-bold hover:bg-red-50 text-xs flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>View Rejected Candidates</span>
              </button>
            </div>
          </div>

          {/* Selected / Rejected Panel Modal */}
          {selRejPanel && (
            <div className="card-glass p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#e0ddd8] pb-3">
                <h3 className="font-black text-[#1E2D4E] text-sm capitalize">{selRejPanel} Candidates</h3>
                <button
                  onClick={() => setSelRejPanel(null)}
                  className="p-1 text-[#888888] hover:text-[#1E2D4E]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                      <th className="py-2.5 px-3">App No</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0ddd8]/50">
                    {selRejData.length > 0 ? (
                      selRejData.map((r) => (
                        <tr key={r.appNo} className="hover:bg-black/5 font-medium">
                          <td className="py-2.5 px-3 font-mono">{r.appNo}</td>
                          <td className="py-2.5 px-3 font-bold">{r.name}</td>
                          <td className="py-2.5 px-3">{r.desig}</td>
                          <td className="py-2.5 px-3">{r.source}</td>
                          <td className="py-2.5 px-3 text-[#666666] italic">{r.remarks || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="py-6 text-center text-[#888888]">No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Candidate Profile Drawer */}
      {drawerCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerCandidate(null)} />
          
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            {/* Drawer Header */}
            <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C9952A] font-black text-white flex items-center justify-center text-sm">
                  {drawerCandidate.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">{drawerCandidate.name}</h3>
                  <div className="text-[11px] text-white/60 mt-0.5">{drawerCandidate.appNo} · Applied {drawerCandidate.date}</div>
                </div>
              </div>

              <button onClick={() => setDrawerCandidate(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[#e0ddd8] bg-[#F9F7F4] text-xs font-bold text-[#888888]">
              {['overview', 'details', 'questions', 'activity'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab as any)}
                  className={`
                    flex-1 py-3 text-center border-b-2 capitalize transition-all
                    ${drawerTab === tab 
                      ? 'border-[#1E2D4E] text-[#1E2D4E] bg-white' 
                      : 'border-transparent hover:text-[#1E2D4E]'}
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {drawerTab === 'overview' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                    <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Personal Overview</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-[#888888]">Phone:</span> <b className="text-[#1E2D4E]">{drawerCandidate.phone}</b></div>
                      <div><span className="text-[#888888]">Email:</span> <b className="text-[#1E2D4E]">{drawerCandidate.email || '—'}</b></div>
                      <div><span className="text-[#888888]">DOB:</span> <b>{drawerCandidate.dob || '—'}</b></div>
                      <div><span className="text-[#888888]">Gender:</span> <b>{drawerCandidate.gender || '—'}</b></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                    <div className="text-[10px] font-black uppercase text-[#1E2D4E] tracking-wider">Application Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-[#888888]">Position:</span> <b className="text-[#1E2D4E]">{drawerCandidate.desig}</b></div>
                      <div><span className="text-[#888888]">Expected Salary:</span> <b className="text-emerald-700">₹{drawerCandidate.salary}</b></div>
                      <div><span className="text-[#888888]">Experience:</span> <b>{drawerCandidate.experience || '—'}</b></div>
                      <div><span className="text-[#888888]">Notice Period:</span> <b>{drawerCandidate.noticePeriod || '—'}</b></div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'details' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-1">
                    <div className="text-[10px] font-black uppercase text-[#1E2D4E]">Location</div>
                    <div>{drawerCandidate.address || '—'}, {drawerCandidate.cityState}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-2">
                    <div className="text-[10px] font-black uppercase text-[#1E2D4E]">Documents</div>
                    {drawerCandidate.resumeUrl ? (
                      <a
                        href={drawerCandidate.resumeUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Resume PDF</span>
                      </a>
                    ) : (
                      <div className="text-[#888888] italic">No resume uploaded</div>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'questions' && (
                <div className="space-y-3">
                  {[
                    { q: '1. Why join BSC Exclusive?', a: drawerCandidate.q1 },
                    { q: '2. Why should we hire you?', a: drawerCandidate.q2 },
                    { q: '3. Comfortable on weekends?', a: drawerCandidate.q3 },
                    { q: '4. Value in first 90 days?', a: drawerCandidate.q4 }
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] space-y-1">
                      <div className="font-bold text-[#1E2D4E]">{item.q}</div>
                      <div className="text-[#666666] leading-relaxed">{item.a || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'activity' && (
                <div className="space-y-3">
                  {activityLog.length > 0 ? (
                    activityLog.map((act, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#F9F7F4] border border-[#e0ddd8]">
                        <span className="text-base">{act.icon || '📋'}</span>
                        <div className="flex-1">
                          <div className="font-bold text-[#1E2D4E]">{act.label}</div>
                          {act.remarks && <div className="text-[#666666] italic mt-0.5">"{act.remarks}"</div>}
                          <div className="text-[10px] text-[#888888] mt-1">{act.date} {act.by ? `by ${act.by}` : ''}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-[#888888]">No activity log recorded</div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            {!isViewOnly && (
              <div className="p-4 border-t border-[#e0ddd8] bg-[#F9F7F4] flex gap-2">
                {drawerCandidate.status === 'New' && (
                  <>
                    <button
                      onClick={() => handleOpenRemarkModal('shortlist', drawerCandidate)}
                      className="flex-1 py-2.5 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs"
                    >
                      Shortlist
                    </button>
                    <button
                      onClick={() => handleOpenRemarkModal('hold', drawerCandidate)}
                      className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white font-bold text-xs"
                    >
                      Hold
                    </button>
                    <button
                      onClick={() => handleOpenRemarkModal('reject', drawerCandidate)}
                      className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold text-xs"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Remarks Modal */}
      {remarkModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <h3 className="font-black text-[#1E2D4E] text-base capitalize">
              {remarkModal.action} Candidate — {remarkModal.candidate?.name}
            </h3>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase text-[#777777]">
                Mandatory Remarks <span className="text-red-600">*</span>
              </label>
              <textarea
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                placeholder="Enter remarks (min 5 characters)..."
                rows={3}
                className="w-full p-3 text-xs rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] focus:outline-none focus:border-[#1E2D4E]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRemarkModal({ open: false, action: '', candidate: null })}
                className="px-4 py-2 rounded-lg border border-[#e0ddd8] text-xs font-bold text-[#666666]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemark}
                className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Setup Modal */}
      {callModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <h3 className="font-black text-[#1E2D4E] text-base">
              Call Setup — {callModal.candidate?.name}
            </h3>
            
            <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e0ddd8] text-xs space-y-2">
               <div className="font-bold text-[#1E2D4E] mb-2">
                  {callModal.step === 1 && 'Step 1: Log 1st Call'}
                  {callModal.step === 2 && 'Step 2: Log 2nd Call'}
                  {callModal.step === 3 && 'Step 3: Schedule Interview'}
               </div>
               
               <div className="space-y-1.5">
                 <label className="block text-[10px] font-extrabold uppercase text-[#777777]">Date <span className="text-red-600">*</span></label>
                 <input 
                   type="date"
                   value={callDate}
                   onChange={(e) => setCallDate(e.target.value)}
                   className="w-full p-2.5 rounded-lg border border-[#e0ddd8] focus:outline-none focus:border-[#1E2D4E]"
                 />
               </div>

               <div className="space-y-1.5 pt-2">
                 <label className="block text-[10px] font-extrabold uppercase text-[#777777]">Remarks <span className="text-red-600">*</span></label>
                 <textarea
                   value={callRemarks}
                   onChange={(e) => setCallRemarks(e.target.value)}
                   placeholder="Call summary or feedback..."
                   rows={3}
                   className="w-full p-2.5 rounded-lg border border-[#e0ddd8] focus:outline-none focus:border-[#1E2D4E]"
                 />
               </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCallModal({ open: false, candidate: null, step: 1, callStatus: null })}
                className="px-4 py-2 rounded-lg border border-[#e0ddd8] text-xs font-bold text-[#666666]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCallStep}
                className="px-4 py-2 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
