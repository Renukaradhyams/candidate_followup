import React, { useState, useEffect } from 'react';
import { Menu, Bell, Clock, ChevronRight, Search, Activity, Command } from 'lucide-react';
import { UserSession } from '../services/api';
import { NotificationService } from '../services/notificationService';
import NotificationDrawer from './ui/NotificationDrawer';
import ActivityPanel from './ui/ActivityPanel';
import GlobalSearchModal from './ui/GlobalSearchModal';
import ProfileDropdown from './ui/ProfileDropdown';

interface TopbarProps {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({ title, breadcrumbs, session, onMenuClick, rightElement }: TopbarProps) {
  const [clock, setClock] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(
        now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) +
        ' · ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const unsub = NotificationService.subscribe(() => {
      setUnreadCount(NotificationService.getUnreadCount());
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#e2dfd7] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl text-[#1E2D4E] hover:bg-[#1E2D4E]/5 lg:hidden transition-colors border border-[#e2dfd7]"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#1E2D4E] tracking-tight leading-none">{title}</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-[#777777] font-semibold mt-1">
              <span className="text-[#1E2D4E]">BSC ATS</span>
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-[#aaaaaa]" />
                  {b.href ? (
                    <a href={b.href} className="hover:text-[#C9952A] transition-colors">{b.label}</a>
                  ) : (
                    <span className="text-[#1E2D4E] font-bold">{b.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Smart Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-semibold text-[#777777] hover:text-[#1E2D4E] hover:border-[#1E2D4E] transition-all shadow-xs"
          >
            <Search className="w-3.5 h-3.5 text-[#C9952A]" />
            <span>Search directory...</span>
            <span className="font-mono text-[9px] bg-white border border-[#e2dfd7] px-1.5 py-0.5 rounded text-[#1E2D4E] font-bold ml-1">Ctrl+K</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[#555555] bg-[#F9F7F4] px-3 py-1.5 rounded-xl border border-[#e2dfd7] font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#C9952A]" />
            <span className="font-semibold">{clock}</span>
          </div>

          {/* Activity Panel Trigger */}
          <button
            onClick={() => setActivityOpen(true)}
            className="p-2 rounded-xl text-[#1E2D4E] hover:bg-[#1E2D4E]/5 border border-transparent hover:border-[#e2dfd7] transition-all"
            title="Live Activity Intelligence"
          >
            <Activity className="w-4 h-4 text-emerald-600" />
          </button>

          {/* Notification Drawer Trigger */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-xl text-[#1E2D4E] hover:bg-[#1E2D4E]/5 border border-transparent hover:border-[#e2dfd7] transition-all"
            title="Notification Center"
          >
            <Bell className="w-4 h-4 text-[#1E2D4E]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown
            session={session}
            onOpenNotifications={() => setNotifOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />

          {rightElement}
        </div>
      </header>

      {/* Drawers & Modals */}
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <ActivityPanel isOpen={activityOpen} onClose={() => setActivityOpen(false)} />
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
