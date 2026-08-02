import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { FileText, Phone, Calendar, CheckCircle2, XCircle, UserCheck, Trash2 } from 'lucide-react';

export default function OfferProcessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [offers, setOffers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  const [detailOffer, setDetailOffer] = useState<any | null>(null);
  const [noticePd, setNoticePd] = useState('');
  const [estDoj, setEstDoj] = useState('');
  const [salaryOffered, setSalaryOffered] = useState('');

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
    if (!detailOffer) return;
    try {
      await API.updateOfferDetails({ appNo: detailOffer.appNo, noticePd, estDoj, salaryOffered });
      showToast('Offer joining details saved', 'success');
      loadOffers();
      setDetailOffer(null);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleAcceptOffer = async (appNo: string) => {
    const remarks = prompt('Mandatory remarks for offer acceptance:');
    if (!remarks) return;
    try {
      await API.acceptOffer({ appNo, remarks });
      showToast('Offer accepted!', 'success');
      loadOffers();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleMarkJoined = async (appNo: string) => {
    try {
      await API.markJoined({ appNo, joiningDate });
      showToast('Employee marked as Joined! 🎉 Moving to Employee directory...', 'success');
      setTimeout(() => {
        navigate('/employees');
      }, 1200);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
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
                      <tr key={o.appNo} className="hover:bg-black/5 font-medium">
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
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setDetailOffer(o);
                                setNoticePd(o.noticePd || '');
                                setEstDoj(o.estDoj || '');
                                setSalaryOffered(o.salary || '');
                              }}
                              className="px-2.5 py-1 rounded bg-[#1E2D4E] text-white font-bold text-[11px]"
                            >
                              Edit Details
                            </button>
                            {o.status === 'Pending Accept' && (
                              <button
                                onClick={() => handleAcceptOffer(o.appNo)}
                                className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold text-[11px]"
                              >
                                Accept Offer
                              </button>
                            )}
                            {o.status === 'Accepted' && (
                              <button
                                onClick={() => handleMarkJoined(o.appNo)}
                                className="px-2.5 py-1 rounded bg-teal-700 text-white font-bold text-[11px]"
                              >
                                Mark Joined
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteOffer(o.appNo, o.name)}
                              className="p-1.5 rounded border border-red-200 text-red-600 font-bold text-[11px] hover:bg-red-50 transition-colors"
                              title="Delete Candidate completely"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
            <h3 className="font-extrabold text-[#1E2D4E] text-base">Offer Details — {detailOffer.name}</h3>

            <div className="space-y-3 text-xs flex-1">
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
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDetailOffer(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#e0ddd8] font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDetails}
                className="flex-1 py-2.5 rounded-lg bg-[#1E2D4E] text-white font-bold text-xs"
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
