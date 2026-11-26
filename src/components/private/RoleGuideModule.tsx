import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AUDIT_COMPARISON_MATRIX } from '../../lib/permissions';
import type { RoleLabel } from '../../types/cmj';
import { usePermissions } from './PermissionGate';

const ROLE_CARDS: {
  role: RoleLabel | 'Coordinador';
  title: string;
  accentClass: string;
  description: string;
  permissions: string[];
}[] = [
  {
    role: 'Presidente',
    title: 'Presidente',
    accentClass: 'text-emerald-700 dark:text-emerald-400',
    description:
      'Representante y máxima autoridad del CMJ (Ley 1622 de 2013 y Ley 1885 de 2018). Convoca sesiones, aprueba actas y publicaciones, designa presidencia y ejecuta el Paso 1/3 de solicitudes especiales.',
    permissions: [
      'Acceso total a módulos institucionales, usuarios, seguridad y auditoría',
      'Paso 1/3 obligatorio en solicitudes de permisos especiales y revocación',
      'Aprobación final de actas, documentos públicos y depuración de plataforma',
    ],
  },
  {
    role: 'Vicepresidente',
    title: 'Vicepresidente',
    accentClass: 'text-blue-700 dark:text-cyan-400',
    description:
      'Suple las ausencias de la Presidencia, supervisa transversalmente las 5 comisiones, valida compromisos y planillas, y ejecuta el Paso 2/3 del flujo de permisos.',
    permissions: [
      'Supervisión de las 5 comisiones, planillas de seguimiento y compromisos',
      'Paso 2/3 en aprobación secuencial y delegación por ausencia',
      'Edición del portal público y gestión de votaciones sin asignar Presidencia',
    ],
  },
  {
    role: 'Secretario',
    title: 'Secretario',
    accentClass: 'text-indigo-700 dark:text-indigo-400',
    description:
      'Ministro de fe del CMJ: redacta actas, administra asistencia y quórum, custodia el archivo documental, responde buzón ciudadano y firma el Paso 3/3 final.',
    permissions: [
      'Control de sesiones, asistencia, emisión de actas y plantillas de oficios',
      'Gestión de encuestas, respuestas ciudadanas y archivo documental',
      'Paso 3/3 final de validación y activación automática de permisos especiales',
    ],
  },
  {
    role: 'Coordinador',
    title: 'Coordinador de Comisión (Rol Dinámico)',
    accentClass: 'text-teal-700 dark:text-teal-400',
    description:
      'Cualquier consejero designado en coordinatorUid de una comisión adquiere permisos operativos exclusivamente dentro de su comisión asignada, sin escalar a otras comisiones.',
    permissions: [
      'Editar descripción, plan de trabajo y portada de SU comisión únicamente',
      'Agregar o retirar integrantes activos y administrar tareas de SU comisión',
      'Subir evidencias y documentos vinculados a SU comisión',
    ],
  },
  {
    role: 'Consejero Departamental',
    title: 'Consejero Departamental (Tolima)',
    accentClass: 'text-purple-700 dark:text-purple-400',
    description:
      'Representante municipal ante el Consejo Departamental de Juventud del Tolima (Ley 1622 de 2013 y Ley 1885 de 2018). Formula propuestas, ejerce veeduría juvenil, rinde informes de interlocución y propone puntos al orden del día.',
    permissions: [
      'Crear propuestas ante la administración, registros de veeduría e informes departamentales',
      'Proponer puntos al orden del día de sesiones para aprobación de Mesa Directiva',
      'No puede auto-publicar documentos al portal ciudadano (requiere visto bueno de Presidencia)',
    ],
  },
  {
    role: 'Consejero',
    title: 'Consejero',
    accentClass: 'text-amber-700 dark:text-amber-400',
    description:
      'Participa con voz y voto en sesiones, registra su asistencia por código, cumple sus compromisos, participa en el banco de ideas y puede solicitar permisos especiales justificados.',
    permissions: [
      'Registro de asistencia con código, emisión de voto y actualización de perfil',
      'Gestión de sus tareas asignadas, compromisos propios y banco de ideas',
      'Solicitud de permisos temporales o permanentes con justificación (>=100 caracteres)',
    ],
  },
];

