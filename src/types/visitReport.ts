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
  title: string;
  auditFinding: string;
  operationalImpact: string;
  idealCondition: string;
  actionPlan: string;
  rootCause: string;
  expectedResult: string;
  deadline: string;
}

export interface EvidencePhoto {
  id: string;
  photoUrl: string;
  caption: string;
  timestamp: string;
  gpsLocation: string;
}

export interface VisitReportData {
  id: string;
  agendaId: string;
  // Step 1: Info Toko & Header
  storeFrontPhoto: string;
  visitorName: string;
  storeName: string;
  storeCode: string;
  storeType: string;
  storeHead: string;
  visitDate: string;
  areaManager: string;
  regionalManager: string;

  // Step 2: Lembar QSC / FamiTrack
  qscSheetTop: string;
  qscSheetBottom: string;

  // Step 3: Store Crew on Duty
  crews: StoreCrew[];

  // Step 4: Observasi (OPI & QSC)
  observations: ObservationFinding[];

  // Step 5: Finding Evidence Photos
  evidencePhotos: EvidencePhoto[];

  // Step 6: Store Assignment & Spreadsheet CA
  spreadsheetUrl: string;
  assignmentNotes: string;
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt?: string;
}
