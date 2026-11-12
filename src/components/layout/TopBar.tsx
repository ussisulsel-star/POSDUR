import React, { useEffect, useState } from 'react';
import { Building2, Clock, Coins, LogOut, Menu, Store, User } from 'lucide-react';
import { Outlet, Shift, User as PosUser } from '../../types/pos';
import {
  canAccessTab,
  getPermittedOutlets,
} from '../../services/accessControl';
import { playBeep } from '../../services/storageService';

interface TopBarProps {
  user: PosUser;
  activeShift: Shift | null;
  outlets: Outlet[];
  activeOutlet: Outlet;
  onSelectOutlet: (outlet: Outlet) => void;
  onOpenShiftModal: () => void;
  onLogout: () => void;
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  activeShift,
  outlets,
  activeOutlet,
  onSelectOutlet,
  onOpenShiftModal,
  onLogout,
  onOpenMobileMenu,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleDateString('id-ID', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const permittedOutlets = getPermittedOutlets(user, outlets);
  const activeIsPermitted = permittedOutlets.some((o) => o.id === activeOutlet.id);
  const displayOutlet = activeIsPermitted ? activeOutlet : permittedOutlets[0];

  return (
    <header className="flex h-12 shrink-0 select-none items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 text-white md:h-14 md:px-4">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
        aria-label="Buka menu navigasi"
        title="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
          <Store className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-extrabold tracking-wider">CATAT POS</span>
      </div>

      <div className="hidden items-center gap-2 rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 lg:flex">
        <Building2 className="h-3.5 w-3.5 text-blue-400" />
        <span className="font-semibold text-white">
          ID: {user.companyId || '99999'}
        </span>
        <span className="text-slate-500">|</span>
        <span>Toko Berkah Sejahtera</span>
      </div>

      {permittedOutlets.length === 0 ? (
        <div
          className="hidden items-center gap-1.5 rounded-md border border-rose-800/60 bg-rose-950/60 px-2.5 py-1.5 text-xs text-rose-300 sm:flex"
          title="Akun ini tidak memiliki akses ke cabang mana pun"
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="font-bold">Tidak ada akses cabang</span>
        </div>
      ) : (
        <div
          className="hidden items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 sm:flex"
          title={
            permittedOutlets.length === 1
              ? `Pengguna dibatasi hanya pada cabang: ${displayOutlet?.name}`
              : `Ganti Cabang Aktif (${permittedOutlets.length} cabang diizinkan)`
          }
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          {permittedOutlets.length > 1 ? (
            <select
              value={displayOutlet?.id || ''}
              onChange={(event) => {
                const found = permittedOutlets.find(
                  (outlet) => outlet.id === event.target.value
                );
                if (found) {
                  playBeep('scan');
                  onSelectOutlet(found);
                }
              }}
              title="Ganti Cabang Aktif"
              className="max-w-[170px] cursor-pointer truncate bg-transparent text-xs font-bold text-white focus:outline-none"
            >
              {permittedOutlets.map((outlet) => (
                <option
                  key={outlet.id}
                  value={outlet.id}
                  className="bg-slate-900 text-white"
                >
                  {outlet.brand ? `[${outlet.brand}] ` : ''}
                  {outlet.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex max-w-[180px] items-center gap-1 truncate">
              <span className="truncate text-xs font-bold text-white">
                {displayOutlet?.brand ? `[${displayOutlet.brand}] ` : ''}
                {displayOutlet?.name}
              </span>
              <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1 py-0.2 font-mono text-[10px] text-amber-400">
                Terkunci
              </span>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded border border-slate-700/50 bg-slate-800/80 px-2.5 py-1.5 font-mono text-xs text-slate-300 xl:flex">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>{currentTime}</span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 sm:flex">
          <User className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-white">{user.userId}</span>
          <span className="rounded border border-emerald-800/80 bg-emerald-950/80 px-1 py-0.2 font-mono text-[10px] uppercase text-emerald-400">
            {user.role}
          </span>
        </div>

        {canAccessTab(user, 'pos') && (
          <button
            type="button"
            onClick={onOpenShiftModal}
            title="Kelola Shift & Kas"
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700"
          >
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden font-medium sm:inline">
              Shift {activeShift?.shiftNumber || 1}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                activeShift ? 'bg-emerald-500' : 'bg-slate-500'
              }`}
            ></span>
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          title="Keluar Sesi Kasir"
          className="ml-1 flex items-center gap-1.5 rounded-md border border-rose-800/70 bg-rose-950/50 px-2.5 py-1 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-900/80 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5 text-rose-400" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
