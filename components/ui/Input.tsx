"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export default function Input({
  label,
  error,
  helperText,
  isRequired = false,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1 w-full text-xs">
      {label && (
        <label htmlFor={inputId} className="block text-[10px] font-extrabold uppercase text-[#777777] tracking-wider">
          {label} {isRequired && <span className="text-red-600">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border bg-[#F9F7F4] text-[#1E2D4E] font-medium transition-colors
          focus:outline-none focus:border-[#1E2D4E] focus:bg-white
          ${error ? 'border-red-500 bg-red-50/50' : 'border-[#e0ddd8]'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-red-600 font-semibold">{error}</p>}
      {helperText && !error && <p className="text-[10px] text-[#888888]">{helperText}</p>}
    </div>
  );
}
