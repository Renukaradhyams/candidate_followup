"use client";

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg'
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthMap = {
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative w-full ${widthMap[width]} bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1E2D4E] p-5 text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base leading-tight">{title}</h3>
            {subtitle && <div className="text-[11px] text-white/60 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">{children}</div>

        {footer && <div className="p-4 border-t border-[#e0ddd8] bg-[#F9F7F4]">{footer}</div>}
      </div>
    </div>
  );
}
