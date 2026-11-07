import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon, ArrowRight, Sparkles, ChevronDown, Check } from 'lucide-react';
import { User } from '../types';
import { ParacetamolHero3D } from './3d-icons/Illustrations';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onContinueAsGuest?: () => void;
}

// Daftar nama akun terdaftar (Dummy Users)
export const REGISTERED_USERS: (User & { role: string })[] = [
  {
    name: 'Dr. Sarah Jenkins',
    email: 'dr.sarah@fmcuteams.com',
    role: 'Medical Lead / Dokter Spesialis',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Aan Bagus',
    email: 'aan.bagus@fmcuteams.com',
    role: 'FMCU Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Dimas Wicaksono',
    email: 'dimas.w@fmcuteams.com',
    role: 'Field Supervisor FMCU',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rian Pratama',
    email: 'rian.p@fmcuteams.com',
    role: 'Store Auditor FMCU',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Siti Rahmawati',
    email: 'siti.r@fmcuteams.com',
    role: 'Pharmacist Coordinator',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<User>(REGISTERED_USERS[0]);
  const [nameInput, setNameInput] = useState(REGISTERED_USERS[0].name);
  const [password, setPassword] = useState('password123'); // Dummy password default
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter daftar nama sesuai ketikan user
  const filteredUsers = REGISTERED_USERS.filter((u) =>
    u.name.toLowerCase().includes(nameInput.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (u: User) => {
    setSelectedUser(u);
    setNameInput(u.name);
    setPassword('password123');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    // Jika nama cocok dengan daftar terdaftar, gunakan profil tersebut
    const existing = REGISTERED_USERS.find(
      (u) => u.name.toLowerCase() === nameInput.trim().toLowerCase()
    );

    const userToLogin: User = existing || {
      name: nameInput.trim(),
      email: `${nameInput.trim().toLowerCase().replace(/\s+/g, '.')}@fmcuteams.com`,
      avatar: selectedUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    };

    onLogin(userToLogin);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden ambient-bg-glow">
      {/* Decorative ambient blurred blobs */}
      <div className="absolute top-12 left-10 w-72 h-72 bg-[#D4F4E2]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFE6D5]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-[#E8EEFF]/70 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Main Glassmorphic / Clay Card */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[38px] p-6 sm:p-8 shadow-soft-lg border border-white/60">
        {/* Top 3D Hero Illustration */}
        <div className="flex flex-col items-center justify-center -mt-2 mb-4">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            <ParacetamolHero3D className="w-32 h-32 sm:w-36 sm:h-36 drop-shadow-sm" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F2] text-[#2BB3A0] text-xs font-bold tracking-wide mt-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FMCU TEAMS</span>
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2 text-center">
            Login Akun FMCU
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mt-1">
            Pilih nama Anda dari daftar terdaftar untuk masuk ke sistem
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Nama Terdaftar (Autocomplete Dropdown) */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs text-slate-600 font-bold mb-1.5 flex items-center justify-between">
              <span>Nama Terdaftar</span>
              <span className="text-[10px] text-teal-600 font-medium">Klik untuk pilih nama</span>
            </label>

            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center pointer-events-none">
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-400" />
                )}
              </div>

              {/* Input text nama: font size 16px di mobile agar tidak auto zoom */}
              <input
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ketik atau pilih nama Anda..."
                required
                className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-11 pr-10 py-3 text-[16px] sm:text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="absolute right-3 text-slate-400 hover:text-slate-700 p-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Daftar Nama Terdaftar */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 max-h-56 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Daftar Nama Terdaftar
                </div>
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs text-slate-400 font-medium">
                    Nama tidak ditemukan di daftar dummy, Anda tetap bisa masuk menggunakan nama ini.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrent = u.name.toLowerCase() === nameInput.toLowerCase();
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-teal-50/70 transition-colors ${
                          isCurrent ? 'bg-teal-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 truncate">
                              {u.name}
                            </span>
                            <span className="block text-[10px] text-slate-400 truncate font-medium">
                              {u.role}
                            </span>
                          </div>
                        </div>

                        {isCurrent && (
                          <Check className="w-4 h-4 text-teal-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 2. Password (font-size 16px di mobile agar tidak auto-zoom focus) */}
          <div>
            <label className="block text-xs text-slate-600 font-bold mb-1.5 flex items-center justify-between">
              <span>Password</span>
              <span className="text-[10px] text-slate-400 font-normal">Dummy: password123</span>
            </label>

            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />

              {/* Input password: text-[16px] sm:text-xs untuk mematikan auto-zoom pada layar mobile */}
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-11 py-3 text-[16px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Remember Me (Forgot Password sudah dihilangkan) */}
          <div className="flex items-center text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-slate-500 font-medium">Ingat akun saya</span>
            </label>
          </div>

          {/* 4. Primary Action Button (Sign In / Login murni) */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>Masuk ke Akun</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="text-center mt-6 text-[11px] text-slate-400 font-medium">
          FMCU TEAMS • Sistem Operasional Lapangan & Pengingat
        </div>
      </div>
    </div>
  );
};
