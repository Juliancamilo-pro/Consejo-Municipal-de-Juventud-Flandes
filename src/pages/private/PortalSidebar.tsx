import {
  Award,
  BookMarked,
  CalendarClock,
  CalendarRange,
  CheckSquare,
  FileText,
  FolderKanban,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LucideIcon,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Vote,
} from 'lucide-react';
import { ROLE_LABELS, UserProfile } from '../../types/models';
import { Avatar } from '../../components/ui/Avatar';

export type PrivateSection =
  | 'resumen'
  | 'apariencia'
  | 'workspace'
  | 'usuarios'
  | 'comisiones'
  | 'documentos'
  | 'sesiones'
  | 'votaciones'
  | 'plan_certificados'
  | 'participacion_admin'
  | 'plantillas'
  | 'ayuda'
  | 'agenda';

export interface SidebarNavItem {
  id: PrivateSection;
  label: string;
  group: 'principal' | 'gestion' | 'herramientas';
  icon: LucideIcon;
  count?: number;
}

interface PortalSidebarProps {
  profile: UserProfile;
  activeSection: PrivateSection;
  onSelect: (section: PrivateSection) => void;
  items: SidebarNavItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function buildSidebarItems(
  isBoard: boolean,
  counts: { pendingUsers: number; mailboxOpen: number },
): SidebarNavItem[] {
  return [
    {
      id: 'resumen',
      label: 'Resumen y Perfil',
      group: 'principal',
      icon: LayoutDashboard,
    },
    ...(isBoard
      ? [
          {
            id: 'apariencia' as PrivateSection,
            label: 'Editar Fotos y Portal',
            group: 'principal' as const,
            icon: ImageIcon,
          },
          {
            id: 'usuarios' as PrivateSection,
            label: 'Usuarios y Mesa',
            group: 'principal' as const,
            icon: Users,
            count: counts.pendingUsers > 0 ? counts.pendingUsers : undefined,
          },
          {
            id: 'participacion_admin' as PrivateSection,
            label: 'Encuestas y Convocatorias',
            group: 'gestion' as const,
            icon: Megaphone,
          },
        ]
      : []),
    {
      id: 'comisiones',
      label: 'Comisiones y Contenidos',
      group: 'gestion',
      icon: FolderKanban,
    },
    {
      id: 'documentos',
      label: 'Documentos y Actas',
      group: 'gestion',
      icon: FileText,
    },
    {
      id: 'sesiones',
      label: 'Sesiones y Asistencia',
      group: 'gestion',
      icon: CalendarClock,
    },
    {
      id: 'votaciones',
      label: 'Votaciones y Compromisos',
      group: 'gestion',
      icon: Vote,
    },
    {
      id: 'plan_certificados',
      label: isBoard ? 'Plan, Certificados e Ideas' : 'Plan de Acción Anual',
      group: 'gestion',
      icon: Award,
    },
    {
      id: 'agenda',
      label: 'Agenda, Buzón y Auditoría',
      group: 'herramientas',
      icon: CheckSquare,
      count: counts.mailboxOpen > 0 ? counts.mailboxOpen : undefined,
    },
    {
      id: 'plantillas',
      label: 'Plantillas de Oficios',
      group: 'herramientas',
      icon: BookMarked,
    },
    {
      id: 'workspace',
      label: 'Google Docs y Calendar',
      group: 'herramientas',
      icon: CalendarRange,
    },
    {
      id: 'ayuda',
      label: 'Guía del Consejero',
      group: 'herramientas',
      icon: HelpCircle,
    },
  ];
}

const GROUP_TITLES: Record<SidebarNavItem['group'], string> = {
  principal: 'Mesa y Despacho',
  gestion: 'Gestión del Consejo',
  herramientas: 'Agenda y Herramientas',
};

export function PortalSidebar({
  profile,
  activeSection,
  onSelect,
  items,
  collapsed = false,
  onToggleCollapse,
}: PortalSidebarProps) {
  const groups: SidebarNavItem['group'][] = ['principal', 'gestion', 'herramientas'];

  return (
    <>
      <aside
        aria-label="Menú lateral del panel de consejeros"
        className={`hidden transition-all duration-200 lg:block lg:shrink-0 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'
        }`}
      >
        <div className="sticky top-24 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/80">
          <div className="cmj-tricolor-rule h-[3px]" />

          <div className="border-b border-stone-200/80 bg-[#FAF8F4] p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
              {!collapsed && (
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar src={profile.photoUrl} name={profile.displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-950 dark:text-white">
                      {profile.displayName}
                    </p>
                    <p className="truncate text-[11px] font-medium text-[#7B1832] dark:text-[#D9B245]">
                      {ROLE_LABELS[profile.role]}
                    </p>
                  </div>
                </div>
              )}
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
                  aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
            {!collapsed && (
              <p className="mt-2.5 text-[11px] font-medium tracking-wider text-stone-500 uppercase dark:text-slate-400">
                Flandes, Tolima · 2026–2029
              </p>
            )}
          </div>

          <nav className="space-y-4 p-2.5">
            {groups.map((group) => {
              const groupItems = items.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;

              return (
                <div key={group}>
                  {!collapsed && (
                    <p className="px-3 text-[11px] font-semibold tracking-wider text-stone-400 uppercase dark:text-slate-500">
                      {GROUP_TITLES[group]}
                    </p>
                  )}
                  <ul className="mt-1 space-y-1">
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            title={collapsed ? item.label : undefined}
                            onClick={() => onSelect(item.id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex min-h-[40px] w-full items-center ${
                              collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3'
                            } rounded-lg py-2 text-left text-sm transition-colors ${
                              isActive
                                ? 'bg-[#7B1832]/10 font-semibold text-[#7B1832] dark:bg-[#C59B27]/15 dark:text-[#E5C158]'
                                : 'font-medium text-stone-700 hover:bg-stone-100/80 hover:text-stone-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {!collapsed && <span className="truncate">{item.label}</span>}
                            </span>
                            {!collapsed && typeof item.count === 'number' && (
                              <span className="font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                                {item.count}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <nav
        aria-label="Navegación móvil del panel de consejeros"
        className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                isActive
                  ? 'border-[#7B1832] bg-[#7B1832] font-medium text-white dark:border-[#C59B27] dark:bg-[#C59B27] dark:text-slate-950'
                  : 'border-stone-200 bg-white font-medium text-stone-700 hover:bg-stone-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="font-mono-tabular text-xs opacity-90">({item.count})</span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
