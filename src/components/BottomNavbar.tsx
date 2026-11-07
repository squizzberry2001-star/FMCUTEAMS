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

  // Hitung indeks tab aktif untuk pergerakan lens glass pill (0, 1, 2, 3)
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));

  return (
    <div className="fixed bottom-3.5 sm:bottom-4 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-40 transition-all duration-300">
      {/* Floating iPhone Glass Dock */}
      <div
        className={`w-full rounded-[36px] flex items-center p-1.5 pointer-events-auto transform-gpu transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] origin-bottom relative overflow-hidden select-none ${
          isScrolled ? 'iphone-glass-dock-scrolled scale-[0.96]' : 'iphone-glass-dock scale-100'
        }`}
      >
        {/* Top Prismatic Hairline Reflection (Apple iPhone Glass Specular) */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />

        {/* Ambient bottom light refraction rim */}
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80" />

        {/* 
          SLIDING ACTIVE GLASS LENS PILL (100% Mirip Glass iPhone)
          Lens kaca meluncur dengan spring physics overshoot khas Apple
        */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-[26px] iphone-glass-pill pointer-events-none transition-transform duration-400 ease-[cubic-bezier(0.175,0.885,0.32,1.14)] z-0"
          style={{
            width: 'calc((100% - 12px) / 4)',
            transform: `translateX(calc(${activeIndex} * 100%))`,
            left: '6px',
          }}
        >
          {/* Inner specular gloss highlight inside the moving pill */}
          <div className="pointer-events-none absolute inset-x-3 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
          <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-gradient-to-b from-white/40 via-transparent to-white/10" />
        </div>

        {/* Tab Items Buttons */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              className="relative z-10 flex-1 py-2 sm:py-2.5 px-1.5 rounded-[26px] flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-90 group cursor-pointer focus:outline-none"
            >
              {/* Icon Container dengan Micro-Spring Damping */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    isActive
                      ? 'scale-115 text-teal-600 stroke-[2.4] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(20,184,166,0.35)]'
                      : 'scale-100 stroke-[1.9] text-slate-400 group-hover:text-slate-600 group-hover:scale-105'
                  }`}
                />
              </div>

              {/* Label Typography */}
              <span
                className={`text-[10px] tracking-tight leading-none transition-all duration-200 ${
                  isActive
                    ? 'text-slate-900 font-black scale-[1.03]'
                    : 'text-slate-400 font-semibold group-hover:text-slate-600'
                }`}
              >
                {item.label}
              </span>

              {/* Glowing Ambient Dot Indicator */}
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
