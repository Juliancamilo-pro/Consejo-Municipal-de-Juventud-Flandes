import React from 'react';
import type { Commission, CouncilSession } from '../../../types/cmj';
import { ResponsiveModal } from '../../ui/DataTableUI';
import { ACTA_TEMPLATES } from './actasShared';

export function ActaCreateModal({
  open,
  onClose,
  sessions,
  commissions,
  newTemplateId,
  onTemplateChange,
  newSessionId,
  onSessionSelect,
  newCommissionId,
  onCommissionChange,
  newYear,
  onYearChange,
  newTitle,
  onTitleChange,
  newDate,
  onDateChange,
  newLocation,
  onLocationChange,
  creating,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  sessions: CouncilSession[];
  commissions: Commission[];
  newTemplateId: string;
  onTemplateChange: (v: string) => void;
  newSessionId: string;
  onSessionSelect: (sid: string) => void;
  newCommissionId: string;
  onCommissionChange: (v: string) => void;
  newYear: number;
  onYearChange: (v: number) => void;
  newTitle: string;
  onTitleChange: (v: string) => void;
  newDate: string;
  onDateChange: (v: string) => void;
  newLocation: string;
  onLocationChange: (v: string) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Nueva Acta Oficial"
      subtitle={`Consecutivo automático vigencia ${newYear}`}
      maxWidthClass="sm:max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Plantilla base
            </label>
            <select
              value={newTemplateId}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {ACTA_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Vigencia (Año)
            </label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              min={2020}
              max={2040}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono-num"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Vincular sesión (opcional)
            </label>
            <select
              value={newSessionId}
              onChange={(e) => onSessionSelect(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Sin sesión vinculada</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.dateIso} · {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Ámbito / Comisión
            </label>
            <select
              value={newCommissionId}
              onChange={(e) => onCommissionChange(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Plenaria General CMJ</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Título oficial del acta *
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Ej: Plenaria Ordinaria de Mayo"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fecha de reunión
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Lugar de reunión
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="Lugar de reunión"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={creating}
            className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {creating ? 'Creando...' : 'Crear borrador de acta'}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
