import React, { useState } from 'react';
import {
  AlertCircle,
  Crown,
  Edit3,
  Info,
  Medal,
  Percent,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import {
  Customer,
  DEFAULT_MEMBER_TIER_CONFIGS,
  MemberTier,
  MemberTierConfig,
  MEMBER_TIER_RANK,
  User as PosUser,
  getEligibleMemberTier,
} from '../../types/pos';
import { canEditCustomers } from '../../services/accessControl';
import { playBeep, StorageService } from '../../services/storageService';

interface MasterMemberViewProps {
  customers: Customer[];
  currentUser: PosUser;
  onUpdateCustomers: (customers: Customer[]) => void;
}

const TIER_STYLE: Record<
  MemberTier,
  {
    icon: typeof Medal;
    topBar: string;
    iconBg: string;
    border: string;
    description: string;
  }
> = {
  MEMBER_SILVER: {
    icon: Medal,
    topBar: 'bg-slate-400',
    iconBg: 'bg-slate-100 text-slate-600',
    border: 'border-slate-200',
    description: 'Tier dasar untuk member baru yang mulai mengumpulkan poin.',
  },
  MEMBER_GOLD: {
    icon: Crown,
    topBar: 'bg-amber-400',
    iconBg: 'bg-amber-100 text-amber-600',
    border: 'border-amber-200',
    description: 'Tier menengah dengan diskon lebih besar untuk member aktif.',
  },
  GROSIR: {
    icon: Store,
    topBar: 'bg-emerald-500',
    iconBg: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
    description: 'Tier tertinggi untuk mitra toko dan pembelian grosir.',
  },
};

export const MasterMemberView: React.FC<MasterMemberViewProps> = ({
  customers,
  currentUser,
  onUpdateCustomers,
}) => {
  const canEditTiers = canEditCustomers(currentUser);
  const [tiers, setTiers] = useState<MemberTierConfig[]>(() =>
    StorageService.getMemberTiers()
  );
  const [editingTier, setEditingTier] = useState<MemberTierConfig | null>(null);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [minPointsInput, setMinPointsInput] = useState<number>(0);

  const sortedTiers = [...tiers].sort(
    (a, b) => MEMBER_TIER_RANK[a.tier] - MEMBER_TIER_RANK[b.tier]
  );

  const members = customers.filter((customer) => customer.tier !== 'UMUM');
  const membersByTier = (tier: MemberTier) =>
    members.filter((member) => member.tier === tier).length;

  /**
   * Terapkan pengaturan tier ke seluruh member:
   * - diskon mengikuti tier terbaru
   * - member naik tier otomatis bila poin memenuhi ambang baru
   */
  const syncCustomersWithTiers = (configs: MemberTierConfig[]) => {
    const updated = customers.map((customer) => {
      if (customer.tier === 'UMUM') return customer;

      const currentRank = MEMBER_TIER_RANK[customer.tier] ?? 0;
      const eligibleTier = getEligibleMemberTier(customer.points, configs);
      const currentConfig = configs.find((config) => config.tier === customer.tier);
      const targetTier =
        eligibleTier && MEMBER_TIER_RANK[eligibleTier.tier] > currentRank
          ? eligibleTier
          : currentConfig;

      if (!targetTier) return customer;

      return {
        ...customer,
        tier: targetTier.tier,
        discountPercent: targetTier.discountPercent,
      };
    });

    onUpdateCustomers(updated);
  };

  const persistTiers = (configs: MemberTierConfig[]) => {
    StorageService.saveMemberTiers(configs);
    setTiers(configs);
    syncCustomersWithTiers(configs);
  };

  const openEditTier = (tier: MemberTierConfig) => {
    if (!canEditTiers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk mengubah pengaturan tier.');
      return;
    }
    setEditingTier(tier);
    setDiscountInput(tier.discountPercent);
    setMinPointsInput(tier.tier === 'MEMBER_SILVER' ? 0 : tier.minPoints);
  };

  const handleSaveTier = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTier) return;

    if (discountInput < 0 || discountInput > 100) {
      playBeep('error');
      alert('Diskon tier harus berada di antara 0% dan 100%.');
      return;
    }

    if (minPointsInput < 0) {
      playBeep('error');
      alert('Minimal poin tidak boleh negatif.');
      return;
    }

    const effectiveMinPoints =
      editingTier.tier === 'MEMBER_SILVER' ? 0 : Math.floor(minPointsInput);

    const nextConfigs = tiers.map((tier) =>
      tier.tier === editingTier.tier
        ? {
            ...tier,
            discountPercent: Math.round(discountInput),
            minPoints: effectiveMinPoints,
          }
        : tier
    );

    const ordered = [...nextConfigs].sort(
      (a, b) => MEMBER_TIER_RANK[a.tier] - MEMBER_TIER_RANK[b.tier]
    );

    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].minPoints <= ordered[index - 1].minPoints) {
        playBeep('error');
        alert(
          `Minimal poin tier ${ordered[index].label} harus lebih besar dari tier ${ordered[index - 1].label}.`
        );
        return;
      }
    }

    persistTiers(nextConfigs);
    playBeep('success');
    alert(
      `Pengaturan tier ${editingTier.label} berhasil disimpan dan diterapkan ke member.`
    );
    setEditingTier(null);
  };

  const handleResetTiers = () => {
    if (!canEditTiers) return;
    if (
      !confirm(
        'Kembalikan pengaturan tier ke bawaan (Silver 2%, Gold 5%, Grosir 8%)? Diskon dan tier member akan disesuaikan.'
      )
    ) {
      return;
    }

    persistTiers(DEFAULT_MEMBER_TIER_CONFIGS.map((tier) => ({ ...tier })));
    playBeep('success');
    alert('Pengaturan tier berhasil dikembalikan ke bawaan.');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Info Aturan Tier */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-950">
                Pengaturan Tier Member
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                Atur diskon dan minimal poin setiap tier. Member naik tier otomatis
                saat poin mencapai ambang, dan diskon tier langsung dipakai di kasir.
              </p>
            </div>
          </div>

          {canEditTiers ? (
            <button
              type="button"
              onClick={handleResetTiers}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              title="Kembalikan pengaturan tier ke bawaan"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Bawaan
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Hanya baca (butuh akses ADMIN)
            </span>
          )}
        </div>

        {/* Kartu Tier */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedTiers.map((tier) => {
            const style = TIER_STYLE[tier.tier];
            const TierIcon = style.icon;
            const memberCount = membersByTier(tier.tier);

            return (
              <div
                key={tier.tier}
                className={`overflow-hidden rounded-2xl border bg-white shadow-2xs transition-all hover:shadow-md ${style.border}`}
              >
                <div className={`h-1.5 ${style.topBar}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
                      >
                        <TierIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Tier Member
                        </p>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {tier.label}
                        </h3>
                      </div>
                    </div>

                    {canEditTiers && (
                      <button
                        type="button"
                        onClick={() => openEditTier(tier)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        title={`Edit pengaturan tier ${tier.label}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <p className="mt-3 min-h-8 text-[11px] leading-relaxed text-slate-500">
                    {style.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <Percent className="h-3 w-3" />
                        Diskon
                      </p>
                      <p className="mt-1 font-mono text-xl font-extrabold text-emerald-600">
                        {tier.discountPercent}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <Star className="h-3 w-3" />
                        Minimal Poin
                      </p>
                      <p className="mt-1 font-mono text-xl font-extrabold text-amber-600">
                        {tier.minPoints.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                    <span className="text-slate-500">Member saat ini</span>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-700">
                      {memberCount} member
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Penjelasan Aturan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Info className="h-4 w-4 text-blue-500" />
            Cara Kerja Tier Member
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-[11px] text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">1. Kumpulkan poin</p>
              <p className="mt-1 leading-relaxed">
                Member mendapat 1 poin untuk setiap Rp 10.000 total belanja.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">2. Naik tier otomatis</p>
              <p className="mt-1 leading-relaxed">
                Saat poin mencapai minimal tier berikutnya, member otomatis naik
                tier setelah transaksi.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">3. Diskon tier berlaku</p>
              <p className="mt-1 leading-relaxed">
                Diskon tier dipakai saat member dipilih di Terminal Kasir. Perubahan
                diskon disinkronkan ke seluruh member tier terkait.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDIT TIER */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="animate-fadeIn w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold">
                  Edit Pengaturan Tier {editingTier.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="text-slate-400 transition-colors hover:text-white"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-4 p-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Pratinjau Benefit
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-extrabold text-slate-800">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    {editingTier.label}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[11px] font-bold text-emerald-700">
                    Diskon {discountInput || 0}%
                  </span>
                  <span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-[11px] font-bold text-amber-700">
                    ≥ {Number(minPointsInput || 0).toLocaleString('id-ID')} poin
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Diskon Tier (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountInput}
                  onChange={(event) => setDiscountInput(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-emerald-600"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Diskon otomatis dipakai saat member tier ini bertransaksi.
                </p>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Minimal Poin untuk Naik Tier:
                </label>
                <input
                  type="number"
                  min="0"
                  value={minPointsInput}
                  onChange={(event) => setMinPointsInput(Number(event.target.value))}
                  disabled={editingTier.tier === 'MEMBER_SILVER'}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-amber-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {editingTier.tier === 'MEMBER_SILVER'
                    ? 'Silver adalah tier dasar, jadi minimal poin dikunci di 0.'
                    : 'Minimal poin harus lebih besar dari tier di bawahnya.'}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] text-blue-900">
                <p className="font-bold">Dampak penyimpanan:</p>
                <p className="mt-1 leading-relaxed">
                  Diskon baru diterapkan ke semua member tier {editingTier.label}.
                  Member yang poinnya sudah memenuhi ambang tier lebih tinggi akan
                  otomatis dinaikkan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
