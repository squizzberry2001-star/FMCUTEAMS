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
  }>({
    x: 0,
    y: 0,
    opacity: 0,
    scale: 1,
    isExpanding: false,
    isBouncing: true,
  });

  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const afterSRef = useRef<HTMLSpanElement>(null);
  const lettersContainerRef = useRef<HTMLDivElement>(null);

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
      metaTheme.setAttribute('content', '#070B14');
      metaApple.setAttribute('content', 'black-translucent');
      document.documentElement.style.backgroundColor = '#070B14';
      document.body.style.backgroundColor = '#070B14';
    }
  }, [splashStage]);

  // Trigger dot expansion and dissolve into destination screen
  const triggerDissolve = () => {
    if (splashStage === 'dissolving' || splashStage === 'completed') return;
    setSplashStage('dissolving');

    setDotPos((prev) => ({
      ...prev,
      scale: 90,
      isExpanding: true,
      isBouncing: false,
    }));

    // Complete dissolve after 850ms, then notify parent
    setTimeout(() => {
      setSplashStage('completed');
      onComplete();
    }, 850);
  };

  // Splash Animation Sequence:
  // 1. Ball drops from above outside the screen, bounces like a ball (1050ms)
  // 2. Dashes immediately into the first letter 'F' (240ms)
  // 3. Glides sequentially through letters at 230ms per char
  // 4. Stops right after 'S' on TEAMS for 3 seconds (3000ms)
  // 5. Expands and dissolves into destination screen
  useEffect(() => {
    let isMounted = true;
    let timerIds: ReturnType<typeof setTimeout>[] = [];

    const updateDotToChar = (index: number) => {
      if (!isMounted) return;
      const contEl = lettersContainerRef.current;
      let charEl: HTMLElement | null = null;

      if (index < CHARACTERS.length) {
        charEl = charRefs.current[index];
      } else if (index === CHARACTERS.length) {
        charEl = afterSRef.current;
      }

      if (charEl && contEl) {
        const charRect = charEl.getBoundingClientRect();
        const contRect = contEl.getBoundingClientRect();
        const x = charRect.left - contRect.left + charRect.width / 2;
        const y = charRect.top - contRect.top + charRect.height / 2;

        setDotPos({
          x,
          y,
          opacity: 1,
          scale: 1,
          isExpanding: false,
          isBouncing: false,
        });

        if (index < CHARACTERS.length) {
          setRevealedCharIndex(index);
        }
      }
    };

    // Initial measurement after 80ms
    const t0 = setTimeout(() => {
      if (!isMounted) return;

      const char0El = charRefs.current[0];
      const contEl = lettersContainerRef.current;
      if (!char0El || !contEl) return;

      const fRect = char0El.getBoundingClientRect();
      const contRect = contEl.getBoundingClientRect();
      const fX = fRect.left - contRect.left + fRect.width / 2;
      const fY = fRect.top - contRect.top + fRect.height / 2;
      const startX = Math.max(12, fX - 75);

      // Phase 1: Ball drops from above outside viewport and bounces like a ball (1050ms)
      setDotPos({
        x: startX,
        y: fY,
        opacity: 1,
        scale: 1,
        isExpanding: false,
        isBouncing: true,
      });

      // Phase 2: After bouncing settles (1050ms), dash directly into letter 'F'
      const tBounce = setTimeout(() => {
        if (!isMounted) return;

        setDotPos({
          x: fX,
          y: fY,
          opacity: 1,
          scale: 1,
          isExpanding: false,
          isBouncing: false,
        });

        // Phase 3: Arrive at 'F' after dash (240ms) and illuminate 'F'
        const tDash = setTimeout(() => {
          if (!isMounted) return;
          setRevealedCharIndex(0);

          // Phase 4: Reveal remaining letters sequentially at slower pace (230ms per char)
          let currentIdx = 0;
          const letterInterval = setInterval(() => {
            if (!isMounted) {
              clearInterval(letterInterval);
              return;
            }
            currentIdx++;
            if (currentIdx <= CHARACTERS.length) {
              updateDotToChar(currentIdx);
            } else {
              clearInterval(letterInterval);
              // Dot has arrived right after 'S' and stops there!
              // Pause for 3 seconds (3000ms) as requested
              const tHold = setTimeout(() => {
                if (isMounted) {
                  triggerDissolve();
                }
              }, 3000);
              timerIds.push(tHold);
            }
          }, 230); // 230ms per character

        }, 240); // 240ms dash from bounce spot to 'F'
        timerIds.push(tDash);

      }, 1050); // 1050ms bounce duration
      timerIds.push(tBounce);

    }, 80);

    timerIds.push(t0);

    return () => {
      isMounted = false;
      timerIds.forEach((id) => clearTimeout(id));
    };
  }, []);

  if (splashStage === 'completed') return null;

  return (
    <div
      onClick={triggerDissolve}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#070B14] cursor-pointer transition-opacity duration-700 select-none touch-none overscroll-none ${
        splashStage === 'dissolving' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        height: '100dvh',
        minHeight: '100vh',
        backgroundColor: '#070B14',
      }}
      title="Ketuk untuk langsung membuka portal"
    >
      {/* Subtle Ambient Cosmic Glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-teal-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[450px] h-[300px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[250px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Perfectly Centered Stage */}
      <div
        ref={lettersContainerRef}
        className="relative inline-flex items-center justify-center px-6 py-8 overflow-visible"
      >
        {/* LARGE GLOWING WHITE DOT (Bounces down from above, dashes to 'F', reveals letters, stops after 'S' for 3s) */}
        <div
          className={`absolute rounded-full pointer-events-none z-30 ${
            dotPos.isBouncing ? 'animate-ball-drop-bounce' : ''
          }`}
          style={{
            left: `${dotPos.x}px`,
            top: `${dotPos.y}px`,
            width: '26px',
            height: '26px',
            transform: dotPos.isBouncing
              ? undefined
              : `translate(-50%, -50%) scale(${dotPos.scale})`,
            opacity: dotPos.opacity,
            transition: dotPos.isExpanding
              ? 'transform 850ms cubic-bezier(0.4, 0, 0.2, 1), opacity 650ms ease-out'
              : dotPos.isBouncing
              ? 'none'
              : 'left 230ms cubic-bezier(0.22, 1, 0.36, 1), top 230ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out',
            background: '#FFFFFF',
            boxShadow: dotPos.isExpanding
              ? '0 0 160px 70px #FFFFFF, 0 0 320px 120px rgba(45,212,191,0.9), 0 0 500px 180px rgba(56,189,248,0.7)'
              : '0 0 20px 5px #FFFFFF, 0 0 45px 12px rgba(45,212,191,0.85), 0 0 80px 24px rgba(56,189,248,0.5)',
          }}
        />

        {/* Typography "FMCU TEAMS" with Seamless Multi-Tier Text-Shadow */}
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
                    ? 'translateY(0) scale(1)'
                    : 'translateY(6px) scale(0.85)',
                  color: '#FFFFFF',
                  // Multi-tiered concentric Gaussian text-shadow: seamless, deep bloom, zero boxiness
                  textShadow: isCurrent
                    ? '0 0 8px #FFFFFF, 0 0 18px rgba(255, 255, 255, 0.9), 0 0 32px rgba(45, 212, 191, 0.8), 0 0 55px rgba(45, 212, 191, 0.5), 0 0 85px rgba(56, 189, 248, 0.3)'
                    : isRevealed
                    ? '0 0 6px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.5), 0 0 28px rgba(45, 212, 191, 0.4), 0 0 48px rgba(45, 212, 191, 0.2)'
                    : 'none',
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
