'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { NsoLink as Link, useNsoRouter, useParams, useSearchParams } from '@nso/routerShim';
import { QRCodeCanvas } from 'qrcode.react';
import { AppHeader } from '@nso/components/AppHeader';
import { PinAccessModal } from '@nso/components/PinAccessModal';
import { Field } from '@nso/components/Field';
import { ImageInput } from '@nso/components/ImageInput';
import {
  BEHAVIOR_METRICS,
  CREW_LEVELS,
  CrewBehaviorRow,
  CrewSpeedRow,
  FACILITATORS,
  GROUP_MODES,
  GroupRole,
  ProductLine,
  ProductMasterItem,
  ReportData,
  DEFAULT_STORE_PIN,
  SPEED_CASHIER_METRICS,
  SPEED_PRODUCT_METRICS,
  SpeedAccuracyGroup,
  SpeedMetric
} from '@nso/lib/types';
import { deleteReport, getReport, saveReport, upsertHistory } from '@nso/lib/localStore';
import { deleteRemoteReport, loadRemoteReport, subscribeReport, convex, upsertRemoteReport } from '@nso/lib/remoteStore';
import { buildRoleComposition, makeCrew, makeSpeedGroup, makeTransaction, roleSlotsForMode, syncCrewDependentRows } from '@nso/lib/reportDefaults';
import { msToTimer, normalizeStoreName, uid } from '@nso/lib/normalize';
import { calculateSuggestPosition, formatStandard, ICE_TEA_STANDARD_MS, isBaristaOk, isCashierOk, KSK_STANDARD_MS, timerClassName, timerTextToMs } from '@nso/lib/evaluation';
import { exportProductListPdf } from '@nso/lib/productListPdf';
import { DEFAULT_PRODUCT_MASTER } from '@nso/lib/productMaster';
import { makeReadinessIssueSummary } from '@nso/lib/preparationChecklist';
import { exportProductUsageExcel } from '@nso/lib/productUsageExcel';

const quickSections = [
  { id: 'general', icon: 'home', label: 'General' },
  { id: 'crew', icon: 'crew', label: 'Crew' },
  { id: 'behavior', icon: 'behavior', label: 'Behavior' },
  { id: 'crew-speed', icon: 'timer', label: 'Penilaian' },
  { id: 'team-speed', icon: 'team', label: 'Team' },
  { id: 'summary', icon: 'summary', label: 'Summary' },
  { id: 'leftover', icon: 'leftover', label: 'Sisa' },
  { id: 'documentation', icon: 'camera', label: 'Dok' },
  { id: 'layout', icon: 'layout', label: 'Layout' },
  { id: 'planogram', icon: 'planogram', label: 'Plano' }
] as const;

type SectionId = (typeof quickSections)[number]['id'];

type GapAssessment = 'OK' | 'Learning' | 'Non Learning' | '';

const LEVEL_SORT_ORDER = new Map(CREW_LEVELS.map((level, index) => [level, index]));
const BEHAVIOR_LEARNING_CORRECTION = 'Refreshment ulang oleh fasilitator';
const BEHAVIOR_NON_LEARNING_CORRECTION = 'Sosialisasi ulang oleh fasilitator';
const SPEED_LEARNING_CORRECTION = 'Refreshment dan evaluasi ulang';
const SPEED_NON_LEARNING_CORRECTION = 'Sosialisasi dan praktik ulang';
const SUMMARY_AUTO_CORRECTION = 'Rekomendasi STO/Order/Reservasi Order/Pembelian Pettycash';
const LEGACY_DEFAULT_PIN = DEFAULT_STORE_PIN;

function normalizeStorePin(value?: string) {
  return String(value ?? '').replace(/\D/g, '');
}

function expectedStorePin(report: ReportData) {
  return normalizeStorePin(report.accessCode) || LEGACY_DEFAULT_PIN;
}

function pinMatches(input: string, expected: string) {
  const cleanInput = normalizeStorePin(input).slice(0, 4);
  const cleanExpected = normalizeStorePin(expected);
  return cleanInput === cleanExpected || (cleanInput.length === 4 && cleanExpected.length > 4 && cleanExpected.startsWith(cleanInput));
}

function hasSessionPinAccess(storeId: string) {
  try { return localStorage.getItem(`nso-store-pin-ok:${storeId}`) === '1'; } catch { return false; }
}

function markSessionPinAccess(storeId: string) {
  try { localStorage.setItem(`nso-store-pin-ok:${storeId}`, '1'); } catch { /* ignore */ }
}


function hasMeaningfulText(value?: string) {
  const text = String(value ?? '').trim();
  return Boolean(text && text !== '-');
}

function joinCorrection(parts: string[]) {
  return Array.from(new Set(parts.filter(Boolean))).join(' / ') || '-';
}

function behaviorCorrection(gapLearning?: string, gapNonLearning?: string) {
  return joinCorrection([
    hasMeaningfulText(gapLearning) ? BEHAVIOR_LEARNING_CORRECTION : '',
    hasMeaningfulText(gapNonLearning) ? BEHAVIOR_NON_LEARNING_CORRECTION : ''
  ]);
}

function speedCorrection(gapLearning?: string, gapNonLearning?: string) {
  return joinCorrection([
    hasMeaningfulText(gapLearning) ? SPEED_LEARNING_CORRECTION : '',
    hasMeaningfulText(gapNonLearning) ? SPEED_NON_LEARNING_CORRECTION : ''
  ]);
}

function parseTransactionGapFinding(raw?: string) {
  const text = (raw === '-' ? '' : (raw || '')).trim();
  const isNonLearning = /\bNon[- ]?Learning\b/i.test(text);
  const withoutNonLearning = text.replace(/\bNon[- ]?Learning\b/gi, '').trim();
  const isLearning = /\bLearning\b/i.test(withoutNonLearning);

  return { isLearning, isNonLearning };
}

function formatTransactionGapFinding(isLearning: boolean, isNonLearning: boolean) {
  const tags: string[] = [];
  if (isLearning) tags.push('Learning');
  if (isNonLearning) tags.push('Non Learning');
  return tags.join(', ');
}

function computeTransactionCorrection(isLearning: boolean, isNonLearning: boolean, currentCorrection: string) {
  const autoCorrections = [
    SPEED_LEARNING_CORRECTION,
    SPEED_NON_LEARNING_CORRECTION,
    `${SPEED_LEARNING_CORRECTION} / ${SPEED_NON_LEARNING_CORRECTION}`,
    'Refreshment dan evaluasi ulang / sosialisasi dan praktik ulang',
    'sosialisasi dan praktik ulang',
    '-'
  ];
  if (isLearning && isNonLearning) {
    return `${SPEED_LEARNING_CORRECTION} / ${SPEED_NON_LEARNING_CORRECTION}`;
  }
  if (isLearning) {
    return SPEED_LEARNING_CORRECTION;
  }
  if (isNonLearning) {
    return SPEED_NON_LEARNING_CORRECTION;
  }
  const isAuto = !currentCorrection.trim() || autoCorrections.includes(currentCorrection.trim());
  return isAuto ? '' : currentCorrection;
}

function normalizeGapList(value?: string) {
  return String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item && item !== '-');
}

function addGapItem(value: string | undefined, item: string) {
  const list = normalizeGapList(value).filter((line) => line !== item);
  return [...list, item].join('\n') || '-';
}

function removeGapItem(value: string | undefined, item: string) {
  const next = normalizeGapList(value).filter((line) => line !== item).join('\n');
  return next || '-';
}

function gapAssessmentFor(row: CrewSpeedRow, metric: SpeedMetric): GapAssessment {
  if (row.values[metric] === 'Y') return 'OK';
  if (normalizeGapList(row.gapLearning).includes(metric)) return 'Learning';
  if (normalizeGapList(row.gapNonLearning).includes(metric)) return 'Non Learning';
  return '';
}

function sortCrewsByLevel(crews: ReportData['crews']) {
  return [...crews].sort((a, b) => (LEVEL_SORT_ORDER.get(a.level) ?? 999) - (LEVEL_SORT_ORDER.get(b.level) ?? 999) || a.name.localeCompare(b.name));
}

function appendNextNumberLine(value: string) {
  const clean = value && value !== '-' ? value.trimEnd() : '';
  const numbers = clean
    .split('\n')
    .map((line) => Number(line.trim().match(/^(\d+)\./)?.[1] ?? 0))
    .filter(Boolean);
  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  const prefix = clean ? '\n' : '';
  return `${clean}${prefix}${nextNumber}. `;
}


function updateArrayItem<T extends { id?: string; crewId?: string }>(items: T[], key: string, patch: Partial<T>): T[] {
  return items.map((item) => ((item.id ?? item.crewId) === key ? { ...item, ...patch } : item));
}

