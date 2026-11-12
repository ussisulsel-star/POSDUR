import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BadgeCheck,
  Crown,
  Edit3,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Customer, User as PosUser } from '../../types/pos';
import { canEditCustomers } from '../../services/accessControl';
import { playBeep } from '../../services/storageService';

interface MasterMemberViewProps {
  customers: Customer[];
  currentUser: PosUser;
  onUpdateCustomers: (customers: Customer[]) => void;
}

type MemberTier = Exclude<Customer['tier'], 'UMUM'>;

interface MemberFormState {
  id: string;
  code: string;
  name: string;
  phone: string;
  tier: MemberTier;
  discountPercent: number;
  points: number;
  address: string;
}

interface PointAdjustmentState {
  customer: Customer;
  mode: 'add' | 'subtract';
  amount: number;
}

const TIER_META: Record<
  MemberTier,
  { label: string; badge: string; dot: string; defaultDiscount: number; accent: string }
> = {
  MEMBER_SILVER: {
    label: 'Silver',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    defaultDiscount: 2,
    accent: 'text-slate-500',
  },
  MEMBER_GOLD: {
    label: 'Gold',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-400',
    defaultDiscount: 5,
    accent: 'text-amber-500',
  },
  GROSIR: {
    label: 'Grosir',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500',
    defaultDiscount: 8,
    accent: 'text-emerald-500',
  },
};

const TIER_ORDER: MemberTier[] = ['MEMBER_SILVER', 'MEMBER_GOLD', 'GROSIR'];

const isMember = (customer: Customer) => customer.tier !== 'UMUM';

