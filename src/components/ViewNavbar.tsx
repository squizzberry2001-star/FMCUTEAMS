import React from 'react';
import { Smartphone, Monitor, Layers, LogIn, LogOut, ExternalLink, Sparkles } from 'lucide-react';
import { User } from '../types';

export type AppViewMode = 'showcase' | 'desktop' | 'mobile' | 'login';

interface ViewNavbarProps {
  currentMode: AppViewMode;
  onSetMode: (mode: AppViewMode) => void;
  user: User | null;
  onLogout: () => void;
}

export const ViewNavbar: React.FC<ViewNavbarProps> = ({
  currentMode,
  onSetMode,
  user,
  onLogout,
}) => {
  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/70 px-4 py-2.5 sticky top-0 z-50 flex items-center justify-between gap-4">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-sm font-bold text-sm">
            F
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 text-sm tracking-tight">FMCU TEAMS</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-200">
                Vercel Ready
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Medicines Reminder • Mobile & Desktop Design Duplicate
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/50">
        <button
          onClick={() => onSetMode('showcase')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'showcase'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="View the 3 phones side-by-side as shown in the reference photo"
        >
          <Layers className="w-3.5 h-3.5 text-[#FF587A]" />
          <span className="hidden md:inline">3-Phones Showcase</span>
          <span className="md:hidden">Showcase</span>
        </button>

        <button
          onClick={() => onSetMode('desktop')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'desktop'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Full Desktop Web Dashboard"
        >
          <Monitor className="w-3.5 h-3.5 text-[#2BB3A0]" />
          <span>Desktop</span>
        </button>

        <button
          onClick={() => onSetMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'mobile'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Single Mobile Phone Device View"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#5C86FA]" />
          <span>Mobile</span>
        </button>

        <button
          onClick={() => onSetMode('login')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'login'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Login Page"
        >
          <LogIn className="w-3.5 h-3.5 text-amber-500" />
          <span>Login</span>
        </button>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2.5">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-teal-200"
            />
            <span className="text-xs font-bold text-slate-700 hidden lg:inline">{user.name}</span>
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-red-500 p-1 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSetMode('login')}
            className="px-3.5 py-1.5 rounded-full bg-[#2BB3A0] text-white text-xs font-bold shadow-sm hover:brightness-105"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
