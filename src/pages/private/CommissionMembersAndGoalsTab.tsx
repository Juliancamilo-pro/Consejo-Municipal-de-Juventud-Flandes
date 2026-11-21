import { FormEvent, useEffect, useState } from 'react';
import { Check, Trash2, UserPlus, X } from 'lucide-react';
import {
  fetchCommissionJoinRequests,
  reviewCommissionJoinRequest,
} from '../../services/commissionRequestsService';
import { updateCommissionMembers } from '../../services/commissionsService';
import {
  Commission,
  CommissionJoinRequest,
  CommissionMemberEntry,
  CommissionMemberRole,
  UserProfile,
} from '../../types/models';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';

interface MembersTabProps {
  actor: UserProfile;
  commission: Commission;
  users: UserProfile[];
  canManage: boolean;
  isBoard: boolean;
  onReload: () => Promise<void>;
}

export function CommissionMembersTab({
  actor,
  commission,
  users,
  canManage,
  isBoard,
  onReload,
}: MembersTabProps) {
  const [requests, setRequests] = useState<CommissionJoinRequest[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedRole, setSelectedRole] = useState<CommissionMemberRole>('integrante');
  const [memberSearch, setMemberSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCommissionJoinRequests(commission.id)
      .then((list) => {
        if (active) setRequests(list);
      })
      .catch(() => {
        if (active) setRequests([]);
      });
    return () => {
      active = false;
    };
  }, [commission.id]);

  const members: CommissionMemberEntry[] = commission.members || [];
  const memberIds = new Set(members.map((m) => m.uid));
  const candidates = users.filter(
    (u) =>
      u.status === 'activo' &&
      !memberIds.has(u.uid) &&
      (!memberSearch.trim() ||
        u.displayName.toLowerCase().includes(memberSearch.trim().toLowerCase())),
  );

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    const target = users.find((u) => u.uid === selectedUid);
    if (!target) return;
    setBusy(true);
    try {
      const next: CommissionMemberEntry[] = [
        ...members,
        {
          uid: target.uid,
          displayName: target.displayName,
          ...(target.photoUrl ? { photoUrl: target.photoUrl } : {}),
          role: !isBoard && selectedRole === 'lider' ? 'integrante' : selectedRole,
          joinedAtIso: new Date().toISOString().slice(0, 10),
        },
      ];
      await updateCommissionMembers(actor, commission, next);
      setSelectedUid('');
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (uid: string, role: CommissionMemberRole) => {
    setBusy(true);
    try {
      const next = members.map((m) => (m.uid === uid ? { ...m, role } : m));
      await updateCommissionMembers(actor, commission, next);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (uid: string) => {
    setBusy(true);
    try {
      const next = members.filter((m) => m.uid !== uid);
      await updateCommissionMembers(actor, commission, next);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (req: CommissionJoinRequest, decision: 'aprobada' | 'rechazada') => {
    setBusy(true);
    try {
      await reviewCommissionJoinRequest(actor, commission, req, decision);
      setRequests((prev) =>
        prev.map((item) => (item.id === req.id ? { ...item, status: decision } : item)),
      );
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pendiente');

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Vincular integrante del Consejo
          </h3>
          <form onSubmit={handleAddMember} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Input
                label="Buscar consejero activo"
                placeholder="Filtrar por nombre..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <Select
                label="Seleccionar consejero"
                required
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
              >
                <option value="">Elegir consejero...</option>
                {candidates.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Select
                label="Rol interno"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as CommissionMemberRole)}
              >
                <option value="integrante">Integrante</option>
                <option value="secretario">Secretario(a)</option>
                {isBoard && <option value="lider">Líder</option>}
              </Select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" loading={busy} className="w-full">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Agregar</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {canManage && pendingRequests.length > 0 && (
        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Solicitudes de ingreso pendientes ({pendingRequests.length})
          </h3>
          <div className="mt-3 divide-y divide-stone-200 dark:divide-slate-800">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={req.userName} src={req.userPhotoUrl} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-stone-900 dark:text-white">
                      {req.userName}
                    </p>
                    {req.message && (
                      <p className="text-xs text-stone-500 dark:text-slate-400">{req.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleReview(req, 'aprobada')}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Aprobar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleReview(req, 'rechazada')}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Rechazar</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Sin integrantes asignados aún"
          description="Agrega consejeros activos o aprueba solicitudes de ingreso."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <Card key={m.uid} padding="sm" className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.displayName} src={m.photoUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">
                    {m.displayName}
                  </p>
                  <p className="text-xs text-stone-500 capitalize dark:text-slate-400">
                    {m.role === 'lider'
                      ? 'Líder de comisión'
                      : m.role === 'secretario'
                        ? 'Secretario(a)'
                        : 'Integrante'}
                    {m.joinedAtIso ? ` · desde ${m.joinedAtIso}` : ''}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    aria-label={`Rol de ${m.displayName}`}
                    value={m.role}
                    disabled={busy || (!isBoard && m.role === 'lider')}
                    onChange={(e) =>
                      void handleRoleChange(m.uid, e.target.value as CommissionMemberRole)
                    }
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="integrante">Integrante</option>
                    <option value="secretario">Secretario(a)</option>
                    {isBoard && <option value="lider">Líder</option>}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemove(m.uid)}
                    aria-label={`Retirar a ${m.displayName}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { CommissionGoalsTab } from './CommissionGoalsTab';
