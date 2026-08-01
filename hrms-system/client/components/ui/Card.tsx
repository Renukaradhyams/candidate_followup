"use client";

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export default function Card({ children, className = '', title, subtitle, headerAction }: CardProps) {
  return (
    <div className={`card-glass p-5 space-y-4 ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#e0ddd8]/60 pb-3">
          <div>
            {title && <h3 className="font-extrabold text-[#1E2D4E] text-sm leading-tight">{title}</h3>}
            {subtitle && <p className="text-[11px] text-[#888888] mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
