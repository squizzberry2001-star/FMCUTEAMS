import React from 'react';
import { X } from 'lucide-react';

interface AdminMobileSheetProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  primaryLabel?: string;
  children: React.ReactNode;
}

/**
 * Reusable minimalist mobile bottom-sheet for filters & secondary actions.
 * Keeps mobile toolbars strictly 1 single slim row with ZERO stacked buttons.
 */
export const AdminMobileSheet: React.FC<AdminMobileSheetProps> = ({
  isOpen,
  title,
  onClose,
  onReset,
  hasActiveFilters,
  primaryLabel = 'Terapkan',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex items-end">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-h-[82dvh] bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl flex flex-col admin-sheet-up overflow-hidden">
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mt-2.5 mb-1 shrink-0" />
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <div className="flex items-center gap-2">
            {onReset && hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs font-semibold text-rose-600 px-2 py-1 rounded-md hover:bg-rose-50 cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">{children}</div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer active:scale-[0.99] transition"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
