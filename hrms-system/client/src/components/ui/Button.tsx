import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: 'bg-[#1E2D4E] text-white hover:bg-[#162340] active:scale-[0.99] border-transparent shadow-sm',
    secondary: 'bg-[#C9952A] text-white hover:bg-[#B8860B] active:scale-[0.99] border-transparent shadow-sm',
    outline: 'bg-white text-[#1E2D4E] border-[#e0ddd8] hover:bg-black/5',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.99] border-transparent shadow-sm',
    success: 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.99] border-transparent shadow-sm',
    warning: 'bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.99] border-transparent shadow-sm',
    ghost: 'bg-transparent text-[#1E2D4E] hover:bg-black/5 border-transparent'
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] rounded-md font-bold',
    md: 'px-4 py-2 text-xs rounded-xl font-bold',
    lg: 'px-6 py-3 text-sm rounded-xl font-bold'
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-1.5 border transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}
