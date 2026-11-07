export type AgendaType = 'VISIT' | 'NSO' | 'MEETING' | 'INSPECTION' | 'TRAINING';

export interface FmcuAgenda {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: AgendaType;
  location: string;
  pic: string;
  description: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface EncryptedPhotoItem {
  id: string;
  name: string;
  caption?: string;
  category: 'FACADE' | 'DISPLAY' | 'STOCK' | 'ISSUE' | 'BEFORE_AFTER' | 'GENERAL';
  originalSizeKB: number;
  compressedSizeKB: number;
  previewUrl: string; // In-memory decrypted display URL
  encryptedBase64: string; // AES-256 cipher string sent to Google Drive
  driveFileId?: string;
  timestamp: string;
}

export interface VisitReport {
  id: string;
  storeName: string;
  storeCode?: string;
  visitDate: string;
  visitorName: string;
  purpose: string;
  checklists: {
    cleanliness: boolean;
    displayVm: boolean;
    stockAvailability: boolean;
    cashierIt: boolean;
    sopCompliance: boolean;
  };
  notes: string;
  actionItems: string;
  photos: EncryptedPhotoItem[];
  status: 'SUBMITTED' | 'REVIEWED' | 'DRAFT';
  createdAt: string;
}

export interface NsoProject {
  id: string;
  storeCode: string;
  storeName: string;
  city: string;
  picNso: string;
  targetOpeningDate: string;
  progressPercent: number;
  checklist: {
    civilFitout: boolean;
    electricalMe: boolean;
    itPosNetwork: boolean;
    shelvesSignage: boolean;
    inventoryStock: boolean;
    manpowerReady: boolean;
    licensesPermits: boolean;
  };
  notes: string;
  photos: EncryptedPhotoItem[];
  status: 'PLANNING' | 'FIT_OUT' | 'STOCKING' | 'READY_TO_OPEN' | 'LAUNCHED';
  createdAt: string;
}

export interface User {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

// Backward compatibility types for medical mockup if referenced
export type MedicineType = 'capsule' | 'bottle' | 'syringe' | 'tablet';

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
