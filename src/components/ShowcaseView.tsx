import React from 'react';
import confetti from 'canvas-confetti';
import { Medicine } from '../types';
import { MobileFrame } from './MobileFrame';
import { HomeScreen } from './HomeScreen';
import { DetailView } from './DetailView';
import { NewReminderView } from './NewReminderView';

interface ShowcaseViewProps {
  medicines: Medicine[];
  selectedMedicine: Medicine;
  onSelectMedicine: (med: Medicine) => void;
  onAddMedicine: (med: Omit<Medicine, 'id'>) => void;
  onRemoveMedicine: (id: string) => void;
  onToggleTaken: (id: string, e?: React.MouseEvent) => void;
  onOpenMobileView: () => void;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({
  medicines,
  selectedMedicine,
  onSelectMedicine,
  onAddMedicine,
  onRemoveMedicine,
  onToggleTaken,
  onOpenMobileView,
}) => {
  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#2BB3A0', '#FF6B8B', '#FFB085', '#5C86FA'],
    });
  };

  const handleToggleTakenWithConfetti = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onToggleTaken(id, e);
    triggerConfetti();
  };

  return (
    <div className="min-h-[calc(100vh-57px)] w-full relative ambient-bg-glow py-8 px-4 sm:px-8 flex flex-col items-center justify-center overflow-x-auto">
      {/* Soft Ambient Background Elements matching the photo */}
      <div className="absolute top-10 left-12 w-96 h-96 bg-[#D4F4E2]/50 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/4 right-1/4 w-[450px] h-[450px] bg-[#FFE7D9]/50 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-12 right-12 w-96 h-96 bg-[#E8EEFF]/60 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Intro Header */}
      <div className="relative z-10 text-center max-w-2xl mb-8">
        <span className="inline-block px-3.5 py-1 rounded-full bg-white/80 text-teal-700 text-xs font-bold border border-teal-100 shadow-sm mb-2">
          Interactive Design Duplicate • As Seen In Photo
        </span>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          Medicines Reminder System
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Each screen is fully interactive and synced in real-time. Try adding a reminder on Phone 3 or clicking a medicine on Phone 1!
        </p>
      </div>

      {/* The 3 Mobile Mockups Side-by-Side */}
      <div className="relative z-10 flex flex-nowrap items-center justify-center gap-6 lg:gap-8 xl:gap-12 pb-6 min-w-max">
        {/* Phone 1: Dashboard / Home */}
        <div className="transition-transform duration-300 hover:-translate-y-1">
          <MobileFrame title="Screen 1: Dashboard">
            <HomeScreen
              medicines={medicines}
              onSelectMedicine={onSelectMedicine}
              onOpenNewReminder={() => {
                alert("You can configure and submit the New Reminder form on the 3rd phone to the right!");
              }}
              onToggleTaken={handleToggleTakenWithConfetti}
            />
          </MobileFrame>
        </div>

        {/* Phone 2: Detail View */}
        <div className="transition-transform duration-300 hover:-translate-y-1">
          <MobileFrame title="Screen 2: Medicine Detail">
            <DetailView
              medicine={selectedMedicine}
              onBack={() => {
                // Select previous medicine
                const currentIndex = medicines.findIndex((m) => m.id === selectedMedicine.id);
                const prev = medicines[(currentIndex - 1 + medicines.length) % medicines.length];
                onSelectMedicine(prev);
              }}
              onRemove={onRemoveMedicine}
              onToggleTaken={handleToggleTakenWithConfetti}
              onEditSchedule={(med) => alert(`Editing schedule for ${med.name}`)}
            />
          </MobileFrame>
        </div>

        {/* Phone 3: New Reminder Form */}
        <div className="transition-transform duration-300 hover:-translate-y-1">
          <MobileFrame title="Screen 3: New Reminder">
            <NewReminderView
              onBack={() => alert("Ready to add a reminder or customize the inputs below!")}
              onAddMedicine={(newMed) => {
                onAddMedicine(newMed);
                triggerConfetti();
                alert(`"${newMed.name}" successfully added to reminders list on Phone 1!`);
              }}
            />
          </MobileFrame>
        </div>
      </div>
    </div>
  );
};
