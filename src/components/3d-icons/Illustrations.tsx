import React from 'react';

// 1. Meglitinides Hero 3D Illustration (Yellow disk + Blue/Lavender Capsule + Green Pedestal)
export const MeglitinidesHero3D: React.FC<{ className?: string }> = ({ className = "w-44 h-44" }) => {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        {/* Yellow Sun Disk Gradient */}
        <linearGradient id="sunGrad" x1="120" y1="30" x2="120" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFD65A" />
          <stop offset="50%" stop-color="#FFB300" />
          <stop offset="100%" stop-color="#FB8C00" />
        </linearGradient>

        {/* Soft Shadow for Capsule */}
        <filter id="capsuleShadow" x="30" y="80" width="180" height="90" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.1   0 0 0 0 0.15   0 0 0 0 0.3  0 0 0 0.18 0"/>
        </filter>

        {/* Lavender Left Half Capsule */}
        <linearGradient id="lavenderHalf" x1="50" y1="90" x2="115" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="35%" stop-color="#EBE7FE" />
          <stop offset="80%" stop-color="#D7D0FB" />
          <stop offset="100%" stop-color="#C5BCF9" />
        </linearGradient>

        {/* Blue Right Half Capsule */}
        <linearGradient id="blueHalf" x1="115" y1="90" x2="175" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="45%" stop-color="#0284C7" />
          <stop offset="90%" stop-color="#0369A1" />
          <stop offset="100%" stop-color="#075985" />
        </linearGradient>

        {/* Green Pedestal Gradient */}
        <linearGradient id="greenPedestalTop" x1="70" y1="140" x2="170" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4ADE80" />
          <stop offset="60%" stop-color="#22C55E" />
          <stop offset="100%" stop-color="#16A34A" />
        </linearGradient>
        
        <linearGradient id="greenPedestalSide" x1="70" y1="150" x2="170" y2="165" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#15803D" />
          <stop offset="100%" stop-color="#166534" />
        </linearGradient>

        {/* Specular highlights */}
        <linearGradient id="capsuleHighlight" x1="60" y1="95" x2="160" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
      </defs>

      {/* Background Yellow Sun / Half-Circle */}
      <circle cx="120" cy="95" r="55" fill="url(#sunGrad)" />
      
      {/* Sun soft glow highlight */}
      <path d="M 72 80 A 55 55 0 0 1 168 80" stroke="#FFF7D6" strokeWidth="4" strokeLinecap="round" opacity="0.6" />

      {/* Sun lower shadow cast */}
      <ellipse cx="120" cy="150" rx="60" ry="14" fill="#000" opacity="0.08" />

      {/* Green Rounded Pedestal Base */}
      {/* Pedestal Shadow */}
      <ellipse cx="120" cy="168" rx="55" ry="10" fill="#000" opacity="0.12" />
      
      {/* Pedestal 3D Base */}
      <rect x="70" y="145" width="100" height="18" rx="9" fill="url(#greenPedestalSide)" />
      <rect x="70" y="138" width="100" height="14" rx="7" fill="url(#greenPedestalTop)" />
      <rect x="74" y="140" width="92" height="3" rx="1.5" fill="#86EFAC" opacity="0.7" />

      {/* Capsule Drop Shadow */}
      <ellipse cx="118" cy="140" rx="52" ry="12" fill="url(#capsuleShadow)" />

      {/* 3D Capsule Pill lying horizontally */}
      <g transform="translate(0, 0)">
        {/* Left Half (Lavender/Pinkish White) */}
        <path d="M 85 96 C 68 96 54 109 54 126 C 54 143 68 156 85 156 L 120 156 L 120 96 Z" fill="url(#lavenderHalf)" />

        {/* Right Half (Ocean Blue) */}
        <path d="M 120 96 L 155 96 C 172 96 186 109 186 126 C 186 143 172 156 155 156 L 120 156 Z" fill="url(#blueHalf)" />

        {/* Middle separator line ring */}
        <line x1="120" y1="96" x2="120" y2="156" stroke="#1E293B" strokeWidth="1" opacity="0.15" />

        {/* Specular Highlight along the top length */}
        <path d="M 75 104 Q 120 102 165 104" stroke="url(#capsuleHighlight)" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="78" cy="116" rx="6" ry="10" transform="rotate(-25 78 116)" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
};

