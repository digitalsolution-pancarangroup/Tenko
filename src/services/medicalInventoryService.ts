import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  PoolInventoryItem,
  StockMovement,
  VitaminMasterWithStock,
  VitaminItem,
} from '../types';
import { getVitamins } from './healthService';
import { getLocations } from './masterService';
import { logAuditAction } from './auditService';
import { INITIAL_VITAMINS, INITIAL_LOCATIONS } from './seedData';
import { generatePoolInventoryId, generateStockMovementId } from '../utils/idGenerators';

const LOCAL_STORAGE_POOL_INVENTORY_KEY = 'tenko_pool_inventory';
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

function makeInventoryDocId(locationName: string, vitaminId: string): string {
  return generatePoolInventoryId(locationName, vitaminId);
}

// Generate realistic initial pool inventories for testing
export function generateInitialPoolInventories(): PoolInventoryItem[] {
  const pools = INITIAL_LOCATIONS.map((l) => l.locationName);
  const result: PoolInventoryItem[] = [];

  for (const pool of pools) {
    for (const vit of INITIAL_VITAMINS) {
      const docId = makeInventoryDocId(pool, vit.vitaminId);

      // Realistic stock variation:
      // Pool Marunda gets a low stock on Paracetamol (18) and D3 (20) to demonstrate low-stock alert
      let stock = 120;
      let minThreshold = 30;

      if (pool.includes('Marunda')) {
        if (vit.vitaminId === 'VTM-06') stock = 15; // Paracetamol low stock
        else if (vit.vitaminId === 'VTM-04') stock = 18; // Vitamin D3 low stock
        else if (vit.vitaminId === 'VTM-01') stock = 145;
        else if (vit.vitaminId === 'VTM-02') stock = 80;
        else stock = 90;
      } else if (pool.includes('Cikarang')) {
        if (vit.vitaminId === 'VTM-07') stock = 12; // Antasida low
        else stock = 110;
      } else {
        stock = 85;
      }

      result.push({
        inventoryId: docId,
        locationName: pool,
        vitaminId: vit.vitaminId,
        vitaminName: vit.name,
        category: vit.category,
        dosageUnit: vit.dosageUnit,
        currentStock: stock,
        minStockThreshold: minThreshold,
        lastRestockDate: '2026-09-01',
        updatedAt: '2026-09-01T08:00:00.000Z',
        updatedBy: 'Sistem Farmasi Pusat',
      });
    }
  }

  return result;
}

export function generateInitialStockMovements(): StockMovement[] {
  return [
    {
      movementId: 'MOV-20260901-0001',
      movementType: 'IN',
      locationName: 'Pool Marunda - Jakarta Utara',
      vitaminId: 'VTM-01',
      vitaminName: 'Vitamin C 500mg',
      quantity: 150,
      previousStock: 0,
      finalStock: 150,
      dosageUnit: 'Tablet',
      referenceId: 'DROP-PO-2026-0901',
      notes: 'Dropping rutin awal bulan dari Farmasi Pusat',
      performedBy: 'USR-ADMIN-01',
      performedByName: 'Administrator TENKO',
      timestamp: '2026-09-01T08:00:00.000Z',
    },
    {
      movementId: 'MOV-20260901-0002',
      movementType: 'IN',
      locationName: 'Pool Marunda - Jakarta Utara',
      vitaminId: 'VTM-02',
      vitaminName: 'Vitamin B Kompleks (B1, B6, B12)',
      quantity: 100,
      previousStock: 0,
      finalStock: 100,
      dosageUnit: 'Tablet',
      referenceId: 'DROP-PO-2026-0901',
      notes: 'Dropping rutin awal bulan dari Farmasi Pusat',
      performedBy: 'USR-ADMIN-01',
      performedByName: 'Administrator TENKO',
      timestamp: '2026-09-01T08:05:00.000Z',
    },
    {
      movementId: 'MOV-20260904-0001',
      movementType: 'OUT',
      locationName: 'Pool Marunda - Jakarta Utara',
      vitaminId: 'VTM-01',
      vitaminName: 'Vitamin C 500mg',
      quantity: 1,
      previousStock: 150,
      finalStock: 149,
      dosageUnit: 'Tablet',
      referenceId: 'TENKO-20260904-0001',
      driverId: '319260066',
      driverName: 'SOPIYAN',
      notes: 'Dispensing pemeriksaan TENKO dengan keluhan Rest Hours',
      performedBy: 'USR-NAKES-01',
      performedByName: 'Ns. Ratna Sari, S.Kep',
      timestamp: '2026-09-04T08:14:00.000Z',
    },
    {
      movementId: 'MOV-20260904-0002',
      movementType: 'OUT',
      locationName: 'Pool Marunda - Jakarta Utara',
      vitaminId: 'VTM-02',
      vitaminName: 'Vitamin B Kompleks (B1, B6, B12)',
      quantity: 1,
      previousStock: 100,
      finalStock: 99,
      dosageUnit: 'Tablet',
      referenceId: 'TENKO-20260904-0001',
      driverId: '319260066',
      driverName: 'SOPIYAN',
      notes: 'Dispensing pemeriksaan TENKO dengan keluhan Rest Hours',
      performedBy: 'USR-NAKES-01',
      performedByName: 'Ns. Ratna Sari, S.Kep',
      timestamp: '2026-09-04T08:14:30.000Z',
    },
  ];
}

