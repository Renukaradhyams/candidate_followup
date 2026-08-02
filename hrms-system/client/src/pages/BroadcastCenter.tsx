import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import PageHeader from '../components/ui/PageHeader';
import { Send, Megaphone, Users, Calendar, AlertTriangle, Trash2, CheckCircle2, Shield, Plus, Clock, Filter, Eye } from 'lucide-react';

export default function BroadcastCenterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Broadcast Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('Everyone');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [category, setCategory] = useState<'broadcast' | 'candidate' | 'interview' | 'offer' | 'system'>('broadcast');
  const [scheduledAt, setScheduledAt] = useState('');

  // History List
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    
    // Load initial list from notification service
    setBroadcasts(NotificationService.getNotifications());

    const unsub = NotificationService.subscribe((list) => {
      setBroadcasts(list);
    });
    return () => unsub();
  }, [navigate]);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('Title and message content are required', 'error');
      return;
    }

    try {
      NotificationService.addNotification({
        title,
        message,
        priority,
        category,
        targetRole
      });

      showToast(`Real-time Broadcast Sent to ${targetRole}! 📢`, 'success');
      setTitle('');
      setMessage('');
      setScheduledAt('');
    } catch (err: any) {
      showToast('Error broadcasting notification', 'error');
    }
  };

  const handleDeleteBroadcast = (id: string) => {
    if (!window.confirm('Delete this broadcast notification?')) return;
    NotificationService.deleteNotification(id);
    showToast('Broadcast removed', 'success');
  };

  const TARGET_ROLES = [
    'Everyone',
    'HR Only',
    'Admin Only',
    'Interview Panel',
    'Store Managers',
    'Recruiters',
    'Employees'
  ];

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="Enterprise Broadcast Center"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Broadcast Center' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Card */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#C9952A]" />
                <span>Real-Time Broadcast &amp; Announcement Hub</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">Dispatch instant system notifications, role-based announcements &amp; urgent alerts to active user sessions.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Broadcast Form */}
            <div className="card-glass p-6 space-y-5 lg:col-span-1 shadow-lg">
              <div className="border-b border-[#e2dfd7] pb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-[#C9952A]" />
                <h3 className="font-extrabold text-[#1E2D4E] text-sm uppercase tracking-wider">Create New Broadcast</h3>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Broadcast Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. System Maintenance Notice"
                    className="input-modern"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Target Audience / Role *</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="select-modern font-bold"
                  >
                    {TARGET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Priority Level</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="broadcast">Announcement</option>
                      <option value="interview">Interview Alert</option>
                      <option value="candidate">Candidate Followup</option>
                      <option value="offer">Offer Process</option>
                      <option value="system">System Notice</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Schedule Dispatch (Optional)</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Announcement Message *</label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter detailed broadcast content..."
                    className="textarea-modern"
                    required
                  />
                </div>

                <button type="submit" className="w-full btn-gold text-xs shadow-md flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Dispatch Real-Time Broadcast</span>
                </button>
              </form>
            </div>

            {/* Broadcast History & Logs */}
            <div className="card-glass p-6 space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-[#1E2D4E] text-base tracking-tight border-b border-[#e2dfd7] pb-3">
                  Broadcast History &amp; Dispatch Logs
                </h3>

                <div className="space-y-3 mt-4 overflow-y-auto max-h-[500px] pr-1">
                  {broadcasts.length > 0 ? (
                    broadcasts.map((b) => (
                      <div key={b.id} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-2 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-[#1E2D4E]">{b.title}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#1E2D4E]/10 text-[#1E2D4E]">
                              {b.targetRole || 'Everyone'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#777777] font-mono">{new Date(b.timestamp).toLocaleString()}</span>
                            <button onClick={() => handleDeleteBroadcast(b.id)} className="p-1 rounded text-rose-600 hover:bg-rose-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-[#555555] font-medium leading-relaxed">{b.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-xs text-[#888888]">No broadcast logs found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