// 2. Paracetamol New Reminder Hero 3D Illustration (Yellow/White Capsules + Pink Tablet)
export const ParacetamolHero3D: React.FC<{ className?: string }> = ({ className = "w-44 h-44" }) => {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        {/* Ambient glow */}
        <radialGradient id="pillGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFE8EC" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#FFE8EC" stop-opacity="0" />
        </radialGradient>

        {/* Yellow Pill Half */}
        <linearGradient id="yellowHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF275" />
          <stop offset="40%" stop-color="#FFD12E" />
          <stop offset="100%" stop-color="#F59E0B" />
        </linearGradient>

        {/* White / Pastel Pill Half */}
        <linearGradient id="whitePillHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="60%" stop-color="#F1F5F9" />
          <stop offset="100%" stop-color="#CBD5E1" />
        </linearGradient>

        {/* Pink/Coral Tablet Gradient */}
        <linearGradient id="coralTabletTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFA8BA" />
          <stop offset="40%" stop-color="#FF6B8B" />
          <stop offset="100%" stop-color="#E11D48" />
        </linearGradient>

        <linearGradient id="coralTabletSide" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#BE123C" />
          <stop offset="100%" stop-color="#881337" />
        </linearGradient>
      </defs>

      {/* Ambient soft glow */}
      <circle cx="120" cy="120" r="90" fill="url(#pillGlow)" />

      {/* Big Vertical Capsule */}
      <g transform="translate(85, 35)">
        {/* Capsule shadow */}
        <ellipse cx="25" cy="115" rx="30" ry="10" fill="#000" opacity="0.1" />

        {/* Top White Half */}
        <path d="M 0 50 C 0 22 11 0 35 0 C 59 0 70 22 70 50 L 70 55 L 0 55 Z" fill="url(#whitePillHalf)" />

        {/* Bottom Yellow Half */}
        <path d="M 0 55 L 70 55 L 70 65 C 70 93 59 115 35 115 C 11 115 0 93 0 65 Z" fill="url(#yellowHalf)" />

        {/* Top Shine */}
        <ellipse cx="28" cy="25" rx="8" ry="16" fill="#FFFFFF" opacity="0.65" transform="rotate(-15 28 25)" />
        <path d="M 15 55 L 15 80" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      </g>

      {/* Second Angled Capsule in Background */}
      <g transform="translate(110, 50) rotate(35)">
        {/* Top Lavender */}
        <rect x="0" y="0" width="36" height="35" rx="18" fill="#F8FAFC" />
        {/* Bottom Pink/Purple */}
        <rect x="0" y="30" width="36" height="35" rx="18" fill="#F472B6" />
        <ellipse cx="14" cy="15" rx="4" ry="8" fill="#FFFFFF" opacity="0.5" />
      </g>

      {/* Pink Round Tablet in foreground */}
      <g transform="translate(95, 120)">
        {/* Tablet Drop Shadow */}
        <ellipse cx="36" cy="56" rx="36" ry="10" fill="#000" opacity="0.16" />

        {/* 3D Cylinder Side */}
        <rect x="8" y="22" width="56" height="14" rx="7" fill="url(#coralTabletSide)" />

        {/* 3D Top Bevel Circle */}
        <circle cx="36" cy="22" r="28" fill="url(#coralTabletTop)" />

        {/* Tablet Center Split Score Line */}
        <line x1="20" y1="22" x2="52" y2="22" stroke="#FDA4AF" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Tablet Top Specular Highlight */}
        <path d="M 22 12 A 20 20 0 0 1 50 12" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  );
};

// 3. 3D Capsule Icon (Small thumbnail for list cards & selectors)
export const CapsuleIcon3D: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="cPink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF9EAA" />
          <stop offset="100%" stop-color="#FF5376" />
        </linearGradient>
        <linearGradient id="cYellow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF08A" />
          <stop offset="100%" stop-color="#EAB308" />
        </linearGradient>
        <linearGradient id="cWhite" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#E2E8F0" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="32" cy="52" rx="20" ry="5" fill="#000" opacity="0.08" />

      {/* Tilted Capsule */}
      <g transform="translate(18, 12) rotate(-20 14 18)">
        <rect x="0" y="0" width="16" height="18" rx="8" fill="url(#cWhite)" />
        <rect x="0" y="16" width="16" height="18" rx="8" fill="url(#cYellow)" />
        <ellipse cx="6" cy="8" rx="2" ry="4" fill="#FFFFFF" opacity="0.7" />
      </g>

      {/* Second Pill Pink */}
      <g transform="translate(32, 28)">
        <circle cx="12" cy="12" r="11" fill="url(#cPink)" />
        <line x1="6" y1="12" x2="18" y2="12" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <ellipse cx="12" cy="7" rx="6" ry="2" fill="#FFFFFF" opacity="0.5" />
      </g>
    </svg>
  );
};

