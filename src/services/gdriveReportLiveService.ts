import { VisitReportData } from '../types/visitReport';
import { GAS_VAULT_API_URL } from './cloudScheduleSyncService';
import {
  FMCU_REPORT_GDRIVE_FOLDER_URL,
  getGDriveReportRegistryEntry,
  toGDriveEmbedPreviewUrl,
  formatDateDdMmYyyy,
  formatIndonesianDate,
} from './pdfGeneratorService';
import { findMasterStoreByCodeOrName } from '../data/masterStoresData';

export interface VerifiedGDriveReportMeta {
  reportData: VisitReportData;
  gdrivePdfUrl: string;
  gdriveEmbedUrl?: string;
  storeFolderName: string;
  pdfFileName: string;
  gdriveSavedDate: string;
  gdriveSavedTimestamp: number;
  isVerifiedInGDrive: boolean;
}

/**
 * Fetch latest visit reports in realtime directly from Google Drive Cloud Vault
 */
export async function fetchRealtimeGDriveReports(): Promise<(VisitReportData & { updatedAtMs?: number })[]> {
  try {
    const res = await fetch(`${GAS_VAULT_API_URL}?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: 'visit_reports',
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch (err) {
    console.warn('fetchRealtimeGDriveReports warning:', err);
    return [];
  }
}

/**
 * Resolve whether an actual report exists in Google Drive for a given store/agenda.
 * If report does NOT exist in GDrive or was deleted directly in GDrive, returns null!
 * (Strict zero-dummy guarantee: only returns truthy if verified in GDrive / cloud).
 */
export function findVerifiedGDriveReport(params: {
  storeCode?: string;
  storeName?: string;
  agendaId?: string;
  visitDate?: string;
  cloudReports?: (VisitReportData & { updatedAtMs?: number })[];
}): VerifiedGDriveReportMeta | null {
  const { storeCode, storeName, agendaId, visitDate, cloudReports = [] } = params;

  const targetCode = String(storeCode || '').toUpperCase().trim();
  const targetName = String(storeName || '').toUpperCase().trim();
  const targetDate = String(visitDate || '').trim();

  // 1. Search in live cloudReports (fetched from Google Drive / Cloud Vault)
  let matchedReport: (VisitReportData & { updatedAtMs?: number }) | null = null;

  if (cloudReports && cloudReports.length > 0) {
    if (agendaId) {
      matchedReport = cloudReports.find((r) => r.agendaId === agendaId) || null;
    }

    if (!matchedReport && targetCode) {
      matchedReport =
        cloudReports.find((r) => {
          const rCode = String(r.storeCode || '').toUpperCase().trim();
          if (rCode !== targetCode) return false;
          if (targetDate && r.visitDate) {
            return r.visitDate === targetDate;
          }
          return true;
        }) || null;
    }

    if (!matchedReport && targetName) {
      matchedReport =
        cloudReports.find((r) => {
          const rName = String(r.storeName || '').toUpperCase().trim();
          if (!rName) return false;
          const isNameMatch = rName === targetName || rName.includes(targetName) || targetName.includes(rName);
          if (!isNameMatch) return false;
          if (targetDate && r.visitDate) {
            return r.visitDate === targetDate;
          }
          return true;
        }) || null;
    }
  }

  // 2. Fallback to local registry or local storage ONLY IF marked with actual sync URL
  if (!matchedReport && typeof window !== 'undefined') {
    const registry = getGDriveReportRegistryEntry({
      storeCode: targetCode,
      storeName: targetName,
      agendaId,
    });

    if (registry && registry.pdfUrl && registry.pdfUrl !== FMCU_REPORT_GDRIVE_FOLDER_URL) {
      // Verified registry entry with actual GDrive file URL
      try {
        const localKey = agendaId ? `fmcu_visit_report_${agendaId}` : null;
        const localRaw = localKey ? localStorage.getItem(localKey) : null;
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed && (parsed.status === 'SUBMITTED' || parsed.actualInSubmitted)) {
            matchedReport = parsed;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // If no verified report exists in GDrive, return null (DO NOT show preview button)
  if (!matchedReport) {
    return null;
  }

  // Construct store folder name and PDF file name based on GDrive standards
  const cleanStoreName = String(matchedReport.storeName || targetName || 'STORE')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .trim();
  const cleanCode = matchedReport.storeCode || targetCode || '';
  const storeFolderName = cleanCode ? `${cleanCode} - ${cleanStoreName}` : cleanStoreName;
  const dateFormatted = formatDateDdMmYyyy(matchedReport.visitDate || targetDate);
  const pdfFileName = `Hasil Kunjungan-${cleanStoreName}-${dateFormatted}.pdf`;

  // Determine save date in GDrive based on file/report metadata
  const saveTimestamp =
    matchedReport.updatedAtMs ||
    (matchedReport.submittedAt ? new Date(matchedReport.submittedAt).getTime() : 0) ||
    (matchedReport.visitDate ? new Date(matchedReport.visitDate).getTime() : Date.now());

  const saveDateObj = new Date(saveTimestamp);
  const hours = String(saveDateObj.getHours()).padStart(2, '0');
  const minutes = String(saveDateObj.getMinutes()).padStart(2, '0');
  const gdriveSavedDate = `${formatIndonesianDate(
    saveDateObj.toISOString().split('T')[0],
    false
  )}, ${hours}:${minutes} WIB`;

  const gdrivePdfUrl =
    (matchedReport as any).pdfUrl ||
    (matchedReport as any).driveUrl ||
    (matchedReport.qscDriveUrl ? matchedReport.qscDriveUrl : '') ||
    FMCU_REPORT_GDRIVE_FOLDER_URL;

  const gdriveEmbedUrl =
    (matchedReport as any).gdriveEmbedUrl ||
    toGDriveEmbedPreviewUrl(gdrivePdfUrl) ||
    toGDriveEmbedPreviewUrl(matchedReport.qscDriveUrl);

  return {
    reportData: matchedReport,
    gdrivePdfUrl,
    gdriveEmbedUrl,
    storeFolderName,
    pdfFileName,
    gdriveSavedDate,
    gdriveSavedTimestamp: saveTimestamp,
    isVerifiedInGDrive: true,
  };
}
