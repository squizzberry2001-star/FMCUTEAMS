import React from 'react';
import {
  Printer,
  ChevronLeft,
  Share2,
  ExternalLink,
  Store,
  Users,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Camera,
  FileSpreadsheet
} from 'lucide-react';
import { VisitReportData } from '../../types/visitReport';

interface VisitPdfPreviewProps {
  data: VisitReportData;
  onBack: () => void;
}

export const VisitPdfPreview: React.FC<VisitPdfPreviewProps> = ({ data, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900/90 text-slate-800 print:bg-white print:text-black">
      {/* Non-printable Sticky Header Control */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Kembali ke Editor Form</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-extrabold text-slate-800">
            Preview PDF: FMCU Visit Store Report
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document (Slides Structure) */}
      <div className="max-w-5xl mx-auto py-8 px-4 print:p-0 space-y-8 print:space-y-0">
        {/* SLIDE 1: Cover & Store Overview */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always">
          {/* Top Exterior Image Banner */}
          <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-slate-100 mb-8 border border-slate-100 shadow-sm relative">
            {data.storeFrontPhoto ? (
              <img
                src={data.storeFrontPhoto}
                alt="Store Exterior"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 text-teal-700">
                <Store className="w-16 h-16 opacity-40 mb-2 stroke-[1.5]" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Foto Eksterior Toko FamilyMart
                </span>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-emerald-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md tracking-wider">
              FamilyMart
            </div>
          </div>

          {/* Title & Metadata Layout */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#00A389] tracking-tight mb-8">
            FMCU Visit Store Report
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left Column: Key Persons */}
            <div className="space-y-4 text-sm">
              <div className="flex">
                <span className="w-32 text-slate-500 font-semibold">Nama Visitor</span>
                <span className="font-extrabold text-slate-900">: {data.visitorName || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-32 text-slate-500 font-semibold">Nama Store</span>
                <span className="font-extrabold text-slate-900">: {data.storeName || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-32 text-slate-500 font-semibold">Store Head</span>
                <span className="font-extrabold text-slate-900">: {data.storeHead || '-'}</span>
              </div>
            </div>

            {/* Right Column: Store Metadata Card */}
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/60 grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  TANGGAL VISIT
                </span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {data.visitDate || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  KODE TOKO
                </span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {data.storeCode || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  TIPE TOKO
                </span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {data.storeType || 'CVS'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  AREA MANAGER
                </span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {data.areaManager || '-'}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  REGIONAL MANAGER
                </span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                  {data.regionalManager || 'Novy Rusnani'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2: QSC / FamiTrack Result */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always">
          <div className="border-b-2 border-[#00A389] pb-4 mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              QSC / FamiTrack Result
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Form penilaian standar kualitas, kebersihan & layanan operasional toko
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sheet 1: Bagian Atas */}
            <div className="flex flex-col">
              <div className="flex-1 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 min-h-[360px] overflow-hidden">
                {data.qscSheetTop ? (
                  <img
                    src={data.qscSheetTop}
                    alt="Lembar QSC Bagian Atas"
                    className="max-h-[480px] w-auto object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-40 text-teal-600" />
                    <span className="text-xs font-semibold">Foto Lembar QSC Bagian Atas (Kosong)</span>
                  </div>
                )}
              </div>
              <span className="text-xs font-extrabold text-slate-700 mt-2 block">
                Lembar Form QSC / FamiTrack #1 (Wajib)
              </span>
            </div>

            {/* Sheet 2: Bagian Bawah */}
            <div className="flex flex-col">
              <div className="flex-1 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 min-h-[360px] overflow-hidden">
                {data.qscSheetBottom ? (
                  <img
                    src={data.qscSheetBottom}
                    alt="Lembar QSC Bagian Bawah"
                    className="max-h-[480px] w-auto object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-40 text-teal-600" />
                    <span className="text-xs font-semibold">Foto Lembar QSC Bagian Bawah (Kosong)</span>
                  </div>
                )}
              </div>
              <span className="text-xs font-extrabold text-slate-700 mt-2 block">
                Lembar Form QSC / FamiTrack #2 (Wajib)
              </span>
            </div>
          </div>
        </div>

        {/* SLIDE 3: General Information (Store Crew) */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always">
          <div className="border-b-2 border-[#00A389] pb-4 mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              General Information (Store Crew)
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Hari, Tanggal Visit : <span className="text-slate-800 font-bold">{data.visitDate || '-'}</span>
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B1E2E] text-white text-xs font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-6">ROLE / JABATAN</th>
                  <th className="py-3.5 px-6">NAMA PERSONEL</th>
                  <th className="py-3.5 px-6 text-right">JOB LEVEL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {data.crews.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Belum ada data crew yang diinput.
                    </td>
                  </tr>
                ) : (
                  data.crews.map((crew, idx) => (
                    <tr key={crew.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-3.5 px-6 font-bold text-slate-900">{crew.role}</td>
                      <td className="py-3.5 px-6 text-slate-700">{crew.name}</td>
                      <td className="py-3.5 px-6 text-right font-extrabold text-teal-700">{crew.jobLevel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SLIDE 4 & ONWARDS: Observations (OPI & QSC) */}
        {data.observations.map((obs, idx) => (
          <div
            key={obs.id || idx}
            className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always"
          >
            <div className="border-b-2 border-[#00A389] pb-4 mb-5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {obs.type === 'OPI' ? 'OPI Project Observation' : 'QSC Observation'}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Ringkasan observasi dan rencana tindak lanjut perbaikan toko
              </p>
            </div>

            {/* Temuan Pill Banner */}
            <div className="flex items-center justify-between mb-5">
              <span className="px-4 py-1.5 rounded-xl bg-[#00A389] text-white text-xs font-black tracking-wide shadow-sm">
                Temuan {idx + 1}/{data.observations.length}
              </span>
              <span className="text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-1 rounded-xl">
                Deadline: {obs.deadline || data.visitDate || '-'}
              </span>
            </div>

            {/* 6-Block Analysis Grid (Exact match to PDF layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: TEMUAN AUDIT */}
              <div className="bg-[#FFFDF5] border border-amber-200/80 rounded-2xl p-4">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
                  TEMUAN AUDIT
                </span>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  {obs.auditFinding || obs.title || '-'}
                </p>
              </div>

              {/* Box 2: DAMPAK OPERASIONAL */}
              <div className="bg-[#F8FBFF] border border-blue-200/80 rounded-2xl p-4">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block mb-1">
                  DAMPAK OPERASIONAL
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {obs.operationalImpact || '-'}
                </p>
              </div>

              {/* Box 3: KONDISI IDEAL / STANDAR */}
              <div className="bg-[#F4FCF9] border border-teal-200/80 rounded-2xl p-4">
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block mb-1">
                  KONDISI IDEAL / STANDAR
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {obs.idealCondition || '-'}
                </p>
              </div>

              {/* Box 4: TINDAKAN PERBAIKAN (ACTION PLAN) */}
              <div className="bg-[#F2FAF5] border border-emerald-300 rounded-2xl p-4">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block mb-1">
                  TINDAKAN PERBAIKAN (ACTION PLAN)
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                  {obs.actionPlan || '-'}
                </p>
              </div>

              {/* Box 5: PENYEBAB (ROOT CAUSE) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                  PENYEBAB (ROOT CAUSE)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {obs.rootCause || '-'}
                </p>
              </div>

              {/* Box 6: HASIL YANG DIHARAPKAN */}
              <div className="bg-[#F4FCF9] border border-teal-200/80 rounded-2xl p-4">
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block mb-1">
                  HASIL YANG DIHARAPKAN
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {obs.expectedResult || 'Akan dimonitoring pada visit berikutnya'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* EVIDENCE PHOTOS GALLERY SLIDES (6 per page) */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always">
          <div className="border-b-2 border-[#00A389] pb-4 mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Finding Evidence - Evidence Photos
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Dokumentasi foto temuan audit operasional toko di lapangan
            </p>
          </div>

          {data.evidencePhotos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <Camera className="w-12 h-12 mx-auto mb-2 opacity-40 text-teal-600" />
              <p className="text-xs font-semibold">Belum ada foto temuan yang diunggah.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.evidencePhotos.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col justify-between"
                >
                  {/* Photo Container with Watermark */}
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-100 relative mb-2">
                    <img
                      src={item.photoUrl}
                      alt={item.caption}
                      className="w-full h-full object-cover"
                    />
                    {/* Watermark Banner */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs text-[9px] text-white px-2 py-0.5 truncate font-mono">
                      {data.storeName} • {item.timestamp} • {item.gpsLocation}
                    </div>
                  </div>

                  {/* Caption */}
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {item.caption || 'Temuan lapangan'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SLIDE: Store Assignment & Action Mechanism */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 print:shadow-none print:border-none print:rounded-none print:p-8 print:h-screen print:page-break-after-always">
          <div className="border-b-2 border-[#00A389] pb-4 mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Mekanisme Pelaporan & Tindak Lanjut Store
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Panduan resmi pengisian form rencana perbaikan (Corrective Action) hasil audit FMCU
            </p>
          </div>

          {/* Spreadsheet Link Box */}
          <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-5 mb-8">
            <span className="text-[11px] font-black text-teal-900 tracking-wider uppercase block mb-1">
              LINK FILE FORM SPREADSHEET CA KHUSUS {data.storeName || 'STORE'} ({data.storeCode || 'KODE'}):
            </span>
            <a
              href={data.spreadsheetUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-teal-700 underline break-all flex items-center gap-1.5 hover:text-teal-900"
            >
              <span>{data.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1o0VG1WP_9cYcfrdEDuA3_7LA2CdYSWrI9vyfLNm-hzc/edit'}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          </div>

          {/* 4 Action Steps */}
          <div className="space-y-4">
            {[
              {
                num: 1,
                title: 'Buka & Isi Formulir di Spreadsheet',
                desc: 'Buka dan isi langsung di spreadsheet file formulir perbaikan toko melalui link di atas.',
              },
              {
                num: 2,
                title: 'Isi Rencana & Bukti Perbaikan',
                desc: 'Tim store mengisi form tersebut berdasarkan temuan yang telah ditunjukkan pada file laporan ini.',
              },
              {
                num: 3,
                title: 'Patuhi Batas Waktu (Deadline)',
                desc: 'Tindakan perbaikan WAJIB dilakukan sebelum deadline yang diberikan oleh FMCU / Regional Bestie.',
              },
              {
                num: 4,
                title: 'Validasi & Konfirmasi Tindak Lanjut',
                desc: 'Forward email ini sebagai validasi bahwa sudah melakukan tindak lanjut hasil visit.',
              },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-[#00A389] text-white flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">{step.title}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
