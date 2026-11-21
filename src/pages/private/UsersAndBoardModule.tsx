import { useMemo, useState } from 'react';
import { LayoutGrid, List, ShieldCheck, Users } from 'lucide-react';
import { manageCouncilorAccount, publishCouncilorPublicProfile } from '../../services/privateUsersService';
import { sendEmailNotificationOnServer } from '../../services/sessionApi';
import {
  AttendanceRecord, Commission, CommitmentItem, ROLE_LABELS, UserProfile, UserRole, UserStatus,
} from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { InvitationRotationCard } from './InvitationRotationCard';
import { RoleMatrixModal } from './RoleMatrixModal';
import { UserAccountCard } from './UserAccountCard';
import { PendingUserConfirm, UserAccountConfirmDialog } from './UserAccountConfirmDialog';
import { UserActivityDrawer } from './UserActivityDrawer';
import { UsersFilterAndBatchBar } from './UsersFilterAndBatchBar';

interface UsersAndBoardModuleProps {
  actor: UserProfile;
  users: UserProfile[];
  commissions: Commission[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  onReload: () => Promise<void>;
}

export function UsersAndBoardModule({
  actor,
  users,
  commissions,
  attendance,
  commitments,
  onReload,
}: UsersAndBoardModuleProps) {
  const { showToast } = useToast();
  const isAdmin = actor.role === 'secretario_admin';
  const canManage = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);

