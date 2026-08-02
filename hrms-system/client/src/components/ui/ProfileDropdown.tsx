import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Settings, Volume2, VolumeX, Moon, Sun, Command, LogOut, ShieldCheck, ChevronDown, Activity } from 'lucide-react';
import { Auth, UserSession } from '../../services/api';
import { NotificationService } from '../../services/notificationService';

interface ProfileDropdownProps {
  session: UserSession | null;
  onOpenNotifications: () => void;
  onOpenActivity: () => void;
  onOpenSearch: () => void;
}

export default function ProfileDropdown({
  session,
  onOpenNotifications,
  onOpenActivity,
  onOpenSearch
}: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(NotificationService.isSoundEnabled());

  const role = session?.role || 'HR';
  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  const handleToggleSound = () => {
    const next = NotificationService.toggleSound();
    setSoundEnabled(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#1E2D4E]/5 border border-transparent hover:border-[#e2dfd7] transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="font-extrabold text-xs text-[#1E2D4E] leading-tight truncate max-w-[110px]">
            {session?.fullName || 'User'}
          </div>
          <div className="text-[9.5px] text-[#C9952A] font-bold uppercase tracking-wider">
            {role}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-[#e2dfd7] z-50 p-2 text-xs font-bold animate-fade-in space-y-1">
            <div className="p-3 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] mb-1">
              <div className="font-black text-[#1E2D4E]">{session?.fullName || 'User Session'}</div>
              <div className="text-[10px] text-[#777777] font-mono mt-0.5">{session?.username}</div>
            </div>

            <button
              onClick={() => { setOpen(false); onOpenNotifications(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#1E2D4E] hover:bg-[#F9F7F4]"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C9952A]" />
                <span>Notifications</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                {NotificationService.getUnreadCount()}
              </span>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenActivity(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#1E2D4E] hover:bg-[#F9F7F4]"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Live Activity</span>
              </div>
            </button>

            <button
              onClick={() => { setOpen(false); onOpenSearch(); }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#1E2D4E] hover:bg-[#F9F7F4]"
            >
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4 text-indigo-600" />
                <span>Global Search</span>
              </div>
              <span className="font-mono text-[9px] text-[#777777] bg-white border px-1.5 py-0.5 rounded">Ctrl+K</span>
            </button>

            <button
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between p-2 rounded-xl text-[#1E2D4E] hover:bg-[#F9F7F4]"
            >
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-[#888888]" />}
                <span>Audio Alerts</span>
              </div>
              <span className="text-[10px] text-[#777777]">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {session?.role === 'Admin' || session?.role === 'Super Admin' ? (
              <button
                onClick={() => { setOpen(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-[#1E2D4E] hover:bg-[#F9F7F4]"
              >
                <Settings className="w-4 h-4 text-amber-600" />
                <span>System Governance</span>
              </button>
            ) : null}

            <div className="pt-1 border-t border-[#e2dfd7]">
              <button
                onClick={() => Auth.logout()}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-rose-700 hover:bg-rose-50 font-black"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
