import React from 'react';
import { ChevronLeft, ClipboardList, CheckCircle2 } from 'lucide-react';
import { Medicine } from '../types';

interface HistoryViewProps {
  medicines: Medicine[];
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ medicines, onBack }) => {
  const historyLogs = [
    { name: 'DPP-4 inhibitors', time: 'Today, 13:15 PM', status: 'Taken on time', statusColor: 'text-emerald-600 bg-emerald-50' },
    { name: 'Paracetamol XL2', time: 'Yesterday, 20:30 PM', status: 'Taken on time', statusColor: 'text-emerald-600 bg-emerald-50' },
    { name: 'Meglitinides', time: 'Yesterday, 07:45 AM', status: 'Taken on time', statusColor: 'text-emerald-600 bg-emerald-50' },
    { name: 'Paracetamol XL2', time: 'Nov 3, 20:10 PM', status: 'Taken late (30m)', statusColor: 'text-amber-600 bg-amber-50' },
    { name: 'DPP-4 inhibitors', time: 'Nov 3, 12:55 PM', status: 'Taken on time', statusColor: 'text-emerald-600 bg-emerald-50' },
  ];

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
        <h2 className="text-base font-extrabold text-slate-800">Dose Adherence Log</h2>
        <div className="w-10 h-10 rounded-full bg-[#EEF3FF] text-[#5C7CFA] flex items-center justify-center">
          <ClipboardList className="w-5 h-5" />
        </div>
      </div>

      {/* Stats Summary Card */}
      <div className="bg-gradient-to-br from-[#2BB3A0] to-[#169888] rounded-3xl p-5 text-white shadow-pill-teal mb-6">
        <span className="text-xs font-semibold text-teal-100 uppercase tracking-wider block">Adherence Score</span>
        <h3 className="text-3xl font-black mt-1">94.8%</h3>
        <p className="text-xs text-teal-100/90 mt-1">
          Outstanding consistency! You've taken 28 of 30 scheduled doses this month.
        </p>
      </div>

      {/* Activity Log */}
      <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Recent Activity</h3>
      <div className="space-y-3">
        {historyLogs.map((log, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-soft-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{log.name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{log.time}</p>
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${log.statusColor}`}>
              {log.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