function IconGlyph({ icon }: { icon: string }) {
  if (icon === 'home') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Zm2 1V19h2v-6h10v6h2v-7.2l-7-6.1-7 6.1Z" fill="currentColor" /></svg>;
  }
  if (icon === 'crew') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0h-2a5 5 0 0 0-10 0H5Zm13.2-8.7a3 3 0 0 0 .8-5.9v2.1a1 1 0 0 1 0 1.8v2Zm1.8 8.7a8.9 8.9 0 0 0-2.5-5.4 5 5 0 0 1 5 5.4H20ZM5 12.3v-2a1 1 0 0 1 0-1.8V6.4a3 3 0 0 0 0 5.9ZM4 21H2a5 5 0 0 1 5-5.4A8.9 8.9 0 0 0 4 21Z" fill="currentColor" /></svg>;
  }
  if (icon === 'behavior') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21a9 9 0 1 1 9-9 9 9 0 0 1-9 9Zm-3.5-8.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm7 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM8 14.5a5 5 0 0 0 8 0l-1.6-1.1a3.1 3.1 0 0 1-4.8 0L8 14.5Z" fill="currentColor" /></svg>;
  }
  if (icon === 'timer') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 2h2v2.1a8 8 0 1 1-2 0V2Zm1 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm1-10v3.6l2.6 1.5-1 1.7-3.6-2.1V10h2Zm5.6-4.8 1.4 1.4-1.3 1.3-1.4-1.4 1.3-1.3Z" fill="currentColor" /></svg>;
  }
  if (icon === 'team') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2 20a5 5 0 0 1 10 0H2Zm10 0a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0h-2Z" fill="currentColor" /></svg>;
  }
  if (icon === 'summary') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 3h6v2H9V8Zm0 4h6v2H9v-2Zm0 4h4v2H9v-2Z" fill="currentColor" /></svg>;
  }
  if (icon === 'leftover') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h12l-1 18H7L6 3Zm2.1 2 .8 14h6.2l.8-14H8.1ZM4 6h16v2H4V6Zm6 4h4v2h-4v-2Zm0 4h4v2h-4v-2Z" fill="currentColor" /></svg>;
  }
  if (icon === 'camera') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.6 5.5 10 3.8h4l1.4 1.7H19a2 2 0 0 1 2 2v10.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h3.6ZM12 16.5a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z" fill="currentColor" /></svg>;
  }
  if (icon === 'layout') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 4h16v16H4V4Zm2 2v5h5V6H6Zm7 0v5h5V6h-5Zm-7 7v5h12v-5H6Z" fill="currentColor" /></svg>;
  }
  if (icon === 'planogram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 1h3v3H8V8Zm5 0h3v3h-3V8Zm-5 5h3v3H8v-3Zm5 0h3v3h-3v-3Z" fill="currentColor" /></svg>;
  }
  if (icon === 'checklist') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 4h14v16H5V4Zm2 2v12h10V6H7Zm2 2h6v2H9V8Zm0 4h1.6l1.2 1.2L15 10l1.4 1.4-4.6 4.6L9 13.2V12Z" fill="currentColor" /></svg>;
  }
  if (icon === 'open') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5h7v2H7v10h10v-5h2v7H5V5Zm9 0h5v5h-2V8.4l-6.3 6.3-1.4-1.4L15.6 7H14V5Z" fill="currentColor" /></svg>;
  }
  if (icon === 'settings') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.4 7.4 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5L10 21.5h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="currentColor" /></svg>;
  }
  if (icon === 'plus') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" fill="currentColor" /></svg>;
  }
  if (icon === 'delete') {
    return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4h8l1 2h4v2H3V6h4l1-2Zm1 6h2v7H9v-7Zm4 0h2v7h-2v-7ZM6 9h12l-1 12H7L6 9Z" fill="currentColor" /></svg>;
  }
  if (icon === 'QR') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm8-3h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-3 3h2v2h-2v-2Zm3 3h2v2h-2v-2Zm3-3h2v5h-5v-2h3v-3Zm-6 3h2v2h-2v-2Z" fill="currentColor" />
      </svg>
    );
  }
  if (icon === 'PDF') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3h7l5 5v13H7V3Zm7 1.8V9h4.2L14 4.8ZM9 13.2h2.5c1.5 0 2.4-.8 2.4-2.1s-.9-2.1-2.4-2.1H9v4.2Zm1.7-1.4v-1.4h.7c.6 0 1 .3 1 .7s-.4.7-1 .7h-.7Zm4.2 4.2h1.7v-2h1.6c1.3 0 2.2-.8 2.2-2s-.9-2-2.2-2h-3.3v6Zm1.7-3.4v-1.2h1c.5 0 .8.2.8.6s-.3.6-.8.6h-1ZM8.9 18H10l.4-1.1h2.1L13 18h1.2l-2.1-6H11l-2.1 6Zm2-2 .6-1.8.6 1.8h-1.2Z" fill="currentColor" />
      </svg>
    );
  }
  return <>{icon}</>;
}

function ActionLink({ href, icon, label, className = '', title, target }: { href: string; icon: string; label: string; className?: string; title?: string; target?: string }) {
  return <Link className={`icon-btn ${className}`} href={href} title={title ?? label} target={target}><span><IconGlyph icon={icon} /></span><b>{label}</b></Link>;
}