export function RoleGuideModule({ roleLabel }: { roleLabel: RoleLabel }) {
  const { coordinatorCommissionIds, openRequestPermission } = usePermissions();
  const [moduleFilter, setModuleFilter] = useState('all');

  const modules = useMemo(
    () => Array.from(new Set(AUDIT_COMPARISON_MATRIX.map((r) => r.module))),
    []
  );

  const filteredMatrix = useMemo(
    () =>
      moduleFilter === 'all'
        ? AUDIT_COMPARISON_MATRIX
        : AUDIT_COMPARISON_MATRIX.filter((r) => r.module === moduleFilter),
    [moduleFilter]
  );

  return (
    <div className="space-y-6">
      <div className="cmj-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Guía Institucional de Roles y Matriz RBAC · CMJ Flandes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openRequestPermission()}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="h-4 w-4" />
            Solicitar permiso especial
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Tu cargo actual es{' '}
          <strong className="text-slate-900 dark:text-white">{roleLabel}</strong>
          {coordinatorCommissionIds.length > 0 && (
            <>
              {' '}
              con alcance adicional como{' '}
              <strong className="text-teal-700 dark:text-teal-300">
                Coordinador(a) en {coordinatorCommissionIds.length} comisión(es)
              </strong>
            </>
          )}
          . Marco legal: Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs">
          {ROLE_CARDS.map((card) => {
            const isCurrent =
              card.role === roleLabel ||
              (card.role === 'Coordinador' && coordinatorCommissionIds.length > 0);
            return (
              <div
                key={card.role}
                className={`rounded-2xl border p-5 space-y-3 transition-colors ${
                  isCurrent
                    ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`font-bold text-sm flex items-center gap-1.5 ${card.accentClass}`}>
                    {card.role === 'Coordinador' && <FolderKanban className="h-4 w-4" />}
                    {card.title}
                  </h3>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> Activo
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {card.description}
                </p>
                <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {card.permissions.map((perm) => (
                    <li key={perm} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400">•</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flujo de aprobación secuencial */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Flujo Secuencial Obligatorio de Permisos Especiales (3 Pasos)
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Cualquier permiso adicional fuera de tu cargo base debe solicitarse con justificación obligatoria (mínimo 100 caracteres, coherente y sin repeticiones). Se aprueba estrictamente en orden, bloqueando la auto-aprobación:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              step: 'Paso 1 de 3',
              role: 'Presidente',
              detail: 'Evalúa pertinencia institucional, riesgo y alcance. Si rechaza o si se vence >48h, el proceso se detiene o alerta.',
            },
            {
              step: 'Paso 2 de 3',
              role: 'Vicepresidente',
              detail: 'Verifica coordinación operativa y cobertura entre comisiones una vez Presidencia haya aprobado.',
            },
            {
              step: 'Paso 3 de 3',
              role: 'Secretario',
              detail: 'Valida trazabilidad legal y otorga la firma final que activa automáticamente el permiso en servidor y cliente.',
            },
          ].map((item, idx) => (
            <div
              key={item.step}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-1.5 relative"
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                <span>{item.step}</span>
                {idx < 2 && <ArrowRight className="h-3.5 w-3.5 hidden md:inline text-slate-400" />}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{item.role}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Matriz comparativa completa */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Matriz Completa de Permisos (Auditoría Hoy vs Propuesto)
            </h3>
            <p className="text-xs text-slate-500">
              Fuente única de verdad compartida entre interfaz y autorización estricta del servidor.
            </p>
          </div>
          <select
            aria-label="Filtrar matriz por módulo"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          >
            <option value="all">Todos los módulos ({AUDIT_COMPARISON_MATRIX.length})</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-2 font-semibold">Módulo</th>
                <th className="py-2.5 px-2 font-semibold">Acción</th>
                <th className="py-2.5 px-2 font-semibold">Antes (Brecha detectada)</th>
                <th className="py-2.5 px-2 font-semibold text-center">Pres.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Vice.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Sec.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Cons. Dept.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Cons.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Coord. Com.</th>
                <th className="py-2.5 px-2 font-semibold text-center">Solicitable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredMatrix.map((row) => (
                <tr key={row.permissionKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-2 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.module}
                  </td>
                  <td className="py-2.5 px-2 text-slate-700 dark:text-slate-200">
                    <div>{row.action}</div>
                    <div className="font-mono-num text-[10px] text-slate-400">
                      {row.permissionKey}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-slate-500 dark:text-slate-400 max-w-[260px]">
                    {row.currentState}
                  </td>
                  <td className="py-2.5 px-2 text-center font-semibold text-emerald-700 dark:text-emerald-300">
                    {row.proposedPresidente}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-slate-700 dark:text-slate-200">
                    {row.proposedVicepresidente}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-slate-700 dark:text-slate-200">
                    {row.proposedSecretario}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-purple-700 dark:text-purple-300">
                    {row.proposedConsejeroDepartamental}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">
                    {row.proposedConsejero}
                  </td>
                  <td className="py-2.5 px-2 text-center text-teal-700 dark:text-teal-300 font-semibold">
                    {row.proposedCoordinador}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {row.specialRequestable ? (
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Sí
                      </span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default RoleGuideModule;
