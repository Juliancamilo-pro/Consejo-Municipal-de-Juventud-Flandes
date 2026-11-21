import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isAdminCredentialConfigured } from './authHelpers.ts';

export interface ServerSecurityAuditEvent {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
  createdAtIso: string;
}

const memoryEvents: ServerSecurityAuditEvent[] = [];

export async function recordServerSecurityAudit(input: {
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
}): Promise<void> {
  const event: ServerSecurityAuditEvent = {
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorUid: input.actorUid.slice(0, 128),
    actorEmail: input.actorEmail.slice(0, 160),
    actorRole: input.actorRole.slice(0, 40),
    action: input.action.slice(0, 120),
    targetCollection: input.targetCollection.slice(0, 80),
    ...(input.targetId ? { targetId: input.targetId.slice(0, 128) } : {}),
    summary: input.summary.slice(0, 500),
    createdAtIso: new Date().toISOString(),
  };

  memoryEvents.unshift(event);
  if (memoryEvents.length > 100) {
    memoryEvents.length = 100;
  }

  if (isAdminCredentialConfigured()) {
    try {
      await getAdminFirestore()
        .collection('audit_logs')
        .add({
          actorUid: event.actorUid,
          actorEmail: event.actorEmail,
          actorRole: event.actorRole,
          action: event.action,
          targetCollection: event.targetCollection,
          ...(event.targetId ? { targetId: event.targetId } : {}),
          summary: event.summary,
          createdAt: FieldValue.serverTimestamp(),
        });
    } catch {
      // Silencioso si no hay permisos IAM en entorno local
    }
  }
}

export function getRecentServerSecurityEvents(): ServerSecurityAuditEvent[] {
  return [...memoryEvents];
}
