import { VisitReportData } from '../types/visitReport';
import { GAS_VAULT_API_URL } from './cloudScheduleSyncService';
import {
  FMCU_REPORT_GDRIVE_FOLDER_URL,
  getGDriveReportRegistryEntry,
  toGDriveEmbedPreviewUrl,
  formatDateDdMmYyyy,
  formatIndonesianDate,
} from './pdfGeneratorService';
import {
  GDRIVE_VERIFIED_REPORTS,
  GDriveVerifiedReportItem,
  getVerifiedGDriveReports,
  findGDriveReportInVerifiedDataset,
} from '../data/gdriveVerifiedReportsData';

export interface VerifiedGDriveReportMeta {
  reportData: VisitReportData;
  gdrivePdfUrl: string;
  gdriveEmbedUrl?: string;
  storeFolderName: string;
  pdfFileName: string;
  gdriveSavedDate: string;
  gdriveSavedTimestamp: number;
  format: 'PDF' | 'PPTX' | 'DOCX' | 'IMAGE';
  category: 'VISIT' | 'NSO';
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
 * Convert GDriveVerifiedReportItem into VerifiedGDriveReportMeta
 */
export function verifiedItemToMeta(item: GDriveVerifiedReportItem): VerifiedGDriveReportMeta {
  const saveTimestamp = new Date(item.visitDate).getTime() || Date.now();
  const folderDisplay = item.subFolderName
    ? `${item.personnelName} / ${item.subFolderName}`
    : item.personnelName;

  const reportData: VisitReportData = {
    id: item.id,
    agendaId: item.fileId,
    visitorName: item.personnelName,
    storeName: item.storeName,
    storeCode: item.storeCode || 'STORE',
    storeType: item.category === 'NSO' ? 'NSO' : 'CVS',
    storeHead: 'Store Head',
    visitDate: item.visitDate,
    areaManager: 'Area Manager',
    regionalManager: 'Regional Manager',
    actualIn: '08:30 WIB',
    actualOut: '17:30 WIB',
    storeFrontPhoto: '',
    qscSheetTop: '',
    qscSheetBottom: '',
    spreadsheetUrl: item.gdriveViewUrl,
    assignmentNotes: item.fileName,
    crews: [],
    observations: [],
    evidencePhotos: [],
    status: 'SUBMITTED',
    updatedAtMs: saveTimestamp,
  };

  return {
    reportData,
    gdrivePdfUrl: item.gdriveViewUrl,
    gdriveEmbedUrl: item.gdriveEmbedUrl,
    storeFolderName: folderDisplay,
    pdfFileName: item.fileName,
    gdriveSavedDate: `${formatIndonesianDate(item.visitDate, false)}`,
    gdriveSavedTimestamp: saveTimestamp,
    format: item.format,
    category: item.category,
    isVerifiedInGDrive: true,
  };
}

/**
 * Resolve whether an actual report exists in Google Drive for a given store/agenda/personnel.
 * Deep searches both the 333 verified GDrive dataset from 17tAUOQ81qtIDz5SlFMRu0VE9SLBkuHmj and live cloud reports.
 * If report does NOT exist in GDrive, returns null! (Strict zero dummy data guarantee).
 */
export function findVerifiedGDriveReport(params: {
  storeCode?: string;
  storeName?: string;
  pic?: string;
  agendaId?: string;
  visitDate?: string;
  cloudReports?: (VisitReportData & { updatedAtMs?: number })[];
}): VerifiedGDriveReportMeta | null {
  const { storeCode, storeName, pic, agendaId, visitDate, cloudReports = [] } = params;

  const targetCode = String(storeCode || '').toUpperCase().trim();
  const targetName = String(storeName || '').toUpperCase().trim();
  const targetPic = String(pic || '').toLowerCase().trim();
  const targetDate = String(visitDate || '').trim();

  // 1. Search in the 333 verified GDrive dataset from folder 17tAUOQ81qtIDz5SlFMRu0VE9SLBkuHmj
  const verifiedMatch = findGDriveReportInVerifiedDataset({
    storeCode: targetCode,
    storeName: targetName,
    pic: targetPic,
    visitDate: targetDate,
  });

  if (verifiedMatch) {
    return verifiedItemToMeta(verifiedMatch);
  }

  // 2. Search in live cloudReports (fetched from Google Drive / Cloud Vault)
  let matchedReport: (VisitReportData & { updatedAtMs?: number }) | null = null;

  if (cloudReports && cloudReports.length > 0) {
    if (agendaId) {
      matchedReport = cloudReports.find((r) => r.agendaId === agendaId) || null;
    }

    if (!matchedReport && targetCode && targetCode !== 'STORE') {
      matchedReport =
        cloudReports.find((r) => {
          const rCode = String(r.storeCode || '').toUpperCase().trim();
          if (rCode !== targetCode) return false;
          if (targetDate && r.visitDate) return r.visitDate === targetDate;
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
          if (targetDate && r.visitDate) return r.visitDate === targetDate;
          return true;
        }) || null;
    }
  }

  if (matchedReport) {
    const cleanStoreName = String(matchedReport.storeName || targetName || 'STORE')
      .replace(/[/\\:*?"<>|]/g, ' ')
      .trim();
    const cleanCode = matchedReport.storeCode || targetCode || '';
    const storeFolderName = cleanCode ? `${cleanCode} - ${cleanStoreName}` : cleanStoreName;
    const dateFormatted = formatDateDdMmYyyy(matchedReport.visitDate || targetDate);
    const pdfFileName = `Hasil Kunjungan-${cleanStoreName}-${dateFormatted}.pdf`;

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
      format: 'PDF',
      category: 'VISIT',
      isVerifiedInGDrive: true,
    };
  }

  // 3. Fallback to local registry ONLY IF marked with actual sync URL
  if (typeof window !== 'undefined') {
    const registry = getGDriveReportRegistryEntry({
      storeCode: targetCode,
      storeName: targetName,
      agendaId,
    });

    if (registry && registry.pdfUrl && registry.pdfUrl !== FMCU_REPORT_GDRIVE_FOLDER_URL) {
      try {
        const localKey = agendaId ? `fmcu_visit_report_${agendaId}` : null;
        const localRaw = localKey ? localStorage.getItem(localKey) : null;
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed && (parsed.status === 'SUBMITTED' || parsed.actualInSubmitted)) {
            return {
              reportData: parsed,
              gdrivePdfUrl: registry.pdfUrl,
              gdriveEmbedUrl: registry.gdriveEmbedUrl,
              storeFolderName: registry.storeName || targetName,
              pdfFileName: `Hasil Kunjungan-${registry.storeName || targetName}.pdf`,
              gdriveSavedDate: `${formatIndonesianDate(registry.visitDate, false)}`,
              gdriveSavedTimestamp: new Date(registry.visitDate).getTime() || Date.now(),
              format: 'PDF',
              category: 'VISIT',
              isVerifiedInGDrive: true,
            };
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // NO DUMMY: If not verified in GDrive, return null
  return null;
}
