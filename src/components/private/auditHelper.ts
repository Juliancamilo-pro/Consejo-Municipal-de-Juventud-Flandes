import { apiRequest } from '../../lib/apiClient';
import type { RoleLabel } from '../../types/cmj';

export async function recordAudit(params: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  action: string;
  module: string;
  targetTitle: string;
}): Promise<void> {
  try {
    await apiRequest('/api/audit', {
      method: 'POST',
      body: {
        action: params.action.slice(0, 180),
        module: params.module.slice(0, 80),
        targetTitle: params.targetTitle.slice(0, 180),
      },
      skipRefresh: true,
    });
  } catch {
    // Registro no bloqueante
  }
}