// ================= FETCH POOL INVENTORIES =================
export async function getPoolInventory(locationFilter?: string): Promise<PoolInventoryItem[]> {
  try {
    const snap = await getDocs(collection(db, 'poolInventory'));
    if (!snap.empty) {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          inventoryId: d.id,
          locationId: data.locationId || '',
          locationName: data.locationName || '',
          vitaminId: data.vitaminId || '',
          vitaminName: data.vitaminName || '',
          category: data.category || 'Umum',
          dosageUnit: data.dosageUnit || 'Tablet',
          currentStock: typeof data.currentStock === 'number' ? data.currentStock : 0,
          minStockThreshold: typeof data.minStockThreshold === 'number' ? data.minStockThreshold : 30,
          lastRestockDate: data.lastRestockDate,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy,
        } as PoolInventoryItem;
      });

      if (locationFilter && locationFilter !== 'ALL') {
        return items.filter(
          (i) => i.locationName.toLowerCase() === locationFilter.toLowerCase()
        );
      }
      return items;
    }
  } catch (e) {
    console.warn('Firestore fallback to local pool inventory:', e);
  }

  // Local storage fallback
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_POOL_INVENTORY_KEY);
    if (saved) {
      const parsed: PoolInventoryItem[] = JSON.parse(saved);
      if (locationFilter && locationFilter !== 'ALL') {
        return parsed.filter(
          (i) => i.locationName.toLowerCase() === locationFilter.toLowerCase()
        );
      }
      return parsed;
    }
  } catch {}

  // Seed default initial pool inventory
  const initial = generateInitialPoolInventories();
  try {
    localStorage.setItem(LOCAL_STORAGE_POOL_INVENTORY_KEY, JSON.stringify(initial));
    // Persist to firestore asynchronously in background
    for (const item of initial) {
      setDoc(doc(db, 'poolInventory', item.inventoryId), cleanPayload(item)).catch(() => {});
    }
  } catch {}

  if (locationFilter && locationFilter !== 'ALL') {
    return initial.filter(
      (i) => i.locationName.toLowerCase() === locationFilter.toLowerCase()
    );
  }
  return initial;
}

// ================= ACCUMULATED VITAMINS WITH POOL BREAKDOWN =================
export async function getAllVitaminsWithStock(locationFilter?: string): Promise<VitaminMasterWithStock[]> {
  const [vitamins, poolItems] = await Promise.all([
    getVitamins(),
    getPoolInventory(), // get all pools for breakdown calculation
  ]);

  return vitamins.map((vit) => {
    const matchingPoolItems = poolItems.filter((p) => p.vitaminId === vit.vitaminId);

    // Filter items according to locationFilter if specified and not 'ALL'
    const relevantPoolItems =
      locationFilter && locationFilter !== 'ALL'
        ? matchingPoolItems.filter(
            (p) => p.locationName.toLowerCase() === locationFilter.toLowerCase()
          )
        : matchingPoolItems;

    const totalStock = relevantPoolItems.reduce((acc, curr) => acc + curr.currentStock, 0);

    const poolBreakdown = matchingPoolItems.map((p) => {
      let status: 'SAFE' | 'LOW' | 'OUT' = 'SAFE';
      if (p.currentStock <= 0) status = 'OUT';
      else if (p.currentStock <= p.minStockThreshold) status = 'LOW';

      return {
        locationName: p.locationName,
        stock: p.currentStock,
        minThreshold: p.minStockThreshold,
        status,
      };
    });

    return {
      ...vit,
      totalStockAllPools: totalStock,
      poolBreakdown,
    };
  });
}

