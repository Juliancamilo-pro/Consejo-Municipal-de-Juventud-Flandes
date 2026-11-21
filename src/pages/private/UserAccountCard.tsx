import { Activity, CheckCircle2 } from 'lucide-react';
import { ROLE_LABELS, UserProfile, UserRole, UserStatus } from '../../types/models';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';

interface UserAccountCardProps {
  user: UserProfile;
  selected: boolean;
  onToggleSelect: (uid: string) => void;
  guardianNote: string;
  onGuardianNoteChange: (val: string) => void;
  reviewComment: string;
  onReviewCommentChange: (val: string) => void;
  onRequestUserChange: (target: UserProfile, role: UserRole, status: UserStatus) => void;
  onPublishReview: (
    target: UserProfile,
    approvePublic: boolean,
    showManagementKpis: boolean,
  ) => Promise<void>;
  onOpenActivity: (target: UserProfile) => void;
}

export function UserAccountCard({
  user: u,
  selected,
  onToggleSelect,
  guardianNote,
  onGuardianNoteChange,
  reviewComment,
  onReviewCommentChange,
  onRequestUserChange,
  onPublishReview,
  onOpenActivity,
}: UserAccountCardProps) {
  const isImmutableAdmin = u.role === 'secretario_admin';
  const reviewStatus = u.profileReviewStatus || 'borrador';

  return (
    <Card padding="sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          {!isImmutableAdmin && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(u.uid)}
              aria-label={`Seleccionar a ${u.displayName}`}
              className="mt-1.5 h-4 w-4 accent-[#7B1832]"
            />
          )}
          <Avatar src={u.photoUrl} name={u.displayName} size="md" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                {u.displayName}
              </h3>
              <StatusText
                label={u.status}
                tone={
                  u.status === 'activo'
                    ? 'success'
                    : u.status === 'pendiente'
                      ? 'warning'
                      : 'danger'
                }
              />
              <StatusText
                label={`Ficha: ${reviewStatus}`}
                tone={reviewStatus === 'publicada' ? 'info' : 'warning'}
              />
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
              {u.email} · {ROLE_LABELS[u.role]}
              {u.sector ? ` · ${u.sector}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => onOpenActivity(u)}>
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Actividad</span>
          </Button>

          {isImmutableAdmin ? (
            <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
              Cuenta inamovible
            </span>
          ) : (
            <>
              <Select
                label=""
                aria-label={`Rol de ${u.displayName}`}
                value={u.role}
                onChange={(e) => onRequestUserChange(u, e.target.value as UserRole, u.status)}
                className="!mt-0 !min-h-[38px] !py-1.5 text-xs"
              >
                <option value="consejero">Consejero</option>
                <option value="lider_comision">Líder de Comisión</option>
                <option value="vicepresidente">Vicepresidente</option>
                <option value="presidente">Presidente</option>
              </Select>

              {u.status === 'pendiente' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onRequestUserChange(u, u.role, 'activo')}
                >
                  Aprobar cuenta
                </Button>
              )}
              {u.status === 'activo' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRequestUserChange(u, u.role, 'suspendido')}
                >
                  Suspender
                </Button>
              )}
              {u.status === 'suspendido' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRequestUserChange(u, u.role, 'activo')}
                >
                  Reactivar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {u.status === 'activo' && (
        <div className="mt-3 flex flex-col gap-3 border-t border-stone-200 pt-3 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {u.isMinor && (
              <div className="min-w-[220px] flex-1">
                <Input
                  label="Autorización acudiente (menor de edad)"
                  value={guardianNote}
                  onChange={(e) => onGuardianNoteChange(e.target.value)}
                  placeholder="Nombre acudiente y radicado/acta"
                  className="!py-1.5 text-xs"
                />
              </div>
            )}
            <div className="min-w-[210px] flex-1">
              <Input
                label="Observación Mesa Directiva (si se devuelve a borrador)"
                value={reviewComment}
                onChange={(e) => onReviewCommentChange(e.target.value)}
                placeholder="Ej. Agrega tus propuestas y foto centrada"
                className="!py-1.5 text-xs"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(u.showManagementKpis)}
                onChange={(e) =>
                  void onPublishReview(u, reviewStatus === 'publicada', e.target.checked)
                }
                className="h-4 w-4 accent-[#7B1832]"
              />
              <span>Mostrar KPIs reales en ficha pública</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void onPublishReview(u, true, Boolean(u.showManagementKpis))}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Publicar ficha</span>
            </Button>
            {(reviewStatus === 'publicada' || reviewStatus === 'revision') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onPublishReview(u, false, Boolean(u.showManagementKpis))}
              >
                Devolver a borrador
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
