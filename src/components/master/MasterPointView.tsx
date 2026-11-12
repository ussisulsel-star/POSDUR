import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Coins,
  Gift,
  Info,
  Lock,
  Package,
  RotateCcw,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  PointProgramStatus,
  PointSettings,
  Product,
  User as PosUser,
  getPointProgramStatus,
  getProductPointValue,
} from '../../types/pos';
import { isAdmin } from '../../services/accessControl';
import {
  formatRupiah,
  playBeep,
  StorageService,
} from '../../services/storageService';

interface MasterPointViewProps {
  products: Product[];
  currentUser: PosUser;
  pointSettings: PointSettings;
  onUpdatePointSettings: (settings: PointSettings) => void;
}

const STATUS_STYLE: Record<
  PointProgramStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  AKTIF: {
    label: 'Aktif',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    description: 'Poin didapat dan dapat ditukar pada transaksi kasir.',
  },
  BELUM_MULAI: {
    label: 'Belum Dimulai',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    description: 'Program poin sudah diatur, tetapi tanggal mulai belum tiba.',
  },
  BERAKHIR: {
    label: 'Berakhir',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    description: 'Masa berlaku program poin sudah lewat. Poin tidak didapat.',
  },
  NONAKTIF: {
    label: 'Nonaktif',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    description: 'Program poin dimatikan oleh admin.',
  },
};

