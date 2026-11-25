import React, { createContext, useContext } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { getPermissionMeta, hasPermission } from '../../lib/permissions';
import type {
  GrantedPermission,
  PermissionKey,
  PrivateModule,
  RoleLabel,
} from '../../types/cmj';

export interface PermissionRequestPrefill {
  permissionKey: PermissionKey;
  targetModule?: PrivateModule;
  commissionId?: string;
}

interface PermissionContextValue {
  uid: string;
  roleLabel: RoleLabel;
  coordinatorCommissionIds: string[];
  grantedPermissions: GrantedPermission[];
  effectivePermissions: PermissionKey[];
  can: (permission: PermissionKey, targetCommissionId?: string) => boolean;
  isCoordinatorOf: (commissionId?: string) => boolean;
  openRequestPermission: (prefill?: PermissionRequestPrefill) => void;
}

const PermissionContext = createContext<PermissionContextValue>({
  uid: '',
  roleLabel: 'Consejero',
  coordinatorCommissionIds: [],
  grantedPermissions: [],
  effectivePermissions: [],
  can: () => false,
  isCoordinatorOf: () => false,
  openRequestPermission: () => undefined,
});

export function PermissionProvider({
  uid,
  roleLabel,
  coordinatorCommissionIds,
  grantedPermissions,
  effectivePermissions,
  onRequestPermission,
  children,
}: {
  uid: string;
  roleLabel: RoleLabel;
  coordinatorCommissionIds: string[];
  grantedPermissions: GrantedPermission[];
  effectivePermissions: PermissionKey[];
  onRequestPermission: (prefill?: PermissionRequestPrefill) => void;
  children: React.ReactNode;
}) {
  const can = (permission: PermissionKey, targetCommissionId?: string) =>
    hasPermission(
      {
        roleLabel,
        active: true,
        coordinatorCommissionIds,
        grantedPermissions,
        effectivePermissions,
      },
      permission,
      targetCommissionId
    );

  const isCoordinatorOf = (commissionId?: string) =>
    Boolean(commissionId && coordinatorCommissionIds.includes(commissionId));

  return (
    <PermissionContext.Provider
      value={{
        uid,
        roleLabel,
        coordinatorCommissionIds,
        grantedPermissions,
        effectivePermissions,
        can,
        isCoordinatorOf,
        openRequestPermission: onRequestPermission,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function PermissionDeniedBanner({
  permission,
  commissionId,
  compact = false,
  customText,
}: {
  permission: PermissionKey;
  commissionId?: string;
  compact?: boolean;
  customText?: string;
}) {
  const { openRequestPermission } = usePermissions();
  const meta = getPermissionMeta(permission);

  if (compact) {
    return (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span>{customText || 'No tienes permiso para esta acción.'}</span>
        {meta.requestable && (
          <button
            type="button"
            onClick={() =>
              openRequestPermission({
                permissionKey: permission,
                targetModule: meta.module,
                commissionId,
              })
            }
            className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            Puedes solicitarlo aquí <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {customText || 'No tienes permiso para esta acción. Puedes solicitarlo aquí'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Permiso requerido: <span className="font-semibold">{meta.label}</span> ({meta.moduleLabel})
          </p>
        </div>
      </div>
      {meta.requestable && (
        <button
          type="button"
          onClick={() =>
            openRequestPermission({
              permissionKey: permission,
              targetModule: meta.module,
              commissionId,
            })
          }
          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white cursor-pointer whitespace-nowrap shrink-0"
        >
          Solicitar permiso <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
