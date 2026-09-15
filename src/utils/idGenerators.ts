/**
 * Structured Custom ID Generators for TENKO System (Pancaran Group)
 * 
 * Rules:
 * - Chronological & Alphabetical sorting via YYYYMMDD
 * - Easy human identification without opening the doc
 * - Safe for Firestore document paths (no slashes, no spaces)
 */

function pad(num: number, size: number = 2): string {
  return String(num).padStart(size, '0');
}

export function getDatePart(d: Date = new Date()): { yyyymmdd: string; hhmm: string; hhmmss: string } {
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  return {
    yyyymmdd: `${yyyy}${mm}${dd}`,
    hhmm: `${hh}${min}`,
    hhmmss: `${hh}${min}${ss}`,
  };
}

export function sanitizeCode(str: string | undefined | null, fallback: string = 'UNKNOWN'): string {
  if (!str) return fallback;
  const cleaned = str
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

export function generateRandomCode(length: number = 3): string {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * TENKO Examination ID
 * Format: TNK_YYYYMMDD_DRIVERID_HHMM
 * Example: TNK_20260915_102938_0830
 */
export function generateTenkoExaminationId(driverId: string, date: Date = new Date()): string {
  const { yyyymmdd, hhmm } = getDatePart(date);
  const cleanDriver = sanitizeCode(driverId, 'DRV');
  const rand = generateRandomCode(2);
  return `TNK_${yyyymmdd}_${cleanDriver}_${hhmm}_${rand}`;
}

/**
 * Stock Movement ID (Kartu Stok)
 * Format: MOV_YYYYMMDD_KODEOBAT_TIPE_HHMM_RAND
 * Example: MOV_20260915_VTM01_IN_0830_A1
 */
export function generateStockMovementId(
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  vitaminId: string,
  date: Date = new Date()
): string {
  const { yyyymmdd, hhmm } = getDatePart(date);
  const cleanVit = sanitizeCode(vitaminId, 'MED');
  const cleanType = type === 'ADJUSTMENT' ? 'ADJ' : type;
  const rand = generateRandomCode(2);
  return `MOV_${yyyymmdd}_${cleanVit}_${cleanType}_${hhmm}_${rand}`;
}

/**
 * Pool Inventory Document ID (Saldo Fisik Pool)
 * Format: STK_KODEOBAT_KODEPOOL
 * Example: STK_VTM_01_MARUNDA
 * Note: Idempotent key ensures 1 document per medicine per pool
 */
export function generatePoolInventoryId(locationName: string, vitaminId: string): string {
  const cleanVit = sanitizeCode(vitaminId, 'MED');
  // Shorten location name for readability, e.g. "Pool Marunda - Jakarta Utara" -> "MARUNDA"
  let shortLoc = locationName.replace(/^pool\s+/i, '').split('-')[0].trim();
  const cleanLoc = sanitizeCode(shortLoc, 'POOL');
  return `STK_${cleanVit}_${cleanLoc}`;
}

/**
 * Master Driver Document ID
 * Format: DRV_NIK
 * Example: DRV_102938
 */
export function generateDriverDocId(driverId: string): string {
  const cleanId = sanitizeCode(driverId, 'UNKNOWN');
  // If already starts with DRV_, don't double prefix
  if (cleanId.startsWith('DRV_') || cleanId.startsWith('DRV-')) {
    return `DRV_${cleanId.substring(4)}`;
  }
  return `DRV_${cleanId}`;
}

/**
 * Master Vitamin Document ID
 * Format: VIT_KODEOBAT
 * Example: VIT_VTM_01
 */
export function generateVitaminDocId(vitaminId: string): string {
  const cleanId = sanitizeCode(vitaminId, 'ITEM');
  if (cleanId.startsWith('VIT_') || cleanId.startsWith('VIT-')) {
    return `VIT_${cleanId.substring(4)}`;
  }
  return `VIT_${cleanId}`;
}

/**
 * Master Location Document ID
 * Format: LOC_KODE
 * Example: LOC_MARUNDA, LOC_01
 */
export function generateLocationDocId(locationIdOrName: string): string {
  let shortLoc = locationIdOrName.replace(/^pool\s+/i, '').split('-')[0].trim();
  const clean = sanitizeCode(shortLoc, 'POOL');
  if (clean.startsWith('LOC_') || clean.startsWith('LOC-')) {
    return `LOC_${clean.substring(4)}`;
  }
  return `LOC_${clean}`;
}

/**
 * Audit Log Document ID
 * Format: LOG_YYYYMMDD_HHMMSS_ACTION_RAND
 * Example: LOG_20260915_083015_RESTOCK_A1B
 */
export function generateAuditLogDocId(action: string, date: Date = new Date()): string {
  const { yyyymmdd, hhmmss } = getDatePart(date);
  const cleanAction = sanitizeCode(action, 'ACTION').substring(0, 15);
  const rand = generateRandomCode(3);
  return `LOG_${yyyymmdd}_${hhmmss}_${cleanAction}_${rand}`;
}

/**
 * Driver Health Record Document ID
 * Format: DHR_YYYYMMDD_DRIVERID_RAND
 * Example: DHR_20260915_102938_X7A
 */
export function generateDriverHealthRecordDocId(driverId: string, date: Date = new Date()): string {
  const { yyyymmdd } = getDatePart(date);
  const cleanDriver = sanitizeCode(driverId, 'DRV');
  const rand = generateRandomCode(3);
  return `DHR_${yyyymmdd}_${cleanDriver}_${rand}`;
}
