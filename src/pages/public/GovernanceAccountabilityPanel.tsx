import { PublicPortalState } from '../../hooks/usePublicPortalData';
import {
  DonutBreakdownChart,
  HorizontalBarChart,
} from '../../components/charts/SimpleSvgCharts';
import { Card } from '../../components/ui/Card';

export function GovernanceAccountabilityPanel({ portal }: { portal: PublicPortalState }) {
  const sessionsDone = portal.sessions.filter((s) => s.status === 'realizada').length;
  const sessionsPlanned = portal.sessions.filter((s) => s.status === 'programada').length;
  const avgProgress =
    portal.projects.length > 0
      ? Math.round(
          portal.projects.reduce((acc, p) => acc + p.progressPercent, 0) / portal.projects.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs text-stone-500 dark:text-slate-400">Sesiones realizadas</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">
            {sessionsDone}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-stone-500 dark:text-slate-400">Avance promedio proyectos</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#1E3A8A] dark:text-[#60A5FA]">
            {avgProgress}%
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-stone-500 dark:text-slate-400">Actas e informes públicos</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
            {portal.documents.length}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-stone-500 dark:text-slate-400">Consejeros en directorio</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
            {portal.directory.length}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
            Rendición de Cuentas · Sesiones y Documentos
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
            Distribución documental y sesiones
          </h2>
          <div className="mt-4">
            <DonutBreakdownChart
              centerLabel="Registros"
              centerValue={portal.documents.length + portal.sessions.length}
              slices={[
                {
                  label: 'Actas públicas',
                  value: portal.documents.filter((d) => d.category === 'acta').length,
                  color: '#7B1832',
                },
                {
                  label: 'Informes y resoluciones',
                  value: portal.documents.filter((d) => d.category !== 'acta').length,
                  color: '#1E3A8A',
                },
                {
                  label: 'Sesiones realizadas',
                  value: sessionsDone,
                  color: '#059669',
                },
                {
                  label: 'Sesiones programadas',
                  value: sessionsPlanned,
                  color: '#C59B27',
                },
              ]}
            />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
            Ejecución Real por Proyecto
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
            Avance porcentual público ({portal.projects.length})
          </h2>
          <div className="mt-4">
            <HorizontalBarChart
              emptyLabel="Aún no se han publicado proyectos para rendición de cuentas."
              data={portal.projects.map((p) => ({
                label: p.title,
                value: p.progressPercent,
                max: 100,
                hint: `${p.progressPercent}%`,
                color: p.progressPercent >= 75 ? '#059669' : '#7B1832',
              }))}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
