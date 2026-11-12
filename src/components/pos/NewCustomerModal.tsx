import React, { useState } from 'react';
import { X, UserPlus, CheckCircle } from 'lucide-react';
import { Customer } from '../../types/pos';
import { playBeep } from '../../services/storageService';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customer: Customer) => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onAddCustomer,
}) => {
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [tier, setTier] = useState<'MEMBER_SILVER' | 'MEMBER_GOLD' | 'GROSIR'>('MEMBER_SILVER');
  const [address, setAddress] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let discountPercent = 2;
    if (tier === 'MEMBER_GOLD') discountPercent = 5;
    if (tier === 'GROSIR') discountPercent = 8;

    const newCust: Customer = {
      id: 'cust-' + Date.now(),
      code: 'PLG-' + Math.floor(1000 + Math.random() * 9000),
      name: name.trim(),
      phone: phone.trim() || '-',
      tier,
      discountPercent,
      points: 50, // Welcome points
      address: address.trim() || '-',
    };

    playBeep('success');
    onAddCustomer(newCust);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold">Daftar Member / Pelanggan Baru</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Hendra Gunawan"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nomor HP / WhatsApp:</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tingkat Member (Tier):</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as 'MEMBER_SILVER' | 'MEMBER_GOLD' | 'GROSIR')}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none"
            >
              <option value="MEMBER_SILVER">Member Silver (Diskon 2% + Poin)</option>
              <option value="MEMBER_GOLD">Member Gold (Diskon 5% + Poin)</option>
              <option value="GROSIR">Mitra Toko / Grosir (Diskon 8% / Harga Grosir)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat (Opsional):</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Sukamaju No. 10..."
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Daftarkan & Pilih Member</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
