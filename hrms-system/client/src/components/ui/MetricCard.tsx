import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'navy' | 'gold' | 'emerald' | 'teal' | 'amber' | 'indigo' | 'rose';
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendUp,
  color = 'navy',
  onClick
}: MetricCardProps) {
  const colorStyles = {
    navy: { iconBg: 'bg-[#1E2D4E]/10 text-[#1E2D4E]', border: 'border-l-4 border-l-[#1E2D4E]' },
    gold: { iconBg: 'bg-[#C9952A]/15 text-[#C9952A]', border: 'border-l-4 border-l-[#C9952A]' },
    emerald: { iconBg: 'bg-emerald-500/10 text-emerald-600', border: 'border-l-4 border-l-emerald-600' },
    teal: { iconBg: 'bg-[#1a8a84]/10 text-[#1a8a84]', border: 'border-l-4 border-l-[#1a8a84]' },
    amber: { iconBg: 'bg-amber-500/10 text-amber-600', border: 'border-l-4 border-l-amber-600' },
    indigo: { iconBg: 'bg-indigo-500/10 text-indigo-600', border: 'border-l-4 border-l-indigo-600' },
    rose: { iconBg: 'bg-rose-500/10 text-rose-600', border: 'border-l-4 border-l-rose-600' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-5 flex flex-col justify-between transition-all duration-200
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#777777] block mb-1">
            {title}
          </span>
          <div className="text-2xl lg:text-3xl font-black text-[#1E2D4E] tracking-tight">
            {value}
          </div>
        </div>

        <div className={`p-3 rounded-2xl ${style.iconBg} shadow-sm flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-[#e2dfd7]/60 flex items-center justify-between text-xs">
          {subtext && <span className="text-[#666666] font-medium">{subtext}</span>}
          {trend && (
            <span className={`font-bold flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-amber-600'}`}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
