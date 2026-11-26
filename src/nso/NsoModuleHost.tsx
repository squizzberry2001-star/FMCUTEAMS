import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { User } from '../types';
import { NsoRouterProvider } from './routerShim';
import globalsCss from './styles/globals.css?inline';
import reportCss from './styles/report.css?inline';
import reportOverridesCss from './styles/report-overrides.css?inline';

import FacilitatorHomePage from './pages/FacilitatorHomePage';
import FacilitatorEditorPage from './pages/FacilitatorEditorPage';
import FacilitatorChecklistPage from './pages/FacilitatorChecklistPage';
import FacilitatorProductsPage from './pages/FacilitatorProductsPage';
import ReportPage from './pages/ReportPage';
import AudiencePage from './pages/AudiencePage';
import ChecklistTokenPage from './pages/ChecklistTokenPage';
import LeftoverTokenPage from './pages/LeftoverTokenPage';
import TimerTokenPage from './pages/TimerTokenPage';

const NSO_STYLE_ELEMENT_ID = 'fmcu-nso-isolated-styles';

/** Public QR-scanned NSO routes (must work without requiring FMCU Teams login) */
export function isNsoPublicRoute(pathname: string): boolean {
  return /^\/(audience|checklist|leftover|timer)\/[^/]+/.test(pathname);
}

/** Protected NSO routes (accessible after FMCU Teams login) */
export function isNsoProtectedRoute(pathname: string): boolean {
  return (
    pathname === '/facilitator' ||
    pathname.startsWith('/facilitator/') ||
    pathname.startsWith('/report/')
  );
}

interface ParsedNsoRoute {
  kind:
    | 'facilitator-home'
    | 'facilitator-editor'
    | 'facilitator-checklist'
    | 'facilitator-products'
    | 'report'
    | 'audience'
    | 'checklist-token'
    | 'leftover-token'
    | 'timer-token';
  params: Record<string, string>;
}

