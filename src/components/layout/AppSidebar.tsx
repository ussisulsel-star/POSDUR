import React, { useEffect, useState } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  Layers,
  Maximize2,
  Minimize2,
  PauseCircle,
  RotateCcw,
  ShoppingBag,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import { AppTab, canAccessMasterData, canAccessTab, canOpenDrawer, canReturn, canViewDocs, canViewReports } from '../../services/accessControl';
import { getAllowedMasterTabs, type MasterTab } from '../master/masterTabs';
import { REPORT_TABS, type ReportTab } from '../reports/reportTabs';
import { User as PosUser } from '../../types/pos';
import { playBeep } from '../../services/storageService';

interface AppSidebarProps {
  user: PosUser;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  heldCount: number;
  masterTab: MasterTab;
  onSelectMasterTab: (tab: MasterTab) => void;
  reportTab: ReportTab;
  onSelectReportTab: (tab: ReportTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenHoldModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenReturnModal: () => void;
  onOpenCashMovementModal: () => void;
  onOpenShortcutsModal: () => void;
}

interface NavButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  active?: boolean;
  accent?: 'emerald';
  badge?: number;
  trailing?: React.ReactNode;
  expanded?: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({
  icon: Icon,
  label,
  collapsed,
  active = false,
  accent,
  badge,
  trailing,
  expanded,
  onClick,
}) => {
  const activeClasses =
    accent === 'emerald'
      ? 'bg-emerald-600 text-white shadow-sm'
      : 'bg-blue-600 text-white shadow-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? activeClasses
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      } ${collapsed ? 'md:justify-center' : ''}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-auto rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${
            collapsed
              ? 'md:absolute md:right-1.5 md:top-1 md:ml-0 md:px-1 md:text-[9px]'
              : ''
          }`}
        >
          {badge}
        </span>
      )}
      {trailing && (
        <span className={`ml-auto shrink-0 ${collapsed ? 'md:hidden' : ''}`}>
          {trailing}
        </span>
      )}
    </button>
  );
};

interface SubNavButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  active?: boolean;
  onClick: () => void;
}

const SubNavButton: React.FC<SubNavButtonProps> = ({
  icon: Icon,
  label,
  accent,
  active = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
      active
        ? 'bg-blue-600/20 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon
      className={`h-3.5 w-3.5 shrink-0 ${
        active ? 'text-blue-400' : accent ?? 'text-slate-500'
      }`}
    />
    <span className="truncate">{label}</span>
  </button>
);

export const AppSidebar: React.FC<AppSidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  heldCount,
  masterTab,
  onSelectMasterTab,
  reportTab,
  onSelectReportTab,
  mobileOpen,
  onCloseMobile,
  onOpenHoldModal,
  onOpenHistoryModal,
  onOpenReturnModal,
  onOpenCashMovementModal,
  onOpenShortcutsModal,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('vc3_sidebar_collapsed');
    if (stored !== null) return stored === '1';
    return window.innerWidth < 1440;
  });
  const [masterOpen, setMasterOpen] = useState<boolean>(
    activeTab === 'master'
  );
  const [reportsOpen, setReportsOpen] = useState<boolean>(
    activeTab === 'reports'
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => Boolean(document.fullscreenElement)
  );

  useEffect(() => {
    localStorage.setItem('vc3_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Buka submenu master/laporan otomatis saat tab terkait aktif.
  useEffect(() => {
    if (activeTab === 'master') {
      setMasterOpen(true);
    }
    if (activeTab === 'reports') {
      setReportsOpen(true);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, onCloseMobile]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser dapat menolak fullscreen (mis. kebijakan iframe).
    }
  };

  const handleOpenCashDrawer = () => {
    playBeep('success');
    alert(
      'Simulasi: Perintah Buka Laci Kasir (ESC/POS Drawer Kick Pulse 27,112,0,25,250) dikirim ke Printer!'
    );
    onCloseMobile();
  };

  const runAction = (action: () => void) => {
    action();
    onCloseMobile();
  };

  const masterTabs = getAllowedMasterTabs(user);

  const handleOpenMaster = () => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop && collapsed) {
      setCollapsed(false);
      setMasterOpen(true);
      if (activeTab !== 'master') setActiveTab('master');
      return;
    }
    if (activeTab === 'master' && masterOpen) {
      setMasterOpen(false);
      return;
    }
    setActiveTab('master');
    setMasterOpen(true);
  };

  const handleSelectMaster = (tab: MasterTab) => {
    onSelectMasterTab(tab);
    setMasterOpen(true);
    onCloseMobile();
  };

  const handleOpenReports = () => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    // Pada rail yang mengecil, klik Laporan membuka sidebar agar submenu terlihat.
    if (isDesktop && collapsed) {
      setCollapsed(false);
      setReportsOpen(true);
      if (activeTab !== 'reports') setActiveTab('reports');
      return;
    }
    if (activeTab === 'reports' && reportsOpen) {
      setReportsOpen(false);
      return;
    }
    setActiveTab('reports');
    setReportsOpen(true);
  };

  const handleSelectReport = (tab: ReportTab) => {
    onSelectReportTab(tab);
    setReportsOpen(true);
    onCloseMobile();
  };

  const posAccess = canAccessTab(user, 'pos');
  const sectionLabel = (text: string) => (
    <p
      className={`px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
        collapsed ? 'md:hidden' : ''
      }`}
    >
      {text}
    </p>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navigasi utama"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-200 shadow-2xl transition-[transform,width] duration-200 md:static md:z-auto md:translate-x-0 md:shadow-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-64 md:w-[72px]' : 'w-64 md:w-60'}`}
      >
        {/* Brand */}
        <div
          className={`flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-3 ${
            collapsed ? 'md:justify-center' : ''
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold tracking-wider">CATAT</span>
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold">
                  POS
                </span>
              </div>
              <p className="truncate text-[10px] text-slate-400">
                Multi-Outlet Terminal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Tutup menu"
            title="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          <div className="space-y-1">
            {sectionLabel('Navigasi')}

            {posAccess && (
              <NavButton
                icon={CreditCard}
                label="Terminal Kasir"
                collapsed={collapsed}
                active={activeTab === 'pos'}
                onClick={() => setActiveTab('pos')}
              />
            )}

            {canAccessMasterData(user) && (
              <>
                <NavButton
                  icon={Boxes}
                  label="Master Data"
                  collapsed={collapsed}
                  active={activeTab === 'master'}
                  expanded={masterOpen}
                  trailing={
                    masterOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  }
                  onClick={handleOpenMaster}
                />

                {masterOpen && (
                  <div
                    className={`ml-5 space-y-0.5 border-l border-slate-800 py-1 pl-2 ${
                      collapsed ? 'md:hidden' : ''
                    }`}
                  >
                    {masterTabs.map((item) => (
                      <SubNavButton
                        key={item.id}
                        icon={item.icon}
                        label={item.shortLabel}
                        accent={item.accent}
                        active={activeTab === 'master' && masterTab === item.id}
                        onClick={() => handleSelectMaster(item.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {canViewReports(user) && (
              <>
                <NavButton
                  icon={FileText}
                  label="Laporan"
                  collapsed={collapsed}
                  active={activeTab === 'reports'}
                  expanded={reportsOpen}
                  trailing={
                    reportsOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )
                  }
                  onClick={handleOpenReports}
                />

                {reportsOpen && (
                  <div
                    className={`ml-5 space-y-0.5 border-l border-slate-800 py-1 pl-2 ${
                      collapsed ? 'md:hidden' : ''
                    }`}
                  >
                    {REPORT_TABS.map((item) => (
                      <SubNavButton
                        key={item.id}
                        icon={item.icon}
                        label={item.shortLabel}
                        accent={item.accent}
                        active={activeTab === 'reports' && reportTab === item.id}
                        onClick={() => handleSelectReport(item.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {canViewDocs(user) && (
              <NavButton
                icon={Layers}
                label="Arsitektur & API"
                collapsed={collapsed}
                active={activeTab === 'docs'}
                accent="emerald"
                onClick={() => setActiveTab('docs')}
              />
            )}
          </div>

          {posAccess && (
            <div className="mt-2 space-y-1 border-t border-slate-800/70 pt-1">
              {sectionLabel('Operasional Kasir')}

              <NavButton
                icon={PauseCircle}
                label="Transaksi Tertahan"
                collapsed={collapsed}
                badge={heldCount}
                onClick={() => runAction(onOpenHoldModal)}
              />

              <NavButton
                icon={History}
                label="Riwayat Nota (F9)"
                collapsed={collapsed}
                onClick={() => runAction(onOpenHistoryModal)}
              />

              {canReturn(user) && (
                <NavButton
                  icon={RotateCcw}
                  label="Retur Penjualan"
                  collapsed={collapsed}
                  onClick={() => runAction(onOpenReturnModal)}
                />
              )}

              <NavButton
                icon={Wallet}
                label="Kas Operasional"
                collapsed={collapsed}
                onClick={() => runAction(onOpenCashMovementModal)}
              />

              {canOpenDrawer(user) && (
                <NavButton
                  icon={Unlock}
                  label="Buka Laci Kasir"
                  collapsed={collapsed}
                  onClick={handleOpenCashDrawer}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom utilities */}
        <div className="mt-auto shrink-0 space-y-1 border-t border-slate-800 p-2">
          <NavButton
            icon={collapsed ? ChevronRight : ChevronLeft}
            label={collapsed ? 'Perluas Menu' : 'Ciutkan Menu'}
            collapsed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          />

          <NavButton
            icon={isFullscreen ? Minimize2 : Maximize2}
            label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            collapsed={collapsed}
            onClick={toggleFullscreen}
          />

          <NavButton
            icon={HelpCircle}
            label="Bantuan (F12)"
            collapsed={collapsed}
            onClick={() => runAction(onOpenShortcutsModal)}
          />
        </div>
      </aside>
    </>
  );
};
