export type MedicineType = 'capsule' | 'bottle' | 'syringe' | 'tablet';

export type TimeSchedule = 'Before Breakfast' | 'After Breakfast' | 'Before Lunch' | 'After Lunch' | 'Before Dinner' | 'After Dinner' | 'Bedtime';

export interface Medicine {
  id: string;
  name: string;
  strength: string; // e.g. "150mg"
  dosageForm: string; // e.g. "1 capsule"
  type: MedicineType;
  description?: string;
  times: string[]; // e.g. ["After Breakfast", "After Dinner"]
  amount: string; // e.g. "2 pill/Day"
  thisMonthProgress: string; // e.g. "3/31 taken"
  cause: string; // e.g. "Diabetes"
  capSize: string; // e.g. "150 mg"
  duration: string; // e.g. "1 Month"
  frequency: string; // e.g. "Daily"
  takenToday?: boolean;
}

export interface User {
  name: string;
  email: string;
  avatar?: string;
}
