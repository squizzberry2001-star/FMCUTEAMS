import React from 'react';
import { LayoutGrid, CalendarDays, ClipboardList, User as UserIcon } from 'lucide-react';

export type NavTabType = 'home' | 'calendar' | 'history' | 'profile';

interface BottomNavbarProps {
  activeTab: NavTabType;
  onSelectTab: (tab: NavTabType) => void;
  isScrolled?: boolean;
  onResetScale?: () => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  activeTab,
  onSelectTab,
  isScrolled = false,
  onResetScale,
}) => {
  const handleTabClick = (tab: NavTabType) => {
    if (onResetScale) {
      onResetScale();
    }
    onSelectTab(tab);
  };

  const navItems: { id: NavTabType; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Schedule', icon: LayoutGrid },
    { id: 'calendar', label: 'Kalender', icon: CalendarDays },
    { id: 'history', label: 'Coverage', icon: ClipboardList },
    { id: 'profile', label: 'Akun', icon: UserIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto px-5 pb-5 pt-2 bg-gradient-to-t from-[#F8F9FD] via-[#F8F9FD]/95 to-transparent pointer-events-none z-30">
      <div
        className={`w-full bg-white/95 backdrop-blur-md rounded-[32px] shadow-dock flex items-center justify-between border border-white/80 pointer-events-auto transform-gpu transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) origin-bottom ${
          isScrolled
            ? 'scale-[0.92] py-2.5 px-5 shadow-lg bg-white/98 border-slate-200/60'
            : 'scale-100 py-3 px-6 shadow-dock'
        }`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center gap-1 p-1.5 transition-all relative ${
                isActive
                  ? 'text-[#3E74FF] scale-105'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-[#3E74FF]' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#3E74FF] absolute -bottom-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
