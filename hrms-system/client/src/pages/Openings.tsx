import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { Users, Plus, Save } from 'lucide-react';

export default function OpeningsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openings, setOpenings] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<{ [key: string]: number }>({});

  const loadOpenings = useCallback(async () => {
    try {
      const res = await API.call('getOpenings');
      setOpenings(res.openings || []);
    } catch (err: any) {
      showToast('Could not load openings', 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role !== 'Admin' && sess?.role !== 'HR') {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSession(sess);
    loadOpenings();
  }, [navigate, loadOpenings]);

  const handleUpdate = async (designation: string) => {
    const count = editMode[designation];
    if (count === undefined) return;

    try {
      await API.call('updateOpening', { designation, required_count: count });
      showToast(`Updated requirement for ${designation}`, 'success');
      
      const newEdit = { ...editMode };
      delete newEdit[designation];
      setEditMode(newEdit);
      
      loadOpenings();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Manpower Planning"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Openings' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] flex items-center gap-2">
                <Users className="w-5 h-5" />
                Hiring Capacity & Openings
              </h2>
              <p className="text-sm text-[#666666] mt-1">Define manpower requisitions for each role and track fulfillment.</p>
            </div>
          </div>

          <div className="card-glass p-4 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#e0ddd8] text-xs font-black uppercase text-[#888888] tracking-wider">
                  <th className="py-3 px-4">Designation Role</th>
                  <th className="py-3 px-4">Required Openings</th>
                  <th className="py-3 px-4">Already Hired</th>
                  <th className="py-3 px-4">Still Needed</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0ddd8]/50">
                {openings.map((op) => {
                  const isEditing = editMode[op.designation] !== undefined;
                  const reqCount = isEditing ? editMode[op.designation] : op.required;
                  const stillNeeded = Math.max(0, reqCount - op.hired);
                  
                  return (
                    <tr key={op.designation} className="hover:bg-black/5 transition-colors font-medium">
                      <td className="py-4 px-4 text-[#1E2D4E] font-bold">{op.designation}</td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <input 
                            type="number"
                            min="0"
                            value={reqCount}
                            onChange={(e) => setEditMode({ ...editMode, [op.designation]: parseInt(e.target.value) || 0 })}
                            className="w-24 p-1.5 border border-[#1E2D4E] rounded-md font-bold text-[#1E2D4E] text-center"
                          />
                        ) : (
                          <span className="text-lg font-black text-[#1E2D4E]">{op.required}</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-lg font-black text-emerald-600">{op.hired}</span>
                        <div className="text-[10px] text-emerald-700/60 font-bold uppercase mt-0.5">Selected / Joined</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-lg font-black ${stillNeeded > 0 ? 'text-amber-600' : 'text-[#888888]'}`}>
                          {stillNeeded}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdate(op.designation)}
                              className="px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white font-bold flex items-center gap-1 hover:bg-[#162340]"
                            >
                              <Save className="w-4 h-4" /> Save
                            </button>
                            <button
                              onClick={() => {
                                const newEdit = { ...editMode };
                                delete newEdit[op.designation];
                                setEditMode(newEdit);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[#e0ddd8] text-[#666666] font-bold hover:bg-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditMode({ ...editMode, [op.designation]: op.required })}
                            className="px-3 py-1.5 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] font-bold text-xs hover:bg-[#1E2D4E] hover:text-white transition-colors"
                          >
                            Edit Requirement
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {openings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#888888]">
                      No active designations found. Add them in Settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
