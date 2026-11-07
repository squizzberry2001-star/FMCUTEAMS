import React, { useState, useRef, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const CHARACTERS = ['F', 'M', 'C', 'U', ' ', 'T', 'E', 'A', 'M', 'S'];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // Splash stages: 'animating-letters' | 'dissolving' | 'completed'
  const [splashStage, setSplashStage] = useState<'animating-letters' | 'dissolving' | 'completed'>(
    'animating-letters'
  );

  const [revealedCharIndex, setRevealedCharIndex] = useState<number>(-1);

  const [dotPos, setDotPos] = useState<{
    x: number;
    y: number;
    opacity: number;
    scale: number;
    isExpanding: boolean;
    isBouncing: boolean;
    isFloating: boolean;
  }>({
    x: 0,
    y: 0,
    opacity: 0,
    scale: 1,
    isExpanding: false,
    isBouncing: true,
    isFloating: false,
  });

  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const afterSRef = useRef<HTMLSpanElement>(null);
  const lettersContainerRef = useRef<HTMLDivElement>(null);
  const isDissolvingRef = useRef(false);

  // Synchronize mobile status bar / theme-color during splash
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

    if (splashStage === 'dissolving' || splashStage === 'completed') {
      metaTheme.setAttribute('content', '#F8F9FD');
      metaApple.setAttribute('content', 'default');
      document.documentElement.style.backgroundColor = '#F8F9FD';
      document.body.style.backgroundColor = '#F8F9FD';
    } else {
      metaTheme.setAttribute('content', '#000000');
      metaApple.setAttribute('content', 'black-translucent');
      document.documentElement.style.backgroundColor = '#000000';
      document.body.style.backgroundColor = '#000000';
    }
  }, [splashStage]);

  // Trigger dot expansion and dissolve into destination screen
  const triggerDissolve = () => {
    if (isDissolvingRef.current || splashStage === 'completed') return;
    isDissolvingRef.current = true;
    setSplashStage('dissolving');

    setDotPos((prev) => ({
      ...prev,
      scale: 90,
      isExpanding: true,
      isBouncing: false,
      isFloating: false,
    }));

    // Complete dissolve after 850ms, then notify parent
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
  // - Bouncing ball drop (1050ms) -> Dash to 'F' (240ms) -> Letters (230ms/char) -> 3s hold after 'S'
  useEffect(() => {
    let isMounted = true;
    let timerIds: ReturnType<typeof setTimeout>[] = [];
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Helper: calculate relative (x, y) coordinates of each letter inside container
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

    // Retry measuring with requestAnimationFrame until layout is painted, or fallback safely
    let attempts = 0;
    const initAndRun = () => {
      if (!isMounted) return;

      const pos = measurePositions();
      // If layout not ready yet, retry up to 10 frames
      if ((!pos || pos[0].x <= 0) && attempts < 10) {
        attempts++;
        requestAnimationFrame(initAndRun);
        return;
      }

      // Fallback safe coordinates if extreme low-end device fails measurement
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
        isExpanding: false,
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
          isExpanding: false,
          isBouncing: false,
          isFloating: false,
        });

        // Phase 3: Arrive at 'F' after dash (240ms) and illuminate 'F'
        const tDash = setTimeout(() => {
          if (!isMounted) return;
          setRevealedCharIndex(0);

          // Phase 4: Reveal remaining letters sequentially at slower pace (230ms per char)
          // Uses PRE-CALCULATED positions -> zero layout reflow!
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
                isExpanding: false,
                isBouncing: false,
                isFloating: false,
              });

              if (currentIdx < CHARACTERS.length) {
                setRevealedCharIndex(currentIdx);
              }
            } else {
              if (intervalId) clearInterval(intervalId);

              // Dot has arrived right after 'S' and stops there!
              // Activate weightless organic floating levitation!
              setDotPos((prev) => ({
                ...prev,
                isFloating: true,
              }));

              // Pause for 2 seconds (2000ms) as requested by user
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

    // Start with a slight delay for smooth component mount
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

  return (
    <div
      onClick={triggerDissolve}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000] cursor-pointer transition-opacity duration-700 select-none touch-none overscroll-none ${
        splashStage === 'dissolving' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        height: '100dvh',
        minHeight: '100vh',
        backgroundColor: '#000000',
      }}
      title="Ketuk untuk langsung membuka portal"
    >
      {/* Pure AMOLED Pitch Black: Tight subtle central glow strictly behind text, zero bleed to status bar */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(45, 212, 191, 0.08) 0%, transparent 40%)',
        }}
      />

      {/* Perfectly Centered Stage */}
      <div
        ref={lettersContainerRef}
        className="relative inline-flex items-center justify-center px-6 py-8 overflow-visible"
      >
        {/* HARDWARE-ACCELERATED OUTER WRAPPER (Translates trajectory via GPU translate3d) */}
        <div
          className="absolute top-0 left-0 pointer-events-none z-30"
          style={{
            transform: `translate3d(${dotPos.x}px, ${dotPos.y}px, 0)`,
            transition:
              dotPos.isBouncing || dotPos.isExpanding
                ? 'none'
                : 'transform 225ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            opacity: dotPos.opacity,
          }}
        >
          {/* INNER BALL (Handles bouncing animation, floating levitation, bloom, and dissolve expansion) */}
          <div
            className={`rounded-full ${
              dotPos.isBouncing
                ? 'animate-ball-drop-bounce'
                : dotPos.isFloating
                ? 'animate-ball-floating'
                : ''
            }`}
            style={{
              width: '26px',
              height: '26px',
              transform:
                dotPos.isBouncing || dotPos.isFloating
                  ? undefined
                  : `translate(-50%, -50%) scale(${dotPos.scale})`,
              transition: dotPos.isExpanding
                ? 'transform 850ms cubic-bezier(0.4, 0, 0.2, 1)'
                : 'none',
              background: '#FFFFFF',
              boxShadow: dotPos.isExpanding
                ? '0 0 100px 40px #FFFFFF, 0 0 220px 80px rgba(45,212,191,0.9)'
                : '0 0 16px 3px #FFFFFF, 0 0 32px 8px rgba(45,212,191,0.85), 0 0 55px 16px rgba(56,189,248,0.4)',
              willChange: 'transform',
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
                  // Lightweight 2-3 tier bloom: vibrant, smooth, zero lag on mobile GPUs
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
  );
};
