import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MedicalInventoryItem,
  StockMovement,
  VitaminMasterWithStock,
  VitaminItem,
  PoolInventoryItem,
} from '../types';
import { getVitamins } from './healthService';
import { logAuditAction } from './auditService';
import { generateStockMovementId } from '../utils/idGenerators';

const LOCAL_STORAGE_MEDICAL_INVENTORY_KEY = 'tenko_medical_inventories';
const LOCAL_STORAGE_MOVEMENTS_KEY = 'tenko_stock_movements';

function cleanPayload(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

export function makeMedicalInventoryDocId(vitaminId: string): string {
  const cleanId = (vitaminId || 'VTM').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
  return cleanId.startsWith('INV-') ? cleanId : `INV-${cleanId}`;
}

// ================= FETCH CENTRAL MEDICAL INVENTORIES =================
export async function getMedicalInventories(): Promise<MedicalInventoryItem[]> {
  try {
    const snap = await getDocs(collection(db, 'medicalInventories'));
    if (!snap.empty) {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          inventoryId: d.id,
          vitaminId: data.vitaminId || d.id.replace('INV-', ''),
          vitaminName: data.vitaminName || 'Vitamin',
          category: data.category || 'Umum',
          dosageUnit: data.dosageUnit || 'Tablet',
          description: data.description || '',
          currentStock: typeof data.currentStock === 'number' ? data.currentStock : 0,
          minStockThreshold: typeof data.minStockThreshold === 'number' ? data.minStockThreshold : 30,
          lastRestockDate: data.lastRestockDate,
          lastRestockQuantity: data.lastRestockQuantity,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || 'Petugas Medis',
        } as MedicalInventoryItem;
      });

      try {
        localStorage.setItem(LOCAL_STORAGE_MEDICAL_INVENTORY_KEY, JSON.stringify(items));
      } catch {}

      return items.sort((a, b) => a.vitaminName.localeCompare(b.vitaminName));
    }
  } catch (e) {
    console.warn('Firestore fallback to local medical inventory cache:', e);
  }

  // Local storage cache check (returns [] if none)
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_MEDICAL_INVENTORY_KEY);
    if (saved) {
      const parsed: MedicalInventoryItem[] = JSON.parse(saved);
      return parsed.sort((a, b) => a.vitaminName.localeCompare(b.vitaminName));
    }
  } catch {}

  return [];
}