const newMemberForm = (customers: Customer[]): MemberFormState => {
  const maxCode = customers.reduce((max, customer) => {
    const numeric = Number.parseInt(customer.code.replace(/\D/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return {
    id: '',
    code: `PLG-${String(maxCode + 1).padStart(4, '0')}`,
    name: '',
    phone: '',
    tier: 'MEMBER_SILVER',
    discountPercent: TIER_META.MEMBER_SILVER.defaultDiscount,
    points: 50,
    address: '',
  };
};

export const MasterMemberView: React.FC<MasterMemberViewProps> = ({
  customers,
  currentUser,
  onUpdateCustomers,
}) => {
  const canEditMembers = canEditCustomers(currentUser);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<'ALL' | MemberTier>('ALL');
  const [editingMember, setEditingMember] = useState<MemberFormState | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [pointAdjustment, setPointAdjustment] =
    useState<PointAdjustmentState | null>(null);

  const members = useMemo(() => customers.filter(isMember), [customers]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const digits = searchQuery.replace(/\D/g, '');

    return members.filter((member) => {
      const matchesTier = tierFilter === 'ALL' || member.tier === tierFilter;
      if (!matchesTier) return false;
      if (!query) return true;

      return (
        member.name.toLowerCase().includes(query) ||
        member.code.toLowerCase().includes(query) ||
        (digits.length > 0 && member.phone.replace(/\D/g, '').includes(digits))
      );
    });
  }, [members, searchQuery, tierFilter]);

  const totalPoints = members.reduce((total, member) => total + member.points, 0);
  const goldMembers = members.filter((member) => member.tier === 'MEMBER_GOLD').length;
  const averageDiscount = members.length
    ? Math.round(
        members.reduce((total, member) => total + member.discountPercent, 0) /
          members.length
      )
    : 0;

  const openAddMember = () => {
    if (!canEditMembers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk menambah member.');
      return;
    }
    setEditingMember(newMemberForm(customers));
    setIsAddingNew(true);
  };

  const openEditMember = (member: Customer) => {
    if (!canEditMembers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk mengubah member.');
      return;
    }
    setEditingMember({
      id: member.id,
      code: member.code,
      name: member.name,
      phone: member.phone,
      tier: member.tier === 'UMUM' ? 'MEMBER_SILVER' : member.tier,
      discountPercent: member.discountPercent,
      points: member.points,
      address: member.address || '',
    });
    setIsAddingNew(false);
  };

  const handleSaveMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMember) return;

    const name = editingMember.name.trim();
    const code = editingMember.code.trim().toUpperCase();
    if (!name || !code) {
      playBeep('error');
      alert('Kode member dan nama member wajib diisi.');
      return;
    }

    const duplicateCode = customers.some(
      (customer) =>
        customer.id !== editingMember.id &&
        customer.code.trim().toLowerCase() === code.toLowerCase()
    );
    if (duplicateCode) {
      playBeep('error');
      alert(`Kode member "${code}" sudah digunakan.`);
      return;
    }

    const memberPayload: Customer = {
      id: editingMember.id || `cust-${Date.now()}`,
      code,
      name,
      phone: editingMember.phone.trim() || '-',
      tier: editingMember.tier,
      discountPercent: Math.max(0, Math.min(100, editingMember.discountPercent)),
      points: Math.max(0, Math.floor(editingMember.points)),
      address: editingMember.address.trim() || '-',
    };

    if (isAddingNew) {
      onUpdateCustomers([memberPayload, ...customers]);
      playBeep('success');
      alert(`Member "${name}" berhasil ditambahkan!`);
    } else {
      onUpdateCustomers(
        customers.map((customer) =>
          customer.id === memberPayload.id ? memberPayload : customer
        )
      );
      playBeep('success');
      alert(`Data member "${name}" berhasil diperbarui!`);
    }

    setEditingMember(null);
    setIsAddingNew(false);
  };

  const handleDeleteMember = (member: Customer) => {
    if (!canEditMembers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk menghapus member.');
      return;
    }
    if (
      !confirm(
        `Hapus member "${member.name}" (${member.code})? Data pelanggan ini akan dihapus permanen.`
      )
    ) {
      return;
    }

    onUpdateCustomers(customers.filter((customer) => customer.id !== member.id));
    playBeep('delete');
  };

  const openPointAdjustment = (member: Customer) => {
    if (!canEditMembers) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk mengubah poin member.');
      return;
    }
    setPointAdjustment({ customer: member, mode: 'add', amount: 10 });
  };

  const handleSavePointAdjustment = () => {
    if (!pointAdjustment) return;

    const amount = Math.max(0, Math.floor(pointAdjustment.amount || 0));
    if (amount <= 0) {
      playBeep('error');
      alert('Jumlah poin harus lebih dari 0.');
      return;
    }

    const current = pointAdjustment.customer.points;
    const nextPoints =
      pointAdjustment.mode === 'add'
        ? current + amount
        : Math.max(0, current - amount);

    onUpdateCustomers(
      customers.map((customer) =>
        customer.id === pointAdjustment.customer.id
          ? { ...customer, points: nextPoints }
          : customer
      )
    );
    playBeep('success');
    setPointAdjustment(null);
  };

  const resetTierDiscount = () => {
    if (!editingMember) return;
    setEditingMember({
      ...editingMember,
      discountPercent: TIER_META[editingMember.tier].defaultDiscount,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Ringkasan Membership */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total Member
              </p>
              <p className="text-xl font-extrabold text-slate-900">{members.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total Poin
              </p>
              <p className="text-xl font-extrabold text-slate-900">
                {totalPoints.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Member Gold
              </p>
              <p className="text-xl font-extrabold text-slate-900">{goldMembers}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Rata-rata Diskon
              </p>
              <p className="text-xl font-extrabold text-slate-900">{averageDiscount}%</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari nama, kode member, atau no. HP..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  title="Hapus pencarian"
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={tierFilter}
              onChange={(event) =>
                setTierFilter(event.target.value as 'ALL' | MemberTier)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Tier</option>
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_META[tier].label}
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-500">
              Menampilkan{' '}
              <strong className="text-slate-800">{filteredMembers.length}</strong> dari{' '}
              {members.length} member
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditMembers ? (
              <button
                type="button"
                onClick={openAddMember}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 hover:shadow"
              >
                <UserPlus className="h-4 w-4" />
                <span>Tambah Member Baru</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                Hanya baca (butuh akses ADMIN)
              </span>
            )}
          </div>
        </div>

        {/* Tabel Member */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          {filteredMembers.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <BadgeCheck className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">
                {members.length === 0 ? 'Belum ada member' : 'Member tidak ditemukan'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {members.length === 0
                  ? 'Tambahkan member pertama untuk mulai mengatur diskon dan poin.'
                  : 'Coba kata kunci atau filter tier lain.'}
              </p>
              {canEditMembers && members.length === 0 && (
                <button
                  type="button"
                  onClick={openAddMember}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Tambah Member Baru
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Member</th>
                    <th className="px-3 py-2.5 font-semibold">Tier</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Diskon</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Poin</th>
                    <th className="px-3 py-2.5 font-semibold">Kontak</th>
                    <th className="w-40 px-3 py-2.5 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member) => {
                    const tierMeta =
                      member.tier === 'UMUM'
                        ? TIER_META.MEMBER_SILVER
                        : TIER_META[member.tier];

                    return (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">
                                {member.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {member.code}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${tierMeta.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${tierMeta.dot}`} />
                            {tierMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-emerald-600">
                          {member.discountPercent}%
                        </td>
                        <td className="px-3 py-3 text-right font-mono-numbers font-bold text-amber-600">
                          {member.points.toLocaleString('id-ID')} pts
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-mono text-slate-600">{member.phone}</p>
                          <p className="max-w-xs truncate text-[10px] text-slate-400">
                            {member.address || '-'}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {canEditMembers ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openPointAdjustment(member)}
                                  className="rounded-lg border border-amber-200 p-1.5 text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700"
                                  title={`Kelola poin ${member.name}`}
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditMember(member)}
                                  className="rounded-lg border border-blue-200 p-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                                  title={`Edit member ${member.name}`}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(member)}
                                  className="rounded-lg border border-rose-200 p-1.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                  title={`Hapus member ${member.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400">Read-only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="px-1 text-[11px] text-slate-500">
          Member yang dibuat dari Terminal Kasir otomatis muncul di sini. Pelanggan
          umum (walk-in) dikelola terpisah di Master Pelanggan.
        </p>
      </div>

      {/* MODAL TAMBAH / EDIT MEMBER */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="animate-fadeIn flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-bold">
                  {isAddingNew
                    ? 'Tambah Member Baru'
                    : `Edit Member: ${editingMember.name}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="text-slate-400 transition-colors hover:text-white"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              className="max-h-[80vh] space-y-3.5 overflow-y-auto p-5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Kode Member:
                  </label>
                  <input
                    type="text"
                    value={editingMember.code}
                    onChange={(event) =>
                      setEditingMember({
                        ...editingMember,
                        code: event.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Nomor HP / WA:
                  </label>
                  <input
                    type="text"
                    value={editingMember.phone}
                    onChange={(event) =>
                      setEditingMember({ ...editingMember, phone: event.target.value })
                    }
                    placeholder="Contoh: 08123456789"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nama Member:
                </label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(event) =>
                    setEditingMember({ ...editingMember, name: event.target.value })
                  }
                  placeholder="Nama lengkap member..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Tier Member:
                  </label>
                  <select
                    value={editingMember.tier}
                    onChange={(event) => {
                      const tier = event.target.value as MemberTier;
                      setEditingMember({
                        ...editingMember,
                        tier,
                        discountPercent: TIER_META[tier].defaultDiscount,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-semibold"
                  >
                    {TIER_ORDER.map((tier) => (
                      <option key={tier} value={tier}>
                        {TIER_META[tier].label} ({TIER_META[tier].defaultDiscount}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 flex items-center justify-between gap-1 font-semibold text-slate-700">
                    <span>Diskon (%):</span>
                    <button
                      type="button"
                      onClick={resetTierDiscount}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                      title="Kembalikan diskon sesuai tier"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingMember.discountPercent}
                    onChange={(event) =>
                      setEditingMember({
                        ...editingMember,
                        discountPercent: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Poin:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingMember.points}
                    onChange={(event) =>
                      setEditingMember({
                        ...editingMember,
                        points: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Alamat:
                </label>
                <textarea
                  rows={2}
                  value={editingMember.address}
                  onChange={(event) =>
                    setEditingMember({ ...editingMember, address: event.target.value })
                  }
                  placeholder="Alamat domisili atau pengiriman..."
                  className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-2"
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900">
                <p className="font-bold">Benefit member saat transaksi:</p>
                <p className="mt-1">
                  Diskon <strong>{editingMember.discountPercent}%</strong> otomatis
                  diterapkan di kasir, dan poin dapat dipakai untuk loyalitas belanja.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isAddingNew ? 'Simpan Member' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA POIN */}
      {pointAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="animate-fadeIn w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold">Kelola Poin Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setPointAdjustment(null)}
                className="text-slate-400 transition-colors hover:text-white"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-xs">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="font-bold text-slate-900">
                  {pointAdjustment.customer.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {pointAdjustment.customer.code} · {pointAdjustment.customer.phone}
                </p>
                <p className="mt-2 text-[11px] text-slate-600">
                  Poin saat ini:{' '}
                  <strong className="font-mono text-sm text-amber-700">
                    {pointAdjustment.customer.points.toLocaleString('id-ID')} pts
                  </strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPointAdjustment({ ...pointAdjustment, mode: 'add' })
                  }
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold transition-colors ${
                    pointAdjustment.mode === 'add'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Poin
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPointAdjustment({ ...pointAdjustment, mode: 'subtract' })
                  }
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-bold transition-colors ${
                    pointAdjustment.mode === 'subtract'
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Minus className="h-4 w-4" />
                  Kurangi Poin
                </button>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Jumlah Poin:
                </label>
                <input
                  type="number"
                  min="1"
                  value={pointAdjustment.amount}
                  onChange={(event) =>
                    setPointAdjustment({
                      ...pointAdjustment,
                      amount: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono font-bold text-slate-900"
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  Poin akhir:{' '}
                  <strong className="font-mono text-slate-800">
                    {pointAdjustment.mode === 'add'
                      ? pointAdjustment.customer.points +
                        Math.max(0, Math.floor(pointAdjustment.amount || 0))
                      : Math.max(
                          0,
                          pointAdjustment.customer.points -
                            Math.max(0, Math.floor(pointAdjustment.amount || 0))
                        )}{' '}
                    pts
                  </strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPointAdjustment(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePointAdjustment}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-700"
                >
                  <Save className="h-4 w-4" />
                  <span>Simpan Poin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
