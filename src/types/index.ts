export type MedicineType = 'capsule' | 'bottle' | 'syringe' | 'tablet';

export type TimeSchedule = 'Before Breakfast' | 'After Breakfast' | 'Before Lunch' | 'After Lunch' | 'Before Dinner' | 'After Dinner' | 'Bedtime';

export type ScheduleCategory =
  | 'VISIT'
  | 'NSO'
  | 'MEETING'
  | 'AUDIT'
  | 'TRAINING'
  | 'WORK_PLAN'
  | 'OPERATION'
  | 'CUTI'
  | 'OFF';

export interface ActualAttendanceSilentAudit {
  inLat?: number;
  inLng?: number;
  inAccuracyMeters?: number;
  inDistanceToStoreMeters?: number;
  inLocationStatus?: 'VERIFIED_AT_STORE' | 'NEAR_STORE_INDOOR' | 'OUTSIDE_STORE_RADIUS' | 'SILENT_BG';
  outLat?: number;
  outLng?: number;
  outAccuracyMeters?: number;
  outDistanceToStoreMeters?: number;
  outLocationStatus?: 'VERIFIED_AT_STORE' | 'NEAR_STORE_INDOOR' | 'OUTSIDE_STORE_RADIUS' | 'SILENT_BG';
  storeOrderIndex?: number; // 1 = Toko Pertama, 2 = Toko Kedua, dst.
  totalStoresToday?: number;
  transitMinutesFromPrevStore?: number;
  inTimingStatus?: 'ON_TIME' | 'LATE' | 'CONTINUATION_VISIT';
  outTimingStatus?: 'FULL_DAY_COMPLETE' | 'TRANSIT_TO_NEXT_STORE' | 'EARLY_OUT';
  lateMinutes?: number;
  earlyOutMinutes?: number;
  clockTamperDetected?: boolean;
  recordedOfflineIn?: boolean;
  recordedOfflineOut?: boolean;
  syncStatus?: 'SYNCED' | 'OFFLINE_QUEUED';
  lastSyncedAt?: string;
}

export interface ScheduleAgenda {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  category: ScheduleCategory;
  location: string;
  pic: string;
  description?: string;
  rawDescription?: string;
  rawLocation?: string;
  storeCode?: string;
  storeName?: string;
  storeType?: string;
  storeHead?: string;
  areaManager?: string;
  regionalManager?: string;
  storeEmail?: string;
  bestieInCharge?: string;
  tags: string[];
  completed?: boolean;
  priority?: 'HIGH' | 'MEDIUM' | 'NORMAL';
  createdBy?: string;
  actualIn?: string; // HH:mm WIB
  actualOut?: string; // HH:mm WIB
  actualInIso?: string;
  actualOutIso?: string;
  silentAudit?: ActualAttendanceSilentAudit;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  password?: string;
  isAdmin?: boolean;
  isExecutiveViewer?: boolean;
  accessLevel?: 'ADMIN' | 'EXECUTIVE_VIEWER' | 'STAFF';
}

export interface Medicine {
  id: string;
  name: string;
  strength: string;
  dosageForm: string;
  type: MedicineType;
  description?: string;
  times: string[];
  amount: string;
  thisMonthProgress: string;
  cause: string;
  capSize: string;
  duration: string;
  frequency: string;
  takenToday?: boolean;
}
