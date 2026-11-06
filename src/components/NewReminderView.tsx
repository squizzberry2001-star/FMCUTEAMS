import React, { useState } from 'react';
import { ChevronLeft, Bell, Plus, Calendar, Clock, Check } from 'lucide-react';
import { Medicine, MedicineType } from '../types';
import { ParacetamolHero3D, BottleIcon3D, CapsuleIcon3D, SyringeIcon3D, BlisterIcon3D } from './3d-icons/Illustrations';

interface NewReminderViewProps {
  onBack: () => void;
  onAddMedicine: (medicine: Omit<Medicine, 'id'>) => void;
}

export const NewReminderView: React.FC<NewReminderViewProps> = ({ onBack, onAddMedicine }) => {
  const [name, setName] = useState('Paracetamol XL2');
  const [strength, setStrength] = useState('150mg');
  const [dosageForm, setDosageForm] = useState('1 capsule');
  const [type, setType] = useState<MedicineType>('capsule');
  const [times, setTimes] = useState<string[]>(['After Breakfast', 'After Dinner']);
  const [duration, setDuration] = useState('1 Month');
  const [frequency, setFrequency] = useState('Daily');
  const [cause, setCause] = useState('Pain Relief');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showAddTiming, setShowAddTiming] = useState(false);

  const availableTypes: { id: MedicineType; label: string; icon: React.ReactNode }[] = [
    { id: 'bottle', label: 'Syrup', icon: <BottleIcon3D className="w-9 h-9" /> },
    { id: 'capsule', label: 'Capsule', icon: <CapsuleIcon3D className="w-9 h-9" /> },
    { id: 'syringe', label: 'Injection', icon: <SyringeIcon3D className="w-9 h-9" /> },
    { id: 'tablet', label: 'Tablet', icon: <BlisterIcon3D className="w-9 h-9" /> },
  ];

  const handleAddTime = (tag: string) => {
    if (tag && !times.includes(tag)) {
      setTimes([...times, tag]);
    }
    setCustomTimeInput('');
    setShowAddTiming(false);
  };

  const handleRemoveTime = (tag: string) => {
    setTimes(times.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddMedicine({
      name,
      strength,
      dosageForm,
      type,
      times: times.length > 0 ? times : ['After Breakfast'],
      amount: '2 pill/Day',
      thisMonthProgress: '0/30 taken',
      cause,
      capSize: strength,
      duration,
      frequency,
      takenToday: false,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar relative">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 shadow-soft-sm transition-transform active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="font-bold text-slate-800 text-base">
          New Reminder
        </h3>

        <div className="w-10 h-10 rounded-full bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] shadow-soft-sm relative">
          <Bell className="w-5 h-5" />
          <span className="w-2 h-2 rounded-full bg-[#2BB3A0] absolute top-2 right-2 border-2 border-white" />
        </div>
      </div>

      {/* 3D Hero Illustration */}
      <div className="relative flex flex-col items-center justify-center pt-2 pb-4 px-6">
        <div className="absolute w-52 h-52 bg-gradient-to-tr from-pink-100/40 via-yellow-100/40 to-teal-100/40 rounded-full blur-2xl -z-0 pointer-events-none" />
        <div className="relative z-10 transition-transform duration-500 hover:scale-105">
          <ParacetamolHero3D className="w-48 h-48 drop-shadow-md" />
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-t-[36px] flex-1 px-6 pt-6 pb-8 shadow-soft-card flex flex-col justify-between">
        <div className="space-y-5">
          {/* Medicine Name */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">
              Medicine Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paracetamol XL2"
              required
              className="w-full text-base font-bold text-slate-800 border-b border-slate-200 pb-2 focus:border-teal-500 outline-none transition-colors placeholder:font-normal placeholder:text-slate-300"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2.5">
              Type
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {availableTypes.map((item) => {
                const isSelected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={`h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#5C86FA] to-[#3B66F5] text-white shadow-pill-blue scale-[1.03]'
                        : 'bg-white hover:bg-slate-50 border border-slate-100 text-slate-600'
                    }`}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time & Schedule */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">
              Time & Schedule
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t, idx) => {
                const isBreakfast = t.toLowerCase().includes('breakfast');
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      isBreakfast ? 'bg-[#EAF8F2] text-[#2BB3A0]' : 'bg-[#FFF0E7] text-[#FF9E79]'
                    }`}
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTime(t)}
                      className="opacity-70 hover:opacity-100 text-[10px]"
                    >
                      ×
                    </button>
                  </span>
                );
              })}

              {/* Add Time Button */}
              <button
                type="button"
                onClick={() => setShowAddTiming(!showAddTiming)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick add popover options */}
            {showAddTiming && (
              <div className="mt-2.5 p-2 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-wrap gap-1.5">
                {['Before Breakfast', 'After Lunch', 'Before Dinner', 'Bedtime'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleAddTime(option)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-teal-50 hover:text-teal-700 text-slate-600 border border-slate-100"
                  >
                    + {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration & Frequency */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Duration */}
            <div>
              <span className="block text-xs text-slate-400 font-medium mb-1.5">
                Duration
              </span>
              <div className="bg-[#F8FAFC] rounded-2xl p-2.5 flex items-center gap-2.5 border border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 outline-none w-full cursor-pointer"
                >
                  <option value="1 Week">1 Week</option>
                  <option value="2 Weeks">2 Weeks</option>
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                </select>
              </div>
            </div>

            {/* Frequency */}
            <div>
              <span className="block text-xs text-slate-400 font-medium mb-1.5">
                Frequency
              </span>
              <div className="bg-[#F8FAFC] rounded-2xl p-2.5 flex items-center gap-2.5 border border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 outline-none w-full cursor-pointer"
                >
                  <option value="Daily">Daily</option>
                  <option value="Every 2 Days">Every 2 Days</option>
                  <option value="Weekly">Weekly</option>
                  <option value="As Needed">As Needed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-7">
          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-semibold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Add Reminder
          </button>
        </div>
      </form>
    </div>
  );
};
