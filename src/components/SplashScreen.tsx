import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { getCurrentWeekDays } from './CalendarStrip';

interface SplashScreenProps {
  onComplete: () => void;
  user?: User | null;
  targetThemeColor?: string;
}

const CHARACTERS = ['F', 'M', 'C', 'U', ' ', 'T', 'E', 'A', 'M', 'S'];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  targetThemeColor = '#F8F9FD',
}) => {
  // Splash stages:
  // 'animating' (ball drop + letter reveal) ->
  // 'jumping' (jump from after 'S' to Actual Date Pill position) ->
  // 'morphing' (bounce into position + transform size to match Actual Date Pill) ->
  // 'dissolving' (circular aperture dissolve from Actual Date Pill) ->
  // 'completed'
  const [splashStage, setSplashStage] = useState<
    'animating' | 'jumping' | 'morphing' | 'dissolving' | 'completed'
  >('animating');

  const [revealedCharIndex, setRevealedCharIndex] = useState<number>(-1);

  const [dotPos, setDotPos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    scale: number;
    isBouncing: boolean;
    isJumping: boolean;
    isMorphingPill: boolean;
  }>({
    x: 0,
    y: 0,
    width: 26,
    height: 26,
    opacity: 0,
    scale: 1,
    isBouncing: true,
    isJumping: false,
    isMorphingPill: false,
  });

  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const afterSRef = useRef<HTMLSpanElement>(null);
  const dotBallRef = useRef<HTMLDivElement>(null);
  const lettersContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isDissolvingRef = useRef(false);

  const weekDays = getCurrentWeekDays();
  const todayItem = weekDays.find((d) => d.isToday) || weekDays[0];

  // Pre-request GPS silently during Splash for Actual IN & OUT recording
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          const now = new Date();
          const wibTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
          try {
            localStorage.setItem('fmcu_live_gps', `${lat}, ${lng} (Akurat)`);
            localStorage.setItem('fmcu_initial_checkin_time', wibTime);
            sessionStorage.setItem('fmcu_gps_verified', 'true');
          } catch (e) {
            console.warn(e);
          }
        },
        () => {
          // Handled by mandatory GPS gate on App load
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  }, []);

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
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
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

  // Measure the exact DOM bounding box of the Actual Date Pill (live or fallback mirror)
  const measureActualDatePill = () => {
    const contEl = lettersContainerRef.current;
    const contRect = contEl?.getBoundingClientRect();

    const livePill =
      (document.querySelector('[data-splash-target="actual-date-pill"]') as HTMLElement | null) ||
      (document.querySelector('[data-selected-date-pill="true"]') as HTMLElement | null) ||
      (document.querySelector('[data-splash-fallback-pill="actual-date-pill"]') as HTMLElement | null);

    if (livePill && contRect) {
      const r = livePill.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const screenCenterX = r.left + r.width / 2;
        const screenCenterY = r.top + r.height / 2;
        return {
          relX: screenCenterX - contRect.left,
          relY: screenCenterY - contRect.top,
          screenX: screenCenterX,
          screenY: screenCenterY,
          width: r.width,
          height: r.height,
        };
      }
    }

    const fallbackScreenX = window.innerWidth / 2;
    const fallbackScreenY = Math.min(205, window.innerHeight * 0.25);
    return {
      relX: contRect ? fallbackScreenX - contRect.left : 0,
      relY: contRect ? fallbackScreenY - contRect.top : -120,
      screenX: fallbackScreenX,
      screenY: fallbackScreenY,
      width: 46,
      height: 74,
    };
  };

  // Circular Aperture Portal Reveal centered on the Actual Date Pill
  const triggerDissolve = (customOriginX?: number, customOriginY?: number, customInitRadius?: number) => {
    if (isDissolvingRef.current || splashStage === 'completed') return;
    isDissolvingRef.current = true;

    setSplashStage('dissolving');

    // Measure exact screen origin coordinates of the morphed pill / Actual Date Pill
    const pillTarget = measureActualDatePill();
    const ballEl = dotBallRef.current;
    const rect = ballEl?.getBoundingClientRect();

    const originX =
      typeof customOriginX === 'number'
        ? customOriginX
        : rect && rect.width > 0
        ? rect.left + rect.width / 2
        : pillTarget.screenX;
    const originY =
      typeof customOriginY === 'number'
        ? customOriginY
        : rect && rect.height > 0
        ? rect.top + rect.height / 2
        : pillTarget.screenY;

    const canvas = canvasRef.current;
    if (!canvas) {
      setTimeout(() => {
        setSplashStage('completed');
        onComplete();
      }, 400);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setTimeout(() => {
        setSplashStage('completed');
        onComplete();
      }, 400);
      return;
    }

    // Maximum distance from the Actual Date Pill to the farthest corner of the viewport
    const cornerDistances = [
      Math.hypot(originX, originY),
      Math.hypot(w - originX, originY),
      Math.hypot(originX, h - originY),
      Math.hypot(w - originX, h - originY),
    ];
    const maxRadius = Math.max(...cornerDistances) + 120;
    const initialRadius = customInitRadius || Math.max(pillTarget.width, pillTarget.height) / 2;
    const duration = 420; // Fast & silky aperture dissolve from the Actual Date Pill
    const startTime = performance.now();
    let themeSwitched = false;

    // Immediately draw Frame 0 with soft feather around the pill so there is zero flash
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-20, -20, w + 40, h + 40);
    ctx.globalCompositeOperation = 'destination-out';
    const initGrad = ctx.createRadialGradient(
      originX,
      originY,
      0,
      originX,
      originY,
      initialRadius + 24
    );
    initGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    initGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.75)');
    initGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = initGrad;
    ctx.beginPath();
    ctx.arc(originX, originY, initialRadius + 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const renderFrame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth cubic-bezier ease-out curve: rapid aperture opening into page
      const ease = 1 - Math.pow(1 - progress, 2.5);
      const currentRadius = initialRadius + ease * (maxRadius - initialRadius);

      // Midpoint theme-color switch for mobile status bar (Dynamic Island / notch)
      if (progress >= 0.18 && !themeSwitched) {
        themeSwitched = true;
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', targetThemeColor);
        const metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (metaApple) metaApple.setAttribute('content', 'default');
        document.documentElement.style.setProperty('background-color', targetThemeColor, 'important');
        document.documentElement.style.setProperty('color-scheme', 'light');
        document.body.style.setProperty('background-color', targetThemeColor, 'important');
        document.body.style.setProperty('color-scheme', 'light');
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      if (progress < 1) {
        // Step 1: Draw solid AMOLED black canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(-20, -20, w + 40, h + 40);

        // Step 2: Cut open the silky feathered portal using destination-out with soft radial gradient
        ctx.globalCompositeOperation = 'destination-out';
        const feather = Math.min(160, 40 + currentRadius * 0.30);
        const r0 = Math.max(0, currentRadius - feather);
        const r1 = currentRadius + feather;

        const grad = ctx.createRadialGradient(originX, originY, r0, originX, originY, r1);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.92)');
        grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.45)');
        grad.addColorStop(0.90, 'rgba(0, 0, 0, 0.12)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(originX, originY, r1 + 5, 0, Math.PI * 2);
        ctx.fill();

        // Step 3: Draw soft atmospheric aura bloom along the feathered melting boundary
        const auraAlpha = Math.max(0, (1 - progress) * 0.65);
        if (auraAlpha > 0.01) {
          ctx.globalCompositeOperation = 'source-over';
          const glowGrad = ctx.createRadialGradient(originX, originY, r0, originX, originY, r1);
          glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          glowGrad.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * auraAlpha})`);
          glowGrad.addColorStop(0.68, `rgba(255, 126, 152, ${0.42 * auraAlpha})`);
          glowGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(originX, originY, r1 + 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        animFrameIdRef.current = requestAnimationFrame(renderFrame);
      } else {
        // Portal has fully expanded past all screen corners!
        ctx.clearRect(0, 0, w, h);
        ctx.restore();
        setSplashStage('completed');
        onComplete();
      }
    };

    animFrameIdRef.current = requestAnimationFrame(renderFrame);
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
  // - Phase 1: Bouncing ball drop (1050ms)
  // - Phase 2: Dash to 'F' (240ms)
  // - Phase 3: Reveal F-M-C-U T-E-A-M-S sequentially (230ms/char)
  // - Phase 4: Immediately after last letter 'S', jump directly to Actual Date Pill position (340ms)
  // - Phase 5: Bounce into position & transform size to match Actual Date Pill with 100% precision (520ms)
  // - Phase 6: Trigger circular aperture dissolve from the Actual Date Pill (420ms)
  useEffect(() => {
    let isMounted = true;
    const timerIds: ReturnType<typeof setTimeout>[] = [];
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
        width: 26,
        height: 26,
        opacity: 1,
        scale: 1,
        isBouncing: true,
        isJumping: false,
        isMorphingPill: false,
      });

      // Phase 2: After bouncing settles (1050ms), dash directly into letter 'F'
      const tBounce = setTimeout(() => {
        if (!isMounted) return;

        setDotPos({
          x: fPos.x,
          y: fPos.y,
          width: 26,
          height: 26,
          opacity: 1,
          scale: 1,
          isBouncing: false,
          isJumping: false,
          isMorphingPill: false,
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
            if (currentIdx < CHARACTERS.length) {
              const target = validPositions[currentIdx];
              setDotPos({
                x: target.x,
                y: target.y,
                width: 26,
                height: 26,
                opacity: 1,
                scale: 1,
                isBouncing: false,
                isJumping: false,
                isMorphingPill: false,
              });
              setRevealedCharIndex(currentIdx);
            } else {
              // Dot has just finished the last letter 'S'!
              if (intervalId) clearInterval(intervalId);

              // Step briefly to slot right after 'S' and immediately jump to Actual Date Pill!
              const afterSTarget = validPositions[CHARACTERS.length] || validPositions[CHARACTERS.length - 1];
              setDotPos({
                x: afterSTarget.x,
                y: afterSTarget.y,
                width: 26,
                height: 26,
                opacity: 1,
                scale: 1,
                isBouncing: false,
                isJumping: false,
                isMorphingPill: false,
              });

              const tImmediateJump = setTimeout(() => {
                if (!isMounted) return;

                // Measure exact position & size of the Actual Date Pill
                const pillTarget = measureActualDatePill();
                setSplashStage('jumping');
                setDotPos({
                  x: pillTarget.relX,
                  y: pillTarget.relY,
                  width: 26,
                  height: 26,
                  opacity: 1,
                  scale: 1,
                  isBouncing: false,
                  isJumping: true,
                  isMorphingPill: false,
                });

                // After jumping to the Actual Date Pill (340ms), bounce into position & transform size to match the pill!
                const tLandAndMorph = setTimeout(() => {
                  if (!isMounted) return;

                  const exactPill = measureActualDatePill();
                  setSplashStage('morphing');
                  setDotPos({
                    x: exactPill.relX,
                    y: exactPill.relY,
                    width: exactPill.width,
                    height: exactPill.height,
                    opacity: 1,
                    scale: 1,
                    isBouncing: false,
                    isJumping: false,
                    isMorphingPill: true,
                  });

                  // After bounce & size transform lock with 100% precision (520ms), trigger Dissolve!
                  const tDissolve = setTimeout(() => {
                    if (!isMounted) return;
                    const finalPill = measureActualDatePill();
                    triggerDissolve(
                      finalPill.screenX,
                      finalPill.screenY,
                      Math.max(finalPill.width, finalPill.height) * 0.45
                    );
                  }, 520);
                  timerIds.push(tDissolve);
                }, 340);
                timerIds.push(tLandAndMorph);
              }, 150);
              timerIds.push(tImmediateJump);
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
  const isJumpingOrLater =
    splashStage === 'jumping' || splashStage === 'morphing' || splashStage === 'dissolving';
  const isPillMorphed = splashStage === 'morphing' || splashStage === 'dissolving';

  return (
    <div
      onClick={() => triggerDissolve()}
      className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer select-none touch-none overscroll-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: isDissolving ? 'transparent' : '#000000',
        pointerEvents: isDissolving ? 'none' : 'auto',
      }}
      title="Ketuk untuk langsung membuka portal"
    >
      {/* Invisible Layout Mirror of HomeScreen CalendarStrip (Fallback when HomeScreen is not mounted underneath) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none opacity-0 flex flex-col px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] max-w-md mx-auto w-full select-none -z-10"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[26px] font-extrabold leading-[1.15]">
              Your Weekly
              <br />
              Schedule
            </div>
            <div className="text-xs font-semibold mt-1">Selamat Pagi!</div>
          </div>
          <div className="w-10 h-10 rounded-full" />
        </div>
        <div className="pt-[max(0.5rem,env(safe-area-inset-top,16px))] pb-3 mb-3 -mx-5 px-5 sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-extrabold">Kalender Mingguan</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5">Bulan Tahun</span>
          </div>
          <div className="flex items-center justify-between gap-1.5 py-2">
            {weekDays.map((item) => (
              <div
                key={item.dateString}
                data-splash-fallback-pill={item.isToday ? 'actual-date-pill' : undefined}
                className={`flex flex-col items-center justify-center flex-1 min-w-[42px] ${
                  item.isToday ? 'py-3.5 rounded-full transform -translate-y-0.5' : 'py-3 rounded-full'
                }`}
              >
                <span className="text-base font-bold leading-tight">{item.num}</span>
                <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hardware-Accelerated 2D Canvas for Iris Reveal from the Actual Date Pill */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: isDissolving ? 'block' : 'none',
        }}
      />

      {/* Typography & Dot Stage (z-20, sits above the portal canvas; ZERO parent transform distortion so pill coordinates are 100% exact) */}
      <div className="relative z-20 flex flex-col items-center justify-center px-6 py-8 overflow-visible select-none">
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
              transition: dotPos.isBouncing
                ? 'none'
                : dotPos.isJumping
                ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)'
                : dotPos.isMorphingPill
                ? 'transform 120ms ease-out'
                : 'transform 225ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
              opacity: isDissolving ? 0 : dotPos.opacity,
              ...(isDissolving
                ? { transition: 'opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)' }
                : {}),
            }}
          >
            {/* INNER BALL / PILL (Handles drop bounce, jump arc, and bounce + size transform into Actual Date Pill) */}
            <div
              ref={dotBallRef}
              className={`rounded-full flex flex-col items-center justify-center overflow-hidden ${
                dotPos.isBouncing
                  ? 'animate-ball-drop-bounce'
                  : dotPos.isJumping
                  ? 'animate-ball-jump-arc'
                  : dotPos.isMorphingPill
                  ? 'animate-pill-bounce-morph'
                  : ''
              }`}
              style={{
                width: `${dotPos.width}px`,
                height: `${dotPos.height}px`,
                transform:
                  dotPos.isBouncing || dotPos.isJumping || dotPos.isMorphingPill
                    ? undefined
                    : `translate(-50%, -50%) scale(${dotPos.scale})`,
                background: isPillMorphed
                  ? 'linear-gradient(180deg, #FF7E98 0%, #FF5376 100%)'
                  : '#FFFFFF',
                boxShadow: isPillMorphed
                  ? '0 10px 25px -4px rgba(255, 107, 139, 0.55), 0 0 24px 4px rgba(255, 126, 152, 0.45)'
                  : '0 0 16px 3px #FFFFFF, 0 0 32px 8px rgba(45,212,191,0.85), 0 0 55px 16px rgba(56,189,248,0.4)',
                transition:
                  'width 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1), background 260ms ease-out, box-shadow 260ms ease-out',
                willChange: 'transform, width, height',
              }}
            >
              {/* Exact Date Number & Day Label matching CalendarStrip Actual Date Pill */}
              <div
                className="flex flex-col items-center justify-center"
                style={{
                  opacity: isPillMorphed ? 1 : 0,
                  transform: isPillMorphed ? 'scale(1)' : 'scale(0.5)',
                  transition: 'opacity 200ms ease-out 110ms, transform 240ms cubic-bezier(0.22, 1, 0.36, 1) 110ms',
                }}
              >
                <span className="text-base font-bold leading-tight text-white">
                  {todayItem.num}
                </span>
                <span className="text-[10px] font-semibold mt-0.5 text-white/95">
                  {todayItem.label}
                </span>
              </div>
            </div>
          </div>

          {/* Typography "FMCU TEAMS" with GPU-Optimized Seamless Text-Shadow */}
          <div
            className="flex items-center text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.16em] sm:tracking-[0.24em] font-sans overflow-visible"
            style={{
              opacity: isJumpingOrLater ? 0 : 1,
              filter: isJumpingOrLater ? 'blur(5px)' : 'none',
              transform: isJumpingOrLater ? 'scale(0.97)' : 'scale(1)',
              transition:
                'opacity 260ms cubic-bezier(0.25, 1, 0.5, 1), filter 260ms ease-out, transform 260ms ease-out',
              willChange: 'opacity, filter, transform',
            }}
          >
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

            {/* Anchor Slot right AFTER letter 'S' on TEAMS */}
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