// ================= STOCK MOVEMENTS / AUDIT TRAIL =================
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
          (m) => m.locationName.toLowerCase() === locationFilter.toLowerCase()
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
          (m) => m.locationName.toLowerCase() === locationFilter.toLowerCase()
        );
      }
      if (vitaminIdFilter) {
        items = items.filter((m) => m.vitaminId === vitaminIdFilter);
      }
      return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }
  } catch {}

  // Seed default
  const initial = generateInitialStockMovements();
  try {
    localStorage.setItem(LOCAL_STORAGE_MOVEMENTS_KEY, JSON.stringify(initial));
    for (const m of initial) {
      setDoc(doc(db, 'stockMovements', m.movementId), cleanPayload(m)).catch(() => {});
    }
  } catch {}

  let filtered = initial;
  if (locationFilter && locationFilter !== 'ALL') {
    filtered = filtered.filter(
      (m) => m.locationName.toLowerCase() === locationFilter.toLowerCase()
    );
  }
  if (vitaminIdFilter) {
    filtered = filtered.filter((m) => m.vitaminId === vitaminIdFilter);
  }
  return filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

// ================= RESTOCK / PENAMBAHAN OBAT (+) =================
export async function restockPoolInventory(params: {
  locationName: string;
  vitaminId: string;
  quantity: number;
  documentNumber?: string;
  notes?: string;
  date?: string;
  currentUser: { userId: string; fullName: string };
}): Promise<PoolInventoryItem> {
  const { locationName, vitaminId, quantity, documentNumber, notes, date, currentUser } = params;

  const docId = makeInventoryDocId(locationName, vitaminId);
  const currentInventories = await getPoolInventory();
  let existingItem = currentInventories.find(
    (i) => i.inventoryId === docId || (i.locationName === locationName && i.vitaminId === vitaminId)
  );

  const prevStock = existingItem ? existingItem.currentStock : 0;
  const newStock = prevStock + Math.max(1, quantity);

  // If existingItem doesn't exist, get vitamin info
  let vitName = existingItem?.vitaminName || 'Vitamin';
  let vitCat = existingItem?.category || 'Umum';
  let vitUnit = existingItem?.dosageUnit || 'Tablet';

  if (!existingItem) {
    const allVits = await getVitamins();
    const found = allVits.find((v) => v.vitaminId === vitaminId);
    if (found) {
      vitName = found.name;
      vitCat = found.category || 'Umum';
      vitUnit = found.dosageUnit;
    }
  }

  const updatedItem: PoolInventoryItem = {
    inventoryId: docId,
    locationName,
    vitaminId,
    vitaminName: vitName,
    category: vitCat,
    dosageUnit: vitUnit,
    currentStock: newStock,
    minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
    lastRestockDate: date || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  // Write to firestore
  try {
    await setDoc(doc(db, 'poolInventory', docId), cleanPayload(updatedItem));
  } catch (e) {
    console.warn('Firestore write failed for poolInventory:', e);
  }

  // Update local storage
  try {
    const filtered = currentInventories.filter((i) => i.inventoryId !== docId);
    localStorage.setItem(
      LOCAL_STORAGE_POOL_INVENTORY_KEY,
      JSON.stringify([...filtered, updatedItem])
    );
  } catch {}

  // Record stock movement
  const movId = generateStockMovementId('IN', vitaminId);
  const movement: StockMovement = {
    movementId: movId,
    movementType: 'IN',
    locationName,
    vitaminId,
    vitaminName: vitName,
    quantity,
    previousStock: prevStock,
    finalStock: newStock,
    dosageUnit: vitUnit,
    referenceId: documentNumber?.trim() || 'RESTOCK-MANUAL',
    notes: notes?.trim() || 'Penambahan stok dropping farmasi',
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

  // Audit Log
  await logAuditAction({
    module: 'Medical Inventory',
    action: 'RESTOCK',
    entity: 'POOL_INVENTORY',
    entityId: `${locationName} - ${vitName}`,
    newValue: { location: locationName, vitamin: vitName, added: quantity, newStock },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return updatedItem;
}

// ================= ADJUSTMENT / STOCK OPNAME =================
export async function adjustPoolInventory(params: {
  locationName: string;
  vitaminId: string;
  newStock: number;
  reason: string;
  currentUser: { userId: string; fullName: string };
}): Promise<PoolInventoryItem> {
  const { locationName, vitaminId, newStock, reason, currentUser } = params;

  const docId = makeInventoryDocId(locationName, vitaminId);
  const currentInventories = await getPoolInventory();
  const existingItem = currentInventories.find(
    (i) => i.inventoryId === docId || (i.locationName === locationName && i.vitaminId === vitaminId)
  );

  const prevStock = existingItem ? existingItem.currentStock : 0;
  const targetStock = Math.max(0, newStock);
  const diff = targetStock - prevStock;

  const vitName = existingItem?.vitaminName || 'Vitamin';
  const vitCat = existingItem?.category || 'Umum';
  const vitUnit = existingItem?.dosageUnit || 'Tablet';

  const updatedItem: PoolInventoryItem = {
    inventoryId: docId,
    locationName,
    vitaminId,
    vitaminName: vitName,
    category: vitCat,
    dosageUnit: vitUnit,
    currentStock: targetStock,
    minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  try {
    await setDoc(doc(db, 'poolInventory', docId), cleanPayload(updatedItem));
  } catch (e) {
    console.warn('Firestore write failed for adjustment:', e);
  }

  try {
    const filtered = currentInventories.filter((i) => i.inventoryId !== docId);
    localStorage.setItem(
      LOCAL_STORAGE_POOL_INVENTORY_KEY,
      JSON.stringify([...filtered, updatedItem])
    );
  } catch {}

  // Record adjustment movement
  const movId = generateStockMovementId('ADJUSTMENT', vitaminId);
  const movement: StockMovement = {
    movementId: movId,
    movementType: 'ADJUSTMENT',
    locationName,
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
  } catch {}

  try {
    const existingMoves = await getStockMovements();
    localStorage.setItem(
      LOCAL_STORAGE_MOVEMENTS_KEY,
      JSON.stringify([movement, ...existingMoves.filter((m) => m.movementId !== movId)])
    );
  } catch {}

  await logAuditAction({
    module: 'Medical Inventory',
    action: 'STOCK_ADJUSTMENT',
    entity: 'POOL_INVENTORY',
    entityId: `${locationName} - ${vitName}`,
    newValue: { location: locationName, vitamin: vitName, prevStock, targetStock, reason },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return updatedItem;
}

// ================= DEDUCT STOCK ON TENKO EXAMINATION =================
export async function deductPoolStockForTenko(params: {
  locationName: string;
  items: { vitaminId?: string; name: string; quantity: number; unit?: string }[];
  tenkoId: string;
  driverId: string;
  driverName: string;
  currentUser: { userId: string; fullName: string };
}): Promise<void> {
  const { locationName, items, tenkoId, driverId, driverName, currentUser } = params;

  if (!items || items.length === 0) return;

  const currentInventories = await getPoolInventory();
  const allVitamins = await getVitamins();

  for (const item of items) {
    // Resolve vitaminId
    let vitId = item.vitaminId;
    if (!vitId) {
      const match = allVitamins.find((v) => v.name.toLowerCase() === item.name.toLowerCase());
      if (match) vitId = match.vitaminId;
    }

    if (!vitId) continue;

    const docId = makeInventoryDocId(locationName, vitId);
    const existingItem = currentInventories.find(
      (i) => i.inventoryId === docId || (i.locationName.toLowerCase() === locationName.toLowerCase() && i.vitaminId === vitId)
    );

    const prevStock = existingItem ? existingItem.currentStock : 50;
    const deductQty = Math.max(1, item.quantity || 1);
    const newStock = Math.max(0, prevStock - deductQty);

    const vitName = existingItem?.vitaminName || item.name;
    const vitCat = existingItem?.category || 'Umum';
    const vitUnit = existingItem?.dosageUnit || item.unit || 'Tablet';

    const updatedItem: PoolInventoryItem = {
      inventoryId: docId,
      locationName,
      vitaminId: vitId,
      vitaminName: vitName,
      category: vitCat,
      dosageUnit: vitUnit,
      currentStock: newStock,
      minStockThreshold: existingItem ? existingItem.minStockThreshold : 30,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    };

    // Save inventory update
    try {
      await setDoc(doc(db, 'poolInventory', docId), cleanPayload(updatedItem));
    } catch (e) {
      console.warn('Failed firestore write on Tenko deduction:', e);
    }

    // Update local cache
    try {
      const idx = currentInventories.findIndex((i) => i.inventoryId === docId);
      if (idx >= 0) currentInventories[idx] = updatedItem;
      else currentInventories.push(updatedItem);
      localStorage.setItem(LOCAL_STORAGE_POOL_INVENTORY_KEY, JSON.stringify(currentInventories));
    } catch {}

    // Record OUT movement
    const movId = generateStockMovementId('OUT', vitId);
    const movement: StockMovement = {
      movementId: movId,
      movementType: 'OUT',
      locationName,
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

// ================= UPDATE MIN STOCK THRESHOLD =================
export async function updateMinStockThreshold(
  locationName: string,
  vitaminId: string,
  threshold: number,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = makeInventoryDocId(locationName, vitaminId);
  try {
    await updateDoc(doc(db, 'poolInventory', docId), {
      minStockThreshold: Math.max(1, threshold),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    });
  } catch (e) {
    console.warn('Firestore update failed for minStockThreshold:', e);
  }

  try {
    const current = await getPoolInventory();
    const updated = current.map((i) =>
      i.inventoryId === docId ? { ...i, minStockThreshold: Math.max(1, threshold) } : i
    );
    localStorage.setItem(LOCAL_STORAGE_POOL_INVENTORY_KEY, JSON.stringify(updated));
  } catch {}
}
