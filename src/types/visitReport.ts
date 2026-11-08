export interface StoreCrew {
  id: string;
  role: string;
  name: string;
  jobLevel: string;
}

export type ObservationType = 'OPI' | 'QSC';

export interface ObservationFinding {
  id: string;
  type: ObservationType;
  title?: string;
  category?: string;
  auditFinding: string;
  operationalImpact: string;
  idealCondition: string;
  actionPlan: string;
  rootCause: string;
  expectedResult: string;
  deadline: string;
  deadlineFormatted?: string;
  status?: 'OPEN' | 'CLOSED';
}

export interface EvidencePhoto {
  id: string;
  photoUrl: string;
  rawPhotoUrl?: string; // Foto bersih asli tanpa watermark untuk edit
  caption: string;
  timestamp: string;
  gpsLocation: string;
  driveFileId?: string;
  driveUrl?: string;
  isCa?: boolean;
}

export interface VisitReportData {
  id: string;
  agendaId: string;
  
  // Geofence & Check-In
  actualIn?: string;
  actualOut?: string;
  liveGps?: string;
  actualInSubmitted?: boolean;
  isManualCheckIn?: boolean;
  
  // Section 1: General Info & QSC
  storeFrontPhoto: string;
  visitorName: string;
  storeName: string;
  storeCode: string;
  storeType: string;
  storeHead: string;
  visitDate: string;
  areaManager: string;
  regionalManager: string;
  storeEmail?: string;
  
  // QSC Sheets (Slide 2 - Foto Utuh Tidak Displit)
  qscSheetPhoto?: string;
  qscDriveUrl?: string;
  qscSheetTop: string;
  qscSheetBottom: string;
  qscTopDriveUrl?: string;
  qscBottomDriveUrl?: string;
  gasSyncStatus?: 'idle' | 'syncing' | 'synced' | 'offline-queued';
  lastSyncedAt?: string;

  // Store Crew on Duty (Slide 3)
  crews: StoreCrew[];

  // Section 2: Observasi (QSC & OPI)
  enableQsc?: boolean;
  enableOpi?: boolean;
  observations: ObservationFinding[];

  // Section 3: Evidence (Bukti Temuan & Hasil Perbaikan CA)
  enableEvidence?: boolean;
  enableCa?: boolean;
  evidencePhotos: EvidencePhoto[];
  caPhotos?: EvidencePhoto[];

  // Store Assignment & Spreadsheet CA
  spreadsheetUrl: string;
  assignmentNotes: string;
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt?: string;
}
