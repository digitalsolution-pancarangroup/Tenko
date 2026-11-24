import React from 'react';

interface TenkoLogoProps {
  className?: string;
  variant?: 'light' | 'dark' | 'white'; // dark: dark navy text (for light bg), white: white text (for dark bg)
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const TenkoLogo: React.FC<TenkoLogoProps> = ({
  className = '',
  variant = 'dark',
  size = 'md',
}) => {
  const heightClass = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16',
  }[size];

  const variantClass =
    variant === 'white' || variant === 'light' ? 'brightness-0 invert' : '';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="/assets/aistudio/tenko_logo_82c51c3e.png"
        alt="TENKO"
        className={`${heightClass} w-auto max-w-full object-contain ${variantClass}`}
        draggable={false}
      />
    </div>
  );
};
