import React from 'react';
import { BookOpen } from 'lucide-react';
import type { RoleLabel } from '../../types/cmj';

export function RoleGuideModule({ roleLabel }: { roleLabel: RoleLabel }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Guía Institucional de Cargos · CMJ Flandes
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Tu cargo actual es <strong>{roleLabel}</strong>. En el marco de la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018, estas son las funciones dentro del portal:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-blue-600 dark:text-cyan-400">Presidente</h3>
          <p>Convoca y preside sesiones plenarias, aprueba publicaciones del portal público, firma oficios y actas, y supervisa indicadores globales y auditoría.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Vicepresidente</h3>
          <p>Apoya y reemplaza a la Presidencia, supervisa el cumplimiento de metas de las 5 comisiones y valida el avance de compromisos y planillas.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400">Secretario</h3>
          <p>Gestiona el directorio de consejeros y cuentas, levanta actas y asistencia, gestiona planillas Excel/PDF, documentos, convocatorias y configuración visual del portal.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400">Consejero</h3>
          <p>Trabaja en su comisión asignada, actualiza sus tareas y compromisos, participa en votaciones, registra asistencia por código y propone iniciativas en el buzón.</p>
        </div>
      </div>
    </div>
  );
}
export default RoleGuideModule;
