import { CrewSpeedRow, SPEED_CASHIER_METRICS } from './types';

export const KSK_STANDARD_MS = 60_000;
export const ICE_TEA_STANDARD_MS = 100_000;

export function timerTextToMs(value?: string): number | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const normalized = text.replace(/\./g, ':');
  const parts = normalized.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.max(0, (minutes * 60 + seconds) * 1000);
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Math.max(0, (hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  return null;
}

export function formatStandard(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function isTimerOk(value: string | undefined, standardMs: number) {
  const ms = timerTextToMs(value);
  return ms !== null && ms > 0 && ms <= standardMs;
}

export function timerClassName(value: string | undefined, standardMs: number) {
  const ms = timerTextToMs(value);
  if (ms === null || ms <= 0) return '';
  return ms <= standardMs ? 'timer-ok' : 'timer-over';
}

export function isCashierOk(row: CrewSpeedRow) {
  return SPEED_CASHIER_METRICS.every((metric) => row.values[metric] === 'Y');
}

export function isBaristaOk(row: CrewSpeedRow) {
  return row.values['KSK Sesuai SOP'] === 'Y'
    && row.values['ICE TEA Sesuai SOP'] === 'Y'
    && isTimerOk(row.kskTime, KSK_STANDARD_MS)
    && isTimerOk(row.iceTeaTime, ICE_TEA_STANDARD_MS);
}

export function calculateSuggestPosition(row: CrewSpeedRow): 'Cashier' | 'Barista' | 'Cashier & Barista' | '' {
  const cashierOk = isCashierOk(row);
  const baristaOk = isBaristaOk(row);
  if (cashierOk && baristaOk) return 'Cashier & Barista';
  if (cashierOk) return 'Cashier';
  if (baristaOk) return 'Barista';
  return '';
}
