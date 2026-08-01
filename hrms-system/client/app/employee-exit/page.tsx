"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { DoorOpen, Plus, X } from 'lucide-react';

export default function EmployeeExitPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [records, setRecords] = useState<any[]>([]);
  const [drawerRecord, setDrawerRecord] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [sections, setSections] = useState<Record<string, any[]>>({});

  const [newModal, setNewModal] = useState(false);
  const [empName, setEmpName] = useState('');
  const [desig, setDesig] = useState('');
  const [lwd, setLwd] = useState(new Date().toISOString().slice(0, 10));

  const loadList = useCallback(async () => {
    try {
      const res = await API.getExitList();
      if (res && res.records) {
        setRecords(res.records);
      }
    } catch (e: any) {
      showToast('Error loading exit list', 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      router.replace('/login');
      return;
    }
    setSession(Auth.get());
    loadList();
  }, [router, loadList]);

  const openChecklist = async (r: any) => {
    setDrawerRecord(r);
    try {
      const res = await API.getExitItems(r.recordId);
      setItems(res.items || []);
      setSections(res.sections || {});
    } catch (e) {
      showToast('Error fetching exit items', 'error');
    }
  };

  const handleTick = async (itemId: string, status: string) => {
    if (!drawerRecord) return;
    try {
      const current = items.find(i => i.itemId === itemId);
      const newStatus = current?.status === status ? '' : status;

      await API.updateExitItem({
        recordId: drawerRecord.recordId,
        itemId,
        status: newStatus,
        doneBy: session?.username || 'HR'
      });

      const res = await API.getExitItems(drawerRecord.recordId);
      setItems(res.items || []);
      setSections(res.sections || {});
      loadList();
    } catch (e: any) {
      showToast('Error updating item', 'error');
    }
  };

  const handleCreateExit = async () => {
    if (!empName.trim() || !lwd) {
      showToast('Employee name and last working day required', 'error');
      return;
    }
    try {
      await API.createExit({ empName, desig, lwd });
      showToast('Exit process created!', 'success');
      setNewModal(false);
      setEmpName(''); setDesig('');
      loadList();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Exit / FnF"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Exit / FnF' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={
            <button
              onClick={() => setNewModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>New Exit Process</span>
            </button>
          }
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="card-glass p-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e0ddd8] text-[10px] font-black uppercase text-[#888888]">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Last Working Day</th>
                    <th className="py-2.5 px-3">Progress</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0ddd8]/50">
                  {records.length > 0 ? (
                    records.map(r => (
                      <tr key={r.recordId} className="hover:bg-black/5 font-medium">
                        <td className="py-3 px-3 font-bold text-[#1E2D4E]">{r.empName}</td>
                        <td className="py-3 px-3">{r.desig}</td>
                        <td className="py-3 px-3">{r.lwd}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-[#f0ede8] h-1.5 rounded-full overflow-hidden">
                              <div className="bg-red-600 h-full" style={{ width: `${r.progress}%` }} />
                            </div>
                            <span className="font-bold text-[10px]">{r.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`badge ${r.status === 'Completed' ? 'b-sel' : 'b-rej'}`}>{r.status}</span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => openChecklist(r)}
                            className="px-2.5 py-1 rounded bg-red-700 text-white font-bold text-[11px]"
                          >
                            Open Clearance
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="py-8 text-center text-[#888888]">No exit records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Drawer */}
      {drawerRecord && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerRecord(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            <div className="bg-red-700 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">{drawerRecord.empName}</h3>
                <div className="text-[11px] text-white/70">{drawerRecord.desig} · Exit / FnF Clearance</div>
              </div>
              <button onClick={() => setDrawerRecord(null)}><X className="w-5 h-5 text-white/70" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {Object.keys(sections).map(sec => (
                <div key={sec} className="space-y-2">
                  <div className="text-[10px] font-black uppercase text-red-800 tracking-wider p-2 bg-red-50 rounded-md border-l-4 border-l-red-600">
                    {sec}
                  </div>
                  {sections[sec].map(item => (
                    <div key={item.itemId} className="p-3 rounded-xl border border-[#e0ddd8] flex items-center justify-between gap-3 bg-white">
                      <div>
                        <div className="font-semibold text-[#1E2D4E]">{item.item}</div>
                        {item.mandatory && <span className="text-[9px] text-red-600 font-bold">★ Mandatory</span>}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTick(item.itemId, 'Done')}
                          className={`w-7 h-7 rounded font-bold border text-xs ${item.status === 'Done' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-[#888888]'}`}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleTick(item.itemId, 'NA')}
                          className={`w-7 h-7 rounded font-bold border text-xs ${item.status === 'NA' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-[#888888]'}`}
                        >
                          NA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Exit Modal */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="font-black text-red-700 text-base">New Exit Process</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Designation</label>
                <input
                  type="text"
                  value={desig}
                  onChange={(e) => setDesig(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Last Working Day *</label>
                <input
                  type="date"
                  value={lwd}
                  onChange={(e) => setLwd(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setNewModal(false)} className="px-4 py-2 rounded-lg border border-[#e0ddd8] text-xs font-bold">Cancel</button>
              <button onClick={handleCreateExit} className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-bold">Start Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