const formatDateLabel = (value: string) => {
  if (!value) return 'Tanpa batas';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeDraft = (settings: PointSettings): PointSettings => ({
  ...settings,
  productPoints: Object.fromEntries(
    Object.entries(settings.productPoints || {})
      .map(([id, value]) => [id, Math.max(0, Math.floor(Number(value) || 0))])
      .filter(([, value]) => Number(value) > 0)
  ),
});

export const MasterPointView: React.FC<MasterPointViewProps> = ({
  products,
  currentUser,
  pointSettings,
  onUpdatePointSettings,
}) => {
  const canEditPoints = isAdmin(currentUser);
  const [draft, setDraft] = useState<PointSettings>(pointSettings);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [bulkPoints, setBulkPoints] = useState<number>(0);

  useEffect(() => {
    setDraft(pointSettings);
  }, [pointSettings]);

  const status = getPointProgramStatus(draft);
  const statusStyle = STATUS_STYLE[status];

  const valuedProducts = useMemo(
    () =>
      products.filter(
        (product) => getProductPointValue(product.id, draft) > 0
      ).length,
    [products, draft]
  );

  const totalPointsPerUnit = useMemo(
    () =>
      products.reduce(
        (total, product) =>
          total + getProductPointValue(product.id, draft),
        0
      ),
    [products, draft]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.categoryName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const brandOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.brand || 'Tanpa Brand'))
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        product.categoryName === selectedCategory;
      const matchesBrand =
        selectedBrand === 'all' ||
        (product.brand || 'Tanpa Brand') === selectedBrand;

      if (!matchesCategory || !matchesBrand) return false;
      if (!query) return true;

      return (
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        product.barcode.includes(searchQuery) ||
        product.categoryName.toLowerCase().includes(query) ||
        (product.brand && product.brand.toLowerCase().includes(query))
      );
    });
  }, [products, searchQuery, selectedCategory, selectedBrand]);

  const visiblePointsTotal = useMemo(
    () =>
      filteredProducts.reduce(
        (total, product) =>
          total + getProductPointValue(product.id, draft),
        0
      ),
    [filteredProducts, draft]
  );

  const isDirty =
    JSON.stringify(normalizeDraft(draft)) !==
    JSON.stringify(normalizeDraft(pointSettings));

  const updateDraft = (patch: Partial<PointSettings>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  };

  const setProductPoints = (productId: string, value: number) => {
    const points = Math.max(0, Math.floor(Number(value) || 0));
    setDraft((previous) => {
      const productPoints = { ...previous.productPoints };
      if (points > 0) {
        productPoints[productId] = points;
      } else {
        delete productPoints[productId];
      }
      return { ...previous, productPoints };
    });
  };

  const applyBulkPoints = () => {
    if (!canEditPoints) return;
    const points = Math.max(0, Math.floor(Number(bulkPoints) || 0));
    setDraft((previous) => {
      const productPoints = { ...previous.productPoints };
      filteredProducts.forEach((product) => {
        if (points > 0) {
          productPoints[product.id] = points;
        } else {
          delete productPoints[product.id];
        }
      });
      return { ...previous, productPoints };
    });
    playBeep('success');
  };

  const handleSave = () => {
    if (!canEditPoints) {
      playBeep('error');
      alert('Akun Anda tidak memiliki kewenangan mengubah Master Point.');
      return;
    }

    if (
      draft.activeFrom &&
      draft.activeUntil &&
      draft.activeUntil < draft.activeFrom
    ) {
      playBeep('error');
      alert('Tanggal berakhir poin tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    if (draft.redeemValue < 0) {
      playBeep('error');
      alert('Nilai tukar poin tidak boleh negatif.');
      return;
    }

    if (draft.minRedeemPoints < 0) {
      playBeep('error');
      alert('Minimal tukar poin tidak boleh negatif.');
      return;
    }

    if (draft.enabled && draft.redeemValue <= 0) {
      playBeep('error');
      alert(
        'Isi nilai tukar poin (Rupiah per poin) agar tombol Tukar Poin dapat dipakai di kasir.'
      );
      return;
    }

    const saved = StorageService.savePointSettings(draft);
    setDraft(saved);
    onUpdatePointSettings(saved);
    playBeep('success');
    alert('Pengaturan Master Point berhasil disimpan.');
  };

  const handleReset = () => {
    if (!canEditPoints) return;
    if (
      !confirm(
        'Kembalikan pengaturan Master Point ke bawaan? Semua poin per produk akan dikosongkan.'
      )
    ) {
      return;
    }

    const defaults = StorageService.resetPointSettings();
    setDraft(defaults);
    onUpdatePointSettings(defaults);
    setBulkPoints(0);
    playBeep('success');
    alert('Pengaturan Master Point berhasil dikembalikan ke bawaan.');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* Info Program */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-950">
                Master Point & Tukar Poin
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                Atur poin yang didapat untuk setiap item produk, masa aktif poin,
                nilai tukar, dan minimal poin untuk ditukar di kasir.
              </p>
            </div>
          </div>

          {canEditPoints ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-700"
                title="Simpan pengaturan Master Point"
              >
                <Save className="h-3.5 w-3.5" />
                Simpan Pengaturan
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                title="Kembalikan pengaturan poin ke bawaan"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Bawaan
              </button>
            </div>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700">
              <Lock className="h-3.5 w-3.5" />
              Hanya baca (butuh akses ADMIN)
            </span>
          )}
        </div>

        {isDirty && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Ada perubahan yang belum disimpan. Klik Simpan Pengaturan agar
            berlaku di kasir.
          </div>
        )}

        {/* Ringkasan Program */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Status Program
            </p>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${statusStyle.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label}
            </span>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {statusStyle.description}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Package className="h-3.5 w-3.5" />
              Produk Berpoin
            </p>
            <p className="mt-2 font-mono text-2xl font-extrabold text-blue-600">
              {valuedProducts.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              dari {products.length.toLocaleString('id-ID')} produk
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Gift className="h-3.5 w-3.5" />
              Nilai Tukar
            </p>
            <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">
              {formatRupiah(draft.redeemValue)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">per 1 poin</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Coins className="h-3.5 w-3.5" />
              Total Poin / Unit
            </p>
            <p className="mt-2 font-mono text-2xl font-extrabold text-amber-600">
              {totalPointsPerUnit.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Minimal tukar {draft.minRedeemPoints.toLocaleString('id-ID')} poin
            </p>
          </div>
        </div>

        {/* Pengaturan Program */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <CalendarClock className="h-4 w-4 text-blue-500" />
                Pengaturan Program Poin
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Poin hanya didapat dan dapat ditukar selama periode aktif.
              </p>
            </div>

            <button
              type="button"
              onClick={() => canEditPoints && updateDraft({ enabled: !draft.enabled })}
              disabled={!canEditPoints}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                draft.enabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-slate-100 text-slate-500'
              } disabled:cursor-not-allowed disabled:opacity-70`}
              title={draft.enabled ? 'Matikan program poin' : 'Aktifkan program poin'}
            >
              <span
                className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  draft.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    draft.enabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
              {draft.enabled ? 'Program Aktif' : 'Program Nonaktif'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Poin Aktif Mulai
              </label>
              <input
                type="date"
                value={draft.activeFrom}
                onChange={(event) =>
                  updateDraft({ activeFrom: event.target.value })
                }
                disabled={!canEditPoints}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {formatDateLabel(draft.activeFrom)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Poin Berakhir
              </label>
              <input
                type="date"
                value={draft.activeUntil}
                onChange={(event) =>
                  updateDraft({ activeUntil: event.target.value })
                }
                disabled={!canEditPoints}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {formatDateLabel(draft.activeUntil)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Nilai Tukar (Rp / Poin)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.redeemValue}
                onChange={(event) =>
                  updateDraft({ redeemValue: Number(event.target.value) })
                }
                disabled={!canEditPoints}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs font-bold text-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                1 poin = {formatRupiah(draft.redeemValue)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Minimal Tukar Poin
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.minRedeemPoints}
                onChange={(event) =>
                  updateDraft({ minRedeemPoints: Number(event.target.value) })
                }
                disabled={!canEditPoints}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs font-bold text-amber-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Minimal {draft.minRedeemPoints.toLocaleString('id-ID')} poin per
                penukaran
              </p>
            </div>
          </div>

          <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-relaxed">
              Contoh: member memiliki <strong>100 poin</strong> dan nilai tukar{' '}
              <strong>{formatRupiah(draft.redeemValue)}</strong>, maka poin dapat
              ditukar menjadi potongan{' '}
              <strong>{formatRupiah(draft.redeemValue * 100)}</strong> di kasir.
              Poin dipotong dari member setelah pembayaran berhasil.
            </p>
          </div>
        </div>

        {/* Poin per Produk */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Package className="h-4 w-4 text-amber-500" />
                Poin per Item Produk
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Isi poin yang didapat untuk setiap 1 unit produk terjual.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama / kode produk..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 sm:w-56"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none sm:w-40"
                title="Filter berdasarkan kategori produk"
              >
                <option value="all">Semua Kategori</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-blue-400 focus:outline-none sm:w-40"
                title="Filter berdasarkan brand produk"
              >
                <option value="all">Semua Brand</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>

              {(searchQuery.trim() !== '' ||
                selectedCategory !== 'all' ||
                selectedBrand !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedBrand('all');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  title="Tampilkan semua produk kembali"
                >
                  Reset Filter
                </button>
              )}

              {canEditPoints && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={bulkPoints}
                    onChange={(event) => setBulkPoints(Number(event.target.value))}
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center font-mono text-xs font-bold text-amber-600"
                    title="Poin untuk diterapkan ke semua produk yang tampil"
                  />
                  <button
                    type="button"
                    onClick={applyBulkPoints}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                    title="Terapkan poin ke semua produk yang tampil (0 = kosongkan)"
                  >
                    Terapkan
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">Kategori</th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Satuan
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Harga Jual
                  </th>
                  <th className="w-32 px-4 py-2.5 text-center font-semibold">
                    Poin / Unit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-xs text-slate-400"
                    >
                      Tidak ada produk yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}

                {filteredProducts.map((product) => {
                  const points = getProductPointValue(product.id, draft);
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors hover:bg-slate-50 ${
                        points > 0 ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {product.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-400">
                          <span>{product.code}</span>
                          {product.isPackage && (
                            <span className="rounded border border-amber-200 bg-amber-100 px-1 py-0.5 font-bold uppercase text-amber-800">
                              Paket
                            </span>
                          )}
                          {points > 0 && (
                            <span className="rounded bg-emerald-50 px-1 py-0.5 font-bold text-emerald-700">
                              +{points} poin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600">
                        <div>{product.categoryName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {product.brand || 'Tanpa Brand'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[11px] text-slate-600">
                        {product.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700">
                        {formatRupiah(product.sellPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={points}
                          onChange={(event) =>
                            setProductPoints(product.id, Number(event.target.value))
                          }
                          disabled={!canEditPoints}
                          aria-label={`Poin per unit ${product.name}`}
                          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center font-mono text-xs font-bold text-amber-600 focus:border-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan{' '}
              <strong>{filteredProducts.length.toLocaleString('id-ID')}</strong>{' '}
              produk · Total poin yang tampil:{' '}
              <strong className="font-mono text-amber-700">
                {visiblePointsTotal.toLocaleString('id-ID')}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Poin dihitung per unit saat transaksi berhasil
            </span>
          </div>
        </div>

        {/* Cara Kerja */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Info className="h-4 w-4 text-blue-500" />
            Cara Kerja Poin di Kasir
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-[11px] text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">1. Poin didapat</p>
              <p className="mt-1 leading-relaxed">
                Setiap unit produk yang dibeli member menambah poin sesuai
                pengaturan per item, selama program aktif.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">2. Tukar poin</p>
              <p className="mt-1 leading-relaxed">
                Kasir menekan tombol <strong>Tukar Poin</strong> pada keranjang.
                Poin dikonversi menjadi potongan tagihan.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-bold text-slate-800">3. Poin dipotong</p>
              <p className="mt-1 leading-relaxed">
                Poin yang ditukar baru dikurangi dari member setelah pembayaran
                berhasil, bukan saat tombol ditekan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
