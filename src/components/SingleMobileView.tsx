import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Medicine } from '../types';
import { MobileFrame } from './MobileFrame';
import { HomeScreen } from './HomeScreen';
import { DetailView } from './DetailView';
import { NewReminderView } from './NewReminderView';

interface SingleMobileViewProps {
  medicines: Medicine[];
  selectedMedicine: Medicine;
  onSelectMedicine: (med: Medicine) => void;
  onAddMedicine: (med: Omit<Medicine, 'id'>) => void;
  onRemoveMedicine: (id: string) => void;
  onToggleTaken: (id: string, e?: React.MouseEvent) => void;
}

export const SingleMobileView: React.FC<SingleMobileViewProps> = ({
  medicines,
  selectedMedicine,
  onSelectMedicine,
  onAddMedicine,
  onRemoveMedicine,
  onToggleTaken,
}) => {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'detail' | 'new-reminder'>('home');

  const triggerConfetti = () => {
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#2BB3A0', '#FF6B8B', '#FFB085', '#5C86FA'],
    });
  };

  const handleSelectMed = (med: Medicine) => {
    onSelectMedicine(med);
    setCurrentScreen('detail');
  };

  const handleToggleTakenWithConfetti = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onToggleTaken(id, e);
    triggerConfetti();
  };

  return (
    <div className="min-h-[calc(100vh-57px)] w-full relative ambient-bg-glow py-8 px-4 flex flex-col items-center justify-center">
      {/* Quick Screen Switcher Pills */}
      <div className="flex items-center gap-2 mb-6 bg-white/80 p-1.5 rounded-full shadow-sm border border-slate-200/60 z-20">
        <button
          onClick={() => setCurrentScreen('home')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            currentScreen === 'home' ? 'bg-[#2BB3A0] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Screen 1: Home
        </button>
        <button
          onClick={() => setCurrentScreen('detail')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            currentScreen === 'detail' ? 'bg-[#FF587A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Screen 2: Detail
        </button>
        <button
          onClick={() => setCurrentScreen('new-reminder')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            currentScreen === 'new-reminder' ? 'bg-[#5C86FA] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Screen 3: New Reminder
        </button>
      </div>

      {/* Standalone Phone Mockup */}
      <MobileFrame>
        {currentScreen === 'home' && (
          <HomeScreen
            medicines={medicines}
            onSelectMedicine={handleSelectMed}
            onOpenNewReminder={() => setCurrentScreen('new-reminder')}
            onToggleTaken={handleToggleTakenWithConfetti}
          />
        )}

        {currentScreen === 'detail' && (
          <DetailView
            medicine={selectedMedicine}
            onBack={() => setCurrentScreen('home')}
            onRemove={(id) => {
              onRemoveMedicine(id);
              setCurrentScreen('home');
            }}
            onToggleTaken={handleToggleTakenWithConfetti}
            onEditSchedule={() => alert(`Editing schedule for ${selectedMedicine.name}`)}
          />
        )}

        {currentScreen === 'new-reminder' && (
          <NewReminderView
            onBack={() => setCurrentScreen('home')}
            onAddMedicine={(newMed) => {
              onAddMedicine(newMed);
              triggerConfetti();
              setCurrentScreen('home');
            }}
          />
        )}
      </MobileFrame>
    </div>
  );
};
