import React from 'react';
import type { CouncilSession, PublicCouncilor } from '../../../types/cmj';
import { MediaUploader } from '../../MediaUploader';
import { ResponsiveModal } from '../../ui/DataTableUI';

export function SessionExcuseModal({
  open,
  councilorName,
  session,
  reason,
  fileUrl,
  fileName,
  submitting,
  onReasonChange,
  onFileUploaded,
  onSubmit,
  onClose,
}: {
  open: boolean;
  councilorName: string;
  session: CouncilSession | null;
  reason: string;
  fileUrl: string;
  fileName: string;
  submitting: boolean;
  onReasonChange: (v: string) => void;
  onFileUploaded: (url: string, name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  if (!session) return null;

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Registrar Excusa Formal"
      subtitle={`${councilorName} · ${session.title}`}
      maxWidthClass="sm:max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Motivo de inasistencia o incapacidad *
          </label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ej: horario académico, laboral, fuerza mayor..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs"
          />
        </div>

        <MediaUploader
          storageFolder={`excuses/${session.id}`}
          label="Adjuntar soporte opcional (PDF, imagen o certificado)"
          onUploaded={(files) => {
            if (files[0]) {
              onFileUploaded(files[0].url, files[0].fileName);
            }
          }}
        />

        {fileUrl && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Soporte listo: {fileName || 'Archivo adjunto'}
          </p>
        )}

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
            disabled={submitting}
            className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {submitting ? 'Guardando...' : 'Guardar excusa'}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

export function SessionPrintableModal({
  open,
  session,
  activeCouncilors,
  presentCount,
  requiredQuorum,
  onClose,
}: {
  open: boolean;
  session: CouncilSession | null;
  activeCouncilors: PublicCouncilor[];
  presentCount: number;
  requiredQuorum: number;
  onClose: () => void;
}) {
  if (!open || !session) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/80 p-0 sm:p-4 overflow-y-auto flex items-stretch sm:items-center justify-center print:static print:bg-white print:p-0 print:block">
      <div className="w-full max-w-3xl bg-white text-slate-900 rounded-none sm:rounded-2xl max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto p-4 sm:p-8 pb-safe-bottom space-y-5 shadow-2xl my-0 sm:my-auto print:shadow-none print:max-w-none print:max-h-none print:p-2">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/751360231_18083936480402166_5535085692637315625_n__1__996feb43.jpg"
              alt="Logo CMJ Flandes"
              className="h-12 w-12 rounded-xl object-cover shrink-0"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Consejo Municipal de Juventudes de Flandes · Tolima
              </p>
              <h2 className="mt-0.5 text-lg sm:text-xl font-extrabold">{session.title}</h2>
              <p className="text-xs text-slate-600">
                Tipo: {session.sessionType} · Fecha: {session.dateIso} · {session.timeRange} · Lugar:{' '}
                {session.location}
              </p>
            </div>
          </div>
          <div className="flex gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[38px] rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase">Orden del Día</h3>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
            {session.agenda || 'Sin orden del día detallado.'}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase mb-2">
            Registro Oficial de Asistencia y Quórum ({presentCount}/{requiredQuorum})
          </h3>
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[480px] text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">Consejero(a)</th>
                  <th className="border border-slate-300 p-2 text-left">Cargo</th>
                  <th className="border border-slate-300 p-2 text-left">Estado</th>
                  <th className="border border-slate-300 p-2 text-left">Observación / Excusa</th>
                </tr>
              </thead>
              <tbody>
                {activeCouncilors.map((c) => {
                  const st = session.attendance?.[c.uid] || 'ausente';
                  const exc = session.excuses?.[c.uid];
                  return (
                    <tr key={c.uid}>
                      <td className="border border-slate-300 p-2 font-medium">{c.fullName}</td>
                      <td className="border border-slate-300 p-2">{c.roleLabel}</td>
                      <td className="border border-slate-300 p-2 font-semibold capitalize">{st}</td>
                      <td className="border border-slate-300 p-2 text-slate-600">
                        {exc?.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 text-xs text-center">
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold">Presidencia CMJ Flandes</p>
            <p className="text-slate-500">Firma</p>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold">Secretaría General CMJ Flandes</p>
            <p className="text-slate-500">Firma y Fe Pública</p>
          </div>
        </div>
      </div>
    </div>
  );
}
