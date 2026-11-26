'use client';

import type { ReactNode } from 'react';
import { NsoLink as Link, useNsoRouter } from '@nso/routerShim';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 10.9 12 3l9 7.9v9.6a.5.5 0 0 1-.5.5h-5.4v-6.2H8.9V21H3.5a.5.5 0 0 1-.5-.5v-9.6Zm3.2.1v7.2h1.2v-6h9.2v6h1.2V11L12 5.9 6.2 11Z" fill="currentColor" />
    </svg>
  );
}

export function AppHeader({ title = 'Regional Bestie NSO Report', actions }: { title?: string; actions?: ReactNode }) {
  const { onExitNso } = useNsoRouter();

  return (
    <header className="topbar app-header" aria-label="Navigasi utama">
      <Link href="/facilitator" className="brand app-brand" style={{ textDecoration: 'none' }}>
        <span className="brand-badge" aria-hidden="true">
          <span className="g" />
          <span className="w">FamilyMart</span>
          <span className="b" />
        </span>
        <span className="brand-copy"><b>{title}</b></span>
      </Link>
      <nav className="actions app-header-nav" aria-label="Shortcut">
        {onExitNso ? (
          <button
            type="button"
            className="btn secondary"
            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
            onClick={onExitNso}
          >
            ← FMCU Teams
          </button>
        ) : null}
        <Link className="header-top-action header-home-action" href="/facilitator" aria-label="Home"><span><HomeIcon /></span></Link>
        {actions}
      </nav>
    </header>
  );
}
