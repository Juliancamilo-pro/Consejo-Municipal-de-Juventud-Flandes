import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { AnnualActionPlanItem, ActionPlanAxis, UserProfile } from '../types/models';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export const ACTION_PLAN_AXES: ActionPlanAxis[] = [
  'Participación Juvenil',
  'Educación y Cultura',
  'Ambiente y Ruralidad',
  'Deporte y Bienestar',
  'Control Social y Veeduría',
];

export async function fetchAnnualActionPlan(): Promise<AnnualActionPlanItem[]> {
  try {
    const q = query(collection(db, 'annual_action_plans'), orderBy('year', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<AnnualActionPlanItem, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'annual_action_plans');
  }
}

export async function saveActionPlanItem(
  actor: UserProfile,
  payload: Omit<AnnualActionPlanItem, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): Promise<void> {
  try {
    const base = {
      year: payload.year,
      axis: payload.axis,
      title: payload.title.trim().slice(0, 180),
      ...(payload.commissionId ? { commissionId: payload.commissionId } : {}),
      goalDescription: payload.goalDescription.trim().slice(0, 1000),
      indicator: payload.indicator.trim().slice(0, 180),
      targetValue: Math.max(1, Number(payload.targetValue) || 1),
      executedValue: Math.max(0, Number(payload.executedValue) || 0),
      status: payload.status,
      responsibleName: payload.responsibleName.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    };

    if (payload.id) {
      await updateDoc(doc(db, 'annual_action_plans', payload.id), base);
    } else {
      await addDoc(collection(db, 'annual_action_plans'), {
        ...base,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ACTION_PLAN_SAVED',
      targetCollection: 'annual_action_plans',
      targetId: payload.id,
      summary: `Plan de acción ${payload.year}: "${base.title}" (${base.executedValue}/${base.targetValue}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'annual_action_plans');
  }
}

export async function deleteActionPlanItem(actor: UserProfile, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'annual_action_plans', id));
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ACTION_PLAN_DELETED',
      targetCollection: 'annual_action_plans',
      targetId: id,
      summary: `Eliminación de meta del plan de acción anual (${id}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `annual_action_plans/${id}`);
  }
}
