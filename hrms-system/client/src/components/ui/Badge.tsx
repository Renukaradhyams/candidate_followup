import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'new' | 'shortlist' | 'interview' | 'select' | 'offer' | 'hold' | 'reject' | 'board' | 'info';
  className?: string;
}

export default function Badge({ children, variant = 'info', className = '' }: BadgeProps) {
  const variantStyles = {
    new: 'bg-[#E6F1FB] text-[#185FA5]',
    shortlist: 'bg-[#FFF7E6] text-[#B8860B]',
    interview: 'bg-[#EEEDFE] text-[#534AB7]',
    select: 'bg-[#EAF3DE] text-[#3B6D11]',
    offer: 'bg-[#E1F5FE] text-[#0288D1]',
    hold: 'bg-[#FFF3E0] text-[#E65100]',
    reject: 'bg-[#FCEBEB] text-[#A32D2D]',
    board: 'bg-[#F3E5F5] text-[#7B1FA2]',
    info: 'bg-[#F5F5F5] text-[#616161]'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold whitespace-nowrap ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
