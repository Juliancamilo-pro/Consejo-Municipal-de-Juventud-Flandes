import { CommitmentItem, ProjectItem } from '../../types/models';
import {
  DonutBreakdownChart,
  HorizontalBarChart,
} from '../../components/charts/SimpleSvgCharts';
import { Card } from '../../components/ui/Card';

export function DashboardOperationalCharts({
  commitments,
  projects,
}: {
  commitments: CommitmentItem[];
  projects: ProjectItem[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
          Tablero de Control · Compromisos Reales
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
          Estado de compromisos del Consejo
        </h2>
        <div className="mt-4">
          <DonutBreakdownChart
            centerLabel="Total"
            centerValue={commitments.length}
            slices={[
              {
                label: 'Cumplidos',
                value: commitments.filter((c) => c.status === 'cumplido').length,
                color: '#059669',
              },
              {
                label: 'En progreso',
                value: commitments.filter((c) => c.status === 'en_progreso').length,
                color: '#1E3A8A',
              },
              {
                label: 'Pendientes',
                value: commitments.filter((c) => c.status === 'pendiente').length,
                color: '#C59B27',
              },
              {
                label: 'Vencidos',
                value: commitments.filter((c) => c.status === 'vencido').length,
                color: '#DC2626',
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
          Avance de Proyectos Juveniles
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
          Ejecución registrada ({projects.length})
        </h2>
        <div className="mt-4">
          <HorizontalBarChart
            emptyLabel="Aún no hay proyectos juveniles en este rango temporal."
            data={projects.slice(0, 5).map((p) => ({
              label: p.title,
              value: p.progressPercent,
              max: 100,
              hint: `${p.progressPercent}%`,
              color: p.progressPercent >= 80 ? '#059669' : '#7B1832',
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
