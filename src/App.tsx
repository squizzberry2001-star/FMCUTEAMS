import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CalendarDays,
  ClipboardCheck,
  Building2,
  FolderLock,
  LogOut,
  User as UserIcon,
  Shield,
  Plus,
  Sparkles,
  Smartphone,
  Monitor
} from 'lucide-react';
import { FmcuAgenda, VisitReport, NsoProject, EncryptedPhotoItem, User } from './types';
import { initialAgendas, initialVisits, initialNsoProjects } from './data/mockData';
import { FmcuAgendaView } from './components/FmcuAgendaView';
import { FmcuVisitView } from './components/FmcuVisitView';
import { FmcuNsoView } from './components/FmcuNsoView';
import { FormVisitModal } from './components/FormVisitModal';
import { FormNsoModal } from './components/FormNsoModal';
import { FormAgendaModal } from './components/FormAgendaModal';
import { GasConnectionModal } from './components/GasConnectionModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { LoginPage } from './components/LoginPage';
import { getGasUrl, saveEncryptedRecordToDrive } from './services/googleAppsScript';

export const App: React.FC = () => {
  // 1. Data State with LocalStorage
  const [agendas, setAgendas] = useState<FmcuAgenda[]>(() => {
    const saved = localStorage.getItem('fmcu_agendas_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return initialAgendas;
  });

  const [visits, setVisits] = useState<VisitReport[]>(() => {
    const saved = localStorage.getItem('fmcu_visits_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return initialVisits;
  });

  const [nsoProjects, setNsoProjects] = useState<NsoProject[]>(() => {
    const saved = localStorage.getItem('fmcu_nso_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return initialNsoProjects;
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fmcu_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: 'Sarah Jenkins',
      email: 'sarah.j@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'FMCU Field Operations',
    };
  });

  // Active Navigation Tab: 'agenda' | 'visit' | 'nso'
  const [activeTab, setActiveTab] = useState<'agenda' | 'visit' | 'nso'>('agenda');

  // Modals
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showNsoModal, setShowNsoModal] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<EncryptedPhotoItem | null>(null);

  // Connection indicator
  const [isGasConnected, setIsGasConnected] = useState<boolean>(() => !!getGasUrl());

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('fmcu_agendas_data', JSON.stringify(agendas));
  }, [agendas]);

  useEffect(() => {
    localStorage.setItem('fmcu_visits_data', JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    localStorage.setItem('fmcu_nso_data', JSON.stringify(nsoProjects));
  }, [nsoProjects]);

  // Handlers
  const handleAddAgenda = async (newAgendaData: Omit<FmcuAgenda, 'id'>) => {
    const newAgenda: FmcuAgenda = {
      ...newAgendaData,
      id: `agenda-${Date.now()}`,
    };
    setAgendas([newAgenda, ...agendas]);

    // Simpan ke Google Drive jika terhubung
    saveEncryptedRecordToDrive({
      type: 'AGENDA',
      title: newAgenda.title,
      author: user?.name || 'Anonymous',
      data: newAgenda,
    });

    confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
  };

  const handleToggleAgendaStatus = (id: string) => {
    setAgendas((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  const handleAddVisit = async (reportData: Omit<VisitReport, 'id' | 'createdAt'>) => {
    const newVisit: VisitReport = {
      ...reportData,
      id: `VISIT-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };
    setVisits([newVisit, ...visits]);
    setActiveTab('visit');

    // Kirim data terenkripsi ke Google Drive
    await saveEncryptedRecordToDrive({
      type: 'VISIT',
      title: `${newVisit.storeName} (${newVisit.visitDate})`,
      author: newVisit.visitorName,
      data: newVisit,
    });

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#2BB3A0', '#4ADE80', '#FF6B8B'],
    });
  };

  const handleAddNso = async (projectData: Omit<NsoProject, 'id' | 'createdAt'>) => {
    const newNso: NsoProject = {
      ...projectData,
      id: `NSO-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };
    setNsoProjects([newNso, ...nsoProjects]);
    setActiveTab('nso');

    // Kirim data terenkripsi ke Google Drive
    await saveEncryptedRecordToDrive({
      type: 'NSO',
      title: `${newNso.storeName} (${newNso.city})`,
      author: newNso.picNso,
      data: newNso,
    });

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#FF6B8B', '#FFD12E', '#3B82F6'],
    });
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={(u) => setUser(u)}
        onContinueAsGuest={() => {
          setUser({
            name: 'Guest Operational',
            email: 'guest@fmcuteams.com',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          });
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F8F9FD] overflow-hidden select-none">
      {/* 1. Left Sidebar Navigation (Desktop) */}
      <aside className="w-64 bg-white border-r border-slate-200/70 hidden lg:flex flex-col justify-between p-6 z-20 flex-shrink-0">
        <div>
          {/* Logo & App Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal font-extrabold text-base">
              F
            </div>
            <div>
              <span className="text-[10px] font-bold text-teal-600 tracking-wider uppercase block">
                FMCU TEAMS
              </span>
              <h2 className="text-base font-extrabold text-slate-800 leading-tight">
                Operations Portal
              </h2>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'agenda', label: 'Agenda FMCU', icon: CalendarDays, count: agendas.length },
              { id: 'visit', label: 'Form & Laporan Visit', icon: ClipboardCheck, count: visits.length },
              { id: 'nso', label: 'Form & Proyek NSO', icon: Building2, count: nsoProjects.length },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#EAF8F2] text-[#2BB3A0] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-teal-200/60 text-teal-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Google Drive Status Box */}
          <div className="mt-8 bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-2xl p-4 border border-teal-100/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FolderLock className="w-4 h-4 text-teal-600" />
                <span>Google Drive</span>
              </span>
              <span className={`w-2.5 h-2.5 rounded-full ${isGasConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              {isGasConnected
                ? 'Terkoneksi ke Google Drive. Foto & data otomatis dienkripsi AES-256.'
                : 'Google Apps Script belum aktif. Klik untuk menghubungkan.'}
            </p>
            <button
              onClick={() => setShowGasModal(true)}
              className="w-full py-2 rounded-xl bg-white border border-teal-200 text-teal-700 hover:bg-teal-600 hover:text-white font-bold text-xs shadow-sm transition-all"
            >
              Pengaturan Drive
            </button>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-teal-100"
            />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 truncate">{user.name}</h4>
              <p className="text-[10px] text-slate-400 truncate">{user.role || 'Staff FMCU'}</p>
            </div>
          </div>
          <button
            onClick={() => setUser(null)}
            title="Log Out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/70 px-5 sm:px-8 py-3 flex items-center justify-between gap-4 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-8 h-8 rounded-xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white font-black text-sm">
              F
            </div>
            <div>
              <h1 className="font-extrabold text-slate-800 text-sm sm:text-base tracking-tight">
                {activeTab === 'agenda' && 'Jadwal Agenda FMCU'}
                {activeTab === 'visit' && 'Dokumentasi & Form Visit'}
                {activeTab === 'nso' && 'New Store Opening (NSO)'}
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Sistem Operasional Terintegrasi • Google Drive Enkripsi AES-256
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Google Drive Status Pill */}
            <button
              onClick={() => setShowGasModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isGasConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isGasConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="hidden sm:inline">
                {isGasConnected ? 'Google Drive Aktif' : 'Hubungkan Drive'}
              </span>
            </button>

            {/* Quick Action Buttons */}
            {activeTab === 'agenda' && (
              <button
                onClick={() => setShowAgendaModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Tambah Agenda</span>
              </button>
            )}

            {activeTab === 'visit' && (
              <button
                onClick={() => setShowVisitModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Form Visit Baru</span>
              </button>
            )}

            {activeTab === 'nso' && (
              <button
                onClick={() => setShowNsoModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF7E98] to-[#FF5376] text-white text-xs font-bold shadow-pill-coral hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Proyek NSO Baru</span>
              </button>
            )}
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden flex flex-col pb-16 lg:pb-0">
          {activeTab === 'agenda' && (
            <FmcuAgendaView
              agendas={agendas}
              onOpenNewAgenda={() => setShowAgendaModal(true)}
              onOpenNewVisit={() => setShowVisitModal(true)}
              onOpenNewNso={() => setShowNsoModal(true)}
              onToggleStatus={handleToggleAgendaStatus}
            />
          )}

          {activeTab === 'visit' && (
            <FmcuVisitView
              visits={visits}
              onOpenNewVisit={() => setShowVisitModal(true)}
              onSelectPhoto={(photo) => setSelectedPhoto(photo)}
            />
          )}

          {activeTab === 'nso' && (
            <FmcuNsoView
              nsoProjects={nsoProjects}
              onOpenNewNso={() => setShowNsoModal(true)}
              onSelectPhoto={(photo) => setSelectedPhoto(photo)}
            />
          )}
        </div>

        {/* Mobile Bottom Dock Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2.5 flex items-center justify-around z-30 shadow-dock">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
              activeTab === 'agenda' ? 'text-[#2BB3A0]' : 'text-slate-400'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span>Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab('visit')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
              activeTab === 'visit' ? 'text-[#2BB3A0]' : 'text-slate-400'
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span>Visit</span>
          </button>

          <button
            onClick={() => setActiveTab('nso')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
              activeTab === 'nso' ? 'text-[#2BB3A0]' : 'text-slate-400'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>NSO</span>
          </button>

          <button
            onClick={() => setShowGasModal(true)}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-400"
          >
            <FolderLock className="w-5 h-5" />
            <span>Drive</span>
          </button>
        </nav>
      </div>

      {/* Modals */}
      <FormAgendaModal
        isOpen={showAgendaModal}
        onClose={() => setShowAgendaModal(false)}
        onSubmit={handleAddAgenda}
        currentUser={user}
      />

      <FormVisitModal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        onSubmit={handleAddVisit}
        currentUser={user}
      />

      <FormNsoModal
        isOpen={showNsoModal}
        onClose={() => setShowNsoModal(false)}
        onSubmit={handleAddNso}
        currentUser={user}
      />

      <GasConnectionModal
        isOpen={showGasModal}
        onClose={() => setShowGasModal(false)}
        onConnectionSuccess={() => setIsGasConnected(true)}
      />

      <PhotoLightboxModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  );
};

export default App;
