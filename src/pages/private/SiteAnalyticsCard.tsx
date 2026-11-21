import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { fetchSiteAnalyticsSummary } from '../../services/analyticsService';
import { SiteAnalyticsRecord } from '../../types/models';
import { HorizontalBarChart } from '../../components/charts/SimpleSvgCharts';
import { Card } from '../../components/ui/Card';

export function SiteAnalyticsCard() {
  const [records, setRecords] = useState<SiteAnalyticsRecord[]>([]);

  useEffect(() => {
    void fetchSiteAnalyticsSummary().then(setRecords);
  }, []);

  const totalsByRoute = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      map.set(r.route, (map.get(r.route) || 0) + Number(r.count || 0));
    });
    return Array.from(map.entries())
      .map(([route, total]) => ({ route, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [records]);

  const totalViews = totalsByRoute.reduce((acc, item) => acc + item.total, 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
            Analítica Institucional Privada · Sin cookies de terceros
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
            Vistas agregadas del portal ({totalViews})
          </h2>
        </div>
        <BarChart3 className="h-5 w-5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
      </div>

      <div className="mt-4">
        <HorizontalBarChart
          emptyLabel="Aún no se han registrado visitas agregadas desde el despliegue actual."
          data={totalsByRoute.map((item) => ({
            label: item.route,
            value: item.total,
            max: Math.max(...totalsByRoute.map((t) => t.total), 1),
            hint: `${item.total} visitas`,
            color: '#1E3A8A',
          }))}
        />
      </div>
    </Card>
  );
}