// ================= CLEAR ALL MEDICAL INVENTORY DATA (OPTION 3) =================
export async function clearAllMedicalInventoryData(currentUser?: { userId: string; fullName: string }): Promise<void> {
  console.log('Clearing all medical inventory and movement data...');
  
  // 1. Clear Firestore medicalInventories
  try {
    const snap = await getDocs(collection(db, 'medicalInventories'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Failed clearing Firestore medicalInventories (offline or quota):', e);
  }

  // 2. Clear legacy poolInventory
  try {
    const snap = await getDocs(collection(db, 'poolInventory'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Failed clearing Firestore poolInventory:', e);
  }

  // 3. Clear stockMovements
  try {
    const snap = await getDocs(collection(db, 'stockMovements'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Failed clearing Firestore stockMovements:', e);
  }

  // 4. Clear LocalStorage caches
  try {
    localStorage.removeItem(LOCAL_STORAGE_MEDICAL_INVENTORY_KEY);
    localStorage.removeItem('tenko_pool_inventory');
    localStorage.removeItem(LOCAL_STORAGE_MOVEMENTS_KEY);
    localStorage.setItem('tenko_inventory_purged_clean_v3', 'true');
  } catch {}

  // 5. Audit Log
  if (currentUser) {
    await logAuditAction({
      module: 'Medical Inventory',
      action: 'CLEAN_DATA',
      entity: 'MEDICAL_INVENTORY',
      entityId: 'ALL_RECORDS',
      newValue: { status: 'CLEARED_EMPTY' },
      userId: currentUser.userId,
      userName: currentUser.fullName,
    });
  }
}

// ================= RESTOCK OBAT (+) =================
export async function restockMedicalInventory(params: {
  vitaminId: string;
  quantity: number;
  documentNumber?: string;
  notes?: string;
  date?: string;
  locationName?: string;
  currentUser: { userId: string; fullName: string };
}): Promise<MedicalInventoryItem> {
  const { vitaminId, quantity, documentNumber, notes, date, locationName, currentUser } = params;

  const docId = makeMedicalInventoryDocId(vitaminId);
  const currentInventories = await getMedicalInventories();
  const existingItem = currentInventories.find(
    (i) => i.inventoryId === docId || i.vitaminId.toLowerCase() === vitaminId.toLowerCase()
  );

  const prevStock = existingItem ? existingItem.currentStock : 0;
  const addedQty = Math.max(1, quantity);
  const newStock = prevStock + addedQty;

  // Resolve vitamin metadata
  let vitName = existingItem?.vitaminName || 'Vitamin';
  let vitCat = existingItem?.category || 'Umum';
  let vitUnit = existingItem?.dosageUnit || 'Tablet';
  let vitDesc = existingItem?.description || '';

  if (!existingItem) {
    const allVits = await getVitamins();
    const found = allVits.find((v) => v.vitaminId.toLowerCase() === vitaminId.toLowerCase());
    if (found) {
      vitName = found.name;
      vitCat = found.category || 'Umum';
      vitUnit = found.dosageUnit || 'Tablet';
      vitDesc = found.description || '';
    }
  }

  const updatedItem: MedicalInventoryItem = {
    inventoryId: docId,
    vitaminId,
    vitaminName: vitName,
    category: vitCat,
    dosageUnit: vitUnit,
    description: vitDesc,
    currentStock: newStock,
    minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
    lastRestockDate: date || new Date().toISOString().slice(0, 10),
    lastRestockQuantity: addedQty,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  // 1. Write to Firestore medicalInventories
  try {
    await setDoc(doc(db, 'medicalInventories', docId), cleanPayload(updatedItem));
  } catch (e) {
    console.warn('Firestore write failed for medicalInventories:', e);
  }

  // 2. Update local storage
  try {
    const filtered = currentInventories.filter(
      (i) => i.inventoryId !== docId && i.vitaminId.toLowerCase() !== vitaminId.toLowerCase()
    );
    localStorage.setItem(
      LOCAL_STORAGE_MEDICAL_INVENTORY_KEY,
      JSON.stringify([...filtered, updatedItem])
    );
  } catch {}

  // 3. Record Stock Movement
  const movId = generateStockMovementId('IN', vitaminId);
  const movement: StockMovement = {
    movementId: movId,
    movementType: 'IN',
    locationName: locationName || 'Gudang Farmasi Pusat',
    vitaminId,
    vitaminName: vitName,
    quantity: addedQty,
    previousStock: prevStock,
    finalStock: newStock,
    dosageUnit: vitUnit,
    referenceId: documentNumber?.trim() || 'RESTOCK-MANUAL',
    notes: notes?.trim() || 'Penambahan stok dropping obat / pengadaan farmasi',
    performedBy: currentUser.userId,
    performedByName: currentUser.fullName,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'stockMovements', movId), cleanPayload(movement));
  } catch (e) {
    console.warn('Firestore write failed for stockMovements:', e);
  }

  try {
    const existingMoves = await getStockMovements();
    localStorage.setItem(
      LOCAL_STORAGE_MOVEMENTS_KEY,
      JSON.stringify([movement, ...existingMoves.filter((m) => m.movementId !== movId)])
    );
  } catch {}

  // 4. Audit Log
  await logAuditAction({
    module: 'Medical Inventory',
    action: 'RESTOCK',
    entity: 'MEDICAL_INVENTORY',
    entityId: vitName,
    newValue: { vitaminId, vitaminName: vitName, added: addedQty, newStock, reference: documentNumber },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return updatedItem;
}

// ================= ADJUSTMENT / STOCK OPNAME FISIK =================
export async function adjustMedicalInventory(params: {
  vitaminId: string;
  newStock: number;
  reason: string;
  locationName?: string;
  currentUser: { userId: string; fullName: string };
}): Promise<MedicalInventoryItem> {
  const { vitaminId, newStock, reason, locationName, currentUser } = params;

  const docId = makeMedicalInventoryDocId(vitaminId);
  const currentInventories = await getMedicalInventories();
  const existingItem = currentInventories.find(
    (i) => i.inventoryId === docId || i.vitaminId.toLowerCase() === vitaminId.toLowerCase()
  );

  const prevStock = existingItem ? existingItem.currentStock : 0;
  const targetStock = Math.max(0, newStock);
  const diff = targetStock - prevStock;

  const vitName = existingItem?.vitaminName || 'Vitamin';
  const vitCat = existingItem?.category || 'Umum';
  const vitUnit = existingItem?.dosageUnit || 'Tablet';
  const vitDesc = existingItem?.description || '';

  const updatedItem: MedicalInventoryItem = {
    inventoryId: docId,
    vitaminId,
    vitaminName: vitName,
    category: vitCat,
    dosageUnit: vitUnit,
    description: vitDesc,
    currentStock: targetStock,
    minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  // 1. Write to Firestore medicalInventories
  try {
    await setDoc(doc(db, 'medicalInventories', docId), cleanPayload(updatedItem));
  } catch (e) {
    console.warn('Firestore write failed for medicalInventories adjust:', e);
  }

  // 2. Update local storage
  try {
    const filtered = currentInventories.filter(
      (i) => i.inventoryId !== docId && i.vitaminId.toLowerCase() !== vitaminId.toLowerCase()
    );
    localStorage.setItem(
      LOCAL_STORAGE_MEDICAL_INVENTORY_KEY,
      JSON.stringify([...filtered, updatedItem])
    );
  } catch {}

  // 3. Record stock movement
  const movId = generateStockMovementId('ADJUSTMENT', vitaminId);
  const movement: StockMovement = {
    movementId: movId,
    movementType: 'ADJUSTMENT',
    locationName: locationName || 'Gudang Farmasi Pusat',
    vitaminId,
    vitaminName: vitName,
    quantity: Math.abs(diff),
    previousStock: prevStock,
    finalStock: targetStock,
    dosageUnit: vitUnit,
    notes: reason.trim() || 'Penyesuaian fisik / Stock Opname',
    performedBy: currentUser.userId,
    performedByName: currentUser.fullName,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'stockMovements', movId), cleanPayload(movement));
  } catch (e) {
    console.warn('Firestore write failed for adjustment stockMovement:', e);
  }

  try {
    const existingMoves = await getStockMovements();
    localStorage.setItem(
      LOCAL_STORAGE_MOVEMENTS_KEY,
      JSON.stringify([movement, ...existingMoves.filter((m) => m.movementId !== movId)])
    );
  } catch {}

  // 4. Audit Log
  await logAuditAction({
    module: 'Medical Inventory',
    action: 'STOCK_ADJUSTMENT',
    entity: 'MEDICAL_INVENTORY',
    entityId: vitName,
    newValue: { vitaminId, vitaminName: vitName, prevStock, targetStock, reason },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return updatedItem;
}

// ================= DEDUCT STOCK ON TENKO EXAMINATION =================
export async function deductMedicalStockForTenko(params: {
  items: { vitaminId?: string; name: string; quantity: number; unit?: string }[];
  tenkoId: string;
  driverId: string;
  driverName: string;
  locationName?: string;
  currentUser: { userId: string; fullName: string };
}): Promise<void> {
  const { items, tenkoId, driverId, driverName, locationName, currentUser } = params;

  if (!items || items.length === 0) return;

  const currentInventories = await getMedicalInventories();
  const allVitamins = await getVitamins();

  for (const item of items) {
    let vitId = item.vitaminId;
    if (!vitId) {
      const match = allVitamins.find((v) => v.name.toLowerCase() === item.name.toLowerCase());
      if (match) vitId = match.vitaminId;
    }

    if (!vitId) continue;

    const docId = makeMedicalInventoryDocId(vitId);
    const existingItem = currentInventories.find(
      (i) => i.inventoryId === docId || i.vitaminId.toLowerCase() === vitId!.toLowerCase()
    );

    const prevStock = existingItem ? existingItem.currentStock : 0;
    const deductQty = Math.max(1, item.quantity || 1);
    const newStock = Math.max(0, prevStock - deductQty);

    const vitName = existingItem?.vitaminName || item.name;
    const vitCat = existingItem?.category || 'Umum';
    const vitUnit = existingItem?.dosageUnit || item.unit || 'Tablet';

    const updatedItem: MedicalInventoryItem = {
      inventoryId: docId,
      vitaminId: vitId,
      vitaminName: vitName,
      category: vitCat,
      dosageUnit: vitUnit,
      currentStock: newStock,
      minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    };

    // Save to Firestore
    try {
      await setDoc(doc(db, 'medicalInventories', docId), cleanPayload(updatedItem));
    } catch (e) {
      console.warn('Failed firestore write on Tenko deduction:', e);
    }

    // Update local cache
    try {
      const idx = currentInventories.findIndex((i) => i.inventoryId === docId || i.vitaminId === vitId);
      if (idx >= 0) currentInventories[idx] = updatedItem;
      else currentInventories.push(updatedItem);
      localStorage.setItem(LOCAL_STORAGE_MEDICAL_INVENTORY_KEY, JSON.stringify(currentInventories));
    } catch {}

    // Record OUT movement
    const movId = generateStockMovementId('OUT', vitId);
    const movement: StockMovement = {
      movementId: movId,
      movementType: 'OUT',
      locationName: locationName || 'Posko Tenko',
      vitaminId: vitId,
      vitaminName: vitName,
      quantity: deductQty,
      previousStock: prevStock,
      finalStock: newStock,
      dosageUnit: vitUnit,
      referenceId: tenkoId,
      driverId,
      driverName,
      notes: `Pemberian vitamin Tenko keluhan pengemudi (${driverName})`,
      performedBy: currentUser.userId,
      performedByName: currentUser.fullName,
      timestamp: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'stockMovements', movId), cleanPayload(movement));
    } catch {}

    try {
      const savedMoves = localStorage.getItem(LOCAL_STORAGE_MOVEMENTS_KEY);
      const moves: StockMovement[] = savedMoves ? JSON.parse(savedMoves) : [];
      localStorage.setItem(LOCAL_STORAGE_MOVEMENTS_KEY, JSON.stringify([movement, ...moves]));
    } catch {}
  }
}

// ================= STOCK MOVEMENTS / BUKU KARTU STOK =================
export async function getStockMovements(
  locationFilter?: string,
  vitaminIdFilter?: string
): Promise<StockMovement[]> {
  try {
    const snap = await getDocs(collection(db, 'stockMovements'));
    if (!snap.empty) {
      let items = snap.docs.map((d) => ({
        movementId: d.id,
        ...(d.data() as Omit<StockMovement, 'movementId'>),
      }));

      if (locationFilter && locationFilter !== 'ALL') {
        items = items.filter(
          (m) => (m.locationName || '').toLowerCase() === locationFilter.toLowerCase()
        );
      }
      if (vitaminIdFilter) {
        items = items.filter((m) => m.vitaminId === vitaminIdFilter);
      }

      return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }
  } catch (e) {
    console.warn('Firestore fallback to local stock movements:', e);
  }

  // Local storage fallback
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_MOVEMENTS_KEY);
    if (saved) {
      let items: StockMovement[] = JSON.parse(saved);
      if (locationFilter && locationFilter !== 'ALL') {
        items = items.filter(
          (m) => (m.locationName || '').toLowerCase() === locationFilter.toLowerCase()
        );
      }
      if (vitaminIdFilter) {
        items = items.filter((m) => m.vitaminId === vitaminIdFilter);
      }
      return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }
  } catch {}

  return [];
}

// ================= UPDATE MIN STOCK THRESHOLD =================
export async function updateMinStockThreshold(
  vitaminId: string,
  threshold: number,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = makeMedicalInventoryDocId(vitaminId);
  try {
    await updateDoc(doc(db, 'medicalInventories', docId), {
      minStockThreshold: Math.max(1, threshold),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    });
  } catch (e) {
    console.warn('Firestore update failed for minStockThreshold:', e);
  }

  try {
    const current = await getMedicalInventories();
    const updated = current.map((i) =>
      i.inventoryId === docId || i.vitaminId === vitaminId
        ? { ...i, minStockThreshold: Math.max(1, threshold) }
        : i
    );
    localStorage.setItem(LOCAL_STORAGE_MEDICAL_INVENTORY_KEY, JSON.stringify(updated));
  } catch {}
}

// ================= BACKWARD COMPATIBILITY EXPORTS =================
export async function getPoolInventory(_locationFilter?: string): Promise<PoolInventoryItem[]> {
  const centralItems = await getMedicalInventories();
  return centralItems.map((c) => ({
    inventoryId: c.inventoryId,
    locationName: 'Gudang Farmasi Terpusat',
    vitaminId: c.vitaminId,
    vitaminName: c.vitaminName,
    category: c.category,
    dosageUnit: c.dosageUnit,
    currentStock: c.currentStock,
    minStockThreshold: c.minStockThreshold,
    lastRestockDate: c.lastRestockDate,
    updatedAt: c.updatedAt,
    updatedBy: c.updatedBy,
  }));
}

export async function getAllVitaminsWithStock(_locationFilter?: string): Promise<VitaminMasterWithStock[]> {
  const [vitamins, centralItems] = await Promise.all([
    getVitamins(),
    getMedicalInventories(),
  ]);

  return vitamins.map((vit) => {
    const matching = centralItems.find((c) => c.vitaminId === vit.vitaminId);
    const stock = matching ? matching.currentStock : 0;
    const minThreshold = matching ? matching.minStockThreshold : 30;

    let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
    if (stock <= 0) status = 'OUT';
    else if (stock <= minThreshold) status = 'LOW';

    return {
      ...vit,
      totalStockAllPools: stock,
      poolBreakdown: [
        {
          locationName: 'Gudang Terpusat',
          stock,
          minThreshold,
          status,
        },
      ],
    };
  });
}

export async function restockPoolInventory(params: {
  locationName?: string;
  vitaminId: string;
  quantity: number;
  documentNumber?: string;
  notes?: string;
  date?: string;
  currentUser: { userId: string; fullName: string };
}): Promise<PoolInventoryItem> {
  const result = await restockMedicalInventory(params);
  return {
    inventoryId: result.inventoryId,
    locationName: params.locationName || 'Gudang Farmasi Terpusat',
    vitaminId: result.vitaminId,
    vitaminName: result.vitaminName,
    category: result.category,
    dosageUnit: result.dosageUnit,
    currentStock: result.currentStock,
    minStockThreshold: result.minStockThreshold,
    lastRestockDate: result.lastRestockDate,
    updatedAt: result.updatedAt,
    updatedBy: result.updatedBy,
  };
}

export async function adjustPoolInventory(params: {
  locationName?: string;
  vitaminId: string;
  newStock: number;
  reason: string;
  currentUser: { userId: string; fullName: string };
}): Promise<PoolInventoryItem> {
  const result = await adjustMedicalInventory(params);
  return {
    inventoryId: result.inventoryId,
    locationName: params.locationName || 'Gudang Farmasi Terpusat',
    vitaminId: result.vitaminId,
    vitaminName: result.vitaminName,
    category: result.category,
    dosageUnit: result.dosageUnit,
    currentStock: result.currentStock,
    minStockThreshold: result.minStockThreshold,
    updatedAt: result.updatedAt,
    updatedBy: result.updatedBy,
  };
}

export const deductPoolStockForTenko = deductMedicalStockForTenko;