function matchNsoRoute(pathname: string): ParsedNsoRoute {
  const clean = pathname.replace(/\/+$/, '') || '/facilitator';

  let m = clean.match(/^\/facilitator\/([^/]+)\/checklist$/);
  if (m) return { kind: 'facilitator-checklist', params: { id: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/facilitator\/([^/]+)\/products$/);
  if (m) return { kind: 'facilitator-products', params: { id: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/facilitator\/([^/]+)$/);
  if (m) return { kind: 'facilitator-editor', params: { id: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/report\/([^/]+)$/);
  if (m) return { kind: 'report', params: { id: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/audience\/([^/]+)$/);
  if (m) return { kind: 'audience', params: { token: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/checklist\/([^/]+)$/);
  if (m) return { kind: 'checklist-token', params: { token: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/leftover\/([^/]+)$/);
  if (m) return { kind: 'leftover-token', params: { token: decodeURIComponent(m[1]) } };

  m = clean.match(/^\/timer\/([^/]+)$/);
  if (m) return { kind: 'timer-token', params: { token: decodeURIComponent(m[1]) } };

  return { kind: 'facilitator-home', params: {} };
}

export interface NsoModuleHostProps {
  user?: User | null;
  initialPath?: string;
  initialStoreName?: string;
  onExit?: () => void;
}

export const NsoModuleHost: React.FC<NsoModuleHostProps> = ({
  user,
  initialPath,
  initialStoreName,
  onExit,
}) => {
  const [locationState, setLocationState] = useState<{ pathname: string; search: string }>(() => {
    const startPath =
      initialPath ||
      (typeof window !== 'undefined' &&
      (isNsoPublicRoute(window.location.pathname) || isNsoProtectedRoute(window.location.pathname))
        ? window.location.pathname
        : '/facilitator');
    const startSearch = typeof window !== 'undefined' ? window.location.search : '';
    return { pathname: startPath, search: startSearch };
  });

  // 1. Bridge FMCU Teams login session into NSO sessionStorage (zero duplicate login form!)
  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem('nso-regional-bestie-auth', '1');
      if (user.nik) sessionStorage.setItem('nso-regional-bestie-nik', String(user.nik));
      if (user.name) sessionStorage.setItem('nso-regional-bestie-name', String(user.name));
    } catch {
      // ignore storage errors
    }
  }, [user]);

  // 2. Mount NSO's exact original stylesheets ONLY while NSO view is active (0% bleed into FMCU Teams!)
  useLayoutEffect(() => {
    let styleEl = document.getElementById(NSO_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = NSO_STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }

    // Small reset bridge so Tailwind's preflight doesn't shrink NSO headings/scrolls while active
    const hostBridgeCss = `
      html.fmcu-nso-active,
      html.fmcu-nso-active body,
      html.fmcu-nso-active #root {
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      .nso-module-host {
        position: relative !important;
        width: 100% !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior-y: contain !important;
      }
      .nso-module-host h1 { font-size: 2em; font-weight: 700; }
      .nso-module-host h2 { font-size: 1.5em; font-weight: 700; }
      .nso-module-host h3 { font-size: 1.17em; font-weight: 700; }
      .nso-module-host img, .nso-module-host svg { display: inline-block; }
      @media print {
        html.fmcu-nso-active,
        html.fmcu-nso-active body,
        html.fmcu-nso-active #root,
        .nso-module-host {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;

    styleEl.textContent = `${globalsCss}\n${reportCss}\n${reportOverridesCss}\n${hostBridgeCss}`;
    document.documentElement.classList.add('fmcu-nso-active');

    return () => {
      document.documentElement.classList.remove('fmcu-nso-active');
      const existing = document.getElementById(NSO_STYLE_ELEMENT_ID);
      if (existing) existing.remove();
    };
  }, []);

  // 3. Keep URL & browser back/forward synchronized cleanly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentFull = `${window.location.pathname}${window.location.search}`;
    const targetFull = `${locationState.pathname}${locationState.search}`;
    if (currentFull !== targetFull) {
      window.history.pushState({ fmcuNso: true }, '', targetFull);
    }
  }, [locationState.pathname, locationState.search]);

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      const nextSearch = window.location.search;
      if (isNsoPublicRoute(nextPath) || isNsoProtectedRoute(nextPath)) {
        setLocationState({ pathname: nextPath, search: nextSearch });
      } else if (onExit) {
        onExit();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onExit]);

  const navigate = (to: string) => {
    const parsed = new URL(to, window.location.origin);
    setLocationState({ pathname: parsed.pathname, search: parsed.search });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleExitToFmcu = onExit
    ? () => {
        if (
          typeof window !== 'undefined' &&
          (isNsoProtectedRoute(window.location.pathname) || isNsoPublicRoute(window.location.pathname))
        ) {
          window.history.replaceState({}, '', '/');
        }
        onExit();
      }
    : undefined;

  const matched = useMemo(() => matchNsoRoute(locationState.pathname), [locationState.pathname]);

  const routerValue = useMemo(
    () => ({
      pathname: locationState.pathname,
      search: locationState.search,
      params: matched.params,
      navigate,
      onExitNso: handleExitToFmcu,
      initialStoreName,
    }),
    [locationState.pathname, locationState.search, matched.params, handleExitToFmcu, initialStoreName]
  );

  return (
    <div className="nso-module-host h-screen h-[100dvh] max-h-[100dvh] w-full bg-[#f8fafc] select-text overflow-y-auto overflow-x-hidden">
      <NsoRouterProvider value={routerValue}>
        {matched.kind === 'facilitator-home' && <FacilitatorHomePage />}
        {matched.kind === 'facilitator-editor' && <FacilitatorEditorPage />}
        {matched.kind === 'facilitator-checklist' && <FacilitatorChecklistPage />}
        {matched.kind === 'facilitator-products' && <FacilitatorProductsPage />}
        {matched.kind === 'report' && <ReportPage />}
        {matched.kind === 'audience' && <AudiencePage />}
        {matched.kind === 'checklist-token' && <ChecklistTokenPage />}
        {matched.kind === 'leftover-token' && <LeftoverTokenPage />}
        {matched.kind === 'timer-token' && <TimerTokenPage />}
      </NsoRouterProvider>
    </div>
  );
};

export default NsoModuleHost;
