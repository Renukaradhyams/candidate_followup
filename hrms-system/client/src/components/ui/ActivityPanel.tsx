import React, { useState, useEffect } from 'react';
import { Activity, X, Calendar, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { API } from '../../services/api';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityPanel({ isOpen, onClose }: ActivityPanelProps) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      API.getActivity({ limit: 10 }).then(res => {
        if (res && res.activity) {
          setActivities(res.activity);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-[#1E2D4E]/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <aside className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in border-l border-[#e2dfd7]">
        <div className="p-4 sm:p-5 border-b border-[#e2dfd7] bg-[#1E2D4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#C9952A]" />
            <h2 className="font-extrabold text-base tracking-tight leading-tight">Live Activity Intelligence</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* System Health */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between font-bold text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>HRMS Core Services</span>
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">Operational</span>
          </div>

          {/* Activity Feed */}
          <div>
            <h3 className="font-black text-xs text-[#1E2D4E] uppercase tracking-wider mb-2.5">Recent Activity Timeline</h3>
            <div className="space-y-2.5">
              {activities.length > 0 ? (
                activities.map((act, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-1">
                    <div className="flex items-center justify-between font-bold text-[#1E2D4E]">
                      <span className="flex items-center gap-1.5">
                        <span>{act.icon || '📋'}</span>
                        <span>{act.label || act.action_type}</span>
                      </span>
                      <span className="text-[10px] text-[#777777] font-mono">{act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    {act.remarks && <p className="text-[#555555] font-medium text-[11px]">{act.remarks}</p>}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[#888888]">No recent system activity logged.</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
