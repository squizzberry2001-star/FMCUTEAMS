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
    <div className="fixed bottom-3.5 left-0 right-0 max-w-md mx-auto px-4 pb-1 pointer-events-none z-40 transition-all duration-300">
      {/* Floating Capsule Bar - iOS 27 Liquid Frosted Glass */}
      <div
        className={`w-full rounded-[34px] flex items-center justify-between p-1.5 pointer-events-auto transform-gpu transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-bottom relative overflow-hidden select-none ${
          isScrolled ? 'ios-glass-scrolled scale-[0.96]' : 'ios-glass-bar scale-100'
        }`}
      >
        {/* Top Specular Liquid Light Sheen (iOS 27 glass reflection) */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />

        {/* Ambient bottom inner reflection */}
        <div className="pointer-events-none absolute inset-x-12 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        {/* Tab Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              className={`relative flex-1 py-2 sm:py-2.5 px-1.5 rounded-[26px] flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-90 group cursor-pointer ${
                isActive
                  ? 'bg-white/85 shadow-sm text-teal-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              {/* Icon Container with subtle spring scale on active */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isActive
                      ? 'scale-110 text-teal-600 stroke-[2.4] drop-shadow-xs'
                      : 'scale-100 stroke-[2] group-hover:scale-105'
                  }`}
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight leading-none transition-colors duration-200 ${
                  isActive ? 'text-teal-900 font-black' : 'text-slate-500 font-bold'
                }`}
              >
                {item.label}
              </span>

              {/* iOS 27 Glowing Pill Dot Indicator */}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 absolute bottom-1 shadow-[0_0_8px_rgba(20,184,166,0.9)] animate-in fade-in zoom-in-75 duration-200" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
