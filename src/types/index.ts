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
  | 'CUTI';

export interface ScheduleAgenda {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: ScheduleCategory;
  location: string;
  pic: string;
  description?: string;
  tags: string[];
  completed?: boolean;
  priority?: 'HIGH' | 'MEDIUM' | 'NORMAL';
  createdBy?: string;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  password?: string;
  isAdmin?: boolean;
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
