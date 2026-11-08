import excelSeed from './excelScheduleSeed.json';
import { Medicine, ScheduleAgenda, User } from '../types';

export const ADMIN_PASSWORD = '01012026';
export const EXECUTIVE_VIEWER_PASSWORD = '20260101';

export const ADMIN_USER: User = {
  id: 'admin-001',
  name: 'Admin FMCU (Scheduler & Control)',
  email: 'admin@fmcuteams.com',
  role: 'Master Admin & Scheduler',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  password: ADMIN_PASSWORD,
  isAdmin: true,
  isExecutiveViewer: false,
  accessLevel: 'ADMIN',
};

export const EXECUTIVE_VIEWER_USER: User = {
  id: 'exec-hod-001',
  name: 'Head of Division (Executive Viewer)',
  email: 'hod.executive@fmcuteams.com',
  role: 'Head of Division • Executive Observer',
  avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  password: EXECUTIVE_VIEWER_PASSWORD,
  isAdmin: true,
  isExecutiveViewer: true,
  accessLevel: 'EXECUTIVE_VIEWER',
};

// 36 User Asli dari kolom Nama pada file "TEMPLET EXCEL JADWAL.xlsx"
export const initialUsers: User[] = [
  ADMIN_USER,
  EXECUTIVE_VIEWER_USER,
  ...(excelSeed.users as User[]),
];

// 582 Agenda Asli dari 3 Sheet Excel
export const initialAgendas: ScheduleAgenda[] = excelSeed.agendas as ScheduleAgenda[];

export const initialMedicines: Medicine[] = [
  {
    id: 'med-1',
    name: 'Paracetamol XL2',
    strength: '150mg',
    dosageForm: '1 capsule',
    type: 'capsule',
    description: 'Fast-acting analgesic and antipyretic formulation designed for relief of mild to moderate pain and fever.',
    times: ['After Breakfast', 'After Dinner'],
    amount: '2 pill/Day',
    thisMonthProgress: '22/31 taken',
    cause: 'Pain Relief',
    capSize: '150 mg',
    duration: '1 Month',
    frequency: 'Daily',
    takenToday: false,
  },
];
