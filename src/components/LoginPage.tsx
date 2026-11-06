import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, ArrowRight, Sparkles } from 'lucide-react';
import { User } from '../types';
import { ParacetamolHero3D } from './3d-icons/Illustrations';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onContinueAsGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onContinueAsGuest }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('demo@fmcuteams.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Sarah Jenkins');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      name: isSignUp ? (name || 'Sarah Jenkins') : 'Sarah Jenkins',
      email: email || 'demo@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
  };

  const handleQuickDemo = () => {
    onLogin({
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.j@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden ambient-bg-glow">
      {/* Decorative ambient blurred blobs */}
      <div className="absolute top-12 left-10 w-72 h-72 bg-[#D4F4E2]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFE6D5]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-[#E8EEFF]/70 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Main Glassmorphic / Clay Card */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[38px] p-6 sm:p-9 shadow-soft-lg border border-white/60">
        {/* Top 3D Hero Illustration */}
        <div className="flex flex-col items-center justify-center -mt-3 mb-2">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            <ParacetamolHero3D className="w-36 h-36 drop-shadow-sm" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F2] text-[#2BB3A0] text-xs font-bold tracking-wide mt-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FMCU TEAMS</span>
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-2 text-center">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mt-1">
            {isSignUp
              ? 'Start tracking your daily medicine schedules smartly'
              : 'Sign in to access your medicine reminders and doses'}
          </p>
        </div>

        {/* Tab switch between Sign In and Sign Up */}
        <div className="flex bg-slate-100/80 p-1 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              !isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 font-semibold mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 font-semibold mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me and Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 rounded"
              />
              <span className="text-slate-500 font-medium">Remember me</span>
            </label>
            <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Reset link sent to your email!"); }} className="text-[#2BB3A0] font-semibold hover:underline">
              Forgot password?
            </a>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>{isSignUp ? 'Create Free Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-medium">or continue with</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Quick Demo and Guest buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full py-2.5 rounded-2xl bg-[#EAF8F2] hover:bg-[#d8f4ea] text-[#2BB3A0] font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Instant Demo Account (1-Click)</span>
          </button>

          <button
            type="button"
            onClick={onContinueAsGuest}
            className="w-full py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200/70 transition-all flex items-center justify-center"
          >
            Continue as Guest
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-5 text-[11px] text-slate-400">
          By signing in, you agree to FMCUTEAMS Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  );
};
