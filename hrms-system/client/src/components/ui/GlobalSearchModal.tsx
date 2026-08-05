import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, UserCheck, Briefcase, FileText, Settings, ArrowRight } from 'lucide-react';
import { API } from '../../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; title: string; subtitle: string; href: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase();
        const resList: { type: string; title: string; subtitle: string; href: string }[] = [];

        // Search Candidates
        const candRes = await API.getCandidates({ q: query, limit: 10 });
        if (candRes && candRes.candidates) {
          candRes.candidates.forEach((c: any) => {
            const formattedName = c.name ? c.name.toLowerCase().replace(/\b\w/g, (char: string) => char.toUpperCase()) : '';
            resList.push({
              type: 'Candidate',
              title: formattedName,
              subtitle: `${c.appNo} · ${c.desig} · ${c.status}`,
              href: `/candidates?search=${c.appNo}`
            });
          });
        }

        // Search Employees
        const empRes = await API.getEmployees();
        if (empRes && empRes.employees) {
          empRes.employees.filter((e: any) => 
            (e.name && e.name.toLowerCase().includes(q)) || 
            (e.appNo && e.appNo.toLowerCase().includes(q)) ||
            (e.phone && e.phone.includes(q))
          ).slice(0, 5).forEach((e: any) => {
            const formattedName = e.name ? e.name.toLowerCase().replace(/\b\w/g, (char: string) => char.toUpperCase()) : '';
            resList.push({
              type: 'Employee',
              title: formattedName,
              subtitle: `${e.appNo} · ${e.desig} · Active Staff`,
              href: `/employees`
            });
          });
        }

        // Static Quick Pages
        if ('dashboard'.includes(q)) resList.push({ type: 'Page', title: 'Dashboard Analytics', subtitle: 'Executive Overview', href: '/dashboard' });
        if ('interview'.includes(q)) resList.push({ type: 'Page', title: 'Interview Evaluation Panel', subtitle: 'Round 1 & Round 2 Scoring', href: '/interview-panel' });
        if ('openings'.includes(q) || 'manpower'.includes(q)) resList.push({ type: 'Page', title: 'Manpower Openings', subtitle: 'Role Requisitions', href: '/openings' });
        if ('broadcast'.includes(q) || 'announcement'.includes(q)) resList.push({ type: 'Page', title: 'Broadcast Center', subtitle: 'System Notifications & Broadcasts', href: '/broadcast-center' });

        setResults(resList);
      } catch (e) {} finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e2dfd7] animate-fade-in">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-[#e2dfd7] flex items-center gap-3 bg-[#F9F7F4]">
          <Search className="w-5 h-5 text-[#C9952A]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search candidates, employees, openings, modules... (ESC to exit)"
            className="w-full text-sm font-semibold bg-transparent text-[#1E2D4E] focus:outline-none placeholder-[#888888]"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-[#888888] hover:text-[#1E2D4E]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-1 text-xs">
          {loading && (
            <div className="p-6 text-center text-[#777777] font-semibold flex items-center justify-center gap-2">
              <span className="spinner" />
              <span>Searching enterprise directory...</span>
            </div>
          )}

          {!loading && results.length > 0 && (
            results.map((r, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onClose();
                  navigate(r.href);
                }}
                className="w-full p-3 rounded-2xl flex items-center justify-between gap-3 hover:bg-[#F9F7F4] text-left transition-colors font-medium border border-transparent hover:border-[#e2dfd7]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#1E2D4E]/10 text-[#1E2D4E]">
                      {r.type}
                    </span>
                    <span className="font-extrabold text-[#1E2D4E]">{r.title}</span>
                  </div>
                  <div className="text-[11px] text-[#777777] mt-0.5">{r.subtitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#888888]" />
              </button>
            ))
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-[#777777] font-semibold">
              No matching candidate or system records found for "{query}".
            </div>
          )}

          {!query.trim() && (
            <div className="p-6 text-center text-[#777777] font-semibold text-xs space-y-2">
              <div>Quick Search Shortcuts</div>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-[#F9F7F4] border font-mono">Ctrl + K</span>
                <span className="px-2.5 py-1 rounded-xl bg-[#F9F7F4] border font-mono">Candidate Names</span>
                <span className="px-2.5 py-1 rounded-xl bg-[#F9F7F4] border font-mono">Application Numbers</span>
                <span className="px-2.5 py-1 rounded-xl bg-[#F9F7F4] border font-mono">Phone Numbers</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
