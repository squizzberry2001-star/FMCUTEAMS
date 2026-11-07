import React from 'react';

interface PageTransitionLoaderProps {
  visible?: boolean;
  label?: string;
}

const FMCU_BOUNCE_CHARS = ['F', 'M', 'C', 'U', '.', '.', '.', '.', '.'];

export const PageTransitionLoader: React.FC<PageTransitionLoaderProps> = ({
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[80] pointer-events-none select-none flex items-center justify-center overflow-hidden animate-in fade-in duration-150"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Underlying Page Silhouette Layer (Siluet Halaman Sedang Dimuat) */}
      <div className="absolute inset-0 max-w-xl mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top,24px))] space-y-4 opacity-45">
        {/* Top Header Silhouette */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-full bg-slate-300/60 animate-pulse" />
          <div className="space-y-1.5 flex flex-col items-center">
            <div className="w-24 h-2.5 rounded-full bg-teal-300/50 animate-pulse" />
            <div className="w-36 h-4 rounded-full bg-slate-300/70 animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-300/60 animate-pulse" />
        </div>

        {/* Hero Banner Silhouette */}
        <div className="w-full h-28 rounded-3xl bg-slate-300/50 animate-pulse" />

        {/* Content Cards Silhouette */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
        <div className="w-full h-44 rounded-3xl bg-slate-200/65 animate-pulse" />
        <div className="w-full h-32 rounded-3xl bg-slate-200/55 animate-pulse" />
      </div>

      {/* Blur Background Frosted Layer over the Page Silhouette */}
      <div className="absolute inset-0 bg-[#F8F9FD]/55 backdrop-blur-md" />

      {/* Center Mini Bouncing Text "FMCU....." */}
      <div className="relative z-10 px-4 py-2 rounded-full bg-white/80 backdrop-blur-xl border border-white/90 shadow-lg flex items-center justify-center">
        <div className="flex items-baseline font-black text-[12px] tracking-[0.14em] text-slate-900">
          {FMCU_BOUNCE_CHARS.map((char, idx) => (
            <span
              key={idx}
              className="animate-fmcu-char"
              style={{
                animationDelay: `${idx * 85}ms`,
              }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
