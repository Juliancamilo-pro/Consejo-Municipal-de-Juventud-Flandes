import { Database, Download } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { downloadCsvDataset, downloadJsonDataset } from '../../utils/dataExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function NewsOpenDataTab({ portal }: { portal: PublicPortalState }) {
  const openDataSets = [
    {
      id: 'proyectos',
      title: 'Proyectos juveniles publicados',
      rows: portal.projects.map((p) => ({
        id: p.id,
        titulo: p.title,
        resumen: p.summary,
        avance_porcentaje: p.progressPercent,
        estado: p.status,
      })),
    },
    {
      id: 'sesiones',
      title: 'Sesiones públicas del Consejo',
      rows: portal.sessions.map((s) => ({
        id: s.id,
        titulo: s.title,
        tipo: s.sessionType,
        fecha: s.dateIso,
        lugar: s.location,
        estado: s.status,
      })),
    },
    {
      id: 'documentos',
      title: 'Actas e informes públicos',
      rows: portal.documents.map((d) => ({
        id: d.id,
        titulo: d.title,
        categoria: d.category,
        version: d.currentVersion,
        archivo: d.fileName,
      })),
    },
    {
      id: 'comisiones',
      title: 'Comisiones de trabajo activas',
      rows: portal.commissions.map((c) => ({
        id: c.id,
        nombre: c.name,
        lider: c.leaderName || 'Sin asignar',
        integrantes: c.memberUids?.length ?? 0,
      })),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {openDataSets.map((ds) => (
        <Card key={ds.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#1E3A8A] dark:text-[#60A5FA]">
                <Database className="h-4 w-4" aria-hidden="true" />
                <span>Conjunto abierto</span>
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
                {ds.title}
              </h2>
              <p className="mt-1 font-mono-tabular text-xs text-stone-500 dark:text-slate-400">
                Registros disponibles: {ds.rows.length}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={ds.rows.length === 0}
              onClick={() => downloadCsvDataset(`cmj-flandes-${ds.id}`, ds.rows)}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Descargar CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={ds.rows.length === 0}
              onClick={() => downloadJsonDataset(`cmj-flandes-${ds.id}`, ds.rows)}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Descargar JSON</span>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
