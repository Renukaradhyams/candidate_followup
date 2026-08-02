import React, { useState, useEffect } from 'react';
import { X, Bell, Pin, CheckCheck, Trash2, Search, Volume2, VolumeX, Sparkles, AlertCircle, Info, Calendar } from 'lucide-react';
import { NotificationService, SystemNotification } from '../../services/notificationService';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'pinned' | 'broadcasts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(NotificationService.isSoundEnabled());

  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const filtered = notifications.filter(n => {
    if (activeTab === 'unread' && n.read) return false;
    if (activeTab === 'pinned' && !n.pinned) return false;
    if (activeTab === 'broadcasts' && n.category !== 'broadcast') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggleSound = () => {
    const updated = NotificationService.toggleSound();
    setSoundEnabled(updated);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">URGENT</span>;
      case 'high': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'low': return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200">LOW</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-100 text-sky-800 border border-sky-200">NORMAL</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[#1E2D4E]/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <aside className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in border-l border-[#e2dfd7]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#e2dfd7] bg-[#1E2D4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-[#C9952A] border border-white/10">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight leading-tight">Notification Center</h2>
              <p className="text-[10.5px] text-white/60 font-semibold mt-0.5">Real-time alerts &amp; broadcasts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title={soundEnabled ? 'Disable Notification Sounds' : 'Enable Notification Sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="p-3 bg-[#F9F7F4] border-b border-[#e2dfd7] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-white text-xs text-[#1E2D4E] font-semibold focus:outline-none focus:border-[#1E2D4E]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between text-xs font-bold pt-1">
            <div className="flex items-center gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: `Unread (${NotificationService.getUnreadCount()})` },
                { key: 'pinned', label: 'Pinned' },
                { key: 'broadcasts', label: 'Broadcasts' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    px-2.5 py-1 rounded-lg text-[11px] transition-all
                    ${activeTab === t.key ? 'bg-[#1E2D4E] text-white font-extrabold' : 'text-[#666666] hover:bg-[#e2dfd7]/50'}
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => NotificationService.markAllAsRead()}
              className="text-[10.5px] text-[#C9952A] font-extrabold hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length > 0 ? (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`
                  p-3.5 rounded-2xl border transition-all duration-150 relative space-y-2 group
                  ${!n.read ? 'bg-sky-50/60 border-sky-200 shadow-xs' : 'bg-white border-[#e2dfd7]'}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />}
                    <h3 className="font-extrabold text-xs text-[#1E2D4E] leading-tight">{n.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {getPriorityBadge(n.priority)}
                    <button
                      onClick={() => NotificationService.togglePin(n.id)}
                      className={`p-1 rounded hover:bg-black/5 ${n.pinned ? 'text-[#C9952A]' : 'text-[#aaaaaa]'}`}
                      title="Pin notification"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => NotificationService.deleteNotification(n.id)}
                      className="p-1 rounded text-[#aaaaaa] hover:text-rose-600 hover:bg-rose-50"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#555555] font-medium leading-relaxed">{n.message}</p>

                <div className="flex items-center justify-between text-[10px] text-[#888888] font-semibold pt-1 border-t border-[#e2dfd7]/40">
                  <span className="font-mono">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!n.read && (
                    <button
                      onClick={() => NotificationService.markAsRead(n.id)}
                      className="text-[#1E2D4E] font-extrabold hover:underline"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#F9F7F4] border border-[#e2dfd7] flex items-center justify-center mx-auto text-[#777777]">
                <Bell className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="text-xs font-extrabold text-[#1E2D4E]">No Notifications</div>
              <p className="text-[11px] text-[#888888] max-w-xs mx-auto">You're all caught up! New broadcasts and activity alerts will appear here.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
