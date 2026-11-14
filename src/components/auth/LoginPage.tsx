import React, { useState } from 'react';
import { Building2, User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { User as PosUser } from '../../types/pos';
import { playBeep } from '../../services/storageService';
import { loginWithApi } from '../../services/posApi';

interface LoginPageProps {
  onLoginSuccess: (user: PosUser, token: string) => void | Promise<void>;
  initialCompanyId?: string;
  initialUserId?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  initialCompanyId,
  initialUserId,
}) => {
  const [companyId, setCompanyId] = useState<string>(initialCompanyId ?? '001');
  const [userId, setUserId] = useState<string>(initialUserId ?? '001');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithApi(
        companyId.trim(),
        userId.trim(),
        password
      );
      playBeep('success');
      await onLoginSuccess(result.user, result.token);
    } catch (loginError) {
      playBeep('error');
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Login gagal. Periksa koneksi server dan kredensial.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Bar info */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-mono text-slate-300">POSDUR · Server diperiksa saat login</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            {window.location.protocol === 'https:'
              ? 'Koneksi HTTPS terenkripsi'
              : 'HTTP belum terenkripsi · gunakan untuk uji internal'}
          </span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Brand Banner Header */}
          <div className="bg-slate-950 p-6 text-white text-center border-b border-slate-800 relative overflow-hidden">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 rounded-xl shadow-md mb-2">
              <span className="font-extrabold tracking-wider text-xl uppercase">CATAT</span>
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded font-mono font-bold">POS</span>
            </div>
            <h1 className="text-sm font-bold text-slate-200">Point of Sale & Kasir Cloud Multi Outlet</h1>
            <p className="text-[11px] text-slate-400 mt-1">
              Sistem kasir multi-cabang terintegrasi laporan konsolidasi & penjualan
            </p>
          </div>

          {/* Security Notice */}
          <div className="p-4 bg-blue-50/80 border-b border-blue-100 text-xs">
            <span className="font-bold text-blue-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Akses Berbasis Peran (RBAC)</span>
            </span>
            <p className="text-slate-600 text-[11px] mt-1">
              Setiap akun hanya dapat membuka menu dan cabang sesuai kewenangannya.
              Gunakan User ID dan Password/PIN akun Anda masing-masing.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* ID Perusahaan */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                ID Perusahaan:
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="Contoh: 99999"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* User ID */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                User ID / Kasir:
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Contoh: ADMIN"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Password:
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Terminal Kasir'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Card Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
            <span>Catat POS Cloud Architecture · Versi Web POS 4.8</span>
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <div className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        <p>© 2026 CATAT POS Multi-Outlet. Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
};
