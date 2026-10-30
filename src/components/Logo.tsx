import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  variant?: 'full' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  variant = 'full',
}) => {
  // Height definitions for optimal visual balance across navigation, cards, and headers
  const sizeConfig = {
    sm: {
      imgHeight: 'h-7 sm:h-8',
      subtitle: 'text-[10px]',
      gap: 'gap-1.5',
    },
    md: {
      imgHeight: 'h-9 sm:h-10',
      subtitle: 'text-[11px]',
      gap: 'gap-2',
    },
    lg: {
      imgHeight: 'h-13 sm:h-14',
      subtitle: 'text-xs',
      gap: 'gap-2.5',
    },
    xl: {
      imgHeight: 'h-16 sm:h-20',
      subtitle: 'text-sm',
      gap: 'gap-3',
    },
  }[size];

  const logoSrc =
    variant === 'icon'
      ? '/assets/aistudio/operio_icon.png'
      : '/assets/aistudio/operio_logo_transparent.png';

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className={`flex items-center ${sizeConfig.gap}`}>
        <img
          src={logoSrc}
          alt="OPERIO"
          className={`${sizeConfig.imgHeight} w-auto object-contain max-w-full transition-transform duration-200 hover:scale-[1.02]`}
          loading="eager"
          onError={(e) => {
            // Fallback to direct original asset if needed
            (e.currentTarget as HTMLImageElement).src =
              '/assets/aistudio/1793304075553_ea6c7137.jpg';
          }}
        />
        {size === 'lg' && (
          <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest text-sky-700 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 self-center">
            PRO
          </span>
        )}
      </div>

      {showSubtitle && (
        <span
          className={`font-medium text-slate-500 tracking-tight mt-1 pl-0.5 ${sizeConfig.subtitle}`}
        >
          Control de Partes de Trabajo
        </span>
      )}
    </div>
  );
};

