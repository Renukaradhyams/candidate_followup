import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { Auth, UserSession } from '../services/api';
import { NotificationService, SystemNotification } from '../services/notificationService';
import MetricCard from '../components/ui/MetricCard';
import { Send, Megaphone, Users, Calendar, AlertTriangle, Trash2, CheckCircle2, Shield, Plus, Clock, Filter, Eye, CheckCheck, FileText, Lock, MessageSquare } from 'lucide-react';

export default function BroadcastCenterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'history'>('dashboard');

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [category, setCategory] = useState<'General' | 'HR' | 'Recruitment' | 'Interview' | 'Offer' | 'Joining' | 'Payroll' | 'System' | 'Emergency'>('General');
  const [targetRoles, setTargetRoles] = useState<string[]>(['Everyone']);
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [pinNotification, setPinNotification] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);

  // Data List
  const [broadcasts, setBroadcasts] = useState<SystemNotification[]>([]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);

    setBroadcasts(NotificationService.getNotifications());
    const unsub = NotificationService.subscribe((list) => {
      setBroadcasts(list);
    });
    return () => unsub();
  }, [navigate]);

  const handleToggleRole = (role: string) => {
    if (role === 'Everyone') {
      setTargetRoles(['Everyone']);
      return;
    }
    setTargetRoles(prev => {
      const filtered = prev.filter(r => r !== 'Everyone');
      return filtered.includes(role) ? filtered.filter(r => r !== role) : [...filtered, role];
    });
  };

  const handleDispatch = (isDraft = false) => {
    if (!title.trim() || !message.trim()) {
      showToast('Broadcast title and message are required', 'error');
      return;
    }

    NotificationService.addNotification({
      title,
      subject,
      message,
      priority,
      category,
      targetRole: targetRoles.join(', '),
      senderName: session?.fullName || 'HR Manager',
      status: isDraft ? 'Draft' : (scheduledAt ? 'Scheduled' : 'Sent'),
      requireAcknowledgement: requireAck,
      pinned: pinNotification,
      expiryDate,
      scheduledAt,
      allowReplies,
      acknowledgedBy: []
    });

    showToast(isDraft ? 'Broadcast saved to Drafts!' : 'Real-time Broadcast Dispatched! 📢', 'success');
    setTitle('');
    setSubject('');
    setMessage('');
    setScheduledAt('');
    setStartDate('');
    setExpiryDate('');
    setActiveTab('dashboard');
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this broadcast notification?')) return;
    NotificationService.deleteNotification(id);
    showToast('Broadcast removed from system', 'success');
  };

  // Metrics Calculation
  const total = broadcasts.length;
  const activeCount = broadcasts.filter(b => b.status === 'Sent').length;
  const scheduledCount = broadcasts.filter(b => b.status === 'Scheduled').length;
  const draftCount = broadcasts.filter(b => b.status === 'Draft').length;
  const readCount = broadcasts.filter(b => b.read).length;
  const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 100;
  const ackRequiredCount = broadcasts.filter(b => b.requireAcknowledgement).length;
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  const RECIPIENT_ROLES = [
    'Everyone',
    'HR Team',
    'Recruiters',
    'Store Managers',
    'Interview Panel',
    'Employees',
    'Admins'
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
          {/* Header Bar */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#1E2D4E] tracking-tight flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-[#C9952A]" />
                <span>Enterprise Broadcast &amp; Notification Control Desk</span>
              </h2>
              <p className="text-xs text-[#666666] font-medium mt-0.5">Commercial-grade role-based messaging, real-time alerts &amp; read acknowledgements (Messaging-Only).</p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { key: 'dashboard', label: 'Analytics Dashboard' },
                { key: 'create', label: '+ Create Broadcast' },
                { key: 'history', label: 'Broadcast History' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs
                    ${activeTab === t.key ? 'bg-[#1E2D4E] text-white shadow-md' : 'bg-white border border-[#e2dfd7] text-[#1E2D4E] hover:bg-[#F9F7F4]'}
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Broadcasts" value={total} trend={`${activeCount} Active`} color="navy" icon={Megaphone} />
                <MetricCard title="Active & Sent" value={activeCount} trend="Real-Time Active" color="emerald" icon={CheckCircle2} />
                <MetricCard title="Scheduled" value={scheduledCount} trend="Pending Auto-Dispatch" color="gold" icon={Clock} />
                <MetricCard title="Read Engagement" value={`${readPercent}%`} trend={`${readCount} Read`} color="teal" icon={Eye} />
              </div>

              {/* Recent Activity Table */}
              <div className="card-glass p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                  <h3 className="font-extrabold text-[#1E2D4E] text-base">Active Broadcast Announcements</h3>
                  <span className="text-xs font-bold text-[#777777] font-mono">{broadcasts.length} Broadcast Logs</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[#777777] font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 text-center w-12">SL.NO</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Title &amp; Subject</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Audience</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Acks</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]">
                      {broadcasts.map((b, idx) => (
                        <tr key={b.id} className="hover:bg-[#F9F7F4] transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-[#666666]">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                              b.priority === 'critical' ? 'bg-rose-100 text-rose-800' :
                              b.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {b.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-[#1E2D4E]">{b.title}</div>
                            <div className="text-[10.5px] text-[#777777]">{b.subject || b.message.slice(0, 45)}</div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#1E2D4E]">{b.category}</td>
                          <td className="py-3 px-3 font-bold text-[#C9952A]">{b.targetRole || 'Everyone'}</td>
                          <td className="py-3 px-3 font-extrabold text-emerald-700">{b.status || 'Sent'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-[#1E2D4E]">{b.acknowledgedBy?.length || 0}</td>
                          <td className="py-3 px-3 text-right">
                            {isAdmin && (
                            <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CREATE BROADCAST TAB */}
          {activeTab === 'create' && (
            <div className="card-glass p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-[#e2dfd7] pb-3 flex items-center gap-2">
                <Send className="w-5 h-5 text-[#C9952A]" />
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-base">Create Enterprise Broadcast Notice</h3>
                  <p className="text-xs text-[#777777]">Dispatch text messages, announcements &amp; alerts (Pure messaging-only, no attachments).</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Title & Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Broadcast Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Q3 Sales Requisition Notice"
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Subject / Header</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Urgent Store Operations Update"
                      className="input-modern"
                    />
                  </div>
                </div>

                {/* Priority & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Priority Level</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="critical">Critical Emergency</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Broadcast Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="General">General Announcement</option>
                      <option value="HR">HR &amp; Operations</option>
                      <option value="Recruitment">Recruitment &amp; Openings</option>
                      <option value="Interview">Interview Panel Alert</option>
                      <option value="Offer">Offer Release</option>
                      <option value="Joining">Joining &amp; Onboarding</option>
                      <option value="Payroll">Payroll Notice</option>
                      <option value="System">System Maintenance</option>
                      <option value="Emergency">Emergency Alert</option>
                    </select>
                  </div>
                </div>

                {/* Recipient Role Selection */}
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-2">Target Audience / Recipient Groups *</label>
                  <div className="flex flex-wrap gap-2">
                    {RECIPIENT_ROLES.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleToggleRole(r)}
                        className={`
                          px-3.5 py-2 rounded-xl border text-xs font-bold transition-all
                          ${targetRoles.includes(r) ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-[#F9F7F4] border-[#e2dfd7] text-[#1E2D4E] hover:bg-white'}
                        `}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates & Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Schedule Dispatch Date &amp; Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1E2D4E] mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="input-modern"
                    />
                  </div>
                </div>

                {/* Messaging Content */}
                <div>
                  <label className="block font-bold text-[#1E2D4E] mb-1">Broadcast Message Body * (Text Only)</label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter message text content..."
                    className="textarea-modern font-medium"
                  />
                  <span className="text-[10.5px] text-[#888888] font-semibold block mt-1">Note: Pure text messaging module. File attachments and media sharing are strictly disabled.</span>
                </div>

                {/* Options Checkboxes */}
                <div className="p-4 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#1E2D4E]">
                    <input
                      type="checkbox"
                      checked={pinNotification}
                      onChange={(e) => setPinNotification(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#1E2D4E]"
                    />
                    <span>Pin Announcement to Top of User Notification Drawer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#1E2D4E]">
                    <input
                      type="checkbox"
                      checked={requireAck}
                      onChange={(e) => setRequireAck(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#1E2D4E]"
                    />
                    <span>Require Mandatory "I Have Read" Acknowledgement Click</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2dfd7]">
                  <button
                    type="button"
                    onClick={() => handleDispatch(true)}
                    className="px-4 py-2.5 rounded-xl border border-[#e2dfd7] font-bold text-xs bg-white hover:bg-[#F9F7F4]"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispatch(false)}
                    className="btn-gold text-xs shadow-md flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Dispatch Real-Time Broadcast</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="card-glass p-6 space-y-4">
              <h3 className="font-extrabold text-[#1E2D4E] text-base border-b border-[#e2dfd7] pb-3">Complete Broadcast Audit &amp; History Log</h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {broadcasts.map((b) => (
                  <div key={b.id} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#1E2D4E]">{b.title}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#1E2D4E]/10 text-[#1E2D4E]">
                          {b.targetRole || 'Everyone'}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-[#777777] font-mono">{new Date(b.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-[#555555] font-medium leading-relaxed">{b.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-[#888888] pt-1 border-t border-[#e2dfd7]/50 font-semibold">
                      <span>Sender: <strong className="text-[#1E2D4E]">{b.senderName || 'HR Desk'}</strong></span>
                      <span>Read Acknowledgements: <strong className="text-emerald-700 font-mono">{b.acknowledgedBy?.length || 0} Users</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
