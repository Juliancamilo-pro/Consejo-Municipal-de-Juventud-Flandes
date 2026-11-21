import {
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Mail,
  UserCheck,
  Users,
} from 'lucide-react';
import { AnimatedCounter } from '../../components/ui/MotionPrimitives';
import { PrivateSection } from './PortalSidebar';

interface DashboardStatsGridProps {
  isBoard: boolean;
  counts: {
    users: number;
    pendingUsers: number;
    documents: number;
    sessions: number;
    commitments: number;
    mailboxOpen: number;
  };
  onNavigateSection: (section: PrivateSection) => void;
}

export function DashboardStatsGrid({
  isBoard,
  counts,
  onNavigateSection,
}: DashboardStatsGridProps) {
  const statItems: {
    eyebrow: string;
    label: string;
    hint: string;
    value: number;
    icon: typeof Users;
    target?: PrivateSection;
    accentColor: string;
  }[] = [
    {
      eyebrow: 'Integrantes',
      label: 'Consejeros registrados',
      hint: 'Directorio activo',
      value: counts.users,
      icon: Users,
      target: isBoard ? 'usuarios' : undefined,
      accentColor: 'bg-[#7B1832]',
    },
    {
      eyebrow: 'Validación',
      label: 'Cuentas pendientes',
      hint: counts.pendingUsers > 0 ? 'Requiere revisión' : 'Al día',
      value: counts.pendingUsers,
      icon: UserCheck,
      target: isBoard ? 'usuarios' : undefined,
      accentColor: 'bg-[#C59B27]',
    },
    {
      eyebrow: 'Repositorio',
      label: 'Documentos y actas',
      hint: 'Archivo oficial',
      value: counts.documents,
      icon: FileText,
      target: 'documentos',
      accentColor: 'bg-[#1E3A8A]',
    },
    {
      eyebrow: 'Plenarias',
      label: 'Sesiones registradas',
      hint: 'Plenarias y actas',
      value: counts.sessions,
      icon: Calendar,
      target: 'sesiones',
      accentColor: 'bg-[#7B1832]',
    },
    {
      eyebrow: 'Veeduría',
      label: 'Compromisos',
      hint: 'Seguimiento CMJ',
      value: counts.commitments,
      icon: CheckSquare,
      target: 'votaciones',
      accentColor: 'bg-[#C59B27]',
    },
    {
      eyebrow: 'Ciudadanía',
      label: 'Radicados en buzón',
      hint: counts.mailboxOpen > 0 ? 'Por atender' : 'Sin pendientes',
      value: counts.mailboxOpen,
      icon: Mail,
      target: 'agenda',
      accentColor: 'bg-[#1E3A8A]',
    },
  ];

  const quickActions: {
    label: string;
    description: string;
    icon: typeof FileText;
    target: PrivateSection;
  }[] = [
    ...(isBoard
      ? [
          {
            label: 'Editar fotos y portal',
            description: 'Portada, imágenes y textos públicos',
            icon: ImageIcon,
            target: 'apariencia' as PrivateSection,
          },
          ...(counts.pendingUsers > 0
            ? [
                {
                  label: `Aprobar cuentas (${counts.pendingUsers})`,
                  description: 'Solicitudes pendientes de consejeros',
                  icon: UserCheck,
                  target: 'usuarios' as PrivateSection,
                },
              ]
            : []),
        ]
      : []),
    {
      label: 'Subir actas y archivos',
      description: 'Repositorio institucional CMJ',
      icon: FileText,
      target: 'documentos',
    },
    {
      label: 'Sesiones y asistencia',
      description: 'Convocar plenaria o registrar quórum',
      icon: Calendar,
      target: 'sesiones',
    },
    {
      label: 'Google Docs y Calendar',
      description: 'Actas colaborativas y agenda',
      icon: CalendarRange,
      target: 'workspace',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statItems.map((item) => {
          const Icon = item.icon;
          const clickable = Boolean(item.target);
          return (
            <button
              key={item.label}
              type="button"
              disabled={!clickable}
              onClick={() => item.target && onNavigateSection(item.target)}
              className={`group relative overflow-hidden rounded-xl border border-stone-200 bg-white p-5 text-left transition-all dark:border-slate-800 dark:bg-slate-900/75 ${
                clickable
                  ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#7B1832]/50 hover:shadow-sm dark:hover:border-[#C59B27]/50'
                  : 'cursor-default'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-[3px] ${item.accentColor}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                    {item.eyebrow}
                  </p>
                  <span className="mt-0.5 block text-xs font-medium text-stone-600 dark:text-slate-300">
                    {item.label}
                  </span>
                  <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-stone-950 dark:text-white">
                    <AnimatedCounter value={item.value} />
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                    <span>{item.hint}</span>
                    {clickable && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-[#1E3A8A] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#60A5FA]">
                        · Abrir
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#FAF8F4] text-[#7B1832] transition-colors group-hover:bg-[#7B1832] group-hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-[#D9B245] dark:group-hover:bg-[#A62B4B] dark:group-hover:text-white">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Acciones rápidas del consejero
          </h2>
          <span className="text-xs text-stone-500 dark:text-slate-400">
            Flandes, Tolima · Periodo 2026–2029
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigateSection(action.target)}
                className="group flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#7B1832]/50 hover:bg-white hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-[#C59B27]/50 dark:hover:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-950 dark:text-white">
                    <Icon
                      className="h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{action.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
                    {action.description}
                  </p>
                </div>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#7B1832] dark:group-hover:text-[#D9B245]"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
