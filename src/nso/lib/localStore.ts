import { DEFAULT_STORE_PIN, ReportData, StoreHistoryItem } from './types';

const HISTORY_KEY = 'regional-bestie-nso-history';
const REPORT_PREFIX = 'regional-bestie-nso-report:';

function normalizeStoredPin(value?: string) {
  const pin = String(value ?? '').replace(/\D/g, '');
  return pin || DEFAULT_STORE_PIN;
}

function normalizeHistoryItem(item: StoreHistoryItem): StoreHistoryItem {
  return { ...item, accessCode: normalizeStoredPin(item.accessCode) };
}

function normalizeReportPin(report: ReportData): ReportData {
  return { ...report, accessCode: normalizeStoredPin(report.accessCode) };
}

export function getHistory(): StoreHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return (JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as StoreHistoryItem[]).map(normalizeHistoryItem);
  } catch {
    return [];
  }
}

export function saveHistory(items: StoreHistoryItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.map(normalizeHistoryItem)));
}

export function upsertHistory(report: ReportData) {
  const items = getHistory().filter((item) => item.id !== report.id);
  items.unshift({
    id: report.id,
    storeName: report.storeName,
    storeKey: report.storeKey,
    audienceToken: report.audienceToken,
    accessCode: normalizeStoredPin(report.accessCode),
    updatedAt: report.updatedAt
  });
  saveHistory(items);
}

export function getReport(id: string): ReportData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${REPORT_PREFIX}${id}`);
    return raw ? normalizeReportPin(JSON.parse(raw) as ReportData) : null;
  } catch {
    return null;
  }
}

export function saveReport(report: ReportData) {
  if (typeof window === 'undefined') return;
  const next = normalizeReportPin({ ...report, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(`${REPORT_PREFIX}${report.id}`, JSON.stringify(next));
  } catch (err: any) {
    console.error('LocalStorage quota exceeded:', err);
    alert('Penyimpanan lokal perangkat Anda penuh! Beberapa foto mungkin gagal disimpan. Silakan hapus foto yang tidak perlu atau kosongkan memori browser Anda.');
  }
  upsertHistory(next);
}

export function deleteReport(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${REPORT_PREFIX}${id}`);
  saveHistory(getHistory().filter((item) => item.id !== id));
}

export function findReportByToken(token: string): ReportData | null {
  const item = getHistory().find((history) => history.audienceToken === token);
  return item ? getReport(item.id) : null;
}

export function clearAllLocalData() {
  if (typeof window === 'undefined') return;
  getHistory().forEach((item) => localStorage.removeItem(`${REPORT_PREFIX}${item.id}`));
  localStorage.removeItem(HISTORY_KEY);
}
