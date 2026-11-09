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
    <div className="fixed bottom-4 sm:bottom-5 left-0 right-0 mx-auto flex justify-center pointer-events-none z-40 select-none px-4">
      {/* 
        Floating iPhone Glass Dock with Optical Refraction & Visual Distortion
        Menyudut tetap center (origin-center, tidak menyusut ke bawah)
        Super smooth deliberate transition & auto-upscale on press
      */}
      <div
        onClick={onResetScale}
        style={{
          transform: isScrolled ? 'scale(0.90)' : 'scale(1)',
        }}
        className={`w-full max-w-md flex items-center pointer-events-auto dock-transition origin-center relative overflow-hidden select-none p-1.5 rounded-full ${
          isScrolled ? 'iphone-glass-dock-scrolled' : 'iphone-glass-dock'
        }`}
      >
        {/* Top Prismatic Hairline Reflection (Apple iPhone Glass Specular) */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent opacity-90 z-10" />

        {/* Ambient bottom light refraction rim */}
        <div className="pointer-events-none absolute inset-x-12 bottom-0 h-[0.75px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-60 z-10" />

        {/* 
          SLIDING ACTIVE GLASS LENS PILL (High-Contrast Apple Dark Lens, Image 1 Aesthetic)
        */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-full iphone-glass-pill pointer-events-none dock-pill-transition z-0"
          style={{
            width: 'calc((100% - 12px) / 4)',
            transform: `translateX(calc(${activeIndex} * 100%))`,
            left: '6px',
          }}
        >
          {/* Top specular hairline inside the pill */}
          <div className="pointer-events-none absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-95" />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/10 via-transparent to-transparent" />
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
              className="relative z-10 flex-1 rounded-full flex flex-col items-center justify-center dock-btn-transition active:scale-95 group cursor-pointer focus:outline-none py-2 px-1.5 gap-1"
            >
              {/* Icon Container dengan Micro-Spring Damping */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                    isActive
                      ? 'scale-110 text-white stroke-[2.5] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                      : 'scale-100 stroke-[2] text-slate-600 group-hover:text-black group-hover:scale-105'
                  }`}
                />
              </div>

              {/* Label Typography */}
              <span
                className={`text-[10px] tracking-tight leading-none transition-all duration-300 ${
                  isActive
                    ? 'text-white font-black scale-[1.02]'
                    : 'text-slate-600 font-bold group-hover:text-black'
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
