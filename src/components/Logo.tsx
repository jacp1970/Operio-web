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
}) => {
  const sizeConfig = {
    sm: {
      imgHeight: 'h-7 sm:h-8',
      subtitle: 'text-[10px]',
      gap: 'gap-1.5',
    },
    md: {
      imgHeight: 'h-9 sm:h-11',
      subtitle: 'text-[11px]',
      gap: 'gap-2',
    },
    lg: {
      imgHeight: 'h-12 sm:h-14',
      subtitle: 'text-xs',
      gap: 'gap-2.5',
    },
    xl: {
      imgHeight: 'h-16 sm:h-20',
      subtitle: 'text-sm',
      gap: 'gap-3',
    },
  }[size];

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className={`flex items-center ${sizeConfig.gap}`}>
        <img
          src="/assets/aistudio/OTERIOlogo_549a0e32.jpg"
          alt="Oterio - Gestión del Trabajo"
          className={`${sizeConfig.imgHeight} w-auto object-contain max-w-full mix-blend-multiply transition-transform duration-200 hover:scale-[1.02]`}
          loading="eager"
          referrerPolicy="no-referrer"
        />
      </div>

      {showSubtitle && (
        <span
          className={`font-medium text-graphite-600 tracking-tight mt-1.5 pl-0.5 ${sizeConfig.subtitle}`}
        >
          Control de Partes de Trabajo
        </span>
      )}
    </div>
  );
};
