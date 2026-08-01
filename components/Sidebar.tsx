"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Auth, UserSession } from '../services/api';
import { 
  BarChart3, 
  Users, 
  Target, 
  FileText, 
  PartyPopper, 
  LogOut, 
  ClipboardList, 
  Settings, 
  DoorOpen,
  UserCheck,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const role = session?.role || 'HR';

  const roleNavMap: Record<string, string[]> = {
    'Super Admin': ['dashboard', 'candidates', 'interview', 'offer', 'onboarding', 'employees', 'exit', 'form', 'settings'],
    'Admin':       ['dashboard', 'candidates', 'interview', 'offer', 'onboarding', 'employees', 'exit', 'form', 'settings'],
    'HR':          ['dashboard', 'candidates', 'interview', 'offer', 'onboarding', 'employees', 'exit', 'form'],
    'Recruiter':   ['dashboard', 'candidates', 'interview', 'form'],
    'Interviewer': ['interview', 'candidates'],
    'Manager':     ['dashboard', 'candidates', 'interview', 'offer'],
    'Employee':    ['dashboard', 'onboarding'],
    'Guest':       ['form']
  };

  const allowed = roleNavMap[role] || roleNavMap['HR'];

  const roleLabels: Record<string, string> = {
    'Super Admin': 'Super Administrator',
    'Admin':       'Administrator',
    'HR':          'HR Specialist',
    'Recruiter':   'Recruiter',
    'Interviewer': 'Interviewer Panel',
    'Manager':     'Store Manager',
    'Employee':    'Employee',
    'Guest':       'Guest'
  };

  const navItems = [
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: BarChart3, section: 'Main' },
    { key: 'candidates', href: '/candidates', label: 'Candidates', icon: Users, section: 'Main' },
    { key: 'interview', href: '/interview-panel', label: 'Interview Panel', icon: Target, section: 'Main' },
    { key: 'offer', href: '/offer-process', label: 'Offer Process', icon: FileText, section: 'Main' },
    { key: 'onboarding', href: '/onboarding', label: 'Onboarding', icon: PartyPopper, section: 'HR Ops' },
    { key: 'employees', href: '/offer-process', label: 'Employees', icon: UserCheck, section: 'HR Ops' },
    { key: 'exit', href: '/employee-exit', label: 'Exit / FnF', icon: DoorOpen, section: 'HR Ops' },
    { key: 'form', href: '/candidate-entry', label: 'Entry Form (QR)', icon: ClipboardList, section: 'Public', target: '_blank' },
    { key: 'settings', href: '/settings', label: 'Settings', icon: Settings, section: 'Admin' }
  ];

  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 bottom-0 w-64 bg-[#1E2D4E] text-white z-50 flex flex-col transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header Logo */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center font-extrabold text-gold text-lg border border-gold/30">
            BSC
          </div>
          <div>
            <div className="font-extrabold text-sm text-white leading-tight">BSC Candidate CRM</div>
            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">The Textile Mall</div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#C9952A] text-white font-black flex items-center justify-center text-xs shadow-md">
            {initials}
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-xs text-white truncate">{session?.fullName || 'User'}</div>
            <div className="text-[10px] text-gold font-medium">{roleLabels[role] || role}</div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {['Main', 'HR Ops', 'Public', 'Admin'].map(section => {
            const items = navItems.filter(item => item.section === section && allowed.includes(item.key));
            if (items.length === 0) return null;

            return (
              <div key={section}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-3 mb-1">
                  {section}
                </div>
                <div className="space-y-1">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        target={item.target}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                          ${isActive 
                            ? 'bg-[#C9952A] text-white shadow-md' 
                            : 'text-white/70 hover:bg-white/10 hover:text-white'}
                        `}
                      >
                        <Icon className="w-4 h-4 opacity-90" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Logout */}
        <div className="p-3 border-t border-white/10 bg-[#162340]/50">
          <button
            onClick={() => Auth.logout()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
          <div className="text-[9px] text-white/30 text-center mt-2">
            BSC Enterprise HRMS v2.0
          </div>
        </div>
      </aside>
    </>
  );
}
