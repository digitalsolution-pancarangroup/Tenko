import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  MedicalInventoryItem,
  StockMovement,
  VitaminItem,
} from '../../types';
import {
  getMedicalInventories,
  getStockMovements,
  restockMedicalInventory,
  adjustMedicalInventory,
  updateMinStockThreshold,
  clearAllMedicalInventoryData,
} from '../../services/medicalInventoryService';
import { createVitamin, getVitamins } from '../../services/healthService';
import { MedicalStockCardModal } from '../../components/inventory/MedicalStockCardModal';
import {
  Pill,
  PackagePlus,
  History,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  X,
  FileText,
  Boxes,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  Trash2,
  AlertOctagon,
} from 'lucide-react';

export const MedicalInventoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [inventories, setInventories] = useState<MedicalInventoryItem[]>([]);
  const [allVitamins, setAllVitamins] = useState<VitaminItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT'>('ALL');

  // Modal states
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAddVitaminModalOpen, setIsAddVitaminModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isSubmittingClearData, setIsSubmittingClearData] = useState(false);
  const [selectedItemForStockCard, setSelectedItemForStockCard] = useState<MedicalInventoryItem | null>(null);

  // Form states for Restock
  const [restockVitaminId, setRestockVitaminId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState<number>(50);
  const [restockDocNumber, setRestockDocNumber] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Form states for Adjustment / Stock Opname
  const [adjustVitaminId, setAdjustVitaminId] = useState('');
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Form states for New Master Vitamin (Super Admin)
  const [newVitCode, setNewVitCode] = useState('');
  const [newVitName, setNewVitName] = useState('');
  const [newVitCategory, setNewVitCategory] = useState('Daya Tahan Tubuh');
  const [newVitUnit, setNewVitUnit] = useState('Tablet');
  const [newVitDescription, setNewVitDescription] = useState('');
  const [newVitInitialStock, setNewVitInitialStock] = useState<number>(100);
  const [isSubmittingNewVit, setIsSubmittingNewVit] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData(true);
  }, []);

  // Real-time sync when tab is refocused
  useEffect(() => {
    const handleSyncOnTabFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    window.addEventListener('focus', handleSyncOnTabFocus);
    document.addEventListener('visibilitychange', handleSyncOnTabFocus);
    return () => {
      window.removeEventListener('focus', handleSyncOnTabFocus);
      document.removeEventListener('visibilitychange', handleSyncOnTabFocus);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (showFullLoading = true) => {
    if (showFullLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const [invItems, vits, movements] = await Promise.all([
        getMedicalInventories(),
        getVitamins(),
        getStockMovements(),
      ]);

      setInventories(invItems);
      setAllVitamins(vits);
      setStockMovements(movements);
    } catch (err) {
      console.error('Failed to load medical inventory data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Compute stock summary KPI metrics
  const summaryMetrics = useMemo(() => {
    const totalItems = inventories.length;
    const totalStock = inventories.reduce((acc, curr) => acc + (curr.currentStock || 0), 0);
    const lowStockCount = inventories.filter(
      (i) => i.currentStock > 0 && i.currentStock <= i.minStockThreshold
    ).length;
    const outOfStockCount = inventories.filter((i) => i.currentStock <= 0).length;

    return { totalItems, totalStock, lowStockCount, outOfStockCount };
  }, [inventories]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventories.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [inventories]);

  // Filtered inventory items
  const filteredRows = useMemo(() => {
    return inventories.filter((item) => {
      const matchesQuery =
        item.vitaminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vitaminId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
      if (item.currentStock <= 0) status = 'OUT';
      else if (item.currentStock <= item.minStockThreshold) status = 'LOW';

      const matchesStatus =
        selectedStockStatus === 'ALL' || status === selectedStockStatus;

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [inventories, searchQuery, selectedCategory, selectedStockStatus]);

  // Submit Restock
  const handleSaveRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockVitaminId || restockQuantity <= 0) return;

    setIsSubmittingRestock(true);
    try {
      await restockMedicalInventory({
        vitaminId: restockVitaminId,
        quantity: Number(restockQuantity),
        documentNumber: restockDocNumber,
        notes: restockNotes,
        currentUser: {
          userId: currentUser?.userId || 'SYS_USER',
          fullName: currentUser?.fullName || 'Petugas Medis',
        },
      });

      showToast(`Berhasil menambah stok +${restockQuantity} unit obat ke database.`);
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

  // Submit Adjustment / Stock Opname Fisik
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustVitaminId || adjustTargetStock < 0 || !adjustReason.trim()) return;

    setIsSubmittingAdjust(true);
    try {
      await adjustMedicalInventory({
        vitaminId: adjustVitaminId,
        newStock: Number(adjustTargetStock),
        reason: adjustReason,
        currentUser: {
          userId: currentUser?.userId || 'SYS_USER',
          fullName: currentUser?.fullName || 'Petugas Medis',
        },
      });

      showToast(`Stok berhasil disesuaikan menjadi ${adjustTargetStock} unit.`);
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

  // Submit New Vitamin & Initialize Inventory (Super Admin)
  const handleSaveNewVitamin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVitName.trim()) return;

    setIsSubmittingNewVit(true);
    try {
      const createdVit = await createVitamin(
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

      // Initialize in Medical Inventory
      if (newVitInitialStock && newVitInitialStock > 0) {
        await restockMedicalInventory({
          vitaminId: createdVit.vitaminId,
          quantity: Number(newVitInitialStock),
          documentNumber: 'INIT-MASTER-INVENTORY',
          notes: 'Stok awal saat pendaftaran master obat',
          currentUser: {
            userId: currentUser?.userId || 'SYS_ADMIN',
            fullName: currentUser?.fullName || 'Administrator',
          },
        });
      } else {
        // Create document with currentStock = 0 in medicalInventories
        await adjustMedicalInventory({
          vitaminId: createdVit.vitaminId,
          newStock: 0,
          reason: 'Pendaftaran master obat baru (stok awal 0)',
          currentUser: {
            userId: currentUser?.userId || 'SYS_ADMIN',
            fullName: currentUser?.fullName || 'Administrator',
          },
        });
      }

      showToast(`Master obat "${newVitName}" berhasil didaftarkan ke inventori!`);
      setIsAddVitaminModalOpen(false);
      setNewVitName('');
      setNewVitCode('');
      setNewVitDescription('');
      setNewVitInitialStock(100);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal membuat master obat.');
    } finally {
      setIsSubmittingNewVit(false);
    }
  };

  // Execute Clean Data Reset
  const handleExecuteCleanData = async () => {
    setIsSubmittingClearData(true);
    try {
      await clearAllMedicalInventoryData(
        currentUser ? { userId: currentUser.userId, fullName: currentUser.fullName } : undefined
      );
      showToast('Seluruh data Medical Inventory telah berhasil dibersihkan (Kosong).');
      setIsClearDataModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal membersihkan data inventori.');
    } finally {
      setIsSubmittingClearData(false);
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

      {/* ================= HEADER BAR ================= */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Database Terpusat
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 mt-1">
            Medical Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat manajemen stok obat, vitamin, dan suplemen fisik operasional medis TENKO.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              loadData(false);
              showToast('Data Medical Inventory diperbarui.');
            }}
            disabled={isRefreshing || loading}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || isRefreshing) ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>

          {/* Restock Button */}
          <button
            id="btn-open-restock-modal"
            onClick={() => {
              if (inventories.length > 0 && !restockVitaminId) {
                setRestockVitaminId(inventories[0].vitaminId);
              } else if (allVitamins.length > 0 && !restockVitaminId) {
                setRestockVitaminId(allVitamins[0].vitaminId);
              }
              setIsRestockModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Restock Obat (+)</span>
          </button>

          {/* Super Admin: Add New Vitamin Item */}
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

          {/* Super Admin: Clean Data Button */}
          {isSuperAdmin && (
            <button
              id="btn-open-clear-inventory-modal"
              onClick={() => setIsClearDataModalOpen(true)}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Bersihkan Semua Data Inventori (Clean Reset)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ================= KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total Jenis Obat */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Jenis Obat
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black text-slate-900">
              {summaryMetrics.totalItems}
            </span>
            <span className="text-xs font-semibold text-slate-400">Katalog</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Tersedia di inventori medis</span>
        </div>

        {/* Card 2: Total Unit Stok Fisik */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Fisik Tersedia
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black text-emerald-600">
              {summaryMetrics.totalStock.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-400">Unit</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Akumulasi seluruh stok obat</span>
        </div>

        {/* Card 3: Stok Menipis */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Stok Menipis
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black text-amber-600">
              {summaryMetrics.lowStockCount}
            </span>
            <span className="text-xs font-semibold text-amber-700/80">Item</span>
          </div>
          <span className="text-[11px] text-amber-700 mt-1 block">&le; Batas minimum buffer</span>
        </div>

        {/* Card 4: Stok Habis */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-rose-200 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Stok Habis (0)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl md:text-3xl font-black text-rose-600">
              {summaryMetrics.outOfStockCount}
            </span>
            <span className="text-xs font-semibold text-rose-700/80">Item</span>
          </div>
          <span className="text-[11px] text-rose-700 mt-1 block">Perlu segera di-restock</span>
        </div>
      </div>

      {/* ================= INVENTORY TABLE & FILTERS ================= */}
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
              placeholder="Cari nama obat, kode (contoh: VTM-01), kategori, atau deskripsi..."
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
              <option value="SAFE">🟢 Stok Aman</option>
              <option value="LOW">🟡 Stok Menipis</option>
              <option value="OUT">🔴 Stok Habis (0)</option>
            </select>
          </div>
        </div>

        {/* TABLE VIEW */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Kode & Nama Obat / Vitamin</th>
                  <th className="py-3 px-4">Kategori & Bentuk Sediaan</th>
                  <th className="py-3 px-4 text-center">Stok Fisik Saat Ini</th>
                  <th className="py-3 px-4 text-center">Batas Minimum (Buffer)</th>
                  <th className="py-3 px-4">Status Ketersediaan</th>
                  <th className="py-3 px-4">Terakhir Diperbarui</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      <span>Memuat database Medical Inventory...</span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                          <Pill className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Belum Ada Stok di Medical Inventory</h4>
                        <p className="text-xs text-slate-400 mt-1 mb-4">
                          Database inventori masih bersih/kosong. Anda dapat menambahkan sediaan obat baru atau melakukan restock obat pertama.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (allVitamins.length > 0) setRestockVitaminId(allVitamins[0].vitaminId);
                              setIsRestockModalOpen(true);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                          >
                            <PackagePlus className="w-4 h-4" />
                            <span>Restock Obat (+)</span>
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => setIsAddVitaminModalOpen(true)}
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Tambah Master Obat</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
                    if (row.currentStock <= 0) status = 'OUT';
                    else if (row.currentStock <= row.minStockThreshold) status = 'LOW';

                    return (
                      <tr key={row.inventoryId} className="hover:bg-slate-50/70 transition">
                        {/* No */}
                        <td className="py-3.5 px-4 font-mono text-slate-400 font-bold text-center">
                          {idx + 1}
                        </td>

                        {/* Kode & Nama Obat */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{row.vitaminName}</div>
                          <div className="font-mono text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                            <span>{row.vitaminId}</span>
                            {row.description && (
                              <span className="text-slate-400 font-normal truncate max-w-xs block">
                                &bull; {row.description}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Kategori & Sediaan */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {row.category}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
                            Sediaan: <strong className="text-slate-700">{row.dosageUnit}</strong>
                          </span>
                        </td>

                        {/* Stok Fisik Saat Ini */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-baseline gap-1 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
                            <span
                              className={`font-black text-base ${
                                status === 'OUT'
                                  ? 'text-rose-600'
                                  : status === 'LOW'
                                  ? 'text-amber-600'
                                  : 'text-slate-900'
                              }`}
                            >
                              {row.currentStock.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {row.dosageUnit}
                            </span>
                          </div>
                        </td>

                        {/* Batas Minimum */}
                        <td className="py-3.5 px-4 text-center text-slate-500 font-semibold">
                          <span className="font-mono text-xs">{row.minStockThreshold}</span>{' '}
                          <span className="text-[10px] text-slate-400">{row.dosageUnit}</span>
                        </td>

                        {/* Status Ketersediaan */}
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

                        {/* Terakhir Diperbarui */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                          {row.lastRestockDate ? (
                            <div>
                              <span className="font-semibold text-slate-700">Restock: {row.lastRestockDate}</span>
                              {row.updatedBy && <span className="block text-[10px] text-slate-400">{row.updatedBy}</span>}
                            </div>
                          ) : (
                            <span>{new Date(row.updatedAt).toLocaleDateString('id-ID')}</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Kartu Stok & Detail */}
                            <button
                              id={`btn-stock-card-${row.vitaminId}`}
                              onClick={() => setSelectedItemForStockCard(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>Kartu Stok</span>
                            </button>

                            {/* Restock (+) */}
                            <button
                              id={`btn-restock-${row.vitaminId}`}
                              onClick={() => {
                                setRestockVitaminId(row.vitaminId);
                                setIsRestockModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
                              title="Restock / Tambah Stok"
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                              <span>Restock (+)</span>
                            </button>

                            {/* Opname / Penyesuaian Fisik */}
                            <button
                              id={`btn-adjust-${row.vitaminId}`}
                              onClick={() => {
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
                  <h3 className="text-base font-bold text-slate-900">Restock Obat / Dropping Farmasi</h3>
                  <p className="text-xs text-slate-500">Penambahan fisik stok obat ke database Medical Inventory</p>
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
                  {/* If there are items in inventory, show them */}
                  {inventories.length > 0 ? (
                    inventories.map((vit) => (
                      <option key={vit.vitaminId} value={vit.vitaminId}>
                        {vit.vitaminName} ({vit.dosageUnit}) &bull; Stok saat ini: {vit.currentStock}
                      </option>
                    ))
                  ) : (
                    /* If inventory is empty, show all available master vitamins to initialize from */
                    allVitamins.map((vit) => (
                      <option key={vit.vitaminId} value={vit.vitaminId}>
                        {vit.name} ({vit.dosageUnit}) - {vit.category}
                      </option>
                    ))
                  )}
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  required
                />
              </div>

              {/* Document Reference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor Surat Jalan / Bukti Terima PO
                </label>
                <input
                  id="input-restock-doc"
                  type="text"
                  value={restockDocNumber}
                  onChange={(e) => setRestockDocNumber(e.target.value)}
                  placeholder="Contoh: DROP-PO-2026-0901 / SJ-FARMASI-08"
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
                  placeholder="Contoh: Pengadaan rutin bulanan dari Apotek Rekanan / Farmasi Pusat"
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
                <span className="font-bold block">Peringatan Stock Opname:</span>
                <span>Perubahan saldo fisik akan dicatat di log audit dan buku mutasi kartu stok resmi.</span>
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
                  placeholder="Contoh: Selisih hitungan fisik opname akhir bulan / obat kadaluarsa disisihkan"
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
                  <span>Simpan Penyesuaian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TAMBAH MASTER OBAT ================= */}
      {isAddVitaminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tambah Master Obat Baru</h3>
                  <p className="text-xs text-slate-500">Mendaftarkan sediaan vitamin/obat baru ke sistem</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kode Obat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newVitCode}
                    onChange={(e) => setNewVitCode(e.target.value)}
                    placeholder="Contoh: VTM-09"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan Sediaan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newVitUnit}
                    onChange={(e) => setNewVitUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    required
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Kaplet">Kaplet</option>
                    <option value="Kapsul">Kapsul</option>
                    <option value="Kapsul Lunak">Kapsul Lunak</option>
                    <option value="Tablet Kunyah">Tablet Kunyah</option>
                    <option value="Strip">Strip</option>
                    <option value="Botol">Botol</option>
                    <option value="Sachet">Sachet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Obat / Vitamin <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newVitName}
                  onChange={(e) => setNewVitName(e.target.value)}
                  placeholder="Contoh: Zinc 20mg / Vitamin E 400 IU"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori Terapi / Manfaat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newVitCategory}
                  onChange={(e) => setNewVitCategory(e.target.value)}
                  placeholder="Contoh: Daya Tahan Tubuh, Saraf & Stamina, Analgesik"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Stok Awal Fisik (Unit)
                </label>
                <input
                  type="number"
                  min={0}
                  value={newVitInitialStock}
                  onChange={(e) => setNewVitInitialStock(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deskripsi & Indikasi Medis
                </label>
                <textarea
                  rows={2}
                  value={newVitDescription}
                  onChange={(e) => setNewVitDescription(e.target.value)}
                  placeholder="Contoh: Suplemen untuk mempercepat pemulihan kelelahan otot pengemudi"
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
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingNewVit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Daftarkan Master Obat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: KONFIRMASI BERSIHKAN DATA (CLEAN DATA RESET) ================= */}
      {isClearDataModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bersihkan Data Inventori?</h3>
                <p className="text-xs text-slate-500">Opsi 3: Kosongkan database Medical Inventory</p>
              </div>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-600">
              <p>
                Tindakan ini akan <strong>menghapus seluruh data stok fisik di Medical Inventory</strong> dan membersihkan kartu mutasi riwayat stok.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-medium">
                Setelah dibersihkan, inventori akan berada pada status <strong>Kosong Murni (0 Item)</strong> dan siap diinput secara fresh.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearDataModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingClearData}
                onClick={handleExecuteCleanData}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2"
              >
                {isSubmittingClearData && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Bersihkan Total</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: KARTU STOK & BUKU MUTASI ================= */}
      {selectedItemForStockCard && (
        <MedicalStockCardModal
          item={{
            vitaminId: selectedItemForStockCard.vitaminId,
            vitaminName: selectedItemForStockCard.vitaminName,
            category: selectedItemForStockCard.category,
            dosageUnit: selectedItemForStockCard.dosageUnit,
            description: selectedItemForStockCard.description,
            currentStock: selectedItemForStockCard.currentStock,
            minStockThreshold: selectedItemForStockCard.minStockThreshold,
            locationName: 'Gudang Farmasi Terpusat',
          }}
          isSuperAdmin={isSuperAdmin}
          allLocations={['Gudang Farmasi Terpusat']}
          onClose={() => setSelectedItemForStockCard(null)}
          onOpenRestock={(vitaminId) => {
            setRestockVitaminId(vitaminId);
            setIsRestockModalOpen(true);
          }}
          onOpenAdjust={(vitaminId, _, stock) => {
            setAdjustVitaminId(vitaminId);
            if (typeof stock === 'number') setAdjustTargetStock(stock);
            setIsAdjustModalOpen(true);
          }}
          onRefreshData={loadData}
        />
      )}
    </div>
  );
};
