import React from 'react';
import { ChevronLeft, LogOut, Bell, Shield, Heart, Award, ArrowRight } from 'lucide-react';
import { User, Medicine } from '../types';

interface ProfileViewProps {
  user: User;
  medicinesCount: number;
  onBack: () => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  medicinesCount,
  onBack,
  onLogout,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-6 pt-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-soft-sm active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-extrabold text-slate-800">My Profile</h2>
        <div className="w-10 h-10" />
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl p-6 shadow-soft-card flex flex-col items-center text-center mb-6">
        <img
          src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
          alt={user.name}
          className="w-20 h-20 rounded-full object-cover ring-4 ring-teal-100 shadow-md mb-3"
        />
        <h3 className="text-lg font-black text-slate-800">{user.name}</h3>
        <p className="text-xs text-slate-400 font-medium">{user.email}</p>

        <div className="flex items-center gap-4 mt-5 w-full pt-4 border-t border-slate-100">
          <div className="flex-1 text-center">
            <span className="block text-base font-black text-slate-800">{medicinesCount}</span>
            <span className="text-[11px] text-slate-400 font-medium">Prescriptions</span>
          </div>
          <div className="w-[1px] h-8 bg-slate-200" />
          <div className="flex-1 text-center">
            <span className="block text-base font-black text-teal-600">95%</span>
            <span className="text-[11px] text-slate-400 font-medium">Adherence</span>
          </div>
          <div className="w-[1px] h-8 bg-slate-200" />
          <div className="flex-1 text-center">
            <span className="block text-base font-black text-orange-500">14 Days</span>
            <span className="text-[11px] text-slate-400 font-medium">Streak</span>
          </div>
        </div>
      </div>

      {/* Settings Options */}
      <div className="bg-white rounded-3xl p-3 shadow-soft-card space-y-1 mb-6">
        {[
          { label: 'Notification Reminders', icon: Bell, tag: 'Enabled' },
          { label: 'Caregiver & Doctor Sharing', icon: Heart, tag: 'Connected' },
          { label: 'Health Goals & Badges', icon: Award, tag: 'Level 4' },
          { label: 'Privacy & Security', icon: Shield, tag: 'Protected' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => alert(`${item.label} settings are active.`)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full">
                  {item.tag}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out of FMCUTEAMS</span>
      </button>
    </div>
  );
};
