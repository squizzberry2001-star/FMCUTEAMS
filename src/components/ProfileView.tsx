import React, { useState, useRef } from 'react';
import {
  ChevronLeft,
  LogOut,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Camera,
  Calendar,
  Briefcase,
  Mail,
  User as UserIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User } from '../types';
import { uploadProfilePhotoToGasGDrive } from '../utils/gdriveGasSync';
import { PageTransitionLoader } from './PageTransitionLoader';
import { DeveloperFooter } from './DeveloperFooter';

// Compress and center-crop avatar photo to 360x360 JPEG so it never exceeds localStorage quota
const compressAvatarImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const targetSize = 360;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
};

interface ProfileViewProps {
  user: User;
  medicinesCount?: number;
  onBack: () => void;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  onReplaySplash?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  medicinesCount = 0,
  onBack,
  onLogout,
  onUpdateUser,
  onReplaySplash,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ubah Sandi State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback Messages
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  // Handle Foto Profil Change via File Picker
  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Silakan pilih file gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarSuccess(null);

    try {
      const compressedBase64 = await compressAvatarImage(file);

      // Update user avatar immediately with compressed 360x360 image (prevents QuotaExceededError / blank page)
      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          avatar: compressedBase64,
        });
      }

      // Upload to Google Drive (same root folder 1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a -> new subfolder FMCU_FOTO_PROFIL_USER)
      await Promise.all([
        uploadProfilePhotoToGasGDrive({
          userName: user.name,
          userEmail: user.email,
          base64Data: compressedBase64,
        }),
        new Promise((r) => setTimeout(r, 900)),
      ]);

      setAvatarSuccess('Foto profil berhasil diperbarui!');
      setTimeout(() => setAvatarSuccess(null), 3500);

      confetti({
        particleCount: 35,
        spread: 45,
        origin: { y: 0.3 },
        colors: ['#2BB3A0', '#4E80EE'],
      });
    } catch (err) {
      console.error('Gagal memproses foto profil:', err);
      alert('Gagal memproses foto profil. Silakan pilih foto lain.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // Handle Ubah Sandi Submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const actualExpectedPassword = user.password || (user.isAdmin ? '607090' : '0000');

    // Validasi sandi saat ini
    if (currentPassword !== actualExpectedPassword) {
      setPasswordError('Sandi saat ini salah. Pastikan sandi yang dimasukkan benar.');
      return;
    }

    // Validasi panjang sandi baru
    if (newPassword.length < 4) {
      setPasswordError('Sandi baru minimal harus terdiri dari 4 karakter.');
      return;
    }

    // Validasi kesamaan sandi konfirmasi
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi sandi baru tidak cocok.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('Sandi baru tidak boleh sama persis dengan sandi lama.');
      return;
    }

    // Update password user
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        password: newPassword,
      });
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Sandi berhasil diubah! Gunakan sandi baru ini untuk login berikutnya.');

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#2BB3A0', '#10B981', '#3B82F6'],
    });

    setTimeout(() => {
      setPasswordSuccess(null);
    }, 4500);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-4 sm:px-6 md:px-8 pt-3 pb-24 max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto w-full select-none">
      <PageTransitionLoader visible={isUploadingAvatar} delayMs={0} />
      {/* Hidden File Input for Avatar Photo */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            Pengaturan Akun
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-800">Profil Pengguna</h2>
        </div>
        <div className="w-9 h-9 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <UserIcon className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>

      {/* Success Notification for Avatar */}
      {avatarSuccess && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{avatarSuccess}</span>
        </div>
      )}

      {/* Responsive Grid: 1 Kolom di Mobile, 2 Kolom Executive di Layar Tablet & Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* ===================================================================
            KOLOM KIRI: Kartu Profil, Avatar, & Informasi Akun
            =================================================================== */}
        <div className="md:col-span-5 space-y-4">
          {/* Profile Card with Avatar & Pencil Icon Overlay */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card flex flex-col items-center text-center relative border border-slate-100">
            {/* Avatar Container with Interactive Pencil Overlay */}
            <div className="relative group mb-3">
              {user.avatar &&
              !user.avatar.includes('dicebear.com') &&
              !user.avatar.includes('images.unsplash.com') ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-teal-100 shadow-md group-hover:brightness-95 transition-all"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#32C2AD] to-[#20A894] text-white flex items-center justify-center font-black text-2xl sm:text-3xl ring-4 ring-teal-100 shadow-md">
                  {user.name ? user.name.substring(0, 2).toUpperCase() : <UserIcon className="w-8 h-8 text-white/90" />}
                </div>
              )}

              {/* Tombol Pensil Ubah Foto Profil */}
              <button
                type="button"
                onClick={handlePhotoClick}
                title="Klik untuk ubah foto profil"
                className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-md ring-2 ring-white active:scale-90 transition-transform duration-200 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10.5px] font-bold mb-1 border border-teal-200/50">
              {user.isAdmin ? (
                <>
                  <Shield className="w-3 h-3 text-teal-600" />
                  <span>Super Admin FMCU</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-3 h-3 text-teal-600" />
                  <span>{user.role || 'Field Staff FMCU'}</span>
                </>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">{user.name}</h3>
            <p className="text-xs text-slate-400 font-medium">{user.email}</p>

            {/* Quick Helper Badge */}
            <button
              type="button"
              onClick={handlePhotoClick}
              className="mt-2.5 text-[10.5px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 bg-teal-50/60 hover:bg-teal-50 px-3 py-1 rounded-full border border-teal-200/40 transition-colors cursor-pointer"
            >
              <Camera className="w-3 h-3" />
              <span>Ganti Foto Profil</span>
            </button>

            {/* Mini stats */}
            <div className="flex items-center gap-4 mt-4 w-full pt-3.5 border-t border-slate-100">
              <div className="flex-1 text-center">
                <span className="block text-base font-black text-slate-800">
                  {medicinesCount}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Jadwal Agenda</span>
              </div>
              <div className="w-[1px] h-7 bg-slate-200" />
              <div className="flex-1 text-center">
                <span className="block text-base font-black text-teal-600 flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Aktif</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Status Akun</span>
              </div>
              <div className="w-[1px] h-7 bg-slate-200" />
              <div className="flex-1 text-center">
                <span className="block text-base font-black text-indigo-600">
                  {user.isAdmin ? 'Super' : 'Karyawan'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Tingkat Akses</span>
              </div>
            </div>
          </div>

          {/* Detail Informasi Akun */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card space-y-2 border border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Informasi Akun
            </h4>

            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5" />
                <span>ID Akun</span>
              </span>
              <span className="font-bold text-slate-700">{user.id || 'ACC-FMCU'}</span>
            </div>

            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </span>
              <span className="font-bold text-slate-700 truncate max-w-[180px]">{user.email}</span>
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-400 font-medium flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                <span>Peran Akses</span>
              </span>
              <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/50 text-[10.5px]">
                {user.isAdmin ? 'Master Administrator' : 'Field Operasional'}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            KOLOM KANAN: Form Ubah Sandi (Langsung Tampak & Fit di Layar) & Logout
            =================================================================== */}
        <div className="md:col-span-7 space-y-4">
          {/* SECTION UBAH SANDI (CHANGE PASSWORD) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-100">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800">Ubah Kata Sandi Akun</h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  Amankan akun Anda dengan memperbarui kata sandi secara berkala.
                </p>
              </div>
            </div>

            {/* Password Error Alert */}
            {passwordError && (
              <div className="my-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Password Success Alert */}
            {passwordSuccess && (
              <div className="my-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3 mt-3">
              {/* 1. Sandi Saat Ini */}
              <div>
                <label className="block text-xs text-slate-600 font-bold mb-1">
                  <span>Sandi Saat Ini</span>
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'tel'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value.replace(/\D/g, ''))}
                    placeholder="Masukkan sandi saat ini..."
                    required
                    style={
                      !showPassword
                        ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)
                        : undefined
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-10 py-2.5 text-[15px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-wider"
                  />
                </div>
              </div>

              {/* 2. Sandi Baru */}
              <div>
                <label className="block text-xs text-slate-600 font-bold mb-1 flex items-center justify-between">
                  <span>Sandi Baru</span>
                  <span className="text-[10px] text-teal-600 font-medium">Min. 4 angka</span>
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'tel'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                    placeholder="Buat sandi baru..."
                    required
                    style={
                      !showPassword
                        ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)
                        : undefined
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-10 py-2.5 text-[15px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-wider"
                  />
                </div>
              </div>

              {/* 3. Konfirmasi Sandi Baru */}
              <div>
                <label className="block text-xs text-slate-600 font-bold mb-1">
                  Konfirmasi Sandi Baru
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'tel'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ketik ulang sandi baru..."
                    required
                    style={
                      !showPassword
                        ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)
                        : undefined
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-10 py-2.5 text-[15px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-wider"
                  />
                </div>
              </div>

              {/* Show Password Toggle */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{showPassword ? 'Sembunyikan karakter' : 'Tampilkan karakter'}</span>
                </button>
              </div>

              {/* Tombol Simpan Sandi Baru: FIT LANGSUNG TERLIHAT TANPA SCROLL */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 hover:brightness-105 text-white font-extrabold text-xs shadow-pill-teal active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Sandi Baru</span>
                </button>
              </div>
            </form>
          </div>

          {/* Putar Ulang Animasi Splash */}
          {onReplaySplash && (
            <button
              type="button"
              onClick={onReplaySplash}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-200/80 active:scale-98 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Putar Ulang Animasi Splash</span>
            </button>
          )}

          {/* Logout Button: FIT & Prominent */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-rose-200/60 cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari FMCU TEAMS (Logout)</span>
          </button>
        </div>
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter className="mt-8 text-center" />
    </div>
  );
};
