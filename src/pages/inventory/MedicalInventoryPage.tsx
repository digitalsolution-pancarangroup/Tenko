import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  PoolInventoryItem,
  StockMovement,
  VitaminMasterWithStock,
  VitaminItem,
} from '../../types';
import {
  getPoolInventory,
  getAllVitaminsWithStock,
  getStockMovements,
  restockPoolInventory,
  adjustPoolInventory,
  updateMinStockThreshold,
} from '../../services/medicalInventoryService';
import { getLocations } from '../../services/masterService';
import { createVitamin, getVitamins } from '../../services/healthService';
import { MedicalStockCardModal } from '../../components/inventory/MedicalStockCardModal';
import {
  Pill,
  PackagePlus,
  History,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  X,
  FileText,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const MedicalInventoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Determine active pool for Nakes vs Super Admin
  const defaultNakesPool = currentUser?.locationId || currentUser?.locationName || 'Pool Marunda - Jakarta Utara';
  const [selectedPoolFilter, setSelectedPoolFilter] = useState<string>(isSuperAdmin ? 'ALL' : defaultNakesPool);

  const [loading, setLoading] = useState(true);
  const [poolInventories, setPoolInventories] = useState<PoolInventoryItem[]>([]);
  const [accumulatedVitamins, setAccumulatedVitamins] = useState<VitaminMasterWithStock[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT'>('ALL');

  // Modal states
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAddVitaminModalOpen, setIsAddVitaminModalOpen] = useState(false);
  const [selectedItemForStockCard, setSelectedItemForStockCard] = useState<{
    vitaminId: string;
    vitaminName: string;
    category?: string;
    dosageUnit: string;
    description?: string;
    currentStock: number;
    minStockThreshold: number;
    locationName: string;
    poolBreakdown?: {
      locationName: string;
      stock: number;
      minThreshold: number;
      status: 'SAFE' | 'LOW' | 'OUT';
    }[];
  } | null>(null);

  // Quick action openers for modal
  const handleOpenRestockForVit = (vitaminId: string, pool?: string) => {
    setRestockVitaminId(vitaminId);
    if (pool) {
      setRestockPool(pool);
    } else {
      setRestockPool(isSuperAdmin && selectedPoolFilter !== 'ALL' ? selectedPoolFilter : defaultNakesPool);
    }
    setIsRestockModalOpen(true);
  };

  const handleOpenAdjustForVit = (vitaminId: string, pool?: string, stock?: number) => {
    setAdjustVitaminId(vitaminId);
    if (pool) {
      setAdjustPool(pool);
    } else {
      setAdjustPool(isSuperAdmin && selectedPoolFilter !== 'ALL' ? selectedPoolFilter : defaultNakesPool);
    }
    if (typeof stock === 'number') {
      setAdjustTargetStock(stock);
    }
    setIsAdjustModalOpen(true);
  };

  // Form states for Restock
  const [restockPool, setRestockPool] = useState(defaultNakesPool);
  const [restockVitaminId, setRestockVitaminId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState<number>(50);
  const [restockDocNumber, setRestockDocNumber] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Form states for Adjustment
  const [adjustPool, setAdjustPool] = useState(defaultNakesPool);
  const [adjustVitaminId, setAdjustVitaminId] = useState('');
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Form states for New Vitamin (Super Admin)
  const [newVitCode, setNewVitCode] = useState('');
  const [newVitName, setNewVitName] = useState('');
  const [newVitCategory, setNewVitCategory] = useState('Daya Tahan Tubuh');
  const [newVitUnit, setNewVitUnit] = useState('Tablet');
  const [newVitDescription, setNewVitDescription] = useState('');
  const [isSubmittingNewVit, setIsSubmittingNewVit] = useState(false);

  // Success message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedPoolFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [invItems, allVits, movements, locs] = await Promise.all([
        getPoolInventory(selectedPoolFilter),
        getAllVitaminsWithStock(selectedPoolFilter),
        getStockMovements(selectedPoolFilter),
        getLocations(),
      ]);

      setPoolInventories(invItems);
      setAccumulatedVitamins(allVits);
      setStockMovements(movements);

      const locNames = locs.map((l) => l.locationName);
      setAllLocations(locNames.length > 0 ? locNames : [
        'Pool Marunda - Jakarta Utara',
        'Pool Cikarang Central - Bekasi',
        'Pool Tanah Merdeka - Cilincing',
        'Pool Tanjung Perak - Surabaya',
        'Pool Tanjung Emas - Semarang',
        'Pool Belawan - Medan',
      ]);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute stock summary metrics
  const summaryMetrics = useMemo(() => {
    let totalItems = 0;
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    if (!isSuperAdmin || selectedPoolFilter !== 'ALL') {
      // Metrics for specific pool
      totalItems = poolInventories.length;
      totalStock = poolInventories.reduce((acc, curr) => acc + curr.currentStock, 0);
      lowStockCount = poolInventories.filter(
        (i) => i.currentStock > 0 && i.currentStock <= i.minStockThreshold
      ).length;
      outOfStockCount = poolInventories.filter((i) => i.currentStock <= 0).length;
    } else {
      // Metrics accumulated across all pools
      totalItems = accumulatedVitamins.length;
      totalStock = accumulatedVitamins.reduce((acc, curr) => acc + curr.totalStockAllPools, 0);
      lowStockCount = accumulatedVitamins.filter((v) =>
        v.poolBreakdown.some((p) => p.status === 'LOW')
      ).length;
      outOfStockCount = accumulatedVitamins.filter((v) =>
        v.poolBreakdown.some((p) => p.status === 'OUT')
      ).length;
    }

    return { totalItems, totalStock, lowStockCount, outOfStockCount };
  }, [poolInventories, accumulatedVitamins, isSuperAdmin, selectedPoolFilter]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    accumulatedVitamins.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [accumulatedVitamins]);

  // Filtered inventory rows
  const filteredRows = useMemo(() => {
    if (!isSuperAdmin || selectedPoolFilter !== 'ALL') {
      // Filter specific pool items
      return poolInventories.filter((item) => {
        const matchesQuery =
          item.vitaminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.vitaminId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory =
          selectedCategory === 'ALL' || item.category === selectedCategory;

        let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
        if (item.currentStock <= 0) status = 'OUT';
        else if (item.currentStock <= item.minStockThreshold) status = 'LOW';

        const matchesStatus =
          selectedStockStatus === 'ALL' || status === selectedStockStatus;

        return matchesQuery && matchesCategory && matchesStatus;
      });
    } else {
      // Filter accumulated items (All Pools)
      return accumulatedVitamins.filter((item) => {
        const matchesQuery =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.vitaminId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory =
          selectedCategory === 'ALL' || item.category === selectedCategory;

        let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
        if (item.totalStockAllPools <= 0) status = 'OUT';
        else if (item.poolBreakdown.some((p) => p.status === 'LOW')) status = 'LOW';

        const matchesStatus =
          selectedStockStatus === 'ALL' || status === selectedStockStatus;

        return matchesQuery && matchesCategory && matchesStatus;
      });
    }
  }, [poolInventories, accumulatedVitamins, searchQuery, selectedCategory, selectedStockStatus, isSuperAdmin, selectedPoolFilter]);

  // Submit Restock
  const handleSaveRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockVitaminId || restockQuantity <= 0) return;

    setIsSubmittingRestock(true);
    try {
      await restockPoolInventory({
        locationName: isSuperAdmin ? restockPool : defaultNakesPool,
        vitaminId: restockVitaminId,
        quantity: Number(restockQuantity),
        documentNumber: restockDocNumber,
        notes: restockNotes,
        currentUser: {
          userId: currentUser?.userId || 'SYS_USER',
          fullName: currentUser?.fullName || 'Petugas Medis',
        },
      });

      showToast(`Berhasil menambah stok +${restockQuantity} ke ${isSuperAdmin ? restockPool : defaultNakesPool}`);
      setIsRestockModalOpen(false);
      setRestockQuantity(50);
      setRestockDocNumber('');
      setRestockNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal menambah stok obat.');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Submit Adjustment / Stock Opname
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustVitaminId || adjustTargetStock < 0 || !adjustReason.trim()) return;

    setIsSubmittingAdjust(true);
    try {
      await adjustPoolInventory({
        locationName: isSuperAdmin ? adjustPool : defaultNakesPool,
        vitaminId: adjustVitaminId,
        newStock: Number(adjustTargetStock),
        reason: adjustReason,
        currentUser: {
          userId: currentUser?.userId || 'SYS_USER',
          fullName: currentUser?.fullName || 'Petugas Medis',
        },
      });

      showToast(`Stok berhasil disesuaikan menjadi ${adjustTargetStock} (${isSuperAdmin ? adjustPool : defaultNakesPool})`);
      setIsAdjustModalOpen(false);
      setAdjustReason('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal menyesuaikan stok obat.');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Submit New Vitamin (Super Admin)
  const handleSaveNewVitamin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVitName.trim()) return;

    setIsSubmittingNewVit(true);
    try {
      await createVitamin(
        {
          vitaminId: newVitCode.trim() || undefined,
          name: newVitName.trim(),
          category: newVitCategory,
          dosageUnit: newVitUnit,
          description: newVitDescription.trim(),
          status: 'ACTIVE',
        },
        {
          userId: currentUser?.userId || 'SYS_ADMIN',
          fullName: currentUser?.fullName || 'Administrator',
        }
      );

      showToast(`Master data vitamin "${newVitName}" berhasil ditambahkan!`);
      setIsAddVitaminModalOpen(false);
      setNewVitName('');
      setNewVitCode('');
      setNewVitDescription('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal membuat master vitamin.');
    } finally {
      setIsSubmittingNewVit(false);
    }
  };

  return (
    <div id="medical-inventory-view" className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs md:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER & ROLE SCOPE BANNER */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
            <Pill className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {isSuperAdmin ? 'Medical Inventory — Pusat Logistik & Farmasi' : `Medical Inventory — ${defaultNakesPool}`}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Medical Inventory
          </h1>

          <p className="text-xs md:text-sm text-slate-500 max-w-2xl">
            {isSuperAdmin
              ? 'Monitoring saldo stok obat/vitamin terakumulasi seluruh pool logistik, riwayat dropping farmasi, dan mutasi dispensing TENKO.'
              : `Kelola stok fisik obat dan vitamin di lemari medis ${defaultNakesPool}. Pengurangan stok terintegrasi otomatis dengan pemeriksaan TENKO.`}
          </p>
        </div>

        {/* Action Buttons & Pool Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Super Admin Pool Selector */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-2xl px-3 py-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <select
                id="select-superadmin-pool-filter"
                value={selectedPoolFilter}
                onChange={(e) => setSelectedPoolFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer pr-2"
              >
                <option value="ALL">🌐 Semua Pool (Akumulasi)</option>
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Restock Button */}
          <button
            id="btn-open-restock-modal"
            onClick={() => {
              setRestockPool(isSuperAdmin && selectedPoolFilter !== 'ALL' ? selectedPoolFilter : defaultNakesPool);
              if (accumulatedVitamins.length > 0 && !restockVitaminId) {
                setRestockVitaminId(accumulatedVitamins[0].vitaminId);
              }
              setIsRestockModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Restock Obat (+)</span>
          </button>

          {/* Super Admin Add New Vitamin Item */}
          {isSuperAdmin && (
            <button
              id="btn-open-add-vitamin-modal"
              onClick={() => setIsAddVitaminModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Master Obat</span>
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isSuperAdmin && selectedPoolFilter === 'ALL' ? 'Total Stok Perusahaan' : 'Total Stok Fisik'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-slate-900">
              {summaryMetrics.totalStock.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-400">Unit / Dosis</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dari {summaryMetrics.totalItems} jenis sediaan aktif
          </p>
        </div>

        {/* Status Aman */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Aman</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-emerald-600">
              {Math.max(0, summaryMetrics.totalItems - summaryMetrics.lowStockCount - summaryMetrics.outOfStockCount)}
            </span>
            <span className="text-xs font-semibold text-emerald-600/80">Item</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Ketersediaan di atas batas aman</p>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Stok Menipis</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-amber-600">
              {summaryMetrics.lowStockCount}
            </span>
            <span className="text-xs font-semibold text-amber-600/80">Item</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Perlu pengajuan dropping restock</p>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Stok Habis</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-rose-600">
              {summaryMetrics.outOfStockCount}
            </span>
            <span className="text-xs font-semibold text-rose-600/80">Item</span>
          </div>
          <p className="text-[11px] text-rose-700 mt-1">Segera restock fisik obat</p>
        </div>
      </div>

      {/* SECTION HEADER & QUICK REFRESH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Katalog Obat & Saldo Stok Fisik</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {filteredRows.length} Sediaan
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Setiap sediaan obat memiliki <strong>Buku Kartu Stok</strong> tersendiri. Klik <strong className="text-slate-800">[Detail & Kartu Stok]</strong> untuk mencetak atau melihat riwayat mutasi per item.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Muat Ulang Data</span>
          </button>
        </div>
      </div>

      {/* ================= INVENTORY & STOCK TABLE ================= */}
      <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-inventory-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama vitamin, kode (e.g. VTM-01), atau kategori..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                id="select-inventory-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full md:w-auto px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                id="select-inventory-status-filter"
                value={selectedStockStatus}
                onChange={(e) => setSelectedStockStatus(e.target.value as any)}
                className="w-full md:w-auto px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status Stok</option>
                <option value="SAFE">🟢 Aman</option>
                <option value="LOW">🟡 Menipis (Low Stock)</option>
                <option value="OUT">🔴 Habis (0 Stock)</option>
              </select>
            </div>
          </div>

          {/* TABLE VIEW */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Kode & Nama Obat / Vitamin</th>
                    <th className="py-3 px-4">Kategori & Satuan</th>
                    {isSuperAdmin && selectedPoolFilter === 'ALL' ? (
                      <>
                        <th className="py-3 px-4">Total Stok Perusahaan</th>
                        <th className="py-3 px-4">Sebaran Stok Tiap Pool</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3 px-4">Stok Fisik Pool</th>
                        <th className="py-3 px-4">Batas Minimum</th>
                        <th className="py-3 px-4">Status Ketersediaan</th>
                      </>
                    )}
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        <span>Memuat data stok inventaris medis...</span>
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Tidak ada data vitamin yang sesuai dengan pencarian atau filter.
                      </td>
                    </tr>
                  ) : isSuperAdmin && selectedPoolFilter === 'ALL' ? (
                    // Super Admin Accumulated View
                    (filteredRows as VitaminMasterWithStock[]).map((row, idx) => {
                      const totalStock = row.totalStockAllPools;
                      const hasLow = row.poolBreakdown.some((p) => p.status === 'LOW');
                      const hasOut = row.poolBreakdown.some((p) => p.status === 'OUT');

                      return (
                        <tr key={row.vitaminId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{row.name}</div>
                            <div className="font-mono text-[10px] text-blue-600 font-semibold">{row.vitaminId}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {row.category}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Satuan: {row.dosageUnit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-black text-base text-slate-900">
                                {totalStock.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">{row.dosageUnit}</span>
                            </div>
                            {hasOut ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded mt-0.5">
                                <XCircle className="w-3 h-3" /> Ada Pool Kosong
                              </span>
                            ) : hasLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Ada Pool Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Semua Pool Aman
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {/* Pool breakdown mini tags */}
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {row.poolBreakdown.map((pb) => (
                                <span
                                  key={pb.locationName}
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
                                    pb.status === 'OUT'
                                      ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                                      : pb.status === 'LOW'
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span>{pb.locationName.replace('Pool ', '').split(' - ')[0]}:</span>
                                  <strong className="font-black">{pb.stock}</strong>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`btn-stock-card-${row.vitaminId}`}
                                onClick={() =>
                                  setSelectedItemForStockCard({
                                    vitaminId: row.vitaminId,
                                    vitaminName: row.name,
                                    category: row.category,
                                    dosageUnit: row.dosageUnit,
                                    description: row.description,
                                    currentStock: row.totalStockAllPools,
                                    minStockThreshold: 30,
                                    locationName: 'ALL',
                                    poolBreakdown: row.poolBreakdown,
                                  })
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>Detail & Kartu Stok</span>
                              </button>
                              <button
                                id={`btn-restock-${row.vitaminId}`}
                                onClick={() => {
                                  setRestockVitaminId(row.vitaminId);
                                  setIsRestockModalOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                <span>Restock (+)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // Specific Pool View (Nakes or Filtered Super Admin)
                    (filteredRows as PoolInventoryItem[]).map((row, idx) => {
                      let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
                      if (row.currentStock <= 0) status = 'OUT';
                      else if (row.currentStock <= row.minStockThreshold) status = 'LOW';

                      return (
                        <tr key={row.inventoryId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{row.vitaminName}</div>
                            <div className="font-mono text-[10px] text-blue-600 font-semibold">{row.vitaminId}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {row.category}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Satuan: {row.dosageUnit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-baseline gap-1.5">
                              <span className={`font-black text-lg ${
                                status === 'OUT' ? 'text-rose-600' : status === 'LOW' ? 'text-amber-600' : 'text-slate-900'
                              }`}>
                                {row.currentStock}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">{row.dosageUnit}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-semibold">
                            {row.minStockThreshold} {row.dosageUnit}
                          </td>
                          <td className="py-3.5 px-4">
                            {status === 'OUT' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                                <XCircle className="w-3.5 h-3.5" />
                                Stok Habis (0)
                              </span>
                            ) : status === 'LOW' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Stok Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Stok Aman
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`btn-pool-stock-card-${row.vitaminId}`}
                                onClick={() =>
                                  setSelectedItemForStockCard({
                                    vitaminId: row.vitaminId,
                                    vitaminName: row.vitaminName,
                                    category: row.category,
                                    dosageUnit: row.dosageUnit,
                                    currentStock: row.currentStock,
                                    minStockThreshold: row.minStockThreshold,
                                    locationName: row.locationName,
                                  })
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>Detail & Kartu Stok</span>
                              </button>
                              <button
                                id={`btn-pool-restock-${row.vitaminId}`}
                                onClick={() => {
                                  setRestockPool(row.locationName);
                                  setRestockVitaminId(row.vitaminId);
                                  setIsRestockModalOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                <span>Restock (+)</span>
                              </button>
                              <button
                                id={`btn-pool-adjust-${row.vitaminId}`}
                                onClick={() => {
                                  setAdjustPool(row.locationName);
                                  setAdjustVitaminId(row.vitaminId);
                                  setAdjustTargetStock(row.currentStock);
                                  setIsAdjustModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                title="Opname / Penyesuaian Fisik"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
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

      {/* ================= MODAL: RESTOCK OBAT (+) ================= */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Input Restock Obat / Dropping</h3>
                  <p className="text-xs text-slate-500">Penambahan fisik obat ke lemari farmasi pool</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRestock} className="space-y-4 pt-4">
              {/* Pool Destination */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lokasi Pool Tujuan <span className="text-rose-500">*</span>
                </label>
                {isSuperAdmin ? (
                  <select
                    id="select-restock-pool"
                    value={restockPool}
                    onChange={(e) => setRestockPool(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    required
                  >
                    {allLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>{defaultNakesPool}</span>
                    <span className="text-[10px] text-slate-400 ml-auto font-normal">(Terkunci sesuai akun Nakes)</span>
                  </div>
                )}
              </div>

              {/* Vitamin Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Obat / Vitamin <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-restock-vitamin"
                  value={restockVitaminId}
                  onChange={(e) => setRestockVitaminId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  required
                >
                  <option value="">-- Pilih Obat / Vitamin --</option>
                  {accumulatedVitamins.map((vit) => (
                    <option key={vit.vitaminId} value={vit.vitaminId}>
                      {vit.name} ({vit.dosageUnit}) - {vit.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Jumlah Tambahan Fisik (+ Qty) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-restock-quantity"
                  type="number"
                  min={1}
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  required
                />
              </div>

              {/* Document Reference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor Surat Jalan / PO Pengadaan
                </label>
                <input
                  id="input-restock-doc"
                  type="text"
                  value={restockDocNumber}
                  onChange={(e) => setRestockDocNumber(e.target.value)}
                  placeholder="Contoh: DROP-PO-2026-0901 / Surat Jalan Logistik"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan / Keterangan Dropping
                </label>
                <textarea
                  id="textarea-restock-notes"
                  rows={2}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Contoh: Pengiriman rutin awal bulan dari Apotek Rekanan / Farmasi Pusat"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingRestock && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Tambahan Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: STOCK OPNAME / PENYESUAIAN ================= */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Stock Opname / Penyesuaian</h3>
                  <p className="text-xs text-slate-500">Sesuaikan angka sistem dengan hitungan fisik riil</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4 pt-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold block">Lokasi: {adjustPool}</span>
                <span>Penyesuaian stok akan dicatat di log audit kartu mutasi fisik.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Stok Fisik Aktual Riil <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-adjust-target-stock"
                  type="number"
                  min={0}
                  value={adjustTargetStock}
                  onChange={(e) => setAdjustTargetStock(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan Penyesuaian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="textarea-adjust-reason"
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Selisih penghitungan fisik akhir bulan / obat kadaluarsa disisihkan"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingAdjust && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Perbarui Saldo Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: KARTU STOK & DETAIL OBAT PER ITEM ================= */}
      {selectedItemForStockCard && (
        <MedicalStockCardModal
          item={selectedItemForStockCard}
          isSuperAdmin={isSuperAdmin}
          allLocations={allLocations}
          onClose={() => setSelectedItemForStockCard(null)}
          onOpenRestock={handleOpenRestockForVit}
          onOpenAdjust={handleOpenAdjustForVit}
          onRefreshData={loadData}
        />
      )}

      {/* ================= MODAL: TAMBAH MASTER OBAT (SUPER ADMIN) ================= */}
      {isAddVitaminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tambah Master Obat Baru</h3>
                  <p className="text-xs text-slate-500">Mendaftarkan jenis obat baru ke katalog TENKO</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddVitaminModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewVitamin} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Obat / Vitamin <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-new-vit-name"
                  type="text"
                  value={newVitName}
                  onChange={(e) => setNewVitName(e.target.value)}
                  placeholder="Contoh: Ibuprofen 400mg"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kode ID (Opsional)
                  </label>
                  <input
                    id="input-new-vit-code"
                    type="text"
                    value={newVitCode}
                    onChange={(e) => setNewVitCode(e.target.value)}
                    placeholder="Contoh: VTM-09"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan Sediaan
                  </label>
                  <select
                    id="select-new-vit-unit"
                    value={newVitUnit}
                    onChange={(e) => setNewVitUnit(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Kaplet">Kaplet</option>
                    <option value="Kapsul">Kapsul</option>
                    <option value="Strip">Strip</option>
                    <option value="Botol">Botol</option>
                    <option value="Sachet">Sachet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori
                </label>
                <input
                  id="input-new-vit-category"
                  type="text"
                  value={newVitCategory}
                  onChange={(e) => setNewVitCategory(e.target.value)}
                  placeholder="Contoh: Daya Tahan Tubuh / Stamina / Lambung"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deskripsi / Indikasi Penggunaan
                </label>
                <textarea
                  id="textarea-new-vit-desc"
                  rows={2}
                  value={newVitDescription}
                  onChange={(e) => setNewVitDescription(e.target.value)}
                  placeholder="Contoh: Meredakan nyeri sendi dan pegal otot driver"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVitaminModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewVit}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingNewVit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Obat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
