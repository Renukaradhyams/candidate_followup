import React, { useState, useEffect } from 'react';
import { Menu, Bell, Clock, ChevronRight, ShieldCheck } from 'lucide-react';
import { UserSession } from '../services/api';

interface TopbarProps {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  session: UserSession | null;
  onMenuClick: () => void;
  rightElement?: React.ReactNode;
}

export default function Topbar({ title, breadcrumbs, session, onMenuClick, rightElement }: TopbarProps) {
  const [clock, setClock] = useState<string>('');

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
    return () => clearInterval(interval);
  }, []);

  return (
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

      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-[#555555] bg-[#F9F7F4] px-3 py-1.5 rounded-xl border border-[#e2dfd7] font-mono shadow-xs">
          <Clock className="w-3.5 h-3.5 text-[#C9952A]" />
          <span className="font-semibold">{clock}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Sync</span>
        </div>

        <button className="relative p-2 rounded-xl text-[#1E2D4E] hover:bg-[#1E2D4E]/5 border border-transparent hover:border-[#e2dfd7] transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {rightElement}
      </div>
    </header>
  );
}
