import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {title && (
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          {title}
        </span>
      )}
      
      {/* Phone Hardware Mockup */}
      <div className="relative w-[340px] h-[700px] sm:w-[355px] sm:h-[730px] bg-white rounded-[48px] p-3 shadow-2xl ring-1 ring-black/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-300">
        {/* Dynamic Island / Top Camera Speaker Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900/10 rounded-full z-30 pointer-events-none flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800/40 ml-5" />
        </div>

        {/* Inner Screen Display */}
        <div className="w-full h-full rounded-[38px] overflow-hidden relative bg-[#F8F9FD] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};
