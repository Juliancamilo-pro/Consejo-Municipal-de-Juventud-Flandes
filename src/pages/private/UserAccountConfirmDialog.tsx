import { ROLE_LABELS, UserProfile, UserRole, UserStatus } from '../../types/models';
import { Dialog } from '../../components/ui/Dialog';

export type PendingUserConfirm =
  | { kind: 'single'; target: UserProfile; role: UserRole; status: UserStatus }
  | { kind: 'batch'; status: 'activo' | 'suspendido'; targets: UserProfile[] };

interface UserAccountConfirmDialogProps {
  confirmState: PendingUserConfirm | null;
  loading: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function UserAccountConfirmDialog({
  confirmState,
  loading,
  onConfirm,
  onCancel,
}: UserAccountConfirmDialogProps) {
  let title = '';
  let description = '';
  let confirmLabel = 'Confirmar';
  let destructive = false;

  if (confirmState?.kind === 'batch') {
    title =
      confirmState.status === 'activo'
        ? 'Aprobar cuentas seleccionadas'
        : 'Suspender cuentas seleccionadas';
    description = `Se aplicará el estado "${confirmState.status}" a ${confirmState.targets.length} cuenta(s) y quedará registrado en auditoría.`;
    destructive = confirmState.status === 'suspendido';
  } else if (confirmState?.kind === 'single') {
    title = `Confirmar cambio en ${confirmState.target.displayName}`;
    description = `El rol quedará en "${ROLE_LABELS[confirmState.role]}" y el estado en "${confirmState.status}".`;
    destructive = confirmState.status === 'suspendido';
  }

  return (
    <Dialog
      open={Boolean(confirmState)}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