function IconButton({ icon, label, className = '', disabled, onClick, type = 'button' }: { icon: string; label: string; className?: string; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return <button type={type} className={`icon-btn ${className}`} disabled={disabled} onClick={onClick} title={label} aria-label={label}><span><IconGlyph icon={icon} /></span><b>{label}</b></button>;
}

function MetricToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`metric-toggle ${checked ? 'checked' : ''}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => { window.navigator?.vibrate?.(40); onChange(event.target.checked); }} />
      <b>{checked ? 'OK' : '-'}</b>
    </label>
  );
}

function AssessmentToggle({ label, value, onChange }: { label: string; value: GapAssessment; onChange: (value: GapAssessment) => void }) {
  return (
    <div className={
      'assessment-toggle ' +
      (value === 'OK' ? 'ok' : value === 'Learning' ? 'learning' : value === 'Non Learning' ? 'non-learning' : '')
    }>
      <b>{label}</b>
      <div>
        <button type="button" className={value === 'OK' ? 'active' : ''} onClick={() => { window.navigator?.vibrate?.(40); onChange('OK'); }}>OK</button>
        <button type="button" className={value === 'Learning' ? 'active' : ''} onClick={() => { window.navigator?.vibrate?.(40); onChange('Learning'); }}>Gap Learning</button>
        <button type="button" className={value === 'Non Learning' ? 'active' : ''} onClick={() => { window.navigator?.vibrate?.(40); onChange('Non Learning'); }}>Gap Non Learning</button>
      </div>
    </div>
  );
}

function NumberButtons({ onPick }: { onPick: () => void }) {
  return (
    <div className="number-button-row single-number-row">
      <button type="button" onClick={onPick}>+ Nomor</button>
    </div>
  );
}

type RichAction = 'number' | 'bullet' | 'bold' | 'italic' | 'underline';

function nextNumberText(value: string) {
  return appendNextNumberLine(value);
}

function appendBulletLine(value: string) {
  const clean = value && value !== '-' ? value.trimEnd() : '';
  return `${clean}${clean ? '\n' : ''}• `;
}

function wrapText(value: string, textarea: HTMLTextAreaElement | null, before: string, after: string, placeholder = 'teks') {
  const text = value === '-' ? '' : value;
  const start = textarea?.selectionStart ?? text.length;
  const end = textarea?.selectionEnd ?? text.length;
  const selected = text.slice(start, end) || placeholder;
  const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  const cursor = start + before.length + selected.length + after.length;
  window.setTimeout(() => {
    textarea?.focus();
    textarea?.setSelectionRange(cursor, cursor);
  }, 0);
  return next || '-';
}

function RichTextarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  function apply(action: RichAction) {
    let next = value;
    if (action === 'number') next = nextNumberText(value);
    if (action === 'bullet') next = appendBulletLine(value);
    if (action === 'bold') next = wrapText(value, textareaRef.current, '**', '**');
    if (action === 'italic') next = wrapText(value, textareaRef.current, '_', '_');
    if (action === 'underline') next = wrapText(value, textareaRef.current, '<u>', '</u>');
    onChange(next);
  }
  return (
    <div className="rich-textarea">
      <div className="rich-toolbar" aria-label="Format text">
        <button type="button" onClick={() => apply('number')} onMouseDown={(e) => e.preventDefault()}>1.</button>
        <button type="button" onClick={() => apply('bullet')} onMouseDown={(e) => e.preventDefault()}>•</button>
        <button type="button" onClick={() => apply('bold')} onMouseDown={(e) => e.preventDefault()}><b>B</b></button>
        <button type="button" onClick={() => apply('italic')} onMouseDown={(e) => e.preventDefault()}><i>I</i></button>
        <button type="button" onClick={() => apply('underline')} onMouseDown={(e) => e.preventDefault()}><u>U</u></button>
      </div>
      <textarea ref={textareaRef} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}


function formatManualTimerInput(input: string) {
  const rawDigits = input.replace(/\D/g, '').slice(0, 6);
  const digits = rawDigits.replace(/^0+(?=\d{3,})/, '');
  if (!digits) return '';
  if (digits.length <= 2) return `00:${digits.padStart(2, '0')}`;
  if (digits.length <= 4) {
    const minutes = digits.slice(0, -2).padStart(2, '0');
    const seconds = digits.slice(-2).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  const hours = digits.slice(0, -4);
  const minutes = digits.slice(-4, -2).padStart(2, '0');
  const seconds = digits.slice(-2).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function normalizeManualTimerValue(value: string) {
  const ms = timerTextToMs(value);
  return ms === null ? '' : msToTimer(ms);
}

function CrewTimerControl({ label, value, standardMs, onSave }: { label: string; value: string; standardMs: number; onSave: (value: string) => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(timerTextToMs(value) ?? 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) setElapsed(timerTextToMs(value) ?? 0);
  }, [value, running]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (startRef.current != null) setElapsed(Date.now() - startRef.current);
    }, 90);
    return () => window.clearInterval(timer);
  }, [running]);

  function start() {
    if (running) return;
    startRef.current = Date.now() - elapsed;
    setRunning(true);
  }

  function stop() {
    if (startRef.current == null) return;
    const total = Date.now() - startRef.current;
    startRef.current = null;
    setElapsed(total);
    setRunning(false);
    onSave(msToTimer(total));
  }

  function reset() {
    startRef.current = null;
    setElapsed(0);
    setRunning(false);
    onSave('');
  }

  const statusClass = running ? 'running' : timerClassName(value, standardMs);
  return (
    <div className={
      'crew-timer-control ' + statusClass
    }>
      <div className="mini-timer-label">{label} max {formatStandard(standardMs)}</div>
      <button type="button" className="mini-timer-value mini-timer-button" onClick={running ? stop : start} title={running ? 'Stop timer' : 'Start timer'}>
        <span className="timer-play-stop">{running ? 'STOP' : 'PLAY'}</span>
        <strong>{running ? msToTimer(elapsed) : (value || '00:00')}</strong>
      </button>
      <input
        className="mini-timer-manual"
        value={value}
        disabled={running}
        placeholder="0130 = 01:30"
        inputMode="numeric"
        onChange={(event) => onSave(formatManualTimerInput(event.target.value))}
        onBlur={(event) => onSave(normalizeManualTimerValue(event.target.value))}
      />
      <div className="mini-timer-actions">
        <IconButton icon="↺" label="Reset" className="secondary small-icon" onClick={reset} />
      </div>
    </div>
  );
}

function QrModal({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card qr-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-header compact-header"><h2>{title}</h2><IconButton icon="✕" label="Tutup" className="secondary" onClick={onClose} /></div>
        <QRCodeCanvas value={url} size={380} includeMargin />
        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      </div>
    </div>
  );
}

function productDisplayName(item: ProductMasterItem) {
  return `${item.category} - ${item.name}${item.article ? ` (${item.article})` : ''}`;
}

function ProductSelect({ master, value, onChange }: { master: ProductMasterItem[]; value: string; onChange: (item: ProductMasterItem) => void }) {
  const [query, setQuery] = useState('');
  const selected = master.find((item) => item.name === value) ?? master[0];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? master.filter((item) => [item.category, item.article, item.name].join(' ').toLowerCase().includes(normalizedQuery)).slice(0, 90)
    : master;
  const kitchen = filtered.filter((item) => item.category === 'Kitchen');
  const beverage = filtered.filter((item) => item.category === 'Beverage');
  return (
    <div className="product-search-select">
      <div className="product-search-row">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          placeholder="Search produk / article..."
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <select value={selected?.id ?? ''} onChange={(event) => {
        const item = master.find((option) => option.id === event.target.value);
        if (item) onChange(item);
      }}>
        <option value="">Pilih produk</option>
        {beverage.length ? <optgroup label="Beverage">{beverage.map((item) => <option key={item.id} value={item.id}>{productDisplayName(item)}</option>)}</optgroup> : null}
        {kitchen.length ? <optgroup label="Kitchen">{kitchen.map((item) => <option key={item.id} value={item.id}>{productDisplayName(item)}</option>)}</optgroup> : null}
      </select>
      {normalizedQuery && filtered.length ? (
        <div className="product-suggestion-list">
          {filtered.slice(0, 6).map((item) => (
            <button type="button" key={item.id} onClick={() => { onChange(item); setQuery(''); }}>
              <b>{item.name}</b><small>{item.category} • {item.article || '-'}</small>
            </button>
          ))}
        </div>
      ) : null}
      {normalizedQuery && !filtered.length ? <small className="product-search-empty">Produk tidak ditemukan.</small> : null}
    </div>
  );
}

function RoleComposer({ group, report, onChange }: { group: SpeedAccuracyGroup; report: ReportData; onChange: (patch: Partial<SpeedAccuracyGroup>) => void }) {
  const selectableCrews = sortCrewsByLevel(report.crews).filter((crew) => crew.name.trim());
  const slots = roleSlotsForMode(group.modeLabel);
  const assignments = group.roleAssignments ?? {};

  function updateSlot(role: GroupRole, roleIndex: number, name: string) {
    const nextAssignments: SpeedAccuracyGroup['roleAssignments'] = {
      Cashier: [...(assignments.Cashier ?? [])],
      Barista: [...(assignments.Barista ?? [])],
      Support: [...(assignments.Support ?? [])]
    };
    const arr = [...(nextAssignments[role] ?? [])];
    arr[roleIndex] = name;
    nextAssignments[role] = arr;
    const teamMembers = Object.values(nextAssignments).flat().filter(Boolean).join('\n');
    onChange({ roleAssignments: nextAssignments, teamMembers, roleComposition: buildRoleComposition(group.modeLabel, nextAssignments) });
  }

  if (!selectableCrews.length) return <p className="muted">Belum ada data crew. Tambahkan crew di Section 2 terlebih dahulu.</p>;

  const roleCounter: Partial<Record<GroupRole, number>> = {};
  return (
    <div className="role-composer">
      {slots.map((role, slotIndex) => {
        const index = roleCounter[role] ?? 0;
        roleCounter[role] = index + 1;
        return (
          <Field key={`${role}-${slotIndex}`} label={`${role} ${index + 1}`}>
            <select value={(assignments[role] ?? [])[index] ?? ''} onChange={(event) => updateSlot(role, index, event.target.value)}>
              <option value="">Pilih Crew</option>
              {selectableCrews.map((crew) => <option key={crew.id} value={crew.name}>{crew.name}</option>)}
            </select>
          </Field>
        );
      })}
    </div>
  );
}

function groupHasCompleteRoles(group: SpeedAccuracyGroup) {
  const slots = roleSlotsForMode(group.modeLabel);
  const required = slots.reduce<Partial<Record<GroupRole, number>>>((acc, role) => ({ ...acc, [role]: (acc[role] ?? 0) + 1 }), {});
  return (Object.entries(required) as [GroupRole, number][]).every(([role, count]) => (group.roleAssignments?.[role] ?? []).filter(Boolean).length >= count);
}

function BehaviorCrewCard({ row, crewName, defaultOpen, onChange }: { row: CrewBehaviorRow; crewName: string; defaultOpen?: boolean; onChange: (patch: Partial<CrewBehaviorRow>) => void }) {
  const okCount = BEHAVIOR_METRICS.filter((metric) => row.values[metric] === 'Y').length;

  function updateGap(field: 'gapLearning' | 'gapNonLearning', value: string) {
    const nextLearning = field === 'gapLearning' ? value : row.gapLearning;
    const nextNonLearning = field === 'gapNonLearning' ? value : row.gapNonLearning;
    onChange({ [field]: value, correction: behaviorCorrection(nextLearning, nextNonLearning) });
  }

  return (
    <details className="observation-card collapsible-card" open={defaultOpen}>
      <summary className="observation-summary">
        <span><b>{crewName || '-'}</b><small>Crew Behavior</small></span>
        <em>{okCount}/{BEHAVIOR_METRICS.length} OK</em>
      </summary>
      <div className="metric-chip-grid behavior-grid">
        {BEHAVIOR_METRICS.map((metric) => (
          <MetricToggle key={metric} label={metric} checked={row.values[metric] === 'Y'} onChange={(checked) => onChange({ values: { ...row.values, [metric]: checked ? 'Y' : 'N' } })} />
        ))}
      </div>
      <div className="grid grid-3 compact-fields">
        <Field label="Gap Learning"><textarea value={row.gapLearning} onChange={(e) => updateGap('gapLearning', e.target.value)} /></Field>
        <Field label="Gap Non-Learning"><textarea value={row.gapNonLearning} onChange={(e) => updateGap('gapNonLearning', e.target.value)} /></Field>
        <Field label="Correction"><textarea value={row.correction} onChange={(e) => onChange({ correction: e.target.value })} /></Field>
      </div>
    </details>
  );
}

function SpeedCrewCard({ row, crewName, defaultOpen, onChange }: { row: CrewSpeedRow; crewName: string; defaultOpen?: boolean; onChange: (patch: Partial<CrewSpeedRow>) => void }) {
  const cashierOk = isCashierOk(row);
  const baristaOk = isBaristaOk(row);
  const suggestPosition = calculateSuggestPosition(row) || 'Belum Memenuhi';

  function updateMetric(metric: SpeedMetric, result: GapAssessment) {
    const nextValues = { ...row.values, [metric]: result === 'OK' ? 'Y' : 'N' };
    let nextLearning = removeGapItem(row.gapLearning, metric);
    let nextNonLearning = removeGapItem(row.gapNonLearning, metric);
    if (result === 'Learning') nextLearning = addGapItem(nextLearning, metric);
    if (result === 'Non Learning') nextNonLearning = addGapItem(nextNonLearning, metric);
    onChange({ values: nextValues, gapLearning: nextLearning, gapNonLearning: nextNonLearning, correction: speedCorrection(nextLearning, nextNonLearning) });
  }

  function updateGap(field: 'gapLearning' | 'gapNonLearning', value: string) {
    const nextLearning = field === 'gapLearning' ? value : row.gapLearning;
    const nextNonLearning = field === 'gapNonLearning' ? value : row.gapNonLearning;
    onChange({ [field]: value, correction: speedCorrection(nextLearning, nextNonLearning) });
  }

  return (
    <details className="observation-card speed-observation-card collapsible-card" open={defaultOpen}>
      <summary className="observation-summary">
        <span><b>{crewName || '-'}</b><small>Cashier {cashierOk ? 'OK' : 'Belum Memenuhi'} / Barista {baristaOk ? 'OK' : 'Belum Memenuhi'}</small></span>
        <em>{suggestPosition}</em>
      </summary>
      <div className="test-split-grid">
        <div className="subsection-panel assessment-panel">
          <div className="subsection-title split-title"><span>Penilaian Cashier</span><b>{cashierOk ? 'OK' : 'Belum Memenuhi'}</b></div>
          <div className="assessment-list">
            {SPEED_CASHIER_METRICS.map((metric) => (
              <AssessmentToggle key={metric} label={metric} value={gapAssessmentFor(row, metric)} onChange={(result) => updateMetric(metric, result)} />
            ))}
          </div>
        </div>
        <div className="subsection-panel assessment-panel beverage-panel">
          <div className="subsection-title split-title"><span>Penilaian Beverage / Barista</span><b>{baristaOk ? 'OK' : 'Belum Memenuhi'}</b></div>
          <div className="barista-timer-grid">
            <div className="subsection-panel timer-subcard">
              <div className="subsection-title">KSK</div>
              <AssessmentToggle label="Sesuai SOP" value={gapAssessmentFor(row, 'KSK Sesuai SOP')} onChange={(result) => updateMetric('KSK Sesuai SOP', result)} />
              <CrewTimerControl label="Waktu" value={row.kskTime} standardMs={KSK_STANDARD_MS} onSave={(value) => onChange({ kskTime: value })} />
            </div>
            <div className="subsection-panel timer-subcard">
              <div className="subsection-title">ICE TEA</div>
              <AssessmentToggle label="Sesuai SOP" value={gapAssessmentFor(row, 'ICE TEA Sesuai SOP')} onChange={(result) => updateMetric('ICE TEA Sesuai SOP', result)} />
              <CrewTimerControl label="Waktu" value={row.iceTeaTime} standardMs={ICE_TEA_STANDARD_MS} onSave={(value) => onChange({ iceTeaTime: value })} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-3 compact-fields">
        <Field label="Gap Learning"><textarea value={row.gapLearning} onChange={(e) => updateGap('gapLearning', e.target.value)} /></Field>
        <Field label="Gap Non-Learning"><textarea value={row.gapNonLearning} onChange={(e) => updateGap('gapNonLearning', e.target.value)} /></Field>
        <Field label="Correction"><textarea value={row.correction} onChange={(e) => onChange({ correction: e.target.value })} /></Field>
      </div>
    </details>
  );
}

function SpeedTestPanel({ type, slotLabel, row, crewId, crews, blockedCrewIds = [], deferTimerAndGap = false, onCrewChange, onChange }: { type: 'cashier' | 'barista'; slotLabel: string; row: CrewSpeedRow | null; crewId: string; crews: ReportData['crews']; blockedCrewIds?: string[]; deferTimerAndGap?: boolean; onCrewChange: (crewId: string) => void; onChange: (patch: Partial<CrewSpeedRow>) => void }) {
  const crew = crews.find((item) => item.id === crewId);
  const title = type === 'cashier' ? 'Test Cashier' : 'Test Barista';
  const statusOk = row ? (type === 'cashier' ? isCashierOk(row) : isBaristaOk(row)) : false;

  function updateMetric(metric: SpeedMetric, checked: boolean) {
    if (!row) return;
    onChange({ values: { ...row.values, [metric]: checked ? 'Y' : 'N' } });
  }

  function updateGap(field: 'gapLearning' | 'gapNonLearning', value: string) {
    if (!row) return;
    const nextLearning = field === 'gapLearning' ? value : row.gapLearning;
    const nextNonLearning = field === 'gapNonLearning' ? value : row.gapNonLearning;
    onChange({ [field]: value, correction: speedCorrection(nextLearning, nextNonLearning) });
  }

  return (
    <div className={`speed-test-panel ${type}`}>
      <div className="speed-test-panel-head">
        <div>
          <p className="eyebrow">{slotLabel} • {title}</p>
          <h3>{crew?.name || 'Pilih Crew'}</h3>
        </div>
        <span className={statusOk ? 'status-pill live' : 'status-pill'}>{statusOk ? 'OK' : 'Belum Memenuhi'}</span>
      </div>
      <Field label="Pilih Crew">
        <select value={crewId} onChange={(event) => onCrewChange(event.target.value)}>
          <option value="">Pilih Crew</option>
          {crews.map((item) => {
            const roleLocked = blockedCrewIds.includes(item.id);
            return <option key={item.id} value={item.id} disabled={roleLocked}>{item.name || item.nik || 'Crew tanpa nama'}{roleLocked ? ` - role ${type === 'cashier' ? 'Cashier' : 'Barista'} sudah dipakai` : ''}</option>;
          })}
        </select>
      </Field>
      {!row ? <p className="muted">Pilih crew untuk mulai penilaian.</p> : null}
      {row && type === 'cashier' ? (
        <div className="metric-chip-grid cashier-grid simple-speed-grid">
          {SPEED_CASHIER_METRICS.map((metric) => (
            <MetricToggle key={metric} label={metric} checked={row.values[metric] === 'Y'} onChange={(checked) => updateMetric(metric, checked)} />
          ))}
        </div>
      ) : null}
      {row && type === 'barista' ? (
        <div className={`barista-timer-grid section4-timer-grid${deferTimerAndGap ? ' section4-inline-timer-grid' : ''}`}>
          <div className="subsection-panel timer-subcard">
            <div className="subsection-title">KSK</div>
            <MetricToggle label="Sesuai SOP" checked={row.values['KSK Sesuai SOP'] === 'Y'} onChange={(checked) => updateMetric('KSK Sesuai SOP', checked)} />
            <CrewTimerControl label="Waktu" value={row.kskTime} standardMs={KSK_STANDARD_MS} onSave={(value) => onChange({ kskTime: value })} />
          </div>
          <div className="subsection-panel timer-subcard">
            <div className="subsection-title">ICE TEA</div>
            <MetricToggle label="Sesuai SOP" checked={row.values['ICE TEA Sesuai SOP'] === 'Y'} onChange={(checked) => updateMetric('ICE TEA Sesuai SOP', checked)} />
            <CrewTimerControl label="Waktu" value={row.iceTeaTime} standardMs={ICE_TEA_STANDARD_MS} onSave={(value) => onChange({ iceTeaTime: value })} />
          </div>
        </div>
      ) : null}
      {row && !deferTimerAndGap ? (
        <div className="section4-gap-area">
          <div className="section4-gap-title"><b>Catatan Gap - {crew?.name || 'Crew'}</b><span>{type === 'cashier' ? 'Penilaian Cashier' : 'Penilaian Barista'}</span></div>
          <div className="grid grid-3 compact-fields section4-gap-fields">
            <Field label="Gap Learning"><textarea value={row.gapLearning} onChange={(e) => updateGap('gapLearning', e.target.value)} /></Field>
            <Field label="Gap Non-Learning"><textarea value={row.gapNonLearning} onChange={(e) => updateGap('gapNonLearning', e.target.value)} /></Field>
            <Field label="Correction"><textarea value={row.correction} onChange={(e) => onChange({ correction: e.target.value })} /></Field>
          </div>
        </div>
      ) : null}

    </div>
  );
}


function SpeedSlotTimerPanel({ slotLabel, type, row, crewName, onChange }: { slotLabel: string; type: 'cashier' | 'barista'; row: CrewSpeedRow | null; crewName: string; onChange: (patch: Partial<CrewSpeedRow>) => void }) {
  if (type !== 'barista') return null;

  function updateMetric(metric: SpeedMetric, checked: boolean) {
    if (!row) return;
    onChange({ values: { ...row.values, [metric]: checked ? 'Y' : 'N' } });
  }

  return (
    <div className="section4-timer-block">
      <div className="section4-block-title"><b>Timer Crew {slotLabel}</b><span>{crewName || 'Pilih Crew'}</span></div>
      {!row ? <p className="muted section4-empty-note">Pilih crew di {slotLabel} untuk mengisi timer.</p> : null}
      {row ? (
        <div className="barista-timer-grid section4-timer-grid section4-timer-grid-wide">
          <div className="subsection-panel timer-subcard">
            <div className="subsection-title">KSK</div>
            <MetricToggle label="Sesuai SOP" checked={row.values['KSK Sesuai SOP'] === 'Y'} onChange={(checked) => updateMetric('KSK Sesuai SOP', checked)} />
            <CrewTimerControl label="Waktu" value={row.kskTime} standardMs={KSK_STANDARD_MS} onSave={(value) => onChange({ kskTime: value })} />
          </div>
          <div className="subsection-panel timer-subcard">
            <div className="subsection-title">ICE TEA</div>
            <MetricToggle label="Sesuai SOP" checked={row.values['ICE TEA Sesuai SOP'] === 'Y'} onChange={(checked) => updateMetric('ICE TEA Sesuai SOP', checked)} />
            <CrewTimerControl label="Waktu" value={row.iceTeaTime} standardMs={ICE_TEA_STANDARD_MS} onSave={(value) => onChange({ iceTeaTime: value })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SpeedSlotGapPanel({ slotLabel, type, row, crewName, onChange }: { slotLabel: string; type: 'cashier' | 'barista'; row: CrewSpeedRow | null; crewName: string; onChange: (patch: Partial<CrewSpeedRow>) => void }) {
  function updateGap(field: 'gapLearning' | 'gapNonLearning', value: string) {
    if (!row) return;
    const nextLearning = field === 'gapLearning' ? value : row.gapLearning;
    const nextNonLearning = field === 'gapNonLearning' ? value : row.gapNonLearning;
    onChange({ [field]: value, correction: speedCorrection(nextLearning, nextNonLearning) });
  }

  return (
    <div className="section4-gap-block">
      <div className="section4-gap-title"><b>Catatan Gap Crew {slotLabel}</b><span>{crewName || (type === 'cashier' ? 'Penilaian Cashier' : 'Penilaian Barista')}</span></div>
      {!row ? <p className="muted section4-empty-note">Pilih crew di {slotLabel} untuk mengisi catatan gap.</p> : null}
      {row ? (
        <div className="grid grid-3 compact-fields section4-gap-fields">
          <Field label="Gap Learning"><textarea value={row.gapLearning} onChange={(e) => updateGap('gapLearning', e.target.value)} /></Field>
          <Field label="Gap Non-Learning"><textarea value={row.gapNonLearning} onChange={(e) => updateGap('gapNonLearning', e.target.value)} /></Field>
          <Field label="Correction"><textarea value={row.correction} onChange={(e) => onChange({ correction: e.target.value })} /></Field>
        </div>
      ) : null}
    </div>
  );
}

function getProgressSummary(report: ReportData) {
  const checks = [
    { ok: Boolean(report.storeName.trim()), label: 'Nama store' },
    { ok: Boolean(report.general.storeLeader.trim()), label: 'Store Leader' },
    { ok: Boolean((report.general.storeCode || '').trim()), label: 'Kode Toko' },
    { ok: Boolean(report.general.areaManager.trim()), label: 'Area Manager' },
    { ok: Boolean((report.general.regionalManager || '').trim()), label: 'Regional Manager' },
    { ok: Boolean(report.general.facilitator.trim()), label: 'Fasilitator 1' },
    { ok: Boolean((report.general.facilitator2 || '').trim()), label: 'Fasilitator 2' },
    { ok: Boolean(report.general.coverPhotoUrl), label: 'Foto cover' },
    { ok: report.crews.length > 0, label: 'Data crew' },
    { ok: report.crews.every((crew) => crew.name && crew.nik), label: 'Nama/NIK crew' },
    { ok: report.crews.every((crew) => crew.photoUrl || crew.groomingPhotoUrl), label: 'Foto crew' },
    { ok: report.behaviorRows.some((row) => BEHAVIOR_METRICS.some((metric) => row.values[metric] === 'Y')), label: 'Crew behavior' },
    { ok: report.speedRows.some((row) => row.kskTime || row.iceTeaTime), label: 'Timer crew KSK/ICE' },
    { ok: report.speedGroups.every((group) => group.teamMembers.trim()), label: 'Komposisi role kelompok' },
    { ok: report.speedGroups.some((group) => group.transactions.some((trx) => trx.actualTime)), label: 'Timer customer' },
    { ok: report.documentationPhotos.length > 0, label: 'Dokumentasi' },
    { ok: report.layoutCounterPhotos.length > 0, label: 'Layout Counter' },
    { ok: report.planogramPhotos.length > 0, label: 'Planogram' }
  ];
  const completed = checks.filter((item) => item.ok).length;
  const percent = Math.round((completed / checks.length) * 100);
  return { percent, completed, total: checks.length, missing: checks.filter((item) => !item.ok).map((item) => item.label).slice(0, 6) };
}

async function parseProductMasterExcel(file: File): Promise<ProductMasterItem[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const items: ProductMasterItem[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' }) as unknown as unknown[][];
    rows.forEach((row, rowIndex) => {
      const article = String(row[1] ?? '').replace(/\.0$/, '').trim();
      const name = String(row[2] ?? '').trim();
      if (!article || !name || name.toLowerCase().includes('nama menu') || rowIndex < 15) return;
      if (!/^\d+/.test(article)) return;
      const category = sheetName.toLowerCase().includes('bev') ? 'Beverage' : 'Kitchen';
      items.push({ id: `master_${category}_${article}_${items.length}`, category, article, name });
    });
  });
  const dedup = new Map(items.map((item) => [`${item.category}-${item.article}-${item.name}`, item]));
  return Array.from(dedup.values());
}
function resolveDriveUrl(url?: string): string | undefined {
  if (!url) return url;
  const driveIdMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/) || url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w2560`;
  if (url.includes("drive.google.com") && url.includes("&sz=")) return url.replace(/&sz=w?\d+/, "&sz=w2560");
  return url;
}

