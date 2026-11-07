import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Users,
  Eye,
  Store,
  Calendar,
  MapPin,
  Sparkles,
  Save,
  Check,
  FileText,
  Clock,
  Printer,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from '../../types';
import {
  VisitReportData,
  StoreCrew,
  ObservationFinding,
  EvidencePhoto
} from '../../types/visitReport';
import { VisitPdfPreview } from './VisitPdfPreview';

interface VisitReportFormProps {
  agenda: ScheduleAgenda;
  user: User | null;
  onBack: () => void;
}

export const VisitReportForm: React.FC<VisitReportFormProps> = ({
  agenda,
  user,
  onBack,
}) => {
  // Draft storage key unique to this agenda
  const draftKey = `fmcu_visit_report_${agenda.id}`;

  // State Form Initializer
  const [formData, setFormData] = useState<VisitReportData>(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      id: `report-${Date.now()}`,
      agendaId: agenda.id,
      storeFrontPhoto: '',
      visitorName: user?.name || agenda.pic || 'Marisa Giselina',
      storeName: agenda.title.replace(/^Audit & Store Visit - Cabang /i, '').trim() || agenda.location,
      storeCode: '3013',
      storeType: 'CVS',
      storeHead: 'Sutris Ismawan',
      visitDate: agenda.date || new Date().toISOString().split('T')[0],
      areaManager: 'Hadi Ilman',
      regionalManager: 'Novy Rusnani',
      qscSheetTop: '',
      qscSheetBottom: '',
      crews: [
        { id: 'c-1', role: 'Store Head', name: 'Sutris Ismawan', jobLevel: '1A' },
        { id: 'c-2', role: 'Shift Leader', name: 'Fikri S.', jobLevel: 'NS3' },
        { id: 'c-3', role: 'Crew Store 1', name: 'Tini Pratiwi', jobLevel: 'MG1' },
        { id: 'c-4', role: 'Crew Store 2', name: 'Zildzian Azhar Permana', jobLevel: 'MG1' },
      ],
      observations: [
        {
          id: 'obs-1',
          type: 'OPI',
          title: 'Kebersihan Lap & Penyimpanan Box',
          auditFinding: 'Lap kotor dan penyimpanan box tidak sesuai dengan tempatnya serta tidak terdapat lap cendol dan sarung tangan dua sisi.',
          operationalImpact: 'Risiko tinggi kontaminasi silang pada produk makanan yang dapat menyebabkan keluhan pelanggan dan potensi penarikan produk. Ketidaksesuaian penyimpanan box mengganggu efisiensi kerja.',
          idealCondition: 'Lap harus dalam kondisi bersih, kering, dan tersimpan di tempat yang telah ditentukan (disinfektan/box khusus). Box penyimpanan harus sesuai layout SOP.',
          actionPlan: '1. Segera ganti lap yang kotor dengan lap bersih. 2. Pindahkan box penyimpanan ke lokasi layout SOP. 3. Pastikan ketersediaan lap cendol dan sarung tangan.',
          rootCause: 'Kurangnya disiplin crew dalam menjalankan SOP kebersihan dan penyimpanan (5R).',
          expectedResult: 'Akan dimonitoring pada visit berikutnya',
          deadline: agenda.date || new Date().toISOString().split('T')[0],
        },
      ],
      evidencePhotos: [],
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1o0VG1WP_9cYcfrdEDuA3_7LA2CdYSWrI9vyfLNm-hzc/edit',
      assignmentNotes: 'Harap segera lakukan tindakan perbaikan (Corrective Action) sebelum batas waktu deadline yang ditentukan.',
      status: 'DRAFT',
    };
  });

  const [activeStep, setActiveStep] = useState<number>(1);
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(false);
  const [autoSavedTime, setAutoSavedTime] = useState<string>('Baru saja');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Auto-save to LocalStorage
  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(formData));
    const now = new Date();
    setAutoSavedTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
  }, [formData, draftKey]);

  // Steps Configuration
  const steps = [
    { num: 1, label: 'Info Toko', desc: 'Identitas & Foto Depan' },
    { num: 2, label: 'Lembar QSC', desc: 'FamiTrack Result' },
    { num: 3, label: 'Store Crew', desc: 'Daftar Personel' },
    { num: 4, label: 'Observasi', desc: 'Temuan OPI & QSC' },
    { num: 5, label: 'Foto Temuan', desc: 'Evidence Photos' },
    { num: 6, label: 'Review & PDF', desc: 'Finalisasi & Cetak' },
  ];

  // Helper untuk konversi File Upload ke Base64 Data URL
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          callback(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Crew Actions
  const handleAddCrew = () => {
    const newCrew: StoreCrew = {
      id: `c-${Date.now()}`,
      role: `Crew Store ${formData.crews.length}`,
      name: '',
      jobLevel: 'MG1',
    };
    setFormData({ ...formData, crews: [...formData.crews, newCrew] });
  };

  const handleUpdateCrew = (id: string, field: keyof StoreCrew, value: string) => {
    setFormData({
      ...formData,
      crews: formData.crews.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    });
  };

  const handleDeleteCrew = (id: string) => {
    setFormData({
      ...formData,
      crews: formData.crews.filter((c) => c.id !== id),
    });
  };

  // Observation Actions
  const handleAddObservation = (type: 'OPI' | 'QSC') => {
    const count = formData.observations.filter((o) => o.type === type).length + 1;
    const newObs: ObservationFinding = {
      id: `obs-${Date.now()}`,
      type,
      title: `Temuan ${type} #${count}`,
      auditFinding: '',
      operationalImpact: '',
      idealCondition: '',
      actionPlan: '',
      rootCause: '',
      expectedResult: 'Akan dimonitoring pada visit berikutnya',
      deadline: formData.visitDate,
    };
    setFormData({ ...formData, observations: [...formData.observations, newObs] });
  };

  const handleUpdateObservation = (id: string, field: keyof ObservationFinding, value: string) => {
    setFormData({
      ...formData,
      observations: formData.observations.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    });
  };

  const handleDeleteObservation = (id: string) => {
    setFormData({
      ...formData,
      observations: formData.observations.filter((o) => o.id !== id),
    });
  };

  // Quick Preset Templates for Observations
  const applyObservationPreset = (id: string, presetName: string) => {
    if (presetName === 'rox') {
      handleUpdateObservation(id, 'auditFinding', 'Penulisan rox belum sesuai standar pada product dibuka, tidak terdapat tanggal dan jam akurat.');
      handleUpdateObservation(id, 'operationalImpact', 'Risiko tinggi produk kedaluwarsa (expired) terjual kepada pelanggan yang dapat memicu komplain dan kerugian reputasi brand.');
      handleUpdateObservation(id, 'idealCondition', 'Seluruh produk dibuka (opened product) wajib memiliki label ROX lengkap, akurat, dan terbaca jelas sesuai SOP.');
      handleUpdateObservation(id, 'actionPlan', '1. Segera lengkapi label ROX pada seluruh produk dibuka. 2. Lakukan briefing kepada seluruh crew terkait disiplin labeling.');
      handleUpdateObservation(id, 'rootCause', 'Kurangnya disiplin crew dan lemahnya pengawasan shift leader sebelum produk dipajang.');
    } else if (presetName === '5r') {
      handleUpdateObservation(id, 'auditFinding', 'Berbagai area kerja kotor seperti area counter cashier, mesin steamer berdebu, dan area backroom berantakan.');
      handleUpdateObservation(id, 'operationalImpact', 'Risiko kontaminasi silang pada produk makanan dan penurunan citra toko higienis.');
      handleUpdateObservation(id, 'idealCondition', 'Seluruh area kerja (front, back, sales) wajib bersih, higienis, bebas serangga, dan tertata rapi (5R).');
      handleUpdateObservation(id, 'actionPlan', '1. Lakukan deep cleaning menyeluruh pada counter kasir dan steamer. 2. Tata ulang area backroom sesuai layout.');
      handleUpdateObservation(id, 'rootCause', 'Kegagalan implementasi jadwal cleaning schedule harian oleh crew.');
    }
  };

  // Evidence Photos Actions
  const handleAddEvidencePhoto = (photoBase64: string, captionText: string = '') => {
    const now = new Date();
    const timeStr = `${now.getDate()} Nov ${now.getFullYear()}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const newPhoto: EvidencePhoto = {
      id: `ev-${Date.now()}`,
      photoUrl: photoBase64,
      caption: captionText || 'Dokumentasi temuan audit toko',
      timestamp: timeStr,
      gpsLocation: 'GPS: -6.90481, 107.67701',
    };
    setFormData({
      ...formData,
      evidencePhotos: [newPhoto, ...formData.evidencePhotos],
    });
  };

  const handleDeleteEvidencePhoto = (id: string) => {
    setFormData({
      ...formData,
      evidencePhotos: formData.evidencePhotos.filter((p) => p.id !== id),
    });
  };

  const handleUpdateEvidenceCaption = (id: string, caption: string) => {
    setFormData({
      ...formData,
      evidencePhotos: formData.evidencePhotos.map((p) => (p.id === id ? { ...p, caption } : p)),
    });
  };

  const handleFinalSubmit = () => {
    setFormData({ ...formData, status: 'SUBMITTED', submittedAt: new Date().toISOString() });
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#4ADE80', '#38BDF8', '#F59E0B'],
    });
    setShowPdfPreview(true);
  };

  // If user toggled into Full PDF Preview
  if (showPdfPreview) {
    return (
      <VisitPdfPreview
        data={formData}
        onBack={() => setShowPdfPreview(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col select-none">
      {/* 1. Top Navbar / Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                Form Visit Toko
              </span>
              <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
                Draft tersimpan ({autoSavedTime})
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate max-w-xs sm:max-w-md">
              {formData.storeName || agenda.location}
            </h1>
          </div>
        </div>

        {/* Action Buttons: Preview PDF & Save */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPdfPreview(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span className="hidden sm:inline">Lihat Preview PDF</span>
            <span className="sm:hidden">Preview</span>
          </button>

          <button
            onClick={handleFinalSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </header>

      {/* 2. Stepper Wizard Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 overflow-x-auto no-scrollbar">
        <div className="max-w-4xl mx-auto flex items-center justify-between min-w-[580px] gap-2">
          {steps.map((st) => {
            const isActive = activeStep === st.num;
            const isCompleted = activeStep > st.num;
            return (
              <button
                key={st.num}
                onClick={() => setActiveStep(st.num)}
                className={`flex items-center gap-2.5 py-1.5 px-3 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-teal-50 border border-teal-200 text-teal-900 shadow-xs'
                    : isCompleted
                    ? 'text-slate-700 hover:bg-slate-50'
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isActive
                      ? 'bg-[#00A389] text-white shadow-pill-teal scale-105'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold leading-tight">{st.label}</span>
                  <span className="text-[10px] text-slate-400 font-medium block leading-none">
                    {st.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Form Body Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
        {/* STEP 1: Info Toko & Header */}
        {activeStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Box */}
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <h2 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <Store className="w-5 h-5 text-teal-600" />
                <span>Identitas Toko & Header Laporan</span>
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Data ini akan dicetak pada halaman sampul (Slide 1) laporan hasil audit toko.
              </p>

              {/* Foto Tampak Depan Toko */}
              <div className="mb-6">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Foto Tampak Depan Toko (Store Exterior) *
                </label>
                <div className="relative w-full h-48 sm:h-64 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 transition-colors overflow-hidden flex flex-col items-center justify-center group cursor-pointer">
                  {formData.storeFrontPhoto ? (
                    <>
                      <img
                        src={formData.storeFrontPhoto}
                        alt="Store Exterior"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <label className="px-4 py-2 rounded-xl bg-white text-slate-800 text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-md flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-teal-600" />
                          <span>Ganti Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, storeFrontPhoto: b }))}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, storeFrontPhoto: '' })}
                          className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md flex items-center gap-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        Klik untuk Ambil Foto / Unggah Foto Toko
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Format JPG/PNG (Direkomendasikan foto tampak fasad depan FamilyMart)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, storeFrontPhoto: b }))}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Form Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nama Visitor (Petugas) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.visitorName}
                    onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nama Store / Cabang *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Store Head (Kepala Toko) *
                  </label>
                  <input
                    type="text"
                    value={formData.storeHead}
                    onChange={(e) => setFormData({ ...formData, storeHead: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tanggal Visit *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Kode Toko *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 3013"
                    value={formData.storeCode}
                    onChange={(e) => setFormData({ ...formData, storeCode: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tipe Toko
                  </label>
                  <select
                    value={formData.storeType}
                    onChange={(e) => setFormData({ ...formData, storeType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="CVS">CVS (Convenience Store)</option>
                    <option value="Ruko / Standalone">Ruko / Standalone</option>
                    <option value="Mall / Commercial">Mall / Commercial</option>
                    <option value="SPBU / Transit">SPBU / Transit Hub</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Area Manager
                  </label>
                  <input
                    type="text"
                    value={formData.areaManager}
                    onChange={(e) => setFormData({ ...formData, areaManager: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Regional Manager
                  </label>
                  <input
                    type="text"
                    value={formData.regionalManager}
                    onChange={(e) => setFormData({ ...formData, regionalManager: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Lembar QSC / FamiTrack Result */}
        {activeStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <h2 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                <span>Lembar Penilaian QSC / FamiTrack Result</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Unggah 2 foto fisik form audit checklist QSC (Quality, Service, Cleanliness) yang telah ditandatangani.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lembar #1 (Bagian Atas) */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Lembar Form QSC / FamiTrack #1 (Wajib)
                    </span>
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      Bagian Atas
                    </span>
                  </div>

                  <div className="relative h-64 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden group">
                    {formData.qscSheetTop ? (
                      <>
                        <img
                          src={formData.qscSheetTop}
                          alt="QSC Top"
                          className="w-full h-full object-contain p-2"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="px-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-bold cursor-pointer shadow-md">
                            Ganti Foto
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, qscSheetTop: b }))}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, qscSheetTop: '' })}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md"
                          >
                            Hapus
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                        <Upload className="w-8 h-8 text-teal-600 mb-2 opacity-60" />
                        <span className="text-xs font-bold text-slate-700">Foto Lembar QSC Bagian Atas</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Ambil kamera atau pilih dari galeri</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, qscSheetTop: b }))}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Lembar #2 (Bagian Bawah) */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Lembar Form QSC / FamiTrack #2 (Wajib)
                    </span>
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      Bagian Bawah
                    </span>
                  </div>

                  <div className="relative h-64 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden group">
                    {formData.qscSheetBottom ? (
                      <>
                        <img
                          src={formData.qscSheetBottom}
                          alt="QSC Bottom"
                          className="w-full h-full object-contain p-2"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="px-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-bold cursor-pointer shadow-md">
                            Ganti Foto
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, qscSheetBottom: b }))}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, qscSheetBottom: '' })}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md"
                          >
                            Hapus
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                        <Upload className="w-8 h-8 text-teal-600 mb-2 opacity-60" />
                        <span className="text-xs font-bold text-slate-700">Foto Lembar QSC Bagian Bawah</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Ambil kamera atau pilih dari galeri</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, (b) => setFormData({ ...formData, qscSheetBottom: b }))}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: General Information (Store Crew) */}
        {activeStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    <span>Daftar Personel Store Crew yang Bertugas</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catat nama personel dan level jabatan yang sedang shift saat visit berlangsung.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCrew}
                  className="px-4 py-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Crew</span>
                </button>
              </div>

              {/* Crew List Table / Cards */}
              <div className="space-y-3">
                {formData.crews.map((crew, idx) => (
                  <div
                    key={crew.id}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-center gap-3"
                  >
                    <div className="w-full sm:w-1/3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Role / Jabatan
                      </label>
                      <input
                        type="text"
                        value={crew.role}
                        placeholder="Contoh: Store Head"
                        onChange={(e) => handleUpdateCrew(crew.id, 'role', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>

                    <div className="w-full sm:w-1/2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Nama Personel
                      </label>
                      <input
                        type="text"
                        value={crew.name}
                        placeholder="Nama lengkap crew"
                        onChange={(e) => handleUpdateCrew(crew.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>

                    <div className="w-full sm:w-28">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Job Level
                      </label>
                      <input
                        type="text"
                        value={crew.jobLevel}
                        placeholder="1A / NS3 / MG1"
                        onChange={(e) => handleUpdateCrew(crew.id, 'jobLevel', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCrew(crew.id)}
                      className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center flex-shrink-0 mt-3 sm:mt-5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Observasi & Temuan Audit (OPI & QSC) */}
        {activeStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-teal-600" />
                    <span>Observasi Temuan & Root Cause Analysis</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mencakup temuan audit, dampak operasional, kondisi ideal, action plan, dan penyebab.
                  </p>
                </div>

                {/* Add Observation Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddObservation('OPI')}
                    className="px-3.5 py-2 rounded-xl bg-[#00A389] text-white font-extrabold text-xs flex items-center gap-1 shadow-pill-teal hover:opacity-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Temuan OPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddObservation('QSC')}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm hover:opacity-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Temuan QSC</span>
                  </button>
                </div>
              </div>

              {/* Observation Cards List */}
              <div className="space-y-6">
                {formData.observations.map((obs, idx) => (
                  <div
                    key={obs.id}
                    className="border border-slate-200 rounded-3xl p-5 bg-white shadow-soft-sm space-y-4 relative"
                  >
                    {/* Header Card */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black text-white ${
                          obs.type === 'OPI' ? 'bg-[#00A389]' : 'bg-blue-600'
                        }`}>
                          Temuan {idx + 1}/{formData.observations.length} ({obs.type})
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {obs.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick Presets */}
                        <button
                          type="button"
                          onClick={() => applyObservationPreset(obs.id, 'rox')}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-[10px] font-bold hover:bg-teal-100"
                        >
                          Template ROX
                        </button>
                        <button
                          type="button"
                          onClick={() => applyObservationPreset(obs.id, '5r')}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold hover:bg-amber-100"
                        >
                          Template 5R
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteObservation(obs.id)}
                          className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Form Fields: 6 Box Model */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Temuan Audit */}
                      <div>
                        <label className="block text-[11px] font-black text-amber-800 uppercase tracking-wider mb-1">
                          1. TEMUAN AUDIT *
                        </label>
                        <textarea
                          rows={3}
                          value={obs.auditFinding}
                          placeholder="Jelaskan detail ketidaksesuaian yang ditemukan..."
                          onChange={(e) => handleUpdateObservation(obs.id, 'auditFinding', e.target.value)}
                          className="w-full p-3 bg-amber-50/40 border border-amber-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        />
                      </div>

                      {/* 2. Dampak Operasional */}
                      <div>
                        <label className="block text-[11px] font-black text-blue-800 uppercase tracking-wider mb-1">
                          2. DAMPAK OPERASIONAL *
                        </label>
                        <textarea
                          rows={3}
                          value={obs.operationalImpact}
                          placeholder="Risiko terhadap pelanggan, finansial, reputasi..."
                          onChange={(e) => handleUpdateObservation(obs.id, 'operationalImpact', e.target.value)}
                          className="w-full p-3 bg-blue-50/40 border border-blue-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                      </div>

                      {/* 3. Kondisi Ideal */}
                      <div>
                        <label className="block text-[11px] font-black text-teal-800 uppercase tracking-wider mb-1">
                          3. KONDISI IDEAL / STANDAR *
                        </label>
                        <textarea
                          rows={3}
                          value={obs.idealCondition}
                          placeholder="Standar SOP yang seharusnya dipatuhi..."
                          onChange={(e) => handleUpdateObservation(obs.id, 'idealCondition', e.target.value)}
                          className="w-full p-3 bg-teal-50/40 border border-teal-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        />
                      </div>

                      {/* 4. Tindakan Perbaikan (Action Plan) */}
                      <div>
                        <label className="block text-[11px] font-black text-emerald-800 uppercase tracking-wider mb-1">
                          4. TINDAKAN PERBAIKAN (ACTION PLAN) *
                        </label>
                        <textarea
                          rows={3}
                          value={obs.actionPlan}
                          placeholder="Langkah konkret 1, 2, 3 untuk perbaikan toko..."
                          onChange={(e) => handleUpdateObservation(obs.id, 'actionPlan', e.target.value)}
                          className="w-full p-3 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                        />
                      </div>

                      {/* 5. Penyebab (Root Cause) */}
                      <div>
                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                          5. PENYEBAB (ROOT CAUSE)
                        </label>
                        <textarea
                          rows={2}
                          value={obs.rootCause}
                          placeholder="Akar masalah utama (kurang disiplin, briefing, supervisi)..."
                          onChange={(e) => handleUpdateObservation(obs.id, 'rootCause', e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                        />
                      </div>

                      {/* 6. Deadline & Hasil yang Diharapkan */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                            Batas Waktu (Deadline)
                          </label>
                          <input
                            type="date"
                            value={obs.deadline}
                            onChange={(e) => handleUpdateObservation(obs.id, 'deadline', e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-rose-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black text-teal-800 uppercase tracking-wider mb-1">
                            Hasil yang Diharapkan
                          </label>
                          <input
                            type="text"
                            value={obs.expectedResult}
                            onChange={(e) => handleUpdateObservation(obs.id, 'expectedResult', e.target.value)}
                            className="w-full p-2.5 bg-teal-50/40 border border-teal-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Finding Evidence (Evidence Photos) */}
        {activeStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-teal-600" />
                    <span>Galeri Foto Bukti Temuan (Finding Evidence)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unggah dokumentasi foto temuan lengkap dengan keterangan & watermark otomatis.
                  </p>
                </div>

                {/* Upload Button */}
                <label className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white font-extrabold text-xs shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer">
                  <Camera className="w-4 h-4" />
                  <span>+ Ambil / Unggah Foto Temuan</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        Array.from(files).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              handleAddEvidencePhoto(reader.result, file.name.replace(/\.[^/.]+$/, ''));
                            }
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                  />
                </label>
              </div>

              {/* Photo Cards Grid */}
              {formData.evidencePhotos.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/60 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Belum Ada Foto Bukti</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Klik tombol di atas untuk mengambil foto melalui kamera HP atau pilih beberapa gambar temuan dari galeri.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {formData.evidencePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="bg-white rounded-2xl p-3 border border-slate-200 shadow-soft-sm flex flex-col justify-between group"
                    >
                      {/* Photo Thumbnail */}
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 mb-2">
                        <img
                          src={photo.photoUrl}
                          alt={photo.caption}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteEvidencePhoto(photo.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white px-2 py-0.5 truncate font-mono">
                          {photo.timestamp}
                        </div>
                      </div>

                      {/* Caption Input */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          Keterangan Temuan:
                        </label>
                        <input
                          type="text"
                          value={photo.caption}
                          placeholder="Tuliskan keterangan foto..."
                          onChange={(e) => handleUpdateEvidenceCaption(photo.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: Review & Finalize (Store Assignment & CA Link) */}
        {activeStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <h2 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>Review Akhir & Tindak Lanjut Store</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Periksa kelengkapan laporan sebelum melakukan ekspor atau cetak PDF resmi.
              </p>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Personel Shift
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-0.5 block">
                    {formData.crews.length} Orang
                  </span>
                </div>
                <div className="bg-teal-50 rounded-2xl p-3.5 border border-teal-100 text-center">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                    Total Temuan
                  </span>
                  <span className="text-lg font-black text-teal-800 mt-0.5 block">
                    {formData.observations.length} Kasus
                  </span>
                </div>
                <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-100 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                    Foto Bukti
                  </span>
                  <span className="text-lg font-black text-blue-800 mt-0.5 block">
                    {formData.evidencePhotos.length} Foto
                  </span>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Status Dokumen
                  </span>
                  <span className="text-sm font-black text-emerald-800 mt-1 block">
                    Siap Dicetak
                  </span>
                </div>
              </div>

              {/* Spreadsheet CA Link Input */}
              <div className="mb-6 p-4 rounded-2xl bg-teal-50/60 border border-teal-200">
                <label className="block text-xs font-bold text-teal-900 mb-1">
                  Link Spreadsheet Corrective Action (CA) Toko:
                </label>
                <input
                  type="url"
                  value={formData.spreadsheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  onChange={(e) => setFormData({ ...formData, spreadsheetUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="text-[11px] text-teal-700 mt-1 block">
                  Link ini akan dicantumkan pada slide mekanisme pelaporan agar tim toko langsung menindaklanjuti.
                </span>
              </div>

              {/* Big CTA: Preview & Print PDF */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(true)}
                  className="w-full sm:flex-1 py-4 rounded-2xl bg-slate-900 text-white font-extrabold text-xs shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>Buka Tampilan Slide PDF Lengkap</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white font-extrabold text-xs shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Unduh PDF Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Bottom Floating Navigation Controls */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-4xl mx-auto px-4 sm:px-6 pb-4 pt-2 bg-gradient-to-t from-[#F8F9FD] via-[#F8F9FD]/95 to-transparent pointer-events-none z-30">
        <div className="w-full bg-white/95 backdrop-blur-md rounded-2xl px-5 py-3 shadow-dock flex items-center justify-between border border-white/80 pointer-events-auto">
          {activeStep > 1 ? (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <div className="w-20" />
          )}

          <div className="text-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">
              Step {activeStep} dari {steps.length}
            </span>
            <span className="text-xs font-extrabold text-slate-800">
              {steps[activeStep - 1].label}
            </span>
          </div>

          {activeStep < steps.length ? (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.min(steps.length, prev + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
            >
              <span>Lanjut: {steps[activeStep].label}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPdfPreview(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
            >
              <span>Preview PDF</span>
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
