import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Calendar, Send, UserCheck, Briefcase, FileText, X } from 'lucide-react';

export default function QuickActionCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions = [
    { label: 'Register Candidate', icon: UserPlus, href: '/candidate-entry', target: '_blank', color: 'bg-[#1E2D4E]' },
    { label: 'Schedule Interview', icon: Calendar, href: '/interview-panel', color: 'bg-indigo-600' },
    { label: 'Broadcast Notification', icon: Send, href: '/broadcast-center', color: 'bg-[#C9952A]' },
    { label: 'Employee Directory', icon: UserCheck, href: '/employees', color: 'bg-[#1a8a84]' },
    { label: 'Manpower Openings', icon: Briefcase, href: '/openings', color: 'bg-amber-600' },
    { label: 'Offer Desk', icon: FileText, href: '/offer-process', color: 'bg-emerald-700' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Speed Dial Menu */}
      {open && (
        <div className="mb-3 space-y-2 animate-fade-in">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  setOpen(false);
                  if (act.target) {
                    window.open(act.href, act.target);
                  } else {
                    navigate(act.href);
                  }
                }}
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] shadow-xl hover:shadow-2xl transition-all duration-150 group text-left"
              >
                <span className="text-xs font-bold text-[#1E2D4E] whitespace-nowrap group-hover:text-[#C9952A]">
                  {act.label}
                </span>
                <div className={`p-2 rounded-lg text-white ${act.color} shadow-xs group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-13 h-13 rounded-2xl bg-[#1E2D4E] text-white flex items-center justify-center shadow-2xl border border-white/20 transition-all duration-200 hover:scale-105 active:scale-95
          ${open ? 'rotate-45 bg-rose-600' : 'bg-[#1E2D4E]'}
        `}
        title="Quick Action Center"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}
