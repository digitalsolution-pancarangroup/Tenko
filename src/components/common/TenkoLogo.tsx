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
  showText = true,
}) => {
  const sizeStyles = {
    sm: { height: 28, iconSize: 26, textClass: 'text-xl' },
    md: { height: 38, iconSize: 36, textClass: 'text-2xl' },
    lg: { height: 50, iconSize: 48, textClass: 'text-3xl' },
    xl: { height: 64, iconSize: 62, textClass: 'text-4xl' },
  }[size];

  const textColor =
    variant === 'white' ? 'text-white' : variant === 'light' ? 'text-slate-100' : 'text-[#0A194E]';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Precision Geometric Medical Cross SVG */}
      <svg
        width={sizeStyles.iconSize}
        height={sizeStyles.iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200"
      >
        <defs>
          <linearGradient id="tenko-grad-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0072CE" />
            <stop offset="100%" stopColor="#00AEEF" />
          </linearGradient>
          <linearGradient id="tenko-grad-bottom" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0099E5" />
            <stop offset="100%" stopColor="#00B4D8" />
          </linearGradient>
          <linearGradient id="tenko-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0052B4" />
            <stop offset="100%" stopColor="#008FD5" />
          </linearGradient>
          <linearGradient id="tenko-grad-right" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0077B6" />
            <stop offset="100%" stopColor="#00B4D8" />
          </linearGradient>
        </defs>

        {/* Top Arm Bracket */}
        <path
          d="M26 36V6H60V22H42V36H26Z"
          fill="url(#tenko-grad-top)"
        />

        {/* Right Arm Bracket */}
        <path
          d="M64 26H94V60H78V42H64V26Z"
          fill="url(#tenko-grad-right)"
        />

        {/* Bottom Arm Bracket */}
        <path
          d="M74 64V94H40V78H58V64H74Z"
          fill="url(#tenko-grad-bottom)"
        />

        {/* Left Arm Bracket */}
        <path
          d="M36 74H6V40H22V58H36V74Z"
          fill="url(#tenko-grad-left)"
        />
      </svg>

      {/* Tenko Wordmark Typography */}
      {showText && (
        <span
          className={`font-black tracking-[-0.03em] leading-none ${sizeStyles.textClass} ${textColor}`}
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          tenko
        </span>
      )}
    </div>
  );
};
