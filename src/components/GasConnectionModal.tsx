import React, { useState, useEffect } from 'react';
import {
  X,
  Link2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Shield,
  Key,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import {
  getGasUrl,
  setGasUrl,
  getSecretKey,
  setSecretKey,
  testGasConnection,
} from '../services/googleAppsScript';
import { DEFAULT_SECRET_KEY } from '../services/crypto';

interface GasConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess?: () => void;
}

export const GasConnectionModal: React.FC<GasConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnectionSuccess,
}) => {
  const [url, setUrlState] = useState('');
  const [secretKey, setSecretKeyState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrlState(getGasUrl());
      setSecretKeyState(getSecretKey() || DEFAULT_SECRET_KEY);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim()) {
      setTestResult({
        success: false,
        message: 'Masukkan Web App URL Google Apps Script terlebih dahulu.',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    const result = await testGasConnection(url.trim());
    setIsLoading(false);
    setTestResult(result);

    if (result.success) {
      setGasUrl(url.trim());
      setSecretKey(secretKey.trim() || DEFAULT_SECRET_KEY);
      if (onConnectionSuccess) onConnectionSuccess();
    }
  };

  const handleSaveOnly = () => {
    setGasUrl(url.trim());
    setSecretKey(secretKey.trim() || DEFAULT_SECRET_KEY);
    alert('Pengaturan URL & Kunci Enkripsi berhasil disimpan.');
    onClose();
  };

  const handleCopyScript = () => {
    const scriptUrl =
      'https://raw.githubusercontent.com/squizzberry2001-star/FMCUTEAMS/main/google-apps-script/Code.gs';
    navigator.clipboard.writeText(scriptUrl);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 absolute top-5 right-5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal flex-shrink-0">
            <FolderLock className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Koneksi Google Apps Script
              </h2>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                AES-256 Drive
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Hubungkan web ini ke Google Drive bersama dengan enkripsi foto & data.
            </p>
          </div>
        </div>

        {/* Step-by-Step Quick Guide */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200/60">
          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-teal-600" />
            <span>3 Langkah Cepat Pasang di Google Drive:</span>
          </h4>
          <ol className="text-[11px] text-slate-500 space-y-1.5 list-decimal pl-4 leading-relaxed font-medium">
            <li>
              Buka <a href="https://script.google.com/" target="_blank" rel="noreferrer" className="text-teal-600 font-bold underline inline-flex items-center gap-0.5">script.google.com <ExternalLink className="w-3 h-3" /></a> dengan akun Google bersama Anda.
            </li>
            <li>
              Buat <b>New project</b>, hapus kode default, dan paste isi script <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono text-[10px]">google-apps-script/Code.gs</code>.
            </li>
            <li>
              Klik <b>Deploy $\rightarrow$ New deployment $\rightarrow$ Web app</b> (Who has access: <b>Anyone</b>). Salin Web App URL dan tempelkan di bawah ini!
            </li>
          </ol>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {/* Web App URL */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1">
              Google Apps Script Web App URL
            </label>
            <div className="relative flex items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrlState(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Harus berakhiran <code className="font-bold text-teal-700">/exec</code>
            </span>
          </div>

          {/* Secret Encryption Key */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Kunci Rahasia Enkripsi (AES-256)</span>
              </span>
              <span className="text-[10px] font-normal text-slate-400">Zero-Knowledge</span>
            </label>
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKeyState(e.target.value)}
              placeholder={DEFAULT_SECRET_KEY}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-teal-500 transition-colors"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Kunci ini yang membuat foto & catatan di Google Drive acak dan tidak bisa dibuka siapapun.
            </span>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{testResult.message}</p>
                {testResult.timestamp && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Server Time: {testResult.timestamp}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 mt-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyScript}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedScript ? 'Link Tersalin!' : 'Link Script Code.gs'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveOnly}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Simpan Saja
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-xs shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menguji Koneksi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Uji & Hubungkan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
