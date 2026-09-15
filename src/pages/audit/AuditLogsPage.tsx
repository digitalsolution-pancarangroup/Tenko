import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog } from '../../types';
import { getAuditLogs } from '../../services/auditService';
import {
  ShieldCheck,
  Search,
  Filter,
  History,
  FileText,
  Clock,
  User,
  RotateCcw,
  CheckCircle,
  Edit,
  Trash2,
  PlusCircle,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterEntity, setFilterEntity] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(150);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.entityId.toLowerCase().includes(q) ||
        (log.userName || '').toLowerCase().includes(q) ||
        (log.userId || '').toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q);

      const matchAct = filterAction === 'ALL' || log.action === filterAction;
      const matchEnt = filterEntity === 'ALL' || log.entity === filterEntity;

      return matchSearch && matchAct && matchEnt;
    });
  }, [logs, searchQuery, filterAction, filterEntity]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
            <PlusCircle className="w-3 h-3" />
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
            <Edit className="w-3 h-3" />
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px]">
            <Trash2 className="w-3 h-3" />
            DELETE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[10px]">
            {action}
          </span>
        );
    }
  };

  return (
    <div id="audit-logs-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            {logs.length} Log Aktivitas
          </span>
          <span className="text-xs text-slate-400 font-medium">
            (Menampilkan {filteredLogs.length} hasil filter)
          </span>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Entity ID, User ID, Nama..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium bg-white focus:outline-none"
            >
              <option value="ALL">Semua Aksi (Action)</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium bg-white focus:outline-none"
            >
              <option value="ALL">Semua Entitas</option>
              <option value="DRIVER">DRIVER</option>
              <option value="TENKO_EXAMINATION">TENKO_EXAMINATION</option>
              <option value="DRIVER_GROUP">DRIVER_GROUP</option>
              <option value="LOCATION">LOCATION</option>
              <option value="NAKES">NAKES</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Log Terpantau: {filteredLogs.length} Catatan
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Memuat audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Belum ada catatan audit log.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[800px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[150px]">Waktu & Tanggal</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Action</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Entitas</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Target ID</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Pelaku (User)</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[220px]">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.auditLogId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-3.5 pl-4 text-slate-600 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <span className="font-bold text-slate-800 text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                        {log.entity}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-bold text-blue-900 whitespace-nowrap">{log.entityId}</td>
                    <td className="py-3.5 px-3.5">
                      <span className="font-bold text-slate-900 block">{log.userName || 'System'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.userId}</span>
                    </td>
                    <td className="py-3.5 px-3.5 pr-4 max-w-sm">
                      <p className="text-slate-600 font-mono text-[11px] truncate" title={log.details ? JSON.stringify(log.details) : '-'}>
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