// 4. 3D Medicine Syrup Bottle Icon (Small thumbnail with ribbon)
export const BottleIcon3D: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF3C7" />
          <stop offset="60%" stop-color="#FDE68A" />
          <stop offset="100%" stop-color="#F59E0B" />
        </linearGradient>
        <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5EEAD4" />
          <stop offset="100%" stop-color="#0D9488" />
        </linearGradient>
        <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDA4AF" />
          <stop offset="100%" stop-color="#F43F5E" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="32" cy="54" rx="16" ry="4" fill="#000" opacity="0.1" />

      {/* Bottle Body */}
      <rect x="18" y="24" width="28" height="28" rx="8" fill="url(#bottleGrad)" />
      
      {/* Bottle Neck */}
      <rect x="25" y="18" width="14" height="8" rx="2" fill="#FDE68A" />

      {/* Cap */}
      <rect x="23" y="12" width="18" height="8" rx="4" fill="url(#capGrad)" />

      {/* Pink ribbon/cross label */}
      <rect x="21" y="32" width="22" height="12" rx="4" fill="#FFFFFF" opacity="0.9" />
      {/* Pink Ribbon shape */}
      <path d="M 28 35 L 36 41 M 36 35 L 28 41" stroke="url(#ribbonGrad)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Specular Shine */}
      <path d="M 22 28 L 22 46" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
};

// 5. 3D Syringe Icon (Small thumbnail with injection fluid)
export const SyringeIcon3D: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="sFluid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FB7185" />
          <stop offset="100%" stop-color="#E11D48" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="32" cy="52" rx="18" ry="4" fill="#000" opacity="0.08" />

      <g transform="translate(32, 32) rotate(-45) translate(-32, -32)">
        {/* Plunger Handle */}
        <line x1="32" y1="6" x2="32" y2="18" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        <rect x="24" y="5" width="16" height="4" rx="2" fill="#CBD5E1" />

        {/* Barrel Body */}
        <rect x="26" y="18" width="12" height="28" rx="3" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />
        {/* Liquid */}
        <rect x="27" y="26" width="10" height="18" rx="2" fill="url(#sFluid)" />

        {/* Tip & Needle */}
        <rect x="29" y="46" width="6" height="4" rx="1" fill="#94A3B8" />
        <line x1="32" y1="50" x2="32" y2="60" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />

        {/* Measurement ticks */}
        <line x1="34" y1="30" x2="37" y2="30" stroke="#FFF" strokeWidth="1" />
        <line x1="34" y1="36" x2="37" y2="36" stroke="#FFF" strokeWidth="1" />
      </g>
    </svg>
  );
};

// 6. 3D Tablet Blister Icon (Small thumbnail with blisters)
export const BlisterIcon3D: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="blisterPack" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#E2E8F0" />
        </linearGradient>
        <linearGradient id="blisterPill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#67E8F9" />
          <stop offset="100%" stop-color="#06B6D4" />
        </linearGradient>
        <linearGradient id="blisterYellow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDE047" />
          <stop offset="100%" stop-color="#EAB308" />
        </linearGradient>
      </defs>

      {/* Shadow */}
      <ellipse cx="32" cy="52" rx="16" ry="4" fill="#000" opacity="0.08" />

      {/* Metallic Pack Foil */}
      <rect x="14" y="16" width="36" height="34" rx="6" fill="url(#blisterPack)" stroke="#CBD5E1" strokeWidth="1" />

      {/* Blister Cells */}
      <ellipse cx="23" cy="25" rx="5" ry="4" fill="url(#blisterPill)" />
      <ellipse cx="41" cy="25" rx="5" ry="4" fill="url(#blisterYellow)" />
      <ellipse cx="23" cy="40" rx="5" ry="4" fill="url(#blisterYellow)" />
      <ellipse cx="41" cy="40" rx="5" ry="4" fill="url(#blisterPill)" />
    </svg>
  );
};