  const [guardianNotes, setGuardianNotes] = useState<Record<string, string>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<PendingUserConfirm | null>(null);
  const [busyConfirm, setBusyConfirm] = useState(false);
  const [drawerUser, setDrawerUser] = useState<UserProfile | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.sector || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const applyUserUpdate = async (target: UserProfile, role: UserRole, status: UserStatus) => {
    await manageCouncilorAccount(actor, target, {
      role,
      status,
      positionTitle: target.positionTitle,
      commissionId: target.commissionId,
    });
    if (status === 'activo' && target.status !== 'activo' && target.emailNotifications !== false && target.email) {
      void sendEmailNotificationOnServer({
        to: [target.email],
        subject: 'Tu cuenta en el Portal del CMJ Flandes ha sido activada',
        text: `Hola ${target.displayName}, la Mesa Directiva activó tu cuenta con rol ${role}. Ya puedes ingresar al portal de consejeros.`,
      });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setBusyConfirm(true);
    try {
      if (confirmState.kind === 'single') {
        await applyUserUpdate(confirmState.target, confirmState.role, confirmState.status);
        showToast(`Cuenta de ${confirmState.target.displayName} actualizada.`, 'success');
      } else {
        for (const t of confirmState.targets) {
          await applyUserUpdate(t, t.role, confirmState.status);
        }
        setSelectedUids([]);
        showToast(`${confirmState.targets.length} cuenta(s) actualizadas.`, 'success');
      }
      setConfirmState(null);
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error actualizando cuenta.', 'error');
    } finally {
      setBusyConfirm(false);
    }
  };

  const handlePublishReview = async (
    target: UserProfile,
    approvePublic: boolean,
    showManagementKpis: boolean,
  ) => {
    try {
      const note = guardianNotes[target.uid] ?? target.guardianAuthorizationNote ?? '';
      const comment = reviewComments[target.uid] ?? target.profileReviewComment ?? '';
      await publishCouncilorPublicProfile(actor, target, {
        approvePublic,
        showManagementKpis,
        guardianAuthorizationNote: note,
        reviewComment: comment,
        commissions,
        attendance,
        commitments,
      });
      showToast(
        approvePublic ? `Ficha pública de ${target.displayName} publicada.` : `Ficha de ${target.displayName} actualizada.`,
        'success',
      );
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar la ficha pública.', 'error');
    }
  };

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const selectedUsers = users.filter((u) => selectedUids.includes(u.uid) && u.role !== 'secretario_admin');

  const tableColumns: TableColumn<UserProfile>[] = [
    {
      key: 'name',
      header: 'Consejero',
      sortValue: (u) => u.displayName,
      render: (u) => (
        <div>
          <p className="font-semibold text-stone-900 dark:text-white">{u.displayName}</p>
          <p className="text-[11px] text-stone-500">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', sortValue: (u) => ROLE_LABELS[u.role], render: (u) => <span>{ROLE_LABELS[u.role]}</span> },
    {
      key: 'status',
      header: 'Estado',
      sortValue: (u) => u.status,
      render: (u) => <StatusText label={u.status} tone={u.status === 'activo' ? 'success' : u.status === 'pendiente' ? 'warning' : 'danger'} />,
    },
    { key: 'ficha', header: 'Ficha pública', sortValue: (u) => u.profileReviewStatus || 'borrador', render: (u) => <span>{u.profileReviewStatus || 'borrador'}</span> },
    { key: 'actions', header: 'Actividad', render: (u) => <Button size="sm" variant="ghost" onClick={() => setDrawerUser(u)}>Ver detalle</Button> },
  ];

  if (!canManage) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Acceso exclusivo para Mesa Directiva"
        description="Solo el Secretario Administrador, Presidente y Vicepresidente pueden aprobar cuentas, fichas públicas y roles."
      />
    );
  }

  return (
    <div className="space-y-8">
      {isAdmin && <InvitationRotationCard actor={actor} />}

      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
            Gestión de consejeros, fichas públicas y Mesa Directiva ({filtered.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setMatrixOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Matriz de roles</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'cards' ? 'primary' : 'outline'}
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tarjetas</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'primary' : 'outline'}
              onClick={() => setViewMode('table')}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tabla y Exportar</span>
            </Button>
          </div>
        </div>

        <UsersFilterAndBatchBar
          search={search}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          selectedUsers={selectedUsers}
          onSearchChange={setSearch}
          onRoleFilterChange={setRoleFilter}
          onStatusFilterChange={setStatusFilter}
          onBatchApprove={() => setConfirmState({ kind: 'batch', status: 'activo', targets: selectedUsers })}
          onBatchSuspend={() => setConfirmState({ kind: 'batch', status: 'suspendido', targets: selectedUsers })}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin consejeros que coincidan"
            description="Ajusta los filtros o espera nuevas solicitudes con código de invitación."
          />
        ) : viewMode === 'table' ? (
          <Card>
            <DataTable
              rows={filtered}
              columns={tableColumns}
              rowKey={(u) => u.uid}
              exportFileName="cmj-flandes-consejeros"
              exportTitle="Directorio Interno de Consejeros — CMJ Flandes"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => (
              <UserAccountCard
                key={u.uid}
                user={u}
                selected={selectedUids.includes(u.uid)}
                onToggleSelect={toggleSelect}
                guardianNote={guardianNotes[u.uid] ?? u.guardianAuthorizationNote ?? ''}
                onGuardianNoteChange={(val) =>
                  setGuardianNotes((prev) => ({ ...prev, [u.uid]: val }))
                }
                reviewComment={reviewComments[u.uid] ?? u.profileReviewComment ?? ''}
                onReviewCommentChange={(val) =>
                  setReviewComments((prev) => ({ ...prev, [u.uid]: val }))
                }
                onRequestUserChange={(target, role, status) =>
                  setConfirmState({ kind: 'single', target, role, status })
                }
                onPublishReview={handlePublishReview}
                onOpenActivity={setDrawerUser}
              />
            ))}
          </div>
        )}
      </div>

      <UserAccountConfirmDialog
        confirmState={confirmState}
        loading={busyConfirm}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />

      <UserActivityDrawer
        user={drawerUser}
        commissions={commissions}
        attendance={attendance}
        commitments={commitments}
        onClose={() => setDrawerUser(null)}
      />

      <RoleMatrixModal open={matrixOpen} onClose={() => setMatrixOpen(false)} />
    </div>
  );
}
