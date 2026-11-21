import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

interface TerritorialDirectoryPanelProps {
  directory: PublicDirectoryMember[];
  onNavigate: (route: AppRoute) => void;
}

export function TerritorialDirectoryPanel({
  directory,
  onNavigate,
}: TerritorialDirectoryPanelProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, PublicDirectoryMember[]>();
    directory.forEach((member) => {
      const zone = member.sector?.trim() || 'Cobertura municipal (Flandes)';
      const list = map.get(zone) || [];
      list.push(member);
      map.set(zone, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es-CO'));
  }, [directory]);

  const [selectedZone, setSelectedZone] = useState<string>('');

  if (directory.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="Sin cobertura territorial publicada aún"
        description="Cuando los consejeros publiquen su sector, barrio o vereda aparecerán agrupados en este directorio."
      />
    );
  }

  const visibleGroups = selectedZone
    ? grouped.filter(([zone]) => zone === selectedZone)
    : grouped;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedZone('')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            !selectedZone
              ? 'border-[#7B1832] bg-[#7B1832] text-white'
              : 'border-stone-200 bg-white text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Todos los sectores ({directory.length})
        </button>
        {grouped.map(([zone, members]) => (
          <button
            key={zone}
            type="button"
            onClick={() => setSelectedZone(zone)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              selectedZone === zone
                ? 'border-[#7B1832] bg-[#7B1832] text-white'
                : 'border-stone-200 bg-white text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {zone} ({members.length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleGroups.map(([zone, members]) => (
          <Card key={zone}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{zone}</span>
            </div>
            <ul className="mt-3 divide-y divide-stone-200 dark:divide-slate-800">
              {members.map((m) => (
                <li key={m.uid} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={m.photoUrl} name={m.displayName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-stone-950 dark:text-white">
                        {m.displayName}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-slate-400">
                        {ROLE_LABELS[m.role]}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(`/consejeros/${m.slug || slugifyCouncilorName(m.displayName, m.uid)}`)
                    }
                    className="text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                  >
                    Ver ficha
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
