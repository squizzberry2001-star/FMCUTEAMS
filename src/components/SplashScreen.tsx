import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';

interface SplashScreenProps {
  onComplete: () => void;
  user?: User | null;
  targetThemeColor?: string;
}

const CHARACTERS = ['F', 'M', 'C', 'U', ' ', 'T', 'E', 'A', 'M', 'S'];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  user = null,
  targetThemeColor = '#F8F9FD',
}) => {
  // Splash stages: 'animating' | 'holding' | 'dissolving' | 'completed'
  const [splashStage, setSplashStage] = useState<
    'animating' | 'holding' | 'dissolving' | 'completed'
  >('animating');

  const [revealedCharIndex, setRevealedCharIndex] = useState<number>(-1);

  const [dotPos, setDotPos] = useState<{
    x: number;
    y: number;
    opacity: number;
    scale: number;
    isBouncing: boolean;
    isFloating: boolean;
  }>({
    x: 0,
    y: 0,
    opacity: 0,
    scale: 1,
    isBouncing: true,
    isFloating: false,
  });

  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const afterSRef = useRef<HTMLSpanElement>(null);
  const lettersContainerRef = useRef<HTMLDivElement>(null);
  const isDissolvingRef = useRef(false);

  // Synchronize mobile status bar / theme-color / AMOLED pitch black during splash
  useEffect(() => {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!metaApple) {
      metaApple = document.createElement('meta');
      metaApple.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(metaApple);
    }

    metaTheme.setAttribute('content', '#000000');
    metaApple.setAttribute('content', 'black-translucent');
    document.documentElement.style.setProperty('background-color', '#000000', 'important');
    document.documentElement.style.setProperty('color-scheme', 'dark');
    document.body.style.setProperty('background-color', '#000000', 'important');
    document.body.style.setProperty('color-scheme', 'dark');

    return () => {
      // Ensure on unmount status bar & document background match the active app theme
      const mTheme = document.querySelector('meta[name="theme-color"]');
      if (mTheme) mTheme.setAttribute('content', targetThemeColor);
      const mApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (mApple) mApple.setAttribute('content', 'default');
      document.documentElement.style.setProperty('background-color', targetThemeColor, 'important');
      document.documentElement.style.setProperty('color-scheme', 'light');
      document.body.style.setProperty('background-color', targetThemeColor, 'important');
      document.body.style.setProperty('color-scheme', 'light');
    };
  }, [targetThemeColor]);

  // Silky-Smooth Organic Cross-Dissolve:
  // Instead of an artificial harsh white flash, the AMOLED black canvas smoothly cross-fades
  // (opacity 1 -> 0 over 850ms) while the glowing typography and dot softly blur & melt,
  // revealing the underlying destination view (dashboard or login form) with absolute seamlessness.
  const triggerDissolve = () => {
    if (isDissolvingRef.current || splashStage === 'completed') return;
    isDissolvingRef.current = true;

    setSplashStage('dissolving');

    // At the midpoint of the dissolve (380ms), seamlessly blend the mobile status bar & body background
    setTimeout(() => {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute('content', targetThemeColor);
      const metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (metaApple) metaApple.setAttribute('content', 'default');
      document.documentElement.style.setProperty('background-color', targetThemeColor, 'important');
      document.documentElement.style.setProperty('color-scheme', 'light');
      document.body.style.setProperty('background-color', targetThemeColor, 'important');
      document.body.style.setProperty('color-scheme', 'light');
    }, 380);

    // Complete dissolve at 850ms, then unmount splash
    setTimeout(() => {
      setSplashStage('completed');
      onComplete();
    }, 850);
  };

  // 1. Bulletproof Watchdog: If anything stalls on low-end mobile devices, force dissolve after 8.5s!
  useEffect(() => {
    const watchdog = setTimeout(() => {
      if (!isDissolvingRef.current) {
        triggerDissolve();
      }
    }, 8500);

    return () => clearTimeout(watchdog);
  }, []);

  // 2. High-Performance Mobile Animation Sequence:
  // - Pre-measures all character positions ONCE (zero layout thrashing during animation)
  // - Hardware-accelerated GPU translate3d trajectory
  // - Bouncing ball drop (1050ms) -> Dash to 'F' (240ms) -> Letters (230ms/char) -> 2s float after 'S'
  useEffect(() => {
    let isMounted = true;
    let timerIds: ReturnType<typeof setTimeout>[] = [];
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const measurePositions = (): { x: number; y: number }[] | null => {
      const contEl = lettersContainerRef.current;
      if (!contEl) return null;
      const contRect = contEl.getBoundingClientRect();
      if (contRect.width === 0 || contRect.height === 0) return null;

      const positions: { x: number; y: number }[] = [];
      for (let i = 0; i < CHARACTERS.length; i++) {
        const el = charRefs.current[i];
        if (el) {
          const r = el.getBoundingClientRect();
          positions.push({
            x: r.left - contRect.left + r.width / 2,
            y: r.top - contRect.top + r.height / 2,
          });
        } else {
          positions.push({ x: 0, y: contRect.height / 2 });
        }
      }

      // Slot 10: anchor slot right after 'S'
      if (afterSRef.current) {
        const r = afterSRef.current.getBoundingClientRect();
        positions.push({
          x: r.left - contRect.left + r.width / 2,
          y: r.top - contRect.top + r.height / 2,
        });
      } else {
        const last = positions[positions.length - 1];
        positions.push({ x: last ? last.x + 32 : 260, y: last ? last.y : 35 });
      }

      return positions;
    };

    let attempts = 0;
    const initAndRun = () => {
      if (!isMounted) return;

      const pos = measurePositions();
      if ((!pos || pos[0].x <= 0) && attempts < 10) {
        attempts++;
        requestAnimationFrame(initAndRun);
        return;
      }

      const validPositions =
        pos && pos[0].x > 0
          ? pos
          : [
              { x: 30, y: 35 },
              { x: 60, y: 35 },
              { x: 90, y: 35 },
              { x: 120, y: 35 },
              { x: 140, y: 35 },
              { x: 165, y: 35 },
              { x: 195, y: 35 },
              { x: 225, y: 35 },
              { x: 255, y: 35 },
              { x: 285, y: 35 },
              { x: 315, y: 35 },
            ];

      const fPos = validPositions[0];
      const startX = Math.max(12, fPos.x - 75);

      // Phase 1: Ball drops from above outside viewport and bounces like a ball (1050ms)
      setDotPos({
        x: startX,
        y: fPos.y,
        opacity: 1,
        scale: 1,
        isBouncing: true,
        isFloating: false,
      });

      // Phase 2: After bouncing settles (1050ms), dash directly into letter 'F'
      const tBounce = setTimeout(() => {
        if (!isMounted) return;

        setDotPos({
          x: fPos.x,
          y: fPos.y,
          opacity: 1,
          scale: 1,
          isBouncing: false,
          isFloating: false,
        });

        // Phase 3: Arrive at 'F' after dash (240ms) and illuminate 'F'
        const tDash = setTimeout(() => {
          if (!isMounted) return;
          setRevealedCharIndex(0);

          // Phase 4: Reveal remaining letters sequentially at 230ms per char
          let currentIdx = 0;
          intervalId = setInterval(() => {
            if (!isMounted) return;

            currentIdx++;
            if (currentIdx < validPositions.length) {
              const target = validPositions[currentIdx];
              setDotPos({
                x: target.x,
                y: target.y,
                opacity: 1,
                scale: 1,
                isBouncing: false,
                isFloating: false,
              });

              if (currentIdx < CHARACTERS.length) {
                setRevealedCharIndex(currentIdx);
              }
            } else {
              if (intervalId) clearInterval(intervalId);

              // Dot has arrived right after 'S' and stops there!
              setSplashStage('holding');

              // Activate weightless organic floating levitation!
              setDotPos((prev) => ({
                ...prev,
                isFloating: true,
              }));

              // Pause for 2 seconds (2000ms) with floating motion before optical dissolve
              const tHold = setTimeout(() => {
                if (isMounted) {
                  triggerDissolve();
                }
              }, 2000);
              timerIds.push(tHold);
            }
          }, 230); // 230ms per character

        }, 240); // 240ms dash from bounce spot to 'F'
        timerIds.push(tDash);

      }, 1050); // 1050ms bounce duration
      timerIds.push(tBounce);
    };

    const tInit = setTimeout(() => {
      requestAnimationFrame(initAndRun);
    }, 40);
    timerIds.push(tInit);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      timerIds.forEach((id) => clearTimeout(id));
    };
  }, []);

  if (splashStage === 'completed') return null;

  const isDissolving = splashStage === 'dissolving';

  return (
    <div
      onClick={triggerDissolve}
      className="fixed z-[9999] flex items-center justify-center bg-[#000000] cursor-pointer select-none touch-none overscroll-none"
      style={{
        position: 'fixed',
        top: '-20vh',
        bottom: '-20vh',
        left: '-15vw',
        right: '-15vw',
        width: '130vw',
        height: '140vh',
        backgroundColor: '#000000',
        opacity: isDissolving ? 0 : 1,
        transition: 'opacity 850ms cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: isDissolving ? 'none' : 'auto',
      }}
      title="Ketuk untuk langsung membuka portal"
    >
      {/* Dissolve Content Wrapper: Softly blurs, scales slightly, and fades out in sync */}
      <div
        className="relative flex flex-col items-center justify-center px-6 py-8 overflow-visible select-none"
        style={{
          transform: isDissolving ? 'scale(1.04)' : 'scale(1)',
          filter: isDissolving ? 'blur(10px)' : 'blur(0px)',
          opacity: isDissolving ? 0 : 1,
          transition:
            'transform 850ms cubic-bezier(0.22, 1, 0.36, 1), filter 850ms cubic-bezier(0.22, 1, 0.36, 1), opacity 850ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform, filter, opacity',
        }}
      >
        {/* Typography & Ball Coordinate Grid */}
        <div
          ref={lettersContainerRef}
          className="relative inline-flex items-center justify-center overflow-visible"
        >
          {/* HARDWARE-ACCELERATED OUTER WRAPPER (Translates trajectory via GPU translate3d) */}
          <div
            className="absolute top-0 left-0 pointer-events-none z-30"
            style={{
              transform: `translate3d(${dotPos.x}px, ${dotPos.y}px, 0)`,
              transition:
                dotPos.isBouncing
                  ? 'none'
                  : 'transform 225ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
              opacity: dotPos.opacity,
            }}
          >
            {/* INNER BALL (Handles bouncing animation, floating levitation, and soft bloom) */}
            <div
              className={`rounded-full ${
                dotPos.isBouncing
                  ? 'animate-ball-drop-bounce'
                  : dotPos.isFloating && !isDissolving
                  ? 'animate-ball-floating'
                  : ''
              }`}
              style={{
                width: '26px',
                height: '26px',
                transform:
                  isDissolving
                    ? 'translate(-50%, -50%) scale(2.2)'
                    : dotPos.isBouncing || dotPos.isFloating
                    ? undefined
                    : `translate(-50%, -50%) scale(${dotPos.scale})`,
                transition: isDissolving
                  ? 'transform 850ms cubic-bezier(0.22, 1, 0.36, 1), opacity 850ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
                opacity: isDissolving ? 0 : 1,
                background: '#FFFFFF',
                boxShadow:
                  '0 0 16px 3px #FFFFFF, 0 0 32px 8px rgba(45,212,191,0.85), 0 0 55px 16px rgba(56,189,248,0.4)',
                willChange: 'transform, opacity',
              }}
            />
          </div>

          {/* Typography "FMCU TEAMS" with GPU-Optimized Seamless Text-Shadow */}
          <div className="flex items-center text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.16em] sm:tracking-[0.24em] font-sans overflow-visible">
            {CHARACTERS.map((char, idx) => {
              const isRevealed = idx <= revealedCharIndex;
              const isCurrent = idx === revealedCharIndex;

              if (char === ' ') {
                return (
                  <span
                    key={idx}
                    ref={(el) => (charRefs.current[idx] = el)}
                    className="w-3 sm:w-6 inline-block select-none"
                  >
                    &nbsp;
                  </span>
                );
              }

              return (
                <span
                  key={idx}
                  ref={(el) => (charRefs.current[idx] = el)}
                  className="inline-block select-none transition-all duration-300 overflow-visible"
                  style={{
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed
                      ? 'translate3d(0, 0, 0) scale(1)'
                      : 'translate3d(0, 6px, 0) scale(0.85)',
                    color: '#FFFFFF',
                    textShadow: isCurrent
                      ? '0 0 10px #FFFFFF, 0 0 20px rgba(45, 212, 191, 0.9), 0 0 40px rgba(45, 212, 191, 0.45)'
                      : isRevealed
                      ? '0 0 8px rgba(255, 255, 255, 0.75), 0 0 18px rgba(45, 212, 191, 0.35)'
                      : 'none',
                    willChange: isRevealed ? 'auto' : 'transform, opacity',
                  }}
                >
                  {char}
                </span>
              );
            })}

            {/* Anchor Slot right AFTER letter 'S' on TEAMS (where the dot stops) */}
            <span
              ref={afterSRef}
              className="w-4 sm:w-6 h-8 inline-flex items-center justify-center select-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
