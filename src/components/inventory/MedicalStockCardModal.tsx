import React, { useState, useEffect, useMemo } from 'react';
import { StockMovement, StockMovementType } from '../../types';
import { getStockMovements } from '../../services/medicalInventoryService';
import {
  Pill,
  X,
  PackagePlus,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  User,
  Calendar,
  Layers,
} from 'lucide-react';

export interface MedicalStockCardModalProps {
  item: {
    vitaminId: string;
    vitaminName: string;
    category?: string;
    dosageUnit: string;
    description?: string;
    currentStock: number;
    minStockThreshold: number;
    locationName?: string;
  };
  isSuperAdmin: boolean;
  allLocations?: string[];
  onClose: () => void;
  onOpenRestock: (vitaminId: string, locationName?: string) => void;
  onOpenAdjust: (vitaminId: string, locationName?: string, currentStock?: number) => void;
  onRefreshData?: () => Promise<void>;
}

export const MedicalStockCardModal: React.FC<MedicalStockCardModalProps> = ({
  item,
  isSuperAdmin,
  onClose,
  onOpenRestock,
  onOpenAdjust,
  onRefreshData,
}) => {
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | StockMovementType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Load movements for this specific vitamin
  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const data = await getStockMovements(undefined, item.vitaminId);
      setMovements(data);
    } catch (err) {
      console.error('Failed to load movements for vitamin:', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [item.vitaminId]);

  // Calculations for KPI cards
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalAdjustments = 0;

    movements.forEach((m) => {
      if (m.movementType === 'IN') {
        totalIn += m.quantity;
      } else if (m.movementType === 'OUT') {
        totalOut += m.quantity;
      } else if (m.movementType === 'ADJUSTMENT') {
        totalAdjustments += 1;
      }
    });

    return { totalIn, totalOut, totalAdjustments, totalTransactions: movements.length };
  }, [movements]);

  // Filtered movements for table
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (m.referenceId || '').toLowerCase().includes(q) ||
        (m.driverName || '').toLowerCase().includes(q) ||
        (m.driverId || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        (m.performedByName || '').toLowerCase().includes(q) ||
        (m.locationName || '').toLowerCase().includes(q);

      return matchesType && matchesSearch;
    });
  }, [movements, typeFilter, searchQuery]);

  // Overall stock status
  let stockStatus: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
  if (item.currentStock <= 0) stockStatus = 'OUT';
  else if (item.currentStock <= item.minStockThreshold) stockStatus = 'LOW';

  // Handle Print Kartu Stok
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="modal-stock-card-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="modal-stock-card-container"
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95"
      >
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 md:p-6 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
              <Pill className="w-6 h-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-blue-300 bg-blue-900/60 border border-blue-700/50 px-2 py-0.5 rounded">
                  {item.vitaminId}
                </span>

                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-200">
                  {item.category || 'Suplemen & Obat'}
                </span>

                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700/70 text-slate-300">
                  Sediaan: {item.dosageUnit}
                </span>

                {stockStatus === 'OUT' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <XCircle className="w-3.5 h-3.5" /> Stok Habis
                  </span>
                ) : stockStatus === 'LOW' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> Stok Menipis
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Stok Aman
                  </span>
                )}
              </div>

              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {item.vitaminName}
              </h2>

              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {item.description || 'Suplemen pemulihan fisik & stamina driver operasional TENKO.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-print-stock-card"
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold print:hidden"
              title="Cetak Kartu Stok"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              id="btn-close-stock-card-modal"
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Saldo Stok Fisik */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Saldo Stok Fisik
              </span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className={`text-2xl md:text-3xl font-black ${
                    stockStatus === 'OUT'
                      ? 'text-rose-600'
                      : stockStatus === 'LOW'
                      ? 'text-amber-600'
                      : 'text-slate-900'
                  }`}
                >
                  {item.currentStock.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400">{item.dosageUnit}</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Tersedia di inventori
              </span>
            </div>

            {/* Batas Minimum Buffer */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Batas Minimum (Buffer)
              </span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-black text-slate-800">
                  {item.minStockThreshold}
                </span>
                <span className="text-xs font-bold text-slate-400">{item.dosageUnit}</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Pemicu peringatan restock
              </span>
            </div>

            {/* Total Masuk / Dropping */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Total Masuk (+)
                </span>
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-black text-emerald-600">
                  +{stats.totalIn.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-emerald-600/70">{item.dosageUnit}</span>
              </div>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                Dari dropping farmasi
              </span>
            </div>

            {/* Total Keluar / TENKO */}
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs bg-blue-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                  Total Keluar (-)
                </span>
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-black text-blue-600">
                  -{stats.totalOut.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-blue-600/70">{item.dosageUnit}</span>
              </div>
              <span className="text-[11px] text-blue-700 mt-1 block">
                Dispensing medis TENKO
              </span>
            </div>
          </div>

          {/* STOCK CARD / MUTATION HISTORY TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Table Header & Controls */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Buku Kartu Stok Fisik — {item.vitaminName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                    {filteredMovements.length} Mutasi
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Catatan historis seluruh aliran masuk dropping dan keluar dispensing Tenko untuk sediaan ini.
                </p>
              </div>

              {/* Filters within Modal */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search in stock card */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari ref, driver, petugas..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 w-48"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="IN">🟢 Masuk (+)</option>
                  <option value="OUT">🔵 Keluar (-)</option>
                  <option value="ADJUSTMENT">⚪ Opname Fisik</option>
                </select>

                <button
                  type="button"
                  onClick={fetchMovements}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                  title="Muat Ulang Riwayat"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMovements ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* MUTATION RECORDS TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">No</th>
                    <th className="py-3 px-4">Tanggal & Jam</th>
                    <th className="py-3 px-4">Jenis Mutasi</th>
                    <th className="py-3 px-4 text-center">Mutasi (+/-)</th>
                    <th className="py-3 px-4 text-center">Saldo Akhir</th>
                    <th className="py-3 px-4">Dokumen / Driver</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Petugas</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                        <span>Memuat buku mutasi kartu stok...</span>
                      </td>
                    </tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Belum ada catatan mutasi stok untuk obat ini pada filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov, idx) => {
                      const isIncoming = mov.movementType === 'IN';
                      const isOutgoing = mov.movementType === 'OUT';

                      return (
                        <tr key={mov.movementId || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-slate-400 font-bold text-center">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {mov.timestamp
                              ? new Date(mov.timestamp).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {isIncoming ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                                Restock Masuk (+)
                              </span>
                            ) : isOutgoing ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                <ArrowUpRight className="w-3 h-3 text-blue-600" />
                                Keluar TENKO (-)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                                <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                                Opname Fisik
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`font-black text-xs ${
                                isIncoming
                                  ? 'text-emerald-600 font-mono'
                                  : isOutgoing
                                  ? 'text-blue-600 font-mono'
                                  : 'text-slate-700 font-mono'
                              }`}
                            >
                              {isIncoming ? `+${mov.quantity}` : isOutgoing ? `-${mov.quantity}` : `${mov.quantity}`}
                            </span>{' '}
                            <span className="text-[10px] text-slate-400 font-semibold">{mov.dosageUnit}</span>
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-slate-900 whitespace-nowrap">
                            <span className="font-mono text-xs">{mov.finalStock}</span>{' '}
                            <span className="text-[10px] text-slate-400 font-normal">{mov.dosageUnit}</span>
                          </td>

                          <td className="py-3 px-4">
                            {mov.referenceId && (
                              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-block mb-0.5 border border-blue-100">
                                {mov.referenceId}
                              </span>
                            )}
                            {mov.driverName && (
                              <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{mov.driverName}</span>
                                {mov.driverId && <span className="text-slate-400 font-mono text-[10px]">({mov.driverId})</span>}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs">
                            {mov.notes || '-'}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                            {mov.performedByName || mov.performedBy || 'Petugas Medis'}
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

        {/* MODAL FOOTER WITH ACTIONS */}
        <div className="p-4 md:p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Kartu stok resmi terstandarisasi SOP Distribusi Farmasi TENKO.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenRestock(item.vitaminId)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Restock Obat Ini (+)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenAdjust(
                  item.vitaminId,
                  undefined,
                  item.currentStock
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Sesuaikan Stok Fisik</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