export default function FacilitatorEditor() {
  const { navigate } = useNsoRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const [report, setReport] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('Loading data...');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const quickNavRef = useRef<HTMLDivElement | null>(null);
  const [quickNavFluid, setQuickNavFluid] = useState({ x: 0, width: 0 });
  const [audienceUrl, setAudienceUrl] = useState('');
  const [timerUrl, setTimerUrl] = useState('');
  const [checklistUrl, setChecklistUrl] = useState('');
  const [leftoverUrl, setLeftoverUrl] = useState('');
  const [qrModal, setQrModal] = useState<{ title: string; url: string } | null>(null);
  const [showProductAdmin, setShowProductAdmin] = useState(false);
  const [openGroupId, setOpenGroupId] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [busyLabel, setBusyLabel] = useState('');
  const [speedTestRoles, setSpeedTestRoles] = useState<('cashier' | 'barista')[]>(['cashier', 'barista']);
  const [speedTestCrewIds, setSpeedTestCrewIds] = useState<string[]>(['', '']);
  const [transactionIndexes, setTransactionIndexes] = useState<Record<string, number>>({});
  const [pendingReport, setPendingReport] = useState<ReportData | null>(null);
  const [pinError, setPinError] = useState('');
  const skipAutosaveRef = useRef(false);
  const lastSnapshotRef = useRef('');
  const dirtyUntilRef = useRef(0);

  async function load(fromRealtime = false) {
    if (fromRealtime && Date.now() < dirtyUntilRef.current) return;
    let remote: ReportData | null = null;
    try { remote = await loadRemoteReport(id); } catch { /* fallback */ }
    const local = getReport(id);
    let loaded: ReportData | null = null;
    if (remote && local) {
      // Prefer whichever is newer — local wins if Firebase quota was exceeded
      loaded = new Date(local.updatedAt).getTime() > new Date(remote.updatedAt).getTime() ? local : remote;
    } else {
      loaded = remote ?? local;
    }
    if (loaded) {
      const synced = syncCrewDependentRows(loaded);
      if (!fromRealtime && !hasSessionPinAccess(synced.id)) {
        setReport(null);
        setPendingReport(synced);
        setPinError('');
        setStatus('Masukkan PIN akses untuk membuka data store.');
        return;
      }
      skipAutosaveRef.current = true;
      lastSnapshotRef.current = JSON.stringify(synced);
      setReport(synced);
      setPendingReport(null);
      setStatus(fromRealtime ? 'Data realtime terupdate.' : 'Data loaded.');
    } else {
      setStatus('Data NSO tidak ditemukan. Kembali ke history dan buat NSO baru.');
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const section = searchParams.get('section') as SectionId | null;
    if (section && quickSections.some((item) => item.id === section)) setActiveSection(section);
  }, [searchParams]);

  useEffect(() => {
    if (!report) return;
    setAudienceUrl(`${window.location.origin}/audience/${report.audienceToken}`);
    setTimerUrl(`${window.location.origin}/timer/${report.audienceToken}`);
    setChecklistUrl(`${window.location.origin}/checklist/${report.audienceToken}`);
    setLeftoverUrl(`${window.location.origin}/leftover/${report.audienceToken}`);
  }, [report?.audienceToken]);

  useEffect(() => {
    if (!report) return;
    const snapshot = JSON.stringify(report);
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastSnapshotRef.current) return;
    
    // Mark dirty for 3s while debouncing — blocks snapshots from overwriting mid-edit
    dirtyUntilRef.current = Date.now() + 3000;

    const timeout = window.setTimeout(async () => {
      setSyncStatus('saving');
      const synced = syncCrewDependentRows({ ...report, updatedAt: new Date().toISOString() });
      try {
        saveReport(synced); // Safety net — persists locally first
      } catch (localErr) {
        console.warn('Gagal simpan lokal:', localErr);
      }
      
      try {
        if (convex) {
          try {
            await upsertRemoteReport(synced);
            setStatus('Autosaved ke database.');
            setSyncStatus('saved');
          } catch (e: any) {
            console.error('Firebase save error:', e);
            const msg = e.message || String(e);
            if (msg.includes('maximum size') || msg.includes('exceeds')) {
              alert('Gagal Sinkronisasi Realtime!\n\nKapasitas laporan sudah melebihi batas (1 MB). Anda harus MENGHAPUS beberapa foto lama agar foto baru bisa tersimpan dan tersinkron ke perangkat lain.');
            }
            setStatus(`Tersimpan lokal. Gagal sync cloud: ${msg}`);
          }
        } else {
          setStatus('Tersimpan lokal.');
          setSyncStatus('saved');
        }
      } catch (err: any) {
        setStatus(`Fatal error: ${err.message || String(err)}`);
      }
      lastSnapshotRef.current = JSON.stringify(synced);
      const saveDone = Date.now();
      if (dirtyUntilRef.current < saveDone + 1500) {
        dirtyUntilRef.current = saveDone + 1500;
      }
    }, 850);
    return () => window.clearTimeout(timeout);
  }, [report]);

  useEffect(() => {
    const unsub = subscribeReport(id, (newData) => {
      if (Date.now() < dirtyUntilRef.current) return; // Prevent overwriting while typing
      const isInputActive = typeof document !== 'undefined' &&
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      if (isInputActive) return;

      const synced = syncCrewDependentRows(newData);
      const newSnapshot = JSON.stringify(synced);
      if (newSnapshot === lastSnapshotRef.current) return;

      setReport((current) => {
        if (current && new Date(current.updatedAt).getTime() > new Date(synced.updatedAt).getTime()) {
          return current;
        }
        skipAutosaveRef.current = true;
        lastSnapshotRef.current = newSnapshot;
        setStatus('Data realtime terupdate.');
        return synced;
      });
    });
    return unsub;
  }, [id]);

  const productMaster = report?.productMaster?.length ? report.productMaster : DEFAULT_PRODUCT_MASTER;
  const crewById = useMemo(() => new Map(report?.crews.map((crew) => [crew.id, crew]) ?? []), [report?.crews]);
  const activeGroup = useMemo(() => report?.speedGroups.find((group) => group.timerEnabled) ?? null, [report]);
  const sortedCrews = useMemo(() => report ? sortCrewsByLevel(report.crews) : [], [report?.crews]);
  const orderedBehaviorRows = useMemo(() => sortedCrews.map((crew) => report?.behaviorRows.find((row) => row.crewId === crew.id)).filter(Boolean) as CrewBehaviorRow[], [report?.behaviorRows, sortedCrews]);
  const orderedSpeedRows = useMemo(() => sortedCrews.map((crew) => report?.speedRows.find((row) => row.crewId === crew.id)).filter(Boolean) as CrewSpeedRow[], [report?.speedRows, sortedCrews]);
  const progress = useMemo(() => report ? getProgressSummary(report) : null, [report]);

  useEffect(() => {
    if (!sortedCrews.length) {
      setSpeedTestCrewIds(['', '']);
      return;
    }
    setSpeedTestCrewIds((current) => {
      const next = ['', ''];
      const used = new Set<string>();
      [0, 1].forEach((index) => {
        const currentId = current[index] ?? '';
        const currentValid = currentId && sortedCrews.some((crew) => crew.id === currentId) && !used.has(currentId);
        if (currentValid) {
          next[index] = currentId;
          used.add(currentId);
          return;
        }
        const fallback = sortedCrews.find((crew) => !used.has(crew.id));
        if (fallback) {
          next[index] = fallback.id;
          used.add(fallback.id);
        }
      });
      return next;
    });
  }, [sortedCrews]);

  const speedSlotRows = useMemo(() => speedTestCrewIds.map((crewId) => report?.speedRows.find((row) => row.crewId === crewId) ?? null), [report?.speedRows, speedTestCrewIds]);

  function patch(next: (current: ReportData) => ReportData) {
    dirtyUntilRef.current = Date.now() + 2000; // 2s debounce only
    setReport((current) => current ? syncCrewDependentRows(next(current)) : current);
  }

  function updateBehavior(crewId: string, nextRow: Partial<CrewBehaviorRow>) {
    patch((r) => ({ ...r, behaviorRows: updateArrayItem(r.behaviorRows, crewId, nextRow) }));
  }

  function updateSpeed(crewId: string, nextRow: Partial<CrewSpeedRow>) {
    patch((r) => ({ ...r, speedRows: updateArrayItem(r.speedRows, crewId, nextRow) }));
  }

  function setSpeedSlotRole(slotIndex: number, role: 'cashier' | 'barista') {
    const otherIndex = slotIndex === 0 ? 1 : 0;
    const currentCrewId = speedTestCrewIds[slotIndex] ?? '';
    const otherCrewId = speedTestCrewIds[otherIndex] ?? '';
    const otherRole = speedTestRoles[otherIndex];
    if (currentCrewId && currentCrewId === otherCrewId && role === otherRole) {
      alert('Crew yang sama hanya boleh dipakai di Penilaian lain untuk role kebalikannya.');
      return;
    }
    setSpeedTestRoles((current) => current.map((value, index) => index === slotIndex ? role : value));
  }

  function setSpeedSlotCrew(slotIndex: number, crewId: string) {
    const otherIndex = slotIndex === 0 ? 1 : 0;
    const otherCrewId = speedTestCrewIds[otherIndex] ?? '';
    const sameCrew = Boolean(crewId && crewId === otherCrewId);
    const sameRole = speedTestRoles[slotIndex] === speedTestRoles[otherIndex];
    if (sameCrew && sameRole) {
      const oppositeRole = speedTestRoles[otherIndex] === 'cashier' ? 'barista' : 'cashier';
      setSpeedTestRoles((current) => current.map((value, index) => index === slotIndex ? oppositeRole : value));
      setStatus(`Crew yang sama otomatis diarahkan ke role ${oppositeRole === 'cashier' ? 'Cashier' : 'Barista'} di Penilaian ${slotIndex + 1}.`);
    }
    setSpeedTestCrewIds((current) => current.map((value, index) => index === slotIndex ? crewId : value));
  }
  function setTransactionIndex(groupId: string, nextIndex: number, total: number) {
    const maxIndex = Math.max(0, total - 1);
    setTransactionIndexes((current) => ({ ...current, [groupId]: Math.min(maxIndex, Math.max(0, nextIndex)) }));
  }

  function addSpeedGroup() {
    const nextGroup = makeSpeedGroup((report?.speedGroups.length ?? 0) + 1);
    patch((r) => ({ ...r, speedGroups: [...r.speedGroups, nextGroup] }));
    setOpenGroupId(nextGroup.id);
    setTransactionIndex(nextGroup.id, 0, nextGroup.transactions.length);
  }

  function deleteSpeedGroup(group: SpeedAccuracyGroup) {
    if (!confirm(`Hapus ${group.title}?`)) return;
    const remainingGroups = report?.speedGroups.filter((item) => item.id !== group.id) ?? [];
    const nextOpenGroupId = remainingGroups.some((item) => item.id === openGroupId)
      ? openGroupId
      : remainingGroups.find((item) => item.timerEnabled)?.id ?? remainingGroups[0]?.id ?? '';

    patch((r) => {
      const speedGroups = r.speedGroups.filter((item) => item.id !== group.id);
      const hasActiveGroup = speedGroups.some((item) => item.id === r.activeSpeedGroupId);
      return {
        ...r,
        activeSpeedGroupId: hasActiveGroup ? r.activeSpeedGroupId : '',
        timerSessionActive: speedGroups.some((item) => item.timerEnabled),
        speedGroups
      };
    });
    setOpenGroupId(nextOpenGroupId);
    setTransactionIndexes((current) => {
      const next = { ...current };
      delete next[group.id];
      return next;
    });
  }

  function addTransactionToGroup(groupId: string) {
    patch((r) => ({
      ...r,
      speedGroups: r.speedGroups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          transactions: [...group.transactions, makeTransaction(group.transactions.length + 1, undefined, r.productMaster)]
        };
      })
    }));
    setTransactionIndexes((current) => {
      const group = report?.speedGroups.find(g => g.id === groupId);
      if (!group) return current;
      return { ...current, [groupId]: group.transactions.length };
    });
  }

  function updateGroup(groupId: string, nextGroup: Partial<SpeedAccuracyGroup>) {
    patch((r) => ({ ...r, speedGroups: r.speedGroups.map((g) => g.id === groupId ? { ...g, ...nextGroup } : g) }));
  }

  function updateTransaction(groupOrId: SpeedAccuracyGroup | string, trxId: string, nextTransaction: Partial<SpeedAccuracyGroup['transactions'][number]>) {
    const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId.id;
    patch((r) => ({
      ...r,
      speedGroups: r.speedGroups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          transactions: g.transactions.map((trx) => trx.id === trxId ? { ...trx, ...nextTransaction } : trx)
        };
      })
    }));
  }

  function setGroupTimer(groupId: string, enabled: boolean) {
    const group = report?.speedGroups.find((item) => item.id === groupId);
    if (enabled && group && !groupHasCompleteRoles(group)) {
      alert('Tentukan posisi role semua crew terlebih dahulu sebelum mulai timer.');
      return;
    }
    patch((r) => ({
      ...r,
      activeSpeedGroupId: enabled ? groupId : '',
      timerSessionActive: enabled,
      speedGroups: r.speedGroups.map((group) => ({ ...group, timerEnabled: enabled && group.id === groupId }))
    }));
  }

  function updateProduct(group: SpeedAccuracyGroup, trxId: string, productId: string, nextProduct: Partial<ProductLine>) {
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    if (!transaction) return;
    updateTransaction(group, trxId, {
      products: transaction.products.map((product) => product.id === productId ? { ...product, ...nextProduct } : product)
    });
  }

  function addProduct(group: SpeedAccuracyGroup, trxId: string) {
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    const first = productMaster[0];
    if (!transaction || !first) return;
    updateTransaction(group, trxId, { products: [...transaction.products, { id: uid('prd'), product: first.name, article: first.article, category: first.category, qty: 1 }] });
  }

  function deleteProduct(group: SpeedAccuracyGroup, trxId: string, productId: string) {
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    if (!transaction) return;
    const first = productMaster[0];
    const nextProducts = transaction.products.filter((product) => product.id !== productId);
    updateTransaction(group, trxId, { products: nextProducts.length ? nextProducts : first ? [{ id: uid('prd'), product: first.name, article: first.article, category: first.category, qty: 1 }] : [] });
  }

  async function handleMasterUpload(file: File | null) {
    if (!file || !report) return;
    setBusyLabel('Membaca master produk Excel...');
    try {
      const master = await parseProductMasterExcel(file);
      if (!master.length) throw new Error('Master produk tidak ditemukan di Excel.');
      patch((r) => ({ ...r, productMaster: master }));
      setStatus(`Master produk berhasil diupload: ${master.length} item.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload master produk gagal.');
    } finally {
      setBusyLabel('');
    }
  }

  async function printProductList() {
    if (!report) return;
    setBusyLabel('Membuat PDF voucher transaksi...');
    try { await exportProductListPdf(report); }
    finally { setBusyLabel(''); }
  }

  async function exportUsageExcel() {
    if (!report) return;
    setBusyLabel('Membuat Excel pemakaian produk...');
    try { await exportProductUsageExcel(report); }
    finally { setBusyLabel(''); }
  }

  async function clearStoreData() {
    if (!report) return;
    const ok = confirm('Clear data store ini? Semua data local, history, database Firebase, dan file storage store ini akan dihapus jika terhubung.');
    if (!ok) return;
    setStatus('Menghapus data store...');
    deleteReport(report.id);
    try { await deleteRemoteReport(report.id); } catch { /* local mode fallback */ }
    navigate('/facilitator');
  }

  function unlockEditor(pin: string) {
    if (!pendingReport) return;
    if (!pinMatches(pin, expectedStorePin(pendingReport))) {
      setPinError('PIN salah. Masukkan PIN akses 4 digit yang sesuai.');
      return;
    }
    markSessionPinAccess(pendingReport.id);
    const synced = syncCrewDependentRows(pendingReport);
    skipAutosaveRef.current = true;
    lastSnapshotRef.current = JSON.stringify(synced);
    setReport(synced);
    setPendingReport(null);
    setPinError('');
    setStatus('Data loaded.');
  }

  function syncQuickNavFluid(id: SectionId = activeSection) {
    const nav = quickNavRef.current;
    const activeButton = nav?.querySelector<HTMLElement>(`[data-section-nav="${id}"]`);
    if (!nav || !activeButton) return;
    setQuickNavFluid({ x: activeButton.offsetLeft, width: activeButton.offsetWidth });
  }

  useEffect(() => {
    const nav = quickNavRef.current;
    const frame = window.requestAnimationFrame(() => syncQuickNavFluid(activeSection));
    const handleResize = () => syncQuickNavFluid(activeSection);
    window.addEventListener('resize', handleResize);
    nav?.addEventListener('scroll', handleResize, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      nav?.removeEventListener('scroll', handleResize);
    };
  }, [activeSection, report?.id]);

  if (!report) {
    return (
      <main className="app-shell">
        <AppHeader />
        <div className="container"><section className="card"><p>{status}</p><Link href="/facilitator">Kembali</Link></section></div>
        <PinAccessModal
          open={Boolean(pendingReport)}
          storeName={pendingReport?.storeName}
          error={pinError}
          onSubmit={unlockEditor}
          onCancel={() => { setPendingReport(null); setPinError(''); setStatus('Akses data store dibatalkan.'); }}
        />
      </main>
    );
  }

  function visible(id: SectionId) { return activeSection === id; }

  function selectSection(id: SectionId) {
    setActiveSection(id);
    window.setTimeout(() => {
      document.querySelector(`[data-section-nav="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      window.setTimeout(() => syncQuickNavFluid(id), 280);
    }, 80);
  }

  function openAudienceQr() {
    setQrModal({ title: 'QR Peserta / Audience', url: audienceUrl });
  }

  function openGroupQr(group: SpeedAccuracyGroup) {
    setQrModal({ title: `QR Customer ${group.title}`, url: `${timerUrl}?group=${encodeURIComponent(group.id)}` });
  }

  function openChecklistQr() {
    setQrModal({ title: 'QR Checklist Kesiapan NSO', url: checklistUrl });
  }

  function openLeftoverQr() {
    setQrModal({ title: 'QR Input Sisa Produk', url: leftoverUrl });
  }

  const selectedSpeedGroupId = report.speedGroups.some((item) => item.id === openGroupId)
    ? openGroupId
    : report.speedGroups.find((item) => item.timerEnabled)?.id ?? report.speedGroups[0]?.id ?? '';

  return (
    <main className="app-shell facilitator-app">
      <AppHeader
        title={`NSO - ${report.storeName}`}
        actions={(
          <>
            <button type="button" className="header-top-action" onClick={openAudienceQr} aria-label="QR Audience"><span><IconGlyph icon="QR" /></span></button>
            {syncStatus === 'saving' && <span className="sync-indicator sync-pending"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Menyimpan...</span>}
              {syncStatus === 'saved' && <span className="sync-indicator sync-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Tersimpan</span>}
              <Link className="header-top-action" href={`/report/${report.id}?from=form`} aria-label="PDF"><span><IconGlyph icon="PDF" /></span></Link>
          </>
        )}
      />
      <div className="container">
        <div
          ref={quickNavRef}
          className="quick-nav icon-quick-nav no-print fluid-quick-nav"
          style={{
            '--fluid-x': `${quickNavFluid.x}px`,
            '--fluid-w': `${quickNavFluid.width}px`
          } as CSSProperties}
        >
          <span className="quick-nav-fluid" aria-hidden="true" />
          {quickSections.filter((section) => section.id !== 'leftover').map((section) => (
            <button key={section.id} className={activeSection === section.id ? 'active' : ''} onClick={() => selectSection(section.id)} data-section-nav={section.id} title={section.label}>
              <span><IconGlyph icon={section.icon} /></span><b>{section.label}</b>
            </button>
          ))}
          {quickSections.filter((section) => section.id === 'leftover').map((section) => (
            <button key={section.id} className={activeSection === section.id ? 'active' : ''} onClick={() => selectSection(section.id)} data-section-nav={section.id} title={section.label}>
              <span><IconGlyph icon={section.icon} /></span><b>{section.label}</b>
            </button>
          ))}
        </div>

        {activeSection === 'general' ? (
          <section className="command-center card no-print">
            <div>
              <p className="eyebrow">Command Center</p>
              <h1>{report.storeName}</h1>
              <p className="muted">{status}</p>
            </div>
            <div className="stat-grid">
              <div className="stat-card"><span>Crew</span><b>{report.crews.length}</b></div>
              <div className="stat-card"><span>Audience</span><b>{report.crews.filter((crew) => crew.createdSource === 'audience').length}</b></div>
              <div className="stat-card"><span>Timer Aktif</span><b>{activeGroup ? activeGroup.title.replace('KELOMPOK ', 'K') : '-'}</b></div>
            </div>
            {progress ? (
              <div className="progress-panel">
                <div className="progress-head"><b>{progress.percent}% lengkap</b><span>{progress.completed}/{progress.total} item</span></div>
                <div className="progress-bar"><i style={{ width: `${progress.percent}%` }} /></div>
              </div>
            ) : null}
          </section>
        ) : null}

        {visible('general') ? (
          <section className="card section-card general-section-card" id="general">
            <div className="section-header">
              <div><h2 className="section-title">Section 1 - Cover & General Information</h2></div>
            </div>
            <div className="grid general-form-grid">
              <Field label="Nama Store"><input required value={report.storeName} onChange={(e) => patch((r) => ({ ...r, storeName: e.target.value.toUpperCase(), storeKey: r.general.storeCode || normalizeStoreName(e.target.value) }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Store Leader"><input required value={report.general.storeLeader} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, storeLeader: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Kode Toko"><input required value={report.general.storeCode ?? ''} onChange={(e) => patch((r) => ({ ...r, storeKey: e.target.value.toUpperCase(), general: { ...r.general, storeCode: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Area Manager"><input required value={report.general.areaManager} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, areaManager: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Regional Manager"><input required value={report.general.regionalManager ?? ''} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, regionalManager: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Store Type"><input required value={report.general.storeType} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, storeType: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="MPA/MPS"><input required value={report.general.mpaMps} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, mpaMps: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Tanggal Pelaksanaan"><input required type="date" value={report.general.date} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, date: e.target.value } }))} /></Field>
              <Field label="Nama Fasilitator 1"><input required placeholder="Ketik nama fasilitator..." value={report.general.facilitator} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, facilitator: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <Field label="Nama Fasilitator 2"><input placeholder="Ketik nama fasilitator (opsional)..." value={report.general.facilitator2 ?? ''} onChange={(e) => patch((r) => ({ ...r, general: { ...r.general, facilitator2: e.target.value.toUpperCase() } }))} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
              <div className="field span-2 general-cover-field">
                <label>Upload Foto Cover</label>
                <div className="cover-upload-box">
                  {report.general.coverPhotoUrl ? <img src={resolveDriveUrl(report.general.coverPhotoUrl)} alt="Cover" className="cover-thumb" /> : <div className="cover-thumb empty">Belum Upload</div>}
                  <div>
                    <div className={`upload-status ${report.general.coverPhotoUrl ? 'ok' : ''}`}>{report.general.coverPhotoUrl ? 'Checklist - foto cover sudah diupload' : 'Foto cover belum diupload'}</div>
                    <ImageInput highRes storeId={report.id} label={report.general.coverPhotoUrl ? 'Ganti Foto Cover' : 'Upload Foto Cover'} aspect="original" onUploaded={(urls) => patch((r) => ({ ...r, general: { ...r.general, coverPhotoUrl: urls[0] } }))} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {visible('crew') ? (
          <section className="card section-card" id="crew">
            <div className="section-header"><div><h2 className="section-title">Section 2 - Crew Store</h2></div><IconButton icon="＋" label="Tambah Crew" className="green" onClick={() => patch((r) => ({ ...r, crews: [...r.crews, makeCrew()] }))} /></div>
            <div className="crew-card-list">
              {report.crews.length === 0 ? <p className="muted">Belum ada crew.</p> : null}
              {sortedCrews.map((crew) => {
                const fromAudience = crew.createdSource === 'audience';
                const imageUrl = crew.photoUrl || crew.groomingPhotoUrl;
                return (
                  <details className="crew-detail-card" key={crew.id}>
                    <summary>
                      {imageUrl ? <img className="thumb" src={resolveDriveUrl(imageUrl)} alt={crew.name} /> : <div className="thumb empty-thumb">No Photo</div>}
                      <span><b>{crew.name || 'Nama Crew'}</b><small>{crew.nik || '-'} &bull; {crew.level} &bull; {fromAudience ? 'Audience' : 'Fasilitator'}</small></span>
                      <em>Detail</em>
                    </summary>
                    <div className="grid grid-4 crew-detail-grid">
                      <Field label="Nama"><input value={crew.name} onChange={(e) => patch((r) => ({ ...r, crews: r.crews.map((c) => c.id === crew.id ? { ...c, name: e.target.value.toUpperCase() } : c) }))} /></Field>
                      <Field label="NIK"><input value={crew.nik} inputMode="numeric" pattern="[0-9]*" onChange={(e) => patch((r) => ({ ...r, crews: r.crews.map((c) => c.id === crew.id ? { ...c, nik: e.target.value.replace(/\D/g, '') } : c) }))} /></Field>
                      <Field label="Level"><select value={crew.level} onChange={(e) => patch((r) => ({ ...r, crews: r.crews.map((c) => c.id === crew.id ? { ...c, level: e.target.value as any } : c) }))}>{CREW_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></Field>
                      <div className="field">
                        <label>Foto</label>
                        {fromAudience && imageUrl ? <span className="upload-status ok small-status">Dari audience</span> : null}<ImageInput storeId={report.id} label={imageUrl ? 'Retake / Ganti Foto' : 'Upload Foto'} aspect="portrait" existingImageUrl={imageUrl} onUploaded={(urls) => patch((r) => ({ ...r, crews: r.crews.map((c) => c.id === crew.id ? { ...c, photoUrl: urls[0] } : c) }))} />
                      </div>
                    </div>
                    <div className="actions right-actions"><IconButton icon="DEL" label="Delete" className="danger small-icon" onClick={() => patch((r) => ({ ...r, crews: r.crews.filter((c) => c.id !== crew.id), deletedCrewIds: [...(r.deletedCrewIds ?? []), crew.id] }))} /></div>
                  </details>
                );
              })}
            </div>
          </section>
        ) : null}

        {visible('behavior') ? (
          <section className="card section-card" id="behavior">
            <div className="section-header"><div><h2 className="section-title">Section 3 - Crew Behavior</h2></div><div className="actions collapse-actions" style={{ border: "none", padding: 0, margin: 0 }}><button type="button" onClick={() => document.querySelectorAll("#behavior .collapsible-card").forEach(c => c.removeAttribute("open"))}>Tutup Semua</button></div></div>
            <div className="observation-list">
              {report.behaviorRows.length === 0 ? <p className="muted">Belum ada crew.</p> : null}
              {orderedBehaviorRows.map((row) => <BehaviorCrewCard key={row.crewId} row={row} crewName={crewById.get(row.crewId)?.name ?? '-'} onChange={(nextRow) => updateBehavior(row.crewId, nextRow)} />)}
            </div>
          </section>
        ) : null}

        <section className={`card section-card ${visible('crew-speed') ? '' : 'section-hidden'}`} id="crew-speed">
            <div className="section-header"><div><h2 className="section-title">Section 4 - Speed & Accuracy Crew</h2></div><div className="actions collapse-actions" style={{ border: "none", padding: 0, margin: 0 }}><button type="button" onClick={() => document.querySelectorAll("#crew-speed .collapsible-card").forEach(c => c.removeAttribute("open"))}>Tutup Semua</button></div></div>
            <div className="speed-test-controls dual-slot-controls">
              {[0, 1].map((slotIndex) => {
                const otherIndex = slotIndex === 0 ? 1 : 0;
                const sameCrewAcrossSlots = Boolean(speedTestCrewIds[slotIndex] && speedTestCrewIds[slotIndex] === speedTestCrewIds[otherIndex]);
                const lockedRoleForSameCrew = sameCrewAcrossSlots ? speedTestRoles[otherIndex] : null;
                return (
                  <div className="test-slot-toggle" key={slotIndex}>
                    <b>Penilaian {slotIndex + 1}</b>
                    <div>
                      <button
                        type="button"
                        disabled={lockedRoleForSameCrew === 'cashier'}
                        className={`test-role-pill cashier ${speedTestRoles[slotIndex] === 'cashier' ? 'active' : ''}`}
                        onClick={() => setSpeedSlotRole(slotIndex, 'cashier')}
                      >
                        Test Cashier
                      </button>
                      <button
                        type="button"
                        disabled={lockedRoleForSameCrew === 'barista'}
                        className={`test-role-pill barista ${speedTestRoles[slotIndex] === 'barista' ? 'active' : ''}`}
                        onClick={() => setSpeedSlotRole(slotIndex, 'barista')}
                      >
                        Test Barista
                      </button>
                    </div>
                    {lockedRoleForSameCrew ? <small className="role-lock-hint">Nama sama: role harus kebalikan dari Penilaian {otherIndex + 1}.</small> : null}
                  </div>
                );
              })}
            </div>
            {report.speedRows.length === 0 ? <p className="muted">Belum ada crew.</p> : null}
            <div className="speed-test-board both two-slot-speed-board">
              {[0, 1].map((slotIndex) => {
                const crewId = speedTestCrewIds[slotIndex] ?? '';
                return (
                  <SpeedTestPanel
                    key={slotIndex}
                    type={speedTestRoles[slotIndex]}
                    slotLabel={`Penilaian ${slotIndex + 1}`}
                    row={speedSlotRows[slotIndex]}
                    crewId={crewId}
                    crews={sortedCrews}
                    blockedCrewIds={speedTestCrewIds.filter((id, index) => index !== slotIndex && Boolean(id) && speedTestRoles[index] === speedTestRoles[slotIndex])}
                    deferTimerAndGap
                    onCrewChange={(crewId) => setSpeedSlotCrew(slotIndex, crewId)}
                    onChange={(nextRow) => crewId && updateSpeed(crewId, nextRow)}
                  />
                );
              })}
            </div>
            <div className="section4-gap-stack">
              {[0, 1].map((slotIndex) => {
                const crewId = speedTestCrewIds[slotIndex] ?? '';
                return (
                  <SpeedSlotGapPanel
                    key={`gap-${slotIndex}`}
                    type={speedTestRoles[slotIndex]}
                    slotLabel={`Penilaian ${slotIndex + 1}`}
                    row={speedSlotRows[slotIndex]}
                    crewName={crewById.get(crewId)?.name ?? ''}
                    onChange={(nextRow) => crewId && updateSpeed(crewId, nextRow)}
                  />
                );
              })}
            </div>
          </section>

        {visible('team-speed') ? (
          <section className="card section-card" id="team-speed">
            <div className="section-header">
              <div><h2 className="section-title">Section 5 - Speed & Accuracy Team</h2></div>
              <div className="actions icon-action-row team-section-actions">
                <Link className="icon-btn secondary" href={`/facilitator/${report.id}/products?back=team-speed`}><span><IconGlyph icon="settings" /></span><b>Setting Produk</b></Link>
                <IconButton icon="plus" label="Tambah Kelompok" className="green" onClick={addSpeedGroup} />
              </div>
            </div>
            <div className="group-tab-row">
              {report.speedGroups.map((group) => {
                const isSelectedGroup = selectedSpeedGroupId === group.id || group.timerEnabled;
                return (
                  <div key={group.id} className={`group-tab-card ${isSelectedGroup ? 'active' : ''} ${group.timerEnabled ? 'live' : ''}`}>
                    <button
                      type="button"
                      className="group-tab-main"
                      onClick={() => setOpenGroupId(group.id)}
                    >
                      <span>{group.title}</span>
                      {group.timerEnabled ? <small>Timer Aktif</small> : null}
                    </button>
                    <button
                      type="button"
                      className="group-tab-delete"
                      title={`Hapus ${group.title}`}
                      aria-label={`Hapus ${group.title}`}
                      onClick={() => deleteSpeedGroup(group)}
                    >
                      <IconGlyph icon="delete" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="team-group-list single-team-group-list">
              {(() => {
                const group = report.speedGroups.find((item) => item.id === selectedSpeedGroupId) ?? report.speedGroups.find((item) => item.timerEnabled) ?? report.speedGroups[0];
                if (!group) return <p className="muted">Belum ada kelompok.</p>;
                const isTimerLive = Boolean(group.timerEnabled);
                const recordedCount = group.transactions.filter((trx) => trx.actualTime).length;
                const visibleTransactions = group.transactions;
                const activeTransactionIndex = Math.min(transactionIndexes[group.id] ?? 0, Math.max(visibleTransactions.length - 1, 0));
                const activeTransaction = visibleTransactions[activeTransactionIndex];
                return (
                  <div className={`card group-card group-card-open ${isTimerLive ? 'live' : ''}`}>
                    <div className="actions group-actions icon-action-row">
                      {isTimerLive ? <IconButton icon="■" label="Nonaktifkan" className="danger" onClick={() => setGroupTimer(group.id, false)} /> : <IconButton icon="▶" label="Mulai Timer" className="green" disabled={!groupHasCompleteRoles(group)} onClick={() => { setOpenGroupId(group.id); setGroupTimer(group.id, true); }} />}
                      <IconButton icon="QR" label="QR Customer" className="blue" onClick={() => openGroupQr(group)} />
                    </div>
                    {!groupHasCompleteRoles(group) ? <p className="notice warning-notice">Lengkapi komposisi role sebelum tombol Mulai Timer aktif.</p> : null}
                    <div className="grid grid-1 team-mode-grid">
                      <Field label="Mode Kelompok"><select value={group.modeLabel} onChange={(e) => {
                        const mode = e.target.value;
                        updateGroup(group.id, { modeLabel: mode, roleComposition: buildRoleComposition(mode, group.roleAssignments) });
                      }}>{GROUP_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></Field>
                    </div>
                    <div className="field" style={{ marginTop: 14 }}>
                      <label>Komposisi Role dari Crew</label>
                      <RoleComposer group={group} report={report} onChange={(patchGroup) => updateGroup(group.id, patchGroup)} />
                    </div>
                    {visibleTransactions.length > 1 ? (
                      <div className="transaction-floating-nav no-print" aria-label="Navigasi transaksi">
                        <button type="button" onClick={() => setTransactionIndex(group.id, activeTransactionIndex - 1, visibleTransactions.length)} disabled={activeTransactionIndex === 0} aria-label="Transaksi sebelumnya">&lt;</button>
                        <span>Transaksi {activeTransactionIndex + 1}/{visibleTransactions.length}</span>
                        <button type="button" onClick={() => setTransactionIndex(group.id, activeTransactionIndex + 1, visibleTransactions.length)} disabled={activeTransactionIndex >= visibleTransactions.length - 1} aria-label="Transaksi berikutnya">&gt;</button>
                      </div>
                    ) : null}
                    <div className="transaction-list modern-transactions single-transaction-list">
                      {activeTransaction ? (() => {
                        const trx = activeTransaction;
                        const trxIndex = activeTransactionIndex;
                        return (
                          <div className="transaction-card" key={trx.id}>
                            <div className="section-header compact-header"><h4>Transaksi {trxIndex + 1}</h4><span className="actual-chip">Actual: {trx.actualTime || '-'}</span></div>
                            <div className="grid grid-2 compact-transaction-fields">
                              <Field label="Label"><input value={trx.label} onChange={(e) => updateTransaction(group, trx.id, { label: e.target.value })} /></Field>
                              <Field label="Actual Time"><input value={trx.actualTime} placeholder="00:00" onChange={(e) => updateTransaction(group, trx.id, { actualTime: e.target.value })} /></Field>
                              <Field label="Keterangan"><textarea value={trx.keterangan === '-' ? '' : trx.keterangan} placeholder="Catatan transaksi / keterangan" onChange={(e) => updateTransaction(group, trx.id, { keterangan: e.target.value })} /></Field>
                              {(() => {
                                const { isLearning, isNonLearning } = parseTransactionGapFinding(trx.gapFinding);
                                return (
                                  <Field label="Gap Finding">
                                    <div className="gap-finding-box">
                                      <div className="gap-finding-checkboxes">
                                        <label className={`gap-check-label ${isLearning ? 'active' : ''}`}>
                                          <input
                                            type="checkbox"
                                            checked={isLearning}
                                            onChange={(e) => {
                                              const nextLearning = e.target.checked;
                                              const nextGap = formatTransactionGapFinding(nextLearning, isNonLearning);
                                              const nextCorr = computeTransactionCorrection(nextLearning, isNonLearning, trx.correction);
                                              updateTransaction(group, trx.id, { gapFinding: nextGap, correction: nextCorr });
                                            }}
                                          />
                                          <span>Learning</span>
                                        </label>
                                        <label className={`gap-check-label ${isNonLearning ? 'active' : ''}`}>
                                          <input
                                            type="checkbox"
                                            checked={isNonLearning}
                                            onChange={(e) => {
                                              const nextNonLearning = e.target.checked;
                                              const nextGap = formatTransactionGapFinding(isLearning, nextNonLearning);
                                              const nextCorr = computeTransactionCorrection(isLearning, nextNonLearning, trx.correction);
                                              updateTransaction(group, trx.id, { gapFinding: nextGap, correction: nextCorr });
                                            }}
                                          />
                                          <span>Non Learning</span>
                                        </label>
                                      </div>
                                    </div>
                                  </Field>
                                );
                              })()}
                              <Field label="Correction"><textarea value={trx.correction === '-' ? '' : trx.correction} placeholder="Tindakan koreksi" onChange={(e) => updateTransaction(group, trx.id, { correction: e.target.value })} /></Field>
                            </div>
                          </div>
                        );
                      })() : <p className="muted">Belum ada transaksi.</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        ) : null}

        {visible('summary') ? (
          <section className="card section-card" id="summary">
            <div className="section-header">
              <div>
                <h2 className="section-title">Section 6 - Summary</h2>
              </div>
              <div className="actions icon-action-row">
                <IconButton icon={report.readinessChecklistEnabled ? 'checklist' : 'checklist'} label={report.readinessChecklistEnabled ? 'Checklist Aktif' : 'Aktifkan Checklist'} className={report.readinessChecklistEnabled ? 'green' : 'secondary'} onClick={() => patch((r) => ({ ...r, readinessChecklistEnabled: !r.readinessChecklistEnabled }))} />
                <IconButton icon="QR" label="QR Checklist" className="blue" onClick={openChecklistQr} />
                <Link className="icon-btn secondary" href={`/checklist/${report.audienceToken}`} target="_blank"><span><IconGlyph icon="open" /></span><b>Buka Checklist</b></Link>
                <Link className="icon-btn green" href={`/facilitator/${report.id}/checklist`}><span><IconGlyph icon="settings" /></span><b>Setting Checklist</b></Link>
              </div>
            </div>
            <div className="readiness-dashboard-card compact-readiness-card">
              <div className="readiness-issue-box">
                {makeReadinessIssueSummary(report.readinessChecklist ?? []).length ? (
                  makeReadinessIssueSummary(report.readinessChecklist ?? []).slice(0, 8).map((line) => <span key={line}>{line}</span>)
                ) : <span>Semua item checklist sudah OK / belum ada gap.</span>}
              </div>
            </div>
            <div className="summary-card-list">
              {report.summaryItems.map((item) => (
                <div className="summary-edit-card" key={item.id}>
                  <h3>{item.jenis}</h3>
                  <Field label="Keterangan">
                    <RichTextarea
                      value={item.keterangan}
                      onChange={(value) => patch((r) => ({
                        ...r,
                        summaryItems: r.summaryItems.map((x) => x.id === item.id ? {
                          ...x,
                          keterangan: value,
                          koreksi: hasMeaningfulText(value) ? SUMMARY_AUTO_CORRECTION : x.koreksi
                        } : x)
                      }))}
                    />
                  </Field>
                  <Field label="Koreksi">
                    <RichTextarea value={item.koreksi} onChange={(value) => patch((r) => ({ ...r, summaryItems: r.summaryItems.map((x) => x.id === item.id ? { ...x, koreksi: value } : x) }))} />
                  </Field>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {visible('leftover') ? (
          <section className="card section-card" id="leftover">
            <div className="section-header">
              <div>
                <h2 className="section-title">Section Sisa Produk</h2>
              </div>
              <div className="actions icon-action-row">
                <IconButton icon={report.leftoverInputEnabled ? 'checklist' : 'checklist'} label={report.leftoverInputEnabled ? 'Link Aktif' : 'Aktifkan Link'} className={report.leftoverInputEnabled ? 'green' : 'secondary'} onClick={() => patch((r) => ({ ...r, leftoverInputEnabled: !r.leftoverInputEnabled }))} />
                <IconButton icon="QR" label="QR Sisa Produk" className="blue" onClick={openLeftoverQr} />
                <Link className="icon-btn secondary" href={`/leftover/${report.audienceToken}`} target="_blank"><span><IconGlyph icon="open" /></span><b>Buka Halaman</b></Link>
              </div>
            </div>
            <div className="leftover-admin-panel">
              <div className="actions">
                <IconButton icon="＋" label="Tambah Sisa Produk" className="green" onClick={() => {
                  const first = productMaster[0];
                  if (!first) return;
                  patch((r) => ({ ...r, leftoverProducts: [...(r.leftoverProducts ?? []), { id: uid('leftover'), product: first.name, article: first.article, category: first.category, qty: 1, source: 'facilitator', updatedAt: new Date().toISOString() }] }));
                }} />
              </div>
              <div className="leftover-product-list">
                {(report.leftoverProducts ?? []).map((item) => (
                  <div className="product-edit-row structured-product-row leftover-row" key={item.id}>
                    <ProductSelect
                      master={productMaster}
                      value={item.product}
                      onChange={(selected) => patch((r) => ({
                        ...r,
                        leftoverProducts: (r.leftoverProducts ?? []).map((line) => line.id === item.id ? { ...line, product: selected.name, article: selected.article, category: selected.category, source: 'facilitator', updatedAt: new Date().toISOString() } : line)
                      }))}
                    />
                    <input
                      aria-label="Qty sisa"
                      inputMode="numeric"
                      value={item.qty || ''}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, '');
                        patch((r) => ({
                          ...r,
                          leftoverProducts: (r.leftoverProducts ?? []).map((line) => line.id === item.id ? { ...line, qty: raw ? Math.max(1, Number(raw)) : 0, source: 'facilitator', updatedAt: new Date().toISOString() } : line)
                        }));
                      }}
                    />
                    <IconButton icon="delete" label="Hapus" className="danger small-icon" onClick={() => {
                      if (!confirm('Hapus sisa produk ini?')) return;
                      patch((r) => ({ ...r, leftoverProducts: (r.leftoverProducts ?? []).filter((line) => line.id !== item.id) }));
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {visible('documentation') ? <PhotoSection id="documentation" title="Section 7 - Dokumentasi Preparation & Simulasi Store" storeId={report.id} photos={report.documentationPhotos} aspect="square" onAdd={(urls) => patch((r) => ({ ...r, documentationPhotos: [...r.documentationPhotos, ...urls] }))} onReplace={(index, url) => patch((r) => ({ ...r, documentationPhotos: r.documentationPhotos.map((item, i) => i === index ? url : item) }))} onDelete={(index) => patch((r) => ({ ...r, documentationPhotos: r.documentationPhotos.filter((_, i) => i !== index) }))} /> : null}
        {visible('layout') ? <PhotoSection id="layout" title="Section 8 - Layout Counter" storeId={report.id} photos={report.layoutCounterPhotos} aspect="portrait" onAdd={(urls) => patch((r) => ({ ...r, layoutCounterPhotos: [...r.layoutCounterPhotos, ...urls] }))} onReplace={(index, url) => patch((r) => ({ ...r, layoutCounterPhotos: r.layoutCounterPhotos.map((item, i) => i === index ? url : item) }))} onDelete={(index) => patch((r) => ({ ...r, layoutCounterPhotos: r.layoutCounterPhotos.filter((_, i) => i !== index) }))} /> : null}
        {visible('planogram') ? <PhotoSection id="planogram" title="Section 9 - Display Planogram" storeId={report.id} photos={report.planogramPhotos} aspect="portrait" onAdd={(urls) => patch((r) => ({ ...r, planogramPhotos: [...r.planogramPhotos, ...urls] }))} onReplace={(index, url) => patch((r) => ({ ...r, planogramPhotos: r.planogramPhotos.map((item, i) => i === index ? url : item) }))} onDelete={(index) => patch((r) => ({ ...r, planogramPhotos: r.planogramPhotos.filter((_, i) => i !== index) }))} /> : null}
      </div>
      {busyLabel ? <div className="global-loading"><span className="spinner large" />{busyLabel}</div> : null}
      {qrModal ? <QrModal title={qrModal.title} url={qrModal.url} onClose={() => setQrModal(null)} /> : null}
    </main>
  );
}

function PhotoSection({ id, title, storeId, photos, aspect, onAdd, onReplace, onDelete }: { id: string; title: string; storeId: string; photos: string[]; aspect: 'portrait' | 'square'; onAdd: (urls: string[]) => void; onReplace: (index: number, url: string) => void; onDelete: (index: number) => void }) {
  return (
    <section className="card section-card photo-section" id={id}>
      <div className="section-header"><h2 className="section-title">{title}</h2><ImageInput storeId={storeId} label="Tambah Foto" multiple aspect={aspect} onUploaded={onAdd} /></div>
      <div className="photo-list">
        {photos.map((photo, index) => {
          const displayUrl = photo.includes('drive.google.com/uc?export=view&id=') 
            ? resolveDriveUrl(photo) 
            : photo;
          return (
          <div className="photo-card" key={`${photo}-${index}`}>
            <img src={displayUrl} alt={title} />
            <div className="photo-card-actions">
              <ImageInput storeId={storeId} label="Edit Crop Foto" aspect={aspect} existingImageUrl={photo} editOnly onUploaded={(urls) => onReplace(index, urls[0])} />
              <IconButton icon="DEL" label="Delete" className="danger small-icon" onClick={() => onDelete(index)} />
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}












