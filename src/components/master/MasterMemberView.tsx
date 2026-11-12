import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  Crown,
  Edit3,
  Info,
  Medal,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import {
  BaseMemberTier,
  Customer,
  DEFAULT_MEMBER_TIER_CONFIGS,
  MemberTier,
  MemberTierConfig,
  User as PosUser,
  getEligibleMemberTier,
  isBaseMemberTier,
  sortMemberTiers,
} from '../../types/pos';
import { canEditCustomers } from '../../services/accessControl';
import { playBeep, StorageService } from '../../services/storageService';

interface MasterMemberViewProps {
  customers: Customer[];
  currentUser: PosUser;
  onUpdateCustomers: (customers: Customer[]) => void;
}

interface TierVisualStyle {
  icon: typeof Medal;
  topBar: string;
  iconBg: string;
  border: string;
  description: string;
}

const BASE_TIER_STYLE: Record<BaseMemberTier, TierVisualStyle> = {
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

const CUSTOM_TIER_STYLES: TierVisualStyle[] = [
  {
    icon: Award,
    topBar: 'bg-indigo-500',
    iconBg: 'bg-indigo-100 text-indigo-600',
    border: 'border-indigo-200',
    description: 'Tier tambahan dengan benefit khusus.',
  },
  {
    icon: Sparkles,
    topBar: 'bg-cyan-500',
    iconBg: 'bg-cyan-100 text-cyan-700',
    border: 'border-cyan-200',
    description: 'Tier tambahan dengan benefit khusus.',
  },
  {
    icon: Crown,
    topBar: 'bg-fuchsia-500',
    iconBg: 'bg-fuchsia-100 text-fuchsia-700',
    border: 'border-fuchsia-200',
    description: 'Tier tambahan dengan benefit khusus.',
  },
];

const getTierStyle = (tier: string, index: number): TierVisualStyle =>
  isBaseMemberTier(tier)
    ? BASE_TIER_STYLE[tier]
    : CUSTOM_TIER_STYLES[index % CUSTOM_TIER_STYLES.length];

const slugifyTierLabel = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const MasterMemberView: React.FC<MasterMemberViewProps> = ({
  customers,
  currentUser,
  onUpdateCustomers,
}) => {
  const canEditTiers = canEditCustomers(currentUser);
  const [tiers, setTiers] = useState<MemberTierConfig[]>(() =>
    sortMemberTiers(StorageService.getMemberTiers())
  );
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingTier, setEditingTier] = useState<MemberTierConfig | null>(null);
  const [labelInput, setLabelInput] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [minPointsInput, setMinPointsInput] = useState<number>(0);

  const sortedTiers = sortMemberTiers(tiers);

  const members = customers.filter((customer) => customer.tier !== 'UMUM');
  const membersByTier = (tier: MemberTier) =>
    members.filter((member) => member.tier === tier).length;

  /**
   * Terapkan pengaturan tier ke seluruh member:
   * - diskon mengikuti tier terbaru
   * - member naik tier otomatis bila poin memenuhi ambang baru
   * - member pada tier yang dihapus dipindahkan ke tier yang sesuai
   */
  const syncCustomersWithTiers = (configs: MemberTierConfig[]) => {
    const ordered = sortMemberTiers(configs);
    const defaultTier = ordered[0];

    const updated = customers.map((customer) => {
      if (customer.tier === 'UMUM') return customer;

      const eligibleTier = getEligibleMemberTier(customer.points, ordered);
      const currentConfig = ordered.find(
        (config) => config.tier === customer.tier
      );

      // Tidak pernah turun tier secara otomatis, kecuali tiernya sudah dihapus.
      const targetTier = !currentConfig
        ? eligibleTier ?? defaultTier
        : eligibleTier && eligibleTier.minPoints > currentConfig.minPoints
        ? eligibleTier
        : currentConfig;

      if (!targetTier) return customer;

      if (
        targetTier.tier === customer.tier &&
        targetTier.discountPercent === customer.discountPercent
      ) {
        return customer;
      }

      return {
        ...customer,
        tier: targetTier.tier,
        discountPercent: targetTier.discountPercent,
      };
    });

    onUpdateCustomers(updated);
  };

  const persistTiers = (configs: MemberTierConfig[]) => {
    const ordered = sortMemberTiers(configs);
    StorageService.saveMemberTiers(ordered);
    setTiers(ordered);
    syncCustomersWithTiers(ordered);
  };

  const closeTierModal = () => {
    setModalMode(null);
    setEditingTier(null);
  };

  const openAddTier = () => {
    if (!canEditTiers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk menambah tier.');
      return;
    }

    const maxMinPoints = tiers.reduce(
      (max, tier) => Math.max(max, tier.minPoints),
      0
    );
    const maxDiscount = tiers.reduce(
      (max, tier) => Math.max(max, tier.discountPercent),
      0
    );

    setModalMode('add');
    setEditingTier({
      tier: '',
      label: '',
      discountPercent: Math.min(100, maxDiscount + 1),
      minPoints: maxMinPoints + 250,
    });
    setLabelInput('');
    setDiscountInput(Math.min(100, maxDiscount + 1));
    setMinPointsInput(maxMinPoints + 250);
  };

  const openEditTier = (tier: MemberTierConfig) => {
    if (!canEditTiers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk mengubah pengaturan tier.');
      return;
    }

    setModalMode('edit');
    setEditingTier(tier);
    setLabelInput(tier.label);
    setDiscountInput(tier.discountPercent);
    setMinPointsInput(tier.tier === 'MEMBER_SILVER' ? 0 : tier.minPoints);
  };

  const handleSaveTier = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTier || !modalMode) return;

    const label = labelInput.trim();
    if (!label) {
      playBeep('error');
      alert('Nama tier wajib diisi.');
      return;
    }

    const duplicateLabel = tiers.some(
      (tier) =>
        tier.tier !== editingTier.tier &&
        tier.label.trim().toLowerCase() === label.toLowerCase()
    );
    if (duplicateLabel) {
      playBeep('error');
      alert(`Nama tier "${label}" sudah digunakan.`);
      return;
    }

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

    const isSilverTier =
      modalMode === 'edit' && editingTier.tier === 'MEMBER_SILVER';
    const effectiveMinPoints = isSilverTier ? 0 : Math.floor(minPointsInput);

    if (!isSilverTier && effectiveMinPoints <= 0) {
      playBeep('error');
      alert('Minimal poin tier selain Silver harus lebih besar dari 0.');
      return;
    }

    const slug = slugifyTierLabel(label) || 'TIER';
    let tierCode = `MEMBER_${slug}`;
    let suffix = 2;
    while (
      tiers.some((tier) => tier.tier === tierCode) ||
      tierCode === 'UMUM'
    ) {
      tierCode = `MEMBER_${slug}_${suffix}`;
      suffix += 1;
    }

    const nextConfig: MemberTierConfig = {
      tier: modalMode === 'add' ? tierCode : editingTier.tier,
      label,
      discountPercent: Math.round(discountInput),
      minPoints: effectiveMinPoints,
    };

    const nextConfigs =
      modalMode === 'add'
        ? [...tiers, nextConfig]
        : tiers.map((tier) =>
            tier.tier === editingTier.tier ? nextConfig : tier
          );

    const ordered = sortMemberTiers(nextConfigs);

    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].minPoints <= ordered[index - 1].minPoints) {
        playBeep('error');
        alert(
          `Minimal poin tier ${ordered[index].label} harus lebih besar dari tier ${ordered[index - 1].label}.`
        );
        return;
      }
    }

    persistTiers(ordered);
    playBeep('success');
    alert(
      modalMode === 'add'
        ? `Tier "${label}" berhasil ditambahkan. Member yang memenuhi ambang poin otomatis dinaikkan.`
        : `Pengaturan tier "${label}" berhasil disimpan dan diterapkan ke member.`
    );
    closeTierModal();
  };

  const handleResetTiers = () => {
    if (!canEditTiers) return;
    if (
      !confirm(
        'Kembalikan pengaturan tier ke bawaan (Silver 2%, Gold 5%, Grosir 8%)? Tier tambahan akan dihapus dan tier member disesuaikan.'
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
                Atur diskon dan minimal poin setiap tier. Gunakan tombol{' '}
                <strong>Tambah Tier</strong> untuk tier baru, atau{' '}
                <strong>Edit</strong> pada kartu tier untuk mengubahnya.
              </p>
            </div>
          </div>

          {canEditTiers ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAddTier}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-700"
                title="Tambah tier member baru"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Tier
              </button>
              <button
                type="button"
                onClick={handleResetTiers}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                title="Kembalikan pengaturan tier ke bawaan"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Bawaan
              </button>
            </div>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Hanya baca (butuh akses ADMIN)
            </span>
          )}
        </div>

        {/* Kartu Tier */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedTiers.map((tier, index) => {
            const style = getTierStyle(tier.tier, index);
            const TierIcon = style.icon;
            const memberCount = membersByTier(tier.tier);
            const description = isBaseMemberTier(tier.tier)
              ? style.description
              : `Tier tambahan dengan diskon ${tier.discountPercent}% untuk member dengan minimal ${tier.minPoints.toLocaleString('id-ID')} poin.`;

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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-base font-extrabold text-slate-900">
                            {tier.label}
                          </h3>
                          {!isBaseMemberTier(tier.tier) && (
                            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700">
                              Kustom
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canEditTiers && (
                      <button
                        type="button"
                        onClick={() => openEditTier(tier)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-900"
                        title={`Edit pengaturan tier ${tier.label}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  <p className="mt-3 min-h-8 text-[11px] leading-relaxed text-slate-500">
                    {description}
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
                Member mendapat poin sesuai pengaturan poin per produk di menu
                Master Point, selama masa aktif poin berlaku.
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

      {/* MODAL TAMBAH / EDIT TIER */}
      {editingTier && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="animate-fadeIn w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                {modalMode === 'add' ? (
                  <Plus className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Crown className="h-5 w-5 text-amber-400" />
                )}
                <h3 className="text-sm font-bold">
                  {modalMode === 'add'
                    ? 'Tambah Tier Baru'
                    : `Edit Pengaturan Tier ${editingTier.label}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeTierModal}
                className="text-slate-400 transition-colors hover:text-white"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveTier}
              className="max-h-[80vh] space-y-4 overflow-y-auto p-5 text-xs"
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Pratinjau Benefit
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-extrabold text-slate-800">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    {labelInput.trim() || 'Tier Baru'}
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
                  Nama Tier:
                </label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(event) => setLabelInput(event.target.value)}
                  placeholder="Contoh: Platinum"
                  maxLength={24}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-semibold text-slate-900"
                  required
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {modalMode === 'add'
                    ? 'Kode tier dibuat otomatis dan tidak perlu diisi.'
                    : 'Kode tier tetap, hanya nama tampilan yang berubah.'}
                </p>
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
                  disabled={
                    modalMode === 'edit' && editingTier.tier === 'MEMBER_SILVER'
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-amber-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {modalMode === 'edit' && editingTier.tier === 'MEMBER_SILVER'
                    ? 'Silver adalah tier dasar, jadi minimal poin dikunci di 0.'
                    : 'Minimal poin harus lebih besar dari tier di bawahnya.'}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] text-blue-900">
                <p className="font-bold">Dampak penyimpanan:</p>
                <p className="mt-1 leading-relaxed">
                  {modalMode === 'add'
                    ? 'Tier baru akan ditambahkan. Member yang poinnya sudah memenuhi ambang tier ini akan otomatis dinaikkan.'
                    : `Diskon baru diterapkan ke semua member tier ${editingTier.label}. Member yang poinnya sudah memenuhi ambang tier lebih tinggi akan otomatis dinaikkan.`}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={closeTierModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  {modalMode === 'add' ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {modalMode === 'add' ? 'Tambah Tier' : 'Simpan Pengaturan'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
