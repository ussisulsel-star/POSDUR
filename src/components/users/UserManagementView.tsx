import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  Key, 
  Lock, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  UserCheck, 
  UserX, 
  LogIn, 
  Eye, 
  EyeOff, 
  Phone,
  CheckCircle2,
  AlertCircle,
  Store,
  Building,
  Activity
} from 'lucide-react';
import { User as PosUser, UserPermissions, Outlet } from '../../types/pos';
import { playBeep, StorageService } from '../../services/storageService';
import { isAdmin } from '../../services/accessControl';
import { UserActivityLogView } from '../audit/UserActivityLogView';

interface UserManagementViewProps {
  currentUser: PosUser;
  users: PosUser[];
  outlets: Outlet[];
  onUpdateUsers: (users: PosUser[]) => void;
  onSwitchUser: (user: PosUser) => void;
}

const DEFAULT_PERMISSIONS: Record<PosUser['role'], UserPermissions> = {
  ADMIN: {
    canDiscount: true,
    canVoid: true,
    canReturn: true,
    canOpenDrawer: true,
    canViewReports: true,
    canEditPrice: true,
  },
  SUPERVISOR: {
    canDiscount: true,
    canVoid: true,
    canReturn: true,
    canOpenDrawer: true,
    canViewReports: true,
    canEditPrice: false,
  },
  KASIR: {
    canDiscount: false,
    canVoid: false,
    canReturn: false,
    canOpenDrawer: true,
    canViewReports: false,
    canEditPrice: false,
  },
  GUDANG: {
    canDiscount: false,
    canVoid: false,
    canReturn: false,
    canOpenDrawer: false,
    canViewReports: false,
    canEditPrice: true,
  },
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  users,
  outlets = [],
  onUpdateUsers,
  onSwitchUser,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [editingUser, setEditingUser] = useState<PosUser | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [showPins, setShowPins] = useState<{ [id: string]: boolean }>({});

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;
    const matchesSearch =
      u.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));
    return matchesRole && matchesSearch;
  });

  // KPI stats
  const totalUsers = users.length;
  const totalCashiers = users.filter((u) => u.role === 'KASIR').length;
  const totalSupervisors = users.filter((u) => u.role === 'SUPERVISOR').length;
  const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;

  const handleTogglePinVisibility = (id: string) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleActiveStatus = (user: PosUser) => {
    if (user.id === currentUser.id) {
      alert('Anda tidak dapat menonaktifkan akun yang sedang aktif digunakan.');
      return;
    }

    const updated = users.map((u) =>
      u.id === user.id ? { ...u, isActive: !u.isActive } : u
    );
    playBeep('scan');
    onUpdateUsers(updated);
  };

  const handleDeleteUser = (user: PosUser) => {
    if (user.id === currentUser.id) {
      alert('Anda tidak dapat menghapus akun yang sedang aktif digunakan.');
      return;
    }

    if (confirm(`Yakin ingin menghapus pengguna "${user.name}" (${user.userId})?`)) {
      playBeep('delete');
      const updated = users.filter((u) => u.id !== user.id);
      onUpdateUsers(updated);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editingUser.userId.trim() || !editingUser.name.trim()) {
      alert('User ID dan Nama Pengguna wajib diisi.');
      return;
    }

    if (!editingUser.password?.trim() && !editingUser.pin?.trim()) {
      alert('Password atau PIN akun wajib diisi agar pengguna dapat login dengan kredensialnya sendiri.');
      return;
    }

    // Validation for outlet access
    if (!editingUser.canAccessAllOutlets && (!editingUser.allowedOutletIds || editingUser.allowedOutletIds.length === 0)) {
      alert('Harap pilih minimal 1 outlet cabang yang dapat dibuka oleh pengguna ini.');
      return;
    }

    // If canAccessAllOutlets is checked, ensure all outlet IDs are populated
    const userToSave: PosUser = {
      ...editingUser,
      allowedOutletIds: editingUser.canAccessAllOutlets
        ? outlets.map((o) => o.id)
        : (editingUser.allowedOutletIds || [outlets[0]?.id || 'out-001']),
      outletId: editingUser.outletId || (editingUser.allowedOutletIds?.[0] || outlets[0]?.id || 'out-001'),
    };

    // Akun sendiri tidak boleh mengubah role, permission, atau cakupan outletnya
    // (mencegah eskalasi hak akses mandiri).
    if (!isAddingNew && editingUser.id === currentUser.id) {
      const original = users.find((u) => u.id === currentUser.id);
      if (original) {
        userToSave.role = original.role;
        userToSave.permissions = original.permissions;
        userToSave.canAccessAllOutlets = original.canAccessAllOutlets;
        userToSave.allowedOutletIds = original.allowedOutletIds;
        userToSave.outletId = original.outletId;
        userToSave.isActive = original.isActive;
      }
    }

    // Check duplicate User ID for new users
    if (isAddingNew) {      const duplicate = users.some(
        (u) => u.userId.toLowerCase() === userToSave.userId.trim().toLowerCase()
      );
      if (duplicate) {
        alert(`User ID "${userToSave.userId}" sudah digunakan oleh pengguna lain.`);
        return;
      }

      const updated = [userToSave, ...users];
      playBeep('success');
      onUpdateUsers(updated);
      alert(`Pengguna baru "${userToSave.name}" berhasil didaftarkan!`);
    } else {
      const updated = users.map((u) => (u.id === userToSave.id ? userToSave : u));
      playBeep('success');
      onUpdateUsers(updated);
      alert(`Data pengguna "${userToSave.name}" berhasil diperbarui!`);
    }

    setEditingUser(null);
    setIsAddingNew(false);
  };

  const handleSwitchUserWithAuth = (target: PosUser) => {
    if (!isAdmin(currentUser)) {
      playBeep('error');
      alert('Hanya Administrator yang dapat beralih sesi pengguna.');
      return;
    }

    const credential = prompt(
      `Otorisasi diperlukan untuk beralih ke sesi "${target.name}" (${target.userId}).\nMasukkan PIN atau Password akun tersebut:`
    );
    if (credential === null) return;

    const isAuthorized =
      (!!target.pin && credential === target.pin) ||
      (!!target.password && credential === target.password);

    if (!isAuthorized) {
      playBeep('error');
      alert('PIN/Password akun tujuan salah. Sesi tidak dialihkan.');
      return;
    }

    playBeep('success');
    onSwitchUser(target);
  };

  const handleOpenAddModal = () => {
    const defaultOutlet = outlets[0]?.id || 'out-001';
    const newUser: PosUser = {
      id: 'usr-' + Date.now(),
      companyId: currentUser.companyId || '99999',
      userId: '',
      name: '',
      role: 'KASIR',
      outletId: defaultOutlet,
      canAccessAllOutlets: false,
      allowedOutletIds: [defaultOutlet],
      password: '',
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      phone: '',
      isActive: true,
      lastLogin: new Date().toISOString(),
      permissions: { ...DEFAULT_PERMISSIONS['KASIR'] },
    };
    setEditingUser(newUser);
    setIsAddingNew(true);
  };

  if (!isAdmin(currentUser)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-6 max-w-md text-center space-y-2">
          <h2 className="text-base font-bold text-rose-700">Akses Ditolak</h2>
          <p className="text-xs text-slate-600">
            Hanya Administrator yang dapat mengelola pengguna, role, dan hak akses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto p-4 sm:p-6 select-none">      <div className="max-w-6xl w-full mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Manajemen Pengguna & Kasir</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola akun kasir, supervisor, hak akses otorisasi diskon, void transaksi, dan PIN kasir ID Perusahaan {currentUser.companyId}.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 py-2 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Total Pengguna
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono-numbers mt-1">
              {totalUsers} <span className="text-xs font-normal text-slate-400">Akun</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Kasir Bertugas
            </span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono-numbers mt-1">
              {totalCashiers} <span className="text-xs font-normal text-slate-400">Kasir</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Supervisor / Manajer
            </span>
            <div className="text-xl font-extrabold text-purple-600 font-mono-numbers mt-1">
              {totalSupervisors} <span className="text-xs font-normal text-slate-400">Akun</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Super Admin
            </span>
            <div className="text-xl font-extrabold text-blue-600 font-mono-numbers mt-1">
              {totalAdmins} <span className="text-xs font-normal text-slate-400">Akun</span>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Role Segmented Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto text-xs">
            {['ALL', 'KASIR', 'SUPERVISOR', 'ADMIN', 'GUDANG'].map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRoleFilter(role)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  selectedRoleFilter === role
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {role === 'ALL' ? 'Semua Role' : role}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari User ID, Nama, No HP..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Akses Buka Outlet</th>
                  <th className="py-3 px-3">PIN Cepat Kasir</th>
                  <th className="py-3 px-3">Hak Otorisasi</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const isPinRevealed = showPins[user.id];

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelf ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        {/* User Identity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase font-mono">
                              {user.userId.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                User ID: <strong className="text-slate-700">{user.userId}</strong>
                                {user.phone && ` · ${user.phone}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono tracking-tight ${
                              user.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-800'
                                : user.role === 'SUPERVISOR'
                                ? 'bg-purple-100 text-purple-800'
                                : user.role === 'KASIR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>

                        {/* Allowed Outlets */}
                        <td className="py-3 px-3">
                          {user.canAccessAllOutlets || user.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Store className="w-3 h-3 text-indigo-600" />
                              <span>Semua Cabang ({outlets.length})</span>
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[210px]">
                              {user.allowedOutletIds && user.allowedOutletIds.length > 0 ? (
                                user.allowedOutletIds.map((oId) => {
                                  const o = outlets.find((item) => item.id === oId);
                                  return (
                                    <span
                                      key={oId}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200"
                                      title={o ? `${o.name} (${o.city})` : oId}
                                    >
                                      <Store className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                      <span className="truncate max-w-[120px]">
                                        {o ? o.name.replace(/^(Toko Berkah|DEL USAHA RASA GRUP)\s+/, '') : oId}
                                      </span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  Belum Diatur
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* PIN */}
                        <td className="py-3 px-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 tracking-wider">
                              {isPinRevealed ? user.pin || '----' : '••••'}
                            </span>
                            <button
                              onClick={() => handleTogglePinVisibility(user.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title={isPinRevealed ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                            >
                              {isPinRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* Permissions Tags */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs text-[10px]">
                            {user.permissions?.canDiscount && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                                Diskon
                              </span>
                            )}
                            {user.permissions?.canVoid && (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-medium">
                                Void
                              </span>
                            )}
                            {user.permissions?.canReturn && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                                Retur
                              </span>
                            )}
                            {user.permissions?.canOpenDrawer && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                                Buka Laci
                              </span>
                            )}
                            {user.permissions?.canViewReports && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">
                                Laporan
                              </span>
                            )}
                            {user.permissions?.canEditPrice && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                                Ubah Harga
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleActiveStatus(user)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                              user.isActive !== false
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                            title="Klik untuk ubah status aktif/non-aktif"
                          >
                            {user.isActive !== false ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                <span>Non-Aktif</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Switch user / login as */}
                            {!isSelf && (
                              <button
                                onClick={() => handleSwitchUserWithAuth(user)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Login / Beralih Kasir (perlu PIN akun tujuan)"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditingUser({ ...user });
                                setIsAddingNew(false);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Pengguna"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit / Add User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>{isAddingNew ? 'Tambah Pengguna Kasir Baru' : `Edit Pengguna: ${editingUser.name}`}</span>
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    User ID (Username):
                  </label>
                  <input
                    type="text"
                    value={editingUser.userId}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        userId: e.target.value.toUpperCase().replace(/\s/g, ''),
                      })
                    }
                    placeholder="Contoh: KASIR3"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Peran / Role:
                  </label>
                  <select
                    value={editingUser.role}
                    disabled={editingUser.id === currentUser.id}
                    onChange={(e) => {
                      const newRole = e.target.value as PosUser['role'];
                      setEditingUser({
                        ...editingUser,
                        role: newRole,
                        permissions: { ...DEFAULT_PERMISSIONS[newRole] },
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="KASIR">KASIR (Terminal POS)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Otorisasi & Retur)</option>
                    <option value="ADMIN">ADMIN (Akses Penuh)</option>
                    <option value="GUDANG">STAFF (Kelola Master Data)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Kasir / Petugas:
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="Contoh: Dewi Lestari"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Password Akun:
                  </label>
                  <input
                    type="password"
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="Wajib diisi (atau gunakan PIN)"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIN Cepat Kasir (4 Digit):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={editingUser.pin || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, pin: e.target.value })}
                    placeholder="1234"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-center tracking-widest text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp:
                </label>
                <input
                  type="tel"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  placeholder="0812-3456-7890"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900 focus:outline-none"
                />
              </div>

              {/* Outlet Access Settings */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Store className="w-4 h-4 text-amber-600" />
                      <span>Hak Buka Outlet / Cabang Toko:</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Tentukan outlet mana saja yang dapat dibuka dan diakses oleh kasir ini.
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          ...editingUser,
                          canAccessAllOutlets: true,
                          allowedOutletIds: outlets.map((o) => o.id),
                        })
                      }
                      className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200 transition-colors"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const hq = outlets.find((o) => o.isHQ) || outlets[0];
                        setEditingUser({
                          ...editingUser,
                          canAccessAllOutlets: false,
                          allowedOutletIds: hq ? [hq.id] : [],
                          outletId: hq ? hq.id : editingUser.outletId,
                        });
                      }}
                      className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded border border-slate-200 transition-colors"
                    >
                      Hanya HQ
                    </button>
                  </div>
                </div>

                {/* All Outlets Toggle Card */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.canAccessAllOutlets ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditingUser({
                          ...editingUser,
                          canAccessAllOutlets: checked,
                          allowedOutletIds: checked ? outlets.map((o) => o.id) : (editingUser.allowedOutletIds?.length ? editingUser.allowedOutletIds : [outlets[0]?.id || 'out-001']),
                        });
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-blue-900 block text-xs">
                        Akses Penuh: Buka Semua Outlet / Cabang
                      </span>
                      <span className="text-[10px] text-blue-700">
                        Pengguna dapat membuka sesi kasir di seluruh cabang saat ini maupun cabang baru yang dibuka di masa depan.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Specific Outlets Checkbox Grid */}
                {!editingUser.canAccessAllOutlets && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 block">
                      Pilih Cabang Tertentu yang Diizinkan:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {outlets.map((outlet) => {
                        const isAllowed = editingUser.allowedOutletIds?.includes(outlet.id) ?? false;
                        return (
                          <label
                            key={outlet.id}
                            className={`flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                              isAllowed
                                ? 'bg-white border-blue-300 shadow-2xs text-slate-900'
                                : 'bg-slate-100/50 border-slate-200 text-slate-500 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const current = editingUser.allowedOutletIds || [];
                                let next: string[];
                                if (checked) {
                                  next = [...current, outlet.id];
                                } else {
                                  next = current.filter((id) => id !== outlet.id);
                                }
                                setEditingUser({
                                  ...editingUser,
                                  allowedOutletIds: next,
                                  outletId: next.includes(editingUser.outletId || '') ? editingUser.outletId : (next[0] || ''),
                                });
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 font-bold text-xs">
                                <span className="truncate">{outlet.name}</span>
                                {outlet.brand && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0">
                                    {outlet.brand}
                                  </span>
                                )}
                                {outlet.isHQ && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-mono px-1 py-0.2 rounded shrink-0 font-bold">
                                    HQ
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {outlet.code} · {outlet.city}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary Default Outlet Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Cabang Utama / Default Saat Login:
                  </label>
                  <select
                    value={editingUser.outletId || outlets[0]?.id}
                    onChange={(e) => setEditingUser({ ...editingUser, outletId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    {outlets
                      .filter((o) => editingUser.canAccessAllOutlets || editingUser.allowedOutletIds?.includes(o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.city}) {o.isHQ ? '- Kantor Pusat' : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Permissions Checkbox Matrix */}
              <div className="pt-2 border-t border-slate-200">
                <span className="block font-bold text-slate-800 mb-2">
                  Hak Akses & Otorisasi Transaksi (Permissions):
                </span>
                {editingUser.id === currentUser.id && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
                    Role dan kewenangan akun yang sedang aktif tidak dapat diubah sendiri.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canDiscount ?? false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canDiscount: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Input Diskon Khusus Faktur</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canVoid ?? false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canVoid: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Void / Batalkan Transaksi</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canReturn ?? false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canReturn: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Proses Retur Penjualan</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canOpenDrawer ?? true}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canOpenDrawer: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Buka Laci Kas Manual</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canViewReports ?? false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canViewReports: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Akses Laporan Omset & Finansial</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.permissions?.canEditPrice ?? false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          permissions: {
                            ...editingUser.permissions!,
                            canEditPrice: e.target.checked,
                          },
                        })
                      }
                      disabled={editingUser.id === currentUser.id}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Ubah Master Harga Produk</span>
                  </label>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive !== false}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, isActive: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">Status Akun Aktif (Dapat Login)</span>
                </label>
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
