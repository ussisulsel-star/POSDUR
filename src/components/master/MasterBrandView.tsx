import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit3,
  Palette,
  Plus,
  Search,
  Sparkles,
  Store,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import {
  Brand,
  BrandColorKey,
  BRAND_COLOR_PRESETS,
  DEFAULT_BRANDS,
  Outlet,
  Product,
  User as PosUser,
  toBrandConfig,
} from '../../types/pos';
import { isAdmin } from '../../services/accessControl';
import { playBeep } from '../../services/storageService';

interface MasterBrandViewProps {
  brands: Brand[];
  products: Product[];
  outlets: Outlet[];
  currentUser: PosUser;
  onUpdateBrands: (brands: Brand[]) => void;
}

interface BrandDraft {
  id?: string;
  name: string;
  tagline: string;
  emoji: string;
  colorKey: BrandColorKey;
  createdAt?: string;
}

const COLOR_KEYS = Object.keys(BRAND_COLOR_PRESETS) as BrandColorKey[];

const EMOJI_PRESETS = [
  '🥭',
  '🍧',
  '🍩',
  '🐨',
  '☕',
  '🧋',
  '🍰',
  '🍜',
  '🍗',
  '🥤',
  '🍪',
  '🍦',
  '🏷️',
];

const emptyDraft = (): BrandDraft => ({
  name: '',
  tagline: '',
  emoji: '🏷️',
  colorKey: 'blue',
});

