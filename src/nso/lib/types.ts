export const DEFAULT_STORE_PIN = '607090';

export const CREW_LEVELS = ['1A', 'NS3', 'NS1', 'MG3', 'MG2', 'MG1'] as const;
export type CrewLevel = (typeof CREW_LEVELS)[number];

export type CheckValue = '' | 'Y' | 'N' | 'F';

export const FACILITATORS = [
  'Aan Bagus Permana',
  'Anggi Novita',
  'Aulia Fauziah',
  'Bagus Pradika',
  'Cindy Silvia Sahyu',
  'Edi Sukarno',
  'Fajar Saputra',
  'Fendi Setiawan',
  'Fiqri Amatul Firdaus',
  'Karlina Endah Puji Astuti',
  'Malik Ibrahim',
  'Muhammad Fikri',
  'Novilya Dwi Rahman',
  'Rani Ismawati',
  'Rully Alfandi',
  'Seftiana Putri Rahmawati',
  'Tia Fitri',
  'Yuyun Yuliyanti'
] as const;

export const GROUP_MODES = [
  '1 Cashier + 1 Support',
  '1 Cashier + 1 Barista + 1 Support',
  '1 Cashier + 1 Barista + 2 Support',
  '2 Cashier + 1 Barista + 2 Support'
] as const;
export type GroupMode = (typeof GROUP_MODES)[number];
export type GroupRole = 'Cashier' | 'Barista' | 'Support';

export const BEHAVIOR_METRICS = [
  'Senyum',
  'Greeting',
  'Ramah',
  'Sopan',
  'Berterimakasih',
  'Komunikasi',
  'Cekatan & Inisiatif',
  'Empati',
  'Personal Hygiene',
  'Kebersihan Area Kerja',
  'Grooming'
] as const;
export type BehaviorMetric = (typeof BEHAVIOR_METRICS)[number];

export const SPEED_CASHIER_METRICS = [
  'Senyum',
  'Greeting',
  'Upselling',
  'Cross Selling',
  'Suggestive Selling',
  'Informasikan Harga dan pembayaran',
  'Menyerahkan Barang',
  'Berterimakasih'
] as const;

export const SPEED_PRODUCT_METRICS = [
  'KSK Sesuai SOP',
  'ICE TEA Sesuai SOP'
] as const;

export const SPEED_METRICS = [
  'Senyum',
  'Greeting',
  'Upselling',
  'Cross Selling',
  'Suggestive Selling',
  'Informasikan Harga dan pembayaran',
  'Menyerahkan Barang',
  'Berterimakasih',
  'KSK Sesuai SOP',
  'ICE TEA Sesuai SOP'
] as const;
export type SpeedMetric = (typeof SPEED_METRICS)[number];

export type ProductCategory = 'Kitchen' | 'Beverage' | 'Grocery';

export interface ProductMasterItem {
  id: string;
  category: ProductCategory;
  article: string;
  name: string;
}

export interface CrewMember {
  id: string;
  name: string;
  nik: string;
  level: CrewLevel;
  photoUrl?: string;
  groomingPhotoUrl?: string;
  createdSource?: 'facilitator' | 'audience';
}

export interface CrewBehaviorRow {
  crewId: string;
  values: Record<BehaviorMetric, CheckValue>;
  gapLearning: string;
  gapNonLearning: string;
  correction: string;
}

export interface CrewSpeedRow {
  crewId: string;
  values: Record<SpeedMetric, CheckValue>;
  kskTime: string;
  iceTeaTime: string;
  gapLearning: string;
  gapNonLearning: string;
  correction: string;
  suggestPosition: 'Cashier' | 'Barista' | 'Cashier & Barista' | '';
}

export interface ProductLine {
  id: string;
  product: string;
  qty: number;
  article?: string;
  category?: ProductCategory;
}

export type ReadinessStatus = 'OK' | 'Belum ada' | 'Pending';
export type ReadinessAction = '' | 'STO' | 'Order' | 'Reservasi' | 'Pembelian Pettycash' | 'Follow Up';

export interface ReadinessItem {
  id: string;
  area: 'Equipment' | 'Beverage' | 'Kitchen' | string;
  section: string;
  name: string;
  qty: string;
  checked: boolean;
  status: ReadinessStatus;
  action: ReadinessAction | string;
  note: string;
}

export interface LeftoverProductLine {
  id: string;
  product: string;
  qty: number;
  article?: string;
  category?: ProductCategory;
  source?: 'facilitator' | 'crew';
  updatedAt?: string;
}

export interface TransactionSet {
  id: string;
  label: string;
  targetTime: string;
  actualTime: string;
  products: ProductLine[];
  keterangan: string;
  gapFinding: string;
  correction: string;
  capturedAt?: string;
  capturedByDeviceId?: string;
  lockedByDeviceId?: string;
  lockedAt?: string;
  noteUpdatedAt?: string;
  customerName?: string;
  cashierCrewId?: string;
  cashierCrewName?: string;
}

export interface SpeedAccuracyGroup {
  id: string;
  title: string;
  modeLabel: GroupMode | string;
  roleComposition: string;
  roleAssignments?: Partial<Record<GroupRole, string[]>>;
  teamMembers: string;
  transactions: TransactionSet[];
  timerEnabled?: boolean;
  keterangan?: string;
  gapFinding?: string;
  correction?: string;
}

export interface SummaryItem {
  id: string;
  jenis: string;
  keterangan: string;
  koreksi: string;
}

export interface TimerRecord {
  id: string;
  crewName: string;
  crewNik: string;
  storeName: string;
  role: string;
  elapsedMs: number;
  elapsedText: string;
  createdAt: string;
  groupId?: string;
  groupTitle?: string;
  transactionId?: string;
  transactionLabel?: string;
  customerName?: string;
  keterangan?: string;
  deviceId?: string;
  cashierCrewId?: string;
  cashierCrewName?: string;
}

export interface ReportData {
  id: string;
  storeName: string;
  storeKey: string;
  audienceToken: string;
  accessCode?: string;
  updatedAt: string;
  general: {
    title: string;
    subtitle: string;
    storeLeader: string;
    storeCode?: string;
    areaManager: string;
    regionalManager?: string;
    storeType: string;
    mpaMps: string;
    date: string;
    facilitator: string;
    facilitator2?: string;
    coverPhotoUrl?: string;
    closingNote: string;
  };
  crews: CrewMember[];
  behaviorRows: CrewBehaviorRow[];
  speedRows: CrewSpeedRow[];
  speedGroups: SpeedAccuracyGroup[];
  activeSpeedGroupId?: string;
  timerSessionActive?: boolean;
  productMaster?: ProductMasterItem[];
  readinessChecklist?: ReadinessItem[];
  readinessChecklistEnabled?: boolean;
  leftoverProducts?: LeftoverProductLine[];
  leftoverInputEnabled?: boolean;
  summaryItems: SummaryItem[];
  actionPlanCrew: string;
  actionPlanTeam: string;
  documentationPhotos: string[];
  layoutCounterPhotos: string[];
  planogramPhotos: string[];
  timers: TimerRecord[];
  deletedCrewIds?: string[];
}

export interface StoreHistoryItem {
  id: string;
  storeName: string;
  storeKey: string;
  audienceToken: string;
  accessCode?: string;
  updatedAt: string;
}
