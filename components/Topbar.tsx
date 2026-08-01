"use client";

import React, { useState, useEffect } from 'react';
import { Menu, Bell, Clock } from 'lucide-react';
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
        now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#e0ddd8] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-[#1E2D4E] hover:bg-black/5 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-[#1E2D4E] leading-none">{title}</h1>
          <div className="flex items-center gap-1.5 text-[11px] text-[#888888] font-medium mt-1">
            <span>BSC CRM</span>
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={idx}>
                <span className="text-[#bbb]">›</span>
                {b.href ? (
                  <a href={b.href} className="hover:underline text-[#1E2D4E]">{b.label}</a>
                ) : (
                  <span>{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#666666] bg-[#F9F7F4] px-3 py-1.5 rounded-lg border border-[#e0ddd8] font-mono">
          <Clock className="w-3.5 h-3.5 text-[#C9952A]" />
          <span>{clock}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live</span>
        </div>

        <button className="relative p-2 rounded-lg text-[#1E2D4E] hover:bg-black/5">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600" />
        </button>

        {rightElement}
      </div>
    </header>
  );
}
