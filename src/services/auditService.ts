import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog } from '../types';
import { generateAuditLogDocId } from '../utils/idGenerators';

/**
 * Recursively remove or replace undefined values so Firestore never rejects the payload.
 */
function cleanForFirestore(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanForFirestore(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    } else {
      cleaned[key] = null;
    }
  }
  return cleaned;
}

export async function logAuditAction(params: {
  action: string;
  entity?: string;
  module?: string;
  entityId?: string;
  recordId?: string;
  previousValue?: any;
  newValue?: any;
  details?: any;
  userId: string;
  userName: string;
}): Promise<void> {
  try {
    const actionKey = params.action || 'INFO';
    const logId = generateAuditLogDocId(actionKey);
    const auditData = {
      auditLogId: logId,
      logId,
      module: params.module || params.entity || 'General',
      action: actionKey,
      entity: params.entity || params.module || 'SYSTEM',
      entityId: params.entityId || params.recordId || logId,
      previousValue: cleanForFirestore(params.previousValue),
      newValue: cleanForFirestore(params.newValue),
      details: cleanForFirestore(params.details || (params.newValue !== undefined ? params.newValue : params.previousValue)),
      userId: params.userId || 'SYSTEM',
      userName: params.userName || 'System User',
      timestamp: new Date().toISOString(),
    };

    await setDoc(doc(db, 'auditLogs', logId), auditData);
  } catch (error: any) {
    if (!error?.message?.includes('Quota limit') && !error?.message?.includes('quota')) {
      console.warn('Gagal mencatat audit log:', error?.message || error);
    }
  }
}

export async function getAuditLogs(maxLimit = 150): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        auditLogId: d.id,
        logId: data.logId || d.id,
        module: data.module || data.entity || 'General',
        action: data.action || 'INFO',
        entity: data.entity || data.module || 'SYSTEM',
        entityId: data.entityId || data.recordId || d.id,
        previousValue: data.previousValue,
        newValue: data.newValue,
        details: data.details,
        userId: data.userId || '',
        userName: data.userName || '',
        timestamp: data.timestamp || new Date().toISOString(),
      } as AuditLog;
    });
  } catch (err) {
    try {
      const snap = await getDocs(collection(db, 'auditLogs'));
      return snap.docs
        .map((d) => {
          const data = d.data();
          return {
            auditLogId: d.id,
            logId: data.logId || d.id,
            module: data.module || data.entity || 'General',
            action: data.action || 'INFO',
            entity: data.entity || data.module || 'SYSTEM',
            entityId: data.entityId || data.recordId || d.id,
            previousValue: data.previousValue,
            newValue: data.newValue,
            details: data.details,
            userId: data.userId || '',
            userName: data.userName || '',
            timestamp: data.timestamp || new Date().toISOString(),
          } as AuditLog;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (fallbackErr) {
      console.warn('Fallback to empty audit logs (Firestore quota/offline):', fallbackErr);
      return [];
    }
  }
}