export const MasterBrandView: React.FC<MasterBrandViewProps> = ({
  brands,
  products,
  outlets,
  currentUser,
  onUpdateBrands,
}) => {
  const canEditBrands = isAdmin(currentUser);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draft, setDraft] = useState<BrandDraft | null>(null);

  const isAdding = Boolean(draft && !draft.id);

  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return brands;
    return brands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(query) ||
        brand.tagline.toLowerCase().includes(query)
    );
  }, [brands, searchQuery]);

  const totalOutlets = brands.reduce(
    (total, brand) => total + outlets.filter((o) => o.brand === brand.name).length,
    0
  );
  const totalProducts = brands.reduce(
    (total, brand) => total + products.filter((p) => p.brand === brand.name).length,
    0
  );

  const openAddModal = () => {
    if (!canEditBrands) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk menambah brand.');
      return;
    }
    setDraft(emptyDraft());
  };

  const openEditModal = (brand: Brand) => {
    if (!canEditBrands) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk mengubah brand.');
      return;
    }
    setDraft({
      id: brand.id,
      name: brand.name,
      tagline: brand.tagline,
      emoji: brand.emoji,
      colorKey: brand.colorKey,
      createdAt: brand.createdAt,
    });
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    const name = draft.name.trim();
    const tagline = draft.tagline.trim();
    const emoji = draft.emoji.trim() || '🏷️';

    if (!name) {
      playBeep('error');
      alert('Nama brand wajib diisi.');
      return;
    }
    if (!tagline) {
      playBeep('error');
      alert('Tagline brand wajib diisi.');
      return;
    }

    const duplicate = brands.find(
      (brand) =>
        brand.id !== draft.id &&
        brand.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      playBeep('error');
      alert(`Nama brand "${name}" sudah digunakan.`);
      return;
    }

    if (draft.id) {
      const existing = brands.find((brand) => brand.id === draft.id);
      if (!existing) {
        playBeep('error');
        alert('Brand yang ingin diubah tidak ditemukan.');
        return;
      }
      const updated = brands.map((brand) =>
        brand.id === draft.id
          ? {
              ...brand,
              tagline,
              emoji,
              colorKey: draft.colorKey,
            }
          : brand
      );
      onUpdateBrands(updated);
      playBeep('success');
      alert(`Brand "${name}" berhasil diperbarui!`);
    } else {
      const newBrand: Brand = {
        id: `brand-${Date.now()}`,
        name,
        tagline,
        emoji,
        colorKey: draft.colorKey,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      onUpdateBrands([...brands, newBrand]);
      playBeep('success');
      alert(`Brand "${name}" berhasil ditambahkan!`);
    }

    setDraft(null);
  };

  const handleDelete = (brand: Brand) => {
    if (!canEditBrands) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan untuk menghapus brand.');
      return;
    }
    if (brands.length <= 1) {
      playBeep('error');
      alert('Brand terakhir tidak dapat dihapus. Minimal harus ada satu brand.');
      return;
    }

    const usedOutlets = outlets.filter((o) => o.brand === brand.name).length;
    const usedProducts = products.filter((p) => p.brand === brand.name).length;
    if (usedOutlets > 0 || usedProducts > 0) {
      playBeep('error');
      const details = [
        usedOutlets > 0 ? `${usedOutlets} cabang` : null,
        usedProducts > 0 ? `${usedProducts} produk` : null,
      ]
        .filter(Boolean)
        .join(' dan ');
      alert(
        `Brand "${brand.name}" masih dipakai oleh ${details}. Pindahkan data tersebut ke brand lain sebelum menghapus.`
      );
      return;
    }

    if (
      !confirm(
        `Hapus brand "${brand.name}"? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    onUpdateBrands(brands.filter((item) => item.id !== brand.id));
    playBeep('delete');
  };

  const resetBrands = () => {
    if (!canEditBrands) return;
    if (
      !confirm(
        'Kembalikan daftar brand ke 4 brand bawaan? Brand tambahan akan dihapus.'
      )
    ) {
      return;
    }
    onUpdateBrands(DEFAULT_BRANDS.map((brand) => ({ ...brand })));
    playBeep('success');
  };

  const draftPreview = draft
    ? toBrandConfig({
        ...draft,
        id: draft.id ?? 'preview',
        isActive: true,
        createdAt: draft.createdAt ?? new Date().toISOString(),
      })
    : null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Ringkasan */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total Brand
              </p>
              <p className="text-xl font-extrabold text-slate-900">{brands.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Cabang Terhubung
              </p>
              <p className="text-xl font-extrabold text-slate-900">{totalOutlets}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Produk Terhubung
              </p>
              <p className="text-xl font-extrabold text-slate-900">{totalProducts}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari nama atau tagline brand..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              Menampilkan <strong className="text-slate-800">{filteredBrands.length}</strong>{' '}
              dari {brands.length} brand
            </span>
            {canEditBrands ? (
              <>
                <button
                  type="button"
                  onClick={resetBrands}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  title="Kembalikan brand ke daftar bawaan"
                >
                  Reset Brand
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 hover:shadow"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Brand Baru</span>
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                Hanya baca (butuh akses ADMIN)
              </span>
            )}
          </div>
        </div>

        {/* Daftar Brand */}
        {filteredBrands.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Tags className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">
              {brands.length === 0 ? 'Belum ada brand' : 'Brand tidak ditemukan'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {brands.length === 0
                ? 'Tambahkan brand pertama untuk mulai menghubungkan cabang dan produk.'
                : 'Coba kata kunci lain atau kosongkan pencarian.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBrands.map((brand) => {
              const cfg = toBrandConfig(brand);
              const outletCount = outlets.filter((o) => o.brand === brand.name).length;
              const productCount = products.filter((p) => p.brand === brand.name).length;

              return (
                <div
                  key={brand.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner ${cfg.iconBg}`}
                        >
                          {cfg.emoji}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-extrabold text-slate-900">
                            {brand.name}
                          </h3>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                          >
                            Brand
                          </span>
                        </div>
                      </div>

                      {canEditBrands && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(brand)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title={`Edit brand ${brand.name}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(brand)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title={`Hapus brand ${brand.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="mt-3 min-h-8 text-xs leading-relaxed text-slate-500">
                      {brand.tagline || 'Belum ada tagline.'}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                      <Store className="h-3.5 w-3.5 text-emerald-500" />
                      <strong className="font-mono text-slate-900">{outletCount}</strong>
                      <span>cabang</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                      <Tags className="h-3.5 w-3.5 text-blue-500" />
                      <strong className="font-mono text-slate-900">{productCount}</strong>
                      <span>produk</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT BRAND */}
      {draft && draftPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="animate-fadeIn w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-teal-400" />
                <h3 className="text-sm font-bold">
                  {isAdding ? 'Tambah Brand Baru' : `Edit Brand: ${draft.name}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-slate-400 transition-colors hover:text-white"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <Palette className="h-3.5 w-3.5" />
                  Pratinjau Identitas
                </p>
                <span
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-extrabold shadow-2xs ${draftPreview.badgeBg} ${draftPreview.badgeText} ${draftPreview.badgeBorder}`}
                >
                  <span className="text-base">{draftPreview.emoji}</span>
                  <span>{draftPreview.name || 'Nama Brand'}</span>
                </span>
                <p className="mt-2 text-[11px] text-slate-500">
                  {draftPreview.tagline || 'Tagline brand akan tampil di sini.'}
                </p>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nama Brand:
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  disabled={!isAdding}
                  placeholder="Contoh: Kopi Senja"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 font-bold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
                {!isAdding && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Nama brand tidak dapat diubah agar referensi cabang dan produk
                    tetap valid.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tagline / Deskripsi Singkat:
                </label>
                <input
                  type="text"
                  value={draft.tagline}
                  onChange={(event) =>
                    setDraft({ ...draft, tagline: event.target.value })
                  }
                  placeholder="Contoh: Kopi & Manual Brew Kekinian"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_1fr]">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Emoji:
                  </label>
                  <input
                    type="text"
                    value={draft.emoji}
                    onChange={(event) =>
                      setDraft({ ...draft, emoji: event.target.value })
                    }
                    maxLength={4}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-center text-lg"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Pilihan Cepat Emoji:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setDraft({ ...draft, emoji })}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-colors ${
                          draft.emoji === emoji
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Warna Brand:
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_KEYS.map((colorKey) => {
                    const preset = BRAND_COLOR_PRESETS[colorKey];
                    const isSelected = draft.colorKey === colorKey;
                    return (
                      <button
                        key={colorKey}
                        type="button"
                        onClick={() => setDraft({ ...draft, colorKey })}
                        className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition-all ${preset.iconBg} ${
                          isSelected
                            ? 'ring-2 ring-blue-600'
                            : 'hover:scale-110'
                        }`}
                        title={`Warna ${colorKey}`}
                      >
                        {isSelected && (
                          <span className="text-xs font-bold text-white">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isAdding ? 'Simpan Brand' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
