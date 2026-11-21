import { ROLE_LABELS, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';

export function UsersFilterAndBatchBar({
  search,
  roleFilter,
  statusFilter,
  selectedUsers,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onBatchApprove,
  onBatchSuspend,
}: {
  search: string;
  roleFilter: string;
  statusFilter: string;
  selectedUsers: UserProfile[];
  onSearchChange: (val: string) => void;
  onRoleFilterChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onBatchApprove: () => void;
  onBatchSuspend: () => void;
}) {
  return (
    <Card padding="sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Buscar consejero"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Nombre, correo o sector..."
        />
        <Select
          label="Filtrar por rol"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([k, lbl]) => (
            <option key={k} value={k}>
              {lbl}
            </option>
          ))}
        </Select>
        <Select
          label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="activo">Activos</option>
          <option value="suspendido">Suspendidos</option>
        </Select>
      </div>

      {selectedUsers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 text-xs dark:border-slate-800">
          <span className="font-semibold text-stone-800 dark:text-slate-100">
            {selectedUsers.length} cuenta(s) seleccionada(s)
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onBatchApprove}>
              Aprobar seleccionados
            </Button>
            <Button size="sm" variant="danger" onClick={onBatchSuspend}>
              Suspender seleccionados
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
