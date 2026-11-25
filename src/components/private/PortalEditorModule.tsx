import React, { useState } from 'react';
import { Images, Newspaper, Palette } from 'lucide-react';
import type {
  Commission,
  GalleryAlbum,
  GalleryItem,
  NewsEvent,
  PortalSettings,
  RoleLabel,
} from '../../types/cmj';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';
import { GalleryManagerTab } from './portal-editor/GalleryManagerTab';
import { NewsEventsTab } from './portal-editor/NewsEventsTab';
import { PortalSettingsTab } from './portal-editor/PortalSettingsTab';

type EditorTab = 'identidad' | 'noticias' | 'galeria';

export function PortalEditorModule({
  uid,
  actorName,
  actorRoleLabel,
  settings,
  commissions,
  newsEvents,
  galleryItems,
  galleryAlbums = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  settings: PortalSettings;
  commissions: Commission[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  galleryAlbums?: GalleryAlbum[];
}) {
  const { can } = usePermissions();
  const canEditPortal = can('portal.editar');
  const [activeTab, setActiveTab] = useState<EditorTab>(canEditPortal ? 'identidad' : 'noticias');

  const tabs: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'identidad', label: 'Identidad y Temas', icon: Palette },
    { id: 'noticias', label: `Noticias y Eventos (${newsEvents.length})`, icon: Newspaper },
    { id: 'galeria', label: `Álbumes y Galería (${galleryItems.length})`, icon: Images },
  ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Secciones del editor del portal"
        className="flex flex-wrap gap-2 cmj-card p-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'identidad' &&
        (canEditPortal ? (
          <PortalSettingsTab
            uid={uid}
            actorName={actorName}
            actorRoleLabel={actorRoleLabel}
            settings={settings}
          />
        ) : (
          <PermissionDeniedBanner
            permission="portal.editar"
            customText="No tienes permiso para modificar la identidad visual ni la configuración del portal."
          />
        ))}

      {activeTab === 'noticias' && (
        <NewsEventsTab
          uid={uid}
          actorName={actorName}
          actorRoleLabel={actorRoleLabel}
          commissions={commissions}
          newsEvents={newsEvents}
        />
      )}

      {activeTab === 'galeria' && (
        <GalleryManagerTab
          uid={uid}
          commissions={commissions}
          galleryItems={galleryItems}
          galleryAlbums={galleryAlbums}
        />
      )}
    </div>
  );
}
export default PortalEditorModule;
