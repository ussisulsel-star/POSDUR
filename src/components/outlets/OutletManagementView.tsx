import React, { useState } from 'react';
import { 
  Building, 
  MapPin, 
  Phone, 
  Plus, 
  CheckCircle2, 
  Edit3, 
  Search, 
  Store,
  Clock,
  UserCheck,
  ShieldCheck,
  Check,
  Sparkles,
  Tag
} from 'lucide-react';
import { 
  Outlet, 
  BrandName, 
  BRAND_CONFIGS, 
  AVAILABLE_BRANDS, 
  getBrandConfig 
} from '../../types/pos';
export { BRAND_CONFIGS, AVAILABLE_BRANDS, getBrandConfig };
import { playBeep } from '../../services/storageService';

interface OutletManagementViewProps {
  outlets: Outlet[];
  activeOutlet: Outlet;
  onSelectActiveOutlet: (outlet: Outlet) => void;
  onUpdateOutlets: (outlets: Outlet[]) => void;
}

export const OutletManagementView: React.FC<OutletManagementViewProps> = ({
  outlets,
  activeOutlet,
  onSelectActiveOutlet,
  onUpdateOutlets,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'table'>('cards');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Filtered outlets
  const filteredOutlets = outlets.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.brand && o.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesBrand =
      selectedBrandFilter === 'ALL' || o.brand === selectedBrandFilter;

    return matchesSearch && matchesBrand;
  });

  const handleSaveOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutlet) return;

    if (!editingOutlet.name.trim() || !editingOutlet.code.trim()) {
      alert('Kode dan Nama Cabang wajib diisi.');
      return;
    }

    if (isAddingNew) {
      const updated = [...outlets, editingOutlet];
      onUpdateOutlets(updated);
      alert(`Cabang "${editingOutlet.name}" berhasil didaftarkan!`);
    } else {
      const updated = outlets.map((o) => (o.id === editingOutlet.id ? editingOutlet : o));
      onUpdateOutlets(updated);
      alert(`Informasi cabang "${editingOutlet.name}" berhasil diperbarui!`);
    }

    setEditingOutlet(null);
    setIsAddingNew(false);
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Header & Subtabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                <Store className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Manajemen Multi-Outlet & Cabang</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data cabang retail, outlet aktif kasir, dan struktur operasional multi-cabang perusahaan.
            </p>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setActiveSubTab('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'cards'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Kartu Cabang ({outlets.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'table'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Tabel Direktori Outlet</span>
            </button>
          </div>
        </div>

        {/* Brand Filter Pills Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Identitas Brand Cabang (4 Brand):</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Filter cabang berdasarkan brand produk yang dijual
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedBrandFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedBrandFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Brand ({outlets.length})
            </button>

            {AVAILABLE_BRANDS.map((brandName) => {
              const cfg = BRAND_CONFIGS[brandName];
              const count = outlets.filter((o) => o.brand === brandName).length;
              const isSelected = selectedBrandFilter === brandName;

              return (
                <button
                  key={brandName}
                  type="button"
                  onClick={() => setSelectedBrandFilter(brandName)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} shadow-xs ring-2 ring-blue-500/30`
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-sm">{cfg.emoji}</span>
                  <span>{brandName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/90 font-bold' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama cabang, brand, kota, kode outlet..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => {
              const newO: Outlet = {
                id: 'out-' + Date.now(),
                code: 'CAB-00' + (outlets.length + 1),
                name: '',
                brand: 'Del Mango',
                address: '',
                phone: '',
                city: 'Jakarta',
                isHQ: false,
                isActive: true,
              };
              setEditingOutlet(newO);
              setIsAddingNew(true);
            }}
            className="flex items-center gap-1.5 py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cabang Baru</span>
          </button>
        </div>

        {/* SUBTAB 1: KARTU CABANG */}
        {activeSubTab === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOutlets.map((outlet) => {
              const isActive = activeOutlet.id === outlet.id;
              const brandCfg = getBrandConfig(outlet.brand);

              return (
                <div
                  key={outlet.id}
                  className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                    isActive
                      ? 'border-blue-600 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div>
                    {/* Brand Identity Header Strip */}
                    <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold border ${brandCfg.badgeBg} ${brandCfg.badgeText} ${brandCfg.badgeBorder} shadow-2xs`}>
                          <span className="text-base">{brandCfg.emoji}</span>
                          <span>{brandCfg.name}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                          · {brandCfg.tagline}
                        </span>
                      </div>

                      {outlet.isMall ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-800 border border-amber-300 flex items-center gap-1">
                          🏬 OUTLET MALL
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Outlet Reguler
                        </span>
                      )}
                    </div>

                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{outlet.name}</h3>
                          {outlet.isHQ && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              KANTOR PUSAT (HQ)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {outlet.code}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {outlet.city}
                          </span>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Outlet Aktif Kasir
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            playBeep('success');
                            onSelectActiveOutlet(outlet);
                          }}
                          className="text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Pilih Cabang Ini
                        </button>
                      )}
                    </div>

                    {/* Address & Contact info */}
                    <div className="space-y-1.5 text-xs text-slate-600 my-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{outlet.address || 'Alamat cabang belum diisi'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{outlet.phone || 'No. telepon belum diisi'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Jam Buka: 08:00 - 22:00 WIB</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Sistem POS Online & Tersinkron</span>
                    </div>

                    <button
                      onClick={() => {
                        setEditingOutlet(outlet);
                        setIsAddingNew(false);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-600 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Data Cabang</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUBTAB 2: TABEL DIREKTORI OUTLET */}
        {activeSubTab === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Kode Cabang</th>
                    <th className="py-3 px-4">Identitas Brand</th>
                    <th className="py-3 px-4">Nama Outlet</th>
                    <th className="py-3 px-4">Tipe Outlet</th>
                    <th className="py-3 px-4">Kota</th>
                    <th className="py-3 px-4">Alamat</th>
                    <th className="py-3 px-4">No. Telepon</th>
                    <th className="py-3 px-4 text-center">Status Terminal</th>
                    <th className="py-3 px-4 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOutlets.map((outlet) => {
                    const isActive = activeOutlet.id === outlet.id;
                    const brandCfg = getBrandConfig(outlet.brand);

                    return (
                      <tr key={outlet.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {outlet.code}
                        </td>
                        {/* Kolom Identitas Brand */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold border ${brandCfg.badgeBg} ${brandCfg.badgeText} ${brandCfg.badgeBorder} shadow-2xs`}>
                            <span className="text-sm">{brandCfg.emoji}</span>
                            <span>{brandCfg.name}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {outlet.name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {outlet.isHQ && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Kantor Pusat (HQ)
                              </span>
                            )}
                            {outlet.isMall ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                                🏬 Outlet Mall (Harga Mall)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Outlet Reguler (Luar Mall)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {outlet.city}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {outlet.address}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {outlet.phone}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              Aktif Sekarang
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                playBeep('success');
                                onSelectActiveOutlet(outlet);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                            >
                              Ganti ke Ini
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setEditingOutlet(outlet);
                              setIsAddingNew(false);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Outlet"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL EDIT / TAMBAH OUTLET */}
        {editingOutlet && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    {isAddingNew ? 'Tambah Cabang Baru' : `Edit Cabang: ${editingOutlet.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingOutlet(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveOutlet} className="p-5 space-y-3.5 text-xs">
                {/* Pilihan Identitas Brand */}
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                  <label className="block font-bold text-amber-950 mb-1 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Identitas Brand Cabang (4 Brand):</span>
                  </label>
                  <select
                    value={editingOutlet.brand || 'Del Mango'}
                    onChange={(e) =>
                      setEditingOutlet({ ...editingOutlet, brand: e.target.value as BrandName })
                    }
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  >
                    {AVAILABLE_BRANDS.map((b) => {
                      const cfg = BRAND_CONFIGS[b];
                      return (
                        <option key={b} value={b}>
                          {cfg.emoji} {b} — {cfg.tagline}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[11px] text-amber-800 block mt-1">
                    Setiap cabang menjual barang dari brand tertentu: <strong>Del Mango</strong>, <strong>Es Teler Pattiro</strong>, <strong>Donat Halus</strong>, atau <strong>Es Tes Koala</strong>.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kode Cabang:</label>
                    <input
                      type="text"
                      value={editingOutlet.code}
                      onChange={(e) =>
                        setEditingOutlet({ ...editingOutlet, code: e.target.value.toUpperCase() })
                      }
                      placeholder="Contoh: JKT-03"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kota Cabang:</label>
                    <input
                      type="text"
                      value={editingOutlet.city}
                      onChange={(e) =>
                        setEditingOutlet({ ...editingOutlet, city: e.target.value })
                      }
                      placeholder="Contoh: Jakarta"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Outlet / Cabang:</label>
                  <input
                    type="text"
                    value={editingOutlet.name}
                    onChange={(e) =>
                      setEditingOutlet({ ...editingOutlet, name: e.target.value })
                    }
                    placeholder="Contoh: Cabang Pondok Indah Mall"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap:</label>
                  <textarea
                    rows={2}
                    value={editingOutlet.address}
                    onChange={(e) =>
                      setEditingOutlet({ ...editingOutlet, address: e.target.value })
                    }
                    placeholder="Alamat detail lokasi cabang..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Telepon / Hotline:</label>
                  <input
                    type="text"
                    value={editingOutlet.phone}
                    onChange={(e) =>
                      setEditingOutlet({ ...editingOutlet, phone: e.target.value })
                    }
                    placeholder="021-xxxxxxx atau 08xxxxxxxx"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div className="pt-2 space-y-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingOutlet.isHQ}
                      onChange={(e) =>
                        setEditingOutlet({ ...editingOutlet, isHQ: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">Tetapkan sebagai Kantor Pusat (HQ)</span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <input
                      type="checkbox"
                      checked={editingOutlet.isMall || false}
                      onChange={(e) =>
                        setEditingOutlet({ ...editingOutlet, isMall: e.target.checked })
                      }
                      className="w-4 h-4 text-amber-600 rounded cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-amber-900 block text-xs">
                        🏬 Outlet Berlokasi di Mall (Gunakan Harga Jual Mall)
                      </span>
                      <span className="text-[11px] text-amber-700 block mt-0.5">
                        Centang ini jika cabang berada di mall. Transaksi kasir di cabang ini otomatis mengenakan <strong>Harga Jual Mall</strong> yang diset pada produk.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingOutlet(null)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Data Cabang</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
