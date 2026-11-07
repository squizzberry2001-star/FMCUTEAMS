import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Code2,
  Cpu,
  Building2,
  Layers,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface DeveloperFooterProps {
  className?: string;
}

export const DeveloperFooter: React.FC<DeveloperFooterProps> = ({
  className = 'mt-auto pt-8 pb-4 text-center',
}) => {
  const [open, setOpen] = useState(false);

  const modalContent = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[9950] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 text-left space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Developer Header Profile */}
            <div className="flex flex-col items-center text-center pt-1 pb-3 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-500 to-blue-600 p-[2px] shadow-md mb-2.5">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white font-black text-base tracking-wider">
                  ABP
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/70 text-[9px] font-extrabold uppercase tracking-wider mb-1">
                <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                <span>Creator & Architect</span>
              </span>

              <h3 className="text-base font-black text-slate-900 tracking-tight">
                AAN BAGUS PERMANA
              </h3>
              <p className="text-[11px] font-bold text-teal-700 mt-0.5">
                Web Application Developer &amp; System Architect
              </p>
            </div>

            {/* System & Architecture Details */}
            <div className="space-y-2.5 text-xs">
              {/* 1. Nama Sistem */}
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Nama Sistem
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug">
                    FMCU TEAMS Web Application
                  </span>
                  <span className="block text-[10px] text-slate-500 font-medium">
                    Field Management, Audit QSC/OPI &amp; Schedule Operational System
                  </span>
                </div>
              </div>

              {/* 2. Institusi */}
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Institusi / Divisi
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug">
                    FMCU Division — FamilyMart Indonesia
                  </span>
                  <span className="block text-[10px] text-slate-500 font-medium">
                    Operational &amp; Store Quality Control Management
                  </span>
                </div>
              </div>

              {/* 3. Bahasa Pemrograman */}
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Bahasa Pemrograman
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug">
                    TypeScript (TSX), JavaScript (ES2022 &amp; Google Apps Script), HTML5, CSS3
                  </span>
                </div>
              </div>

              {/* 4. Tech Stack */}
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Tech Stack &amp; Infrastruktur
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'React 18',
                      'Vite 6',
                      'Tailwind CSS',
                      'PWA Service Worker',
                      'Google Apps Script API',
                      'Google Drive Cloud',
                      'IndexedDB',
                      'WebRTC & Geolocation API',
                    ].map((stack) => (
                      <span
                        key={stack}
                        className="px-2 py-0.5 rounded-lg bg-white border border-slate-200/90 text-[10px] font-bold text-slate-700 shadow-2xs"
                      >
                        {stack}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="pt-1 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Verified System Build</span>
              </span>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition active:scale-95 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <footer className={className}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 text-[10px] font-light text-slate-400/90 hover:text-teal-600 tracking-widest transition-colors cursor-pointer py-1 px-2 rounded-full"
        >
          <Code2 className="w-3 h-3 opacity-70" />
          <span>Pengembang Web</span>
        </button>
      </footer>
      {modalContent}
    </>
  );
};
