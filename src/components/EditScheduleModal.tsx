import React, { useState } from 'react';
import { X, Clock, Calendar, Pill, Check } from 'lucide-react';
import { Medicine } from '../types';

interface EditScheduleModalProps {
  medicine: Medicine;
  onClose: () => void;
  onSave: (updated: Medicine) => void;
}

export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  medicine,
  onClose,
  onSave,
}) => {
  const [strength, setStrength] = useState(medicine.strength);
  const [dosageForm, setDosageForm] = useState(medicine.dosageForm);
  const [times, setTimes] = useState<string[]>(medicine.times);
  const [duration, setDuration] = useState(medicine.duration);
  const [frequency, setFrequency] = useState(medicine.frequency);
  const [amount, setAmount] = useState(medicine.amount);

  const allTimes = [
    'Before Breakfast',
    'After Breakfast',
    'Before Lunch',
    'After Lunch',
    'Before Dinner',
    'After Dinner',
    'Bedtime',
  ];

  const toggleTime = (t: string) => {
    if (times.includes(t)) {
      setTimes(times.filter((x) => x !== t));
    } else {
      setTimes([...times, t]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...medicine,
      strength,
      dosageForm,
      times: times.length > 0 ? times : ['After Breakfast'],
      duration,
      frequency,
      amount,
      capSize: strength,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 absolute top-5 right-5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
            Schedule Settings
          </span>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mt-0.5">
            Edit Schedule: {medicine.name}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Customize dosages, reminder alarms, and schedule frequency.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Strength & Dosage Form */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">
                Dosage Strength
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 150mg"
                required
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">
                Amount Per Day
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2 pill/Day"
                required
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Time & Schedule Pills */}
          <div>
            <label className="block text-xs text-slate-500 font-semibold mb-2">
              Timing & When to Take
            </label>
            <div className="flex flex-wrap gap-2">
              {allTimes.map((t) => {
                const isSelected = times.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTime(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#2BB3A0] text-white shadow-sm scale-[1.02]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1 stroke-[3]" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration & Frequency */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">
                Duration
              </label>
              <div className="bg-[#F8FAFC] rounded-2xl p-2.5 flex items-center gap-2 border border-slate-200">
                <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
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

            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">
                Frequency
              </label>
              <div className="bg-[#F8FAFC] rounded-2xl p-2.5 flex items-center gap-2 border border-slate-200">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
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

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-xs shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Schedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
