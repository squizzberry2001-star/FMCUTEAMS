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

  // Hitung indeks tab aktif untuk pergerakan sliding glass lens pill (0, 1, 2, 3)
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));

  return (
    <div className="fixed bottom-3.5 sm:bottom-4 left-0 right-0 mx-auto flex justify-center pointer-events-none z-40 select-none px-4">
      {/* 
        Floating iPhone Glass Dock with Optical Refraction & Visual Distortion
        Menyudut tetap center (origin-center, tidak menyusut ke bawah)
        Super smooth deliberate transition (800ms) & auto-upscale on press
      */}
      <div
        onClick={onResetScale}
        className={`flex items-center pointer-events-auto transform-gpu dock-transition origin-center relative overflow-hidden select-none ${
          isScrolled ? 'iphone-glass-dock-scrolled shadow-xl' : 'iphone-glass-dock shadow-2xl'
        }`}
      >
        {/* Top Prismatic Hairline Reflection (Apple iPhone Glass Specular) */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-50 z-0" />

        {/* Ambient bottom light refraction rim */}
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-30 z-0" />

        {/* 
          SLIDING ACTIVE GLASS LENS PILL (White Liquid Glass, No Border, +5% Transparency)
          Lens kaca putih meluncur anggun tanpa border
        */}
        <div
          className={`absolute rounded-[24px] iphone-glass-pill pointer-events-none dock-pill-transition z-0 ${
            isScrolled ? 'top-1 bottom-1' : 'top-1.5 bottom-1.5'
          }`}
          style={{
            width: `calc((100% - ${isScrolled ? '8px' : '12px'}) / 4)`,
            transform: `translateX(calc(${activeIndex} * 100%))`,
            left: isScrolled ? '4px' : '6px',
          }}
        >
          {/* Top specular hairline inside the pill */}
          <div className="pointer-events-none absolute inset-x-2.5 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-60" />
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-b from-white/40 via-transparent to-white/10" />
        </div>

        {/* Tab Items Buttons */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onPointerDown={() => {
                if (onResetScale) onResetScale();
              }}
              onClick={() => handleTabClick(item.id)}
              className={`relative z-10 flex-1 rounded-[24px] flex flex-col items-center justify-center dock-btn-transition active:scale-90 group cursor-pointer focus:outline-none ${
                isScrolled ? 'py-1 px-1 gap-0.5' : 'py-2 sm:py-2.5 px-1.5 gap-1'
              }`}
            >
              {/* Icon Container dengan Micro-Spring Damping */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                    isScrolled ? 'w-4 h-4' : 'w-5 h-5'
                  } ${
                    isActive
                      ? 'scale-115 text-teal-600 stroke-[2.4] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(20,184,166,0.35)]'
                      : 'scale-100 stroke-[1.9] text-slate-400 group-hover:text-slate-600 group-hover:scale-105'
                  }`}
                />
              </div>

              {/* Label Typography */}
              <span
                className={`tracking-tight leading-none transition-all duration-300 ${
                  isScrolled ? 'text-[9px]' : 'text-[10px]'
                } ${
                  isActive
                    ? 'text-slate-900 font-black scale-[1.03]'
                    : 'text-slate-400 font-semibold group-hover:text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
