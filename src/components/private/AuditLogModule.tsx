import React, { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import type { AuditLog } from '../../types/cmj';

export function AuditLogModule({ auditLogs }: { auditLogs: AuditLog[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter(
      (a) =>
        !q ||
        a.actorName.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.module.toLowerCase().includes(q) ||
        a.targetTitle.toLowerCase().includes(q)
    );
  }, [auditLogs, search]);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" /> Historial de Auditoría
          </h2>
          <p className="text-xs text-slate-500">
            Registro inmutable de acciones realizadas por la Mesa Directiva y Consejeros.
          </p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar auditoría..."
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">Sin eventos registrados aún.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {filtered.map((a) => (
            <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{a.actorName}</span>{' '}
                <span className="text-blue-600 dark:text-cyan-400 font-semibold">
                  ({a.actorRoleLabel})
                </span>{' '}
                — {a.action}: <strong>{a.targetTitle}</strong>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0">{a.module}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default AuditLogModule;
