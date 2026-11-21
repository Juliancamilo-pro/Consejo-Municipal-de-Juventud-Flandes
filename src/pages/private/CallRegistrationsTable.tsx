import { Download } from 'lucide-react';
import { CallRegistration } from '../../types/participation';
import { exportRegistrationsPdf } from '../../utils/participationExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, TableColumn } from '../../components/ui/Table';

export function CallRegistrationsTable({ registrations }: { registrations: CallRegistration[] }) {
  const columns: TableColumn<CallRegistration>[] = [
    {
      key: 'fullName',
      header: 'Joven inscrito',
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div>
          <p className="font-semibold text-stone-900 dark:text-white">{r.fullName}</p>
          <p className="text-[11px] text-stone-500">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'callTitle',
      header: 'Convocatoria',
      sortValue: (r) => r.callTitle,
      render: (r) => <span>{r.callTitle}</span>,
    },
    {
      key: 'age',
      header: 'Edad',
      sortValue: (r) => r.age,
      align: 'right',
      render: (r) => <span className="font-mono-tabular">{r.age} años</span>,
    },
    {
      key: 'neighborhood',
      header: 'Barrio / Vereda',
      sortValue: (r) => r.neighborhood,
      render: (r) => <span>{r.neighborhood}</span>,
    },
    {
      key: 'phone',
      header: 'Teléfono',
      exportValue: (r) => r.phone || '',
      render: (r) => <span className="font-mono-tabular">{r.phone || '—'}</span>,
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Listado real de jóvenes inscritos en convocatorias
        </h2>
        <Button size="sm" variant="outline" onClick={() => void exportRegistrationsPdf(registrations)}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Exportar PDF</span>
        </Button>
      </div>
      <DataTable
        rows={registrations}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Buscar por nombre, barrio o convocatoria..."
        searchableText={(r) => `${r.fullName} ${r.neighborhood} ${r.callTitle} ${r.email}`}
        exportFileName="cmj-flandes-inscritos-convocatorias"
        emptyText="Aún no hay jóvenes inscritos en las convocatorias."
      />
    </Card>
  );
}
