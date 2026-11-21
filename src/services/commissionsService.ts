import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Commission,
  CommissionGoal,
  CommissionIconName,
  CommissionMemberEntry,
  UserProfile,
} from '../types/models';
import { slugifyCommissionName } from '../utils/commissionUtils';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export interface SaveCommissionPayload {
  id?: string;
  name: string;
  description: string;
  slug?: string;
  accentColor?: string;
  iconName?: CommissionIconName;
  coverImageUrl?: string;
  mission?: string;
  objectives?: string[];
  workLines?: string[];
  meetingPlace?: string;
  meetingSchedule?: string;
  leaderUid?: string;
  leaderName?: string;
  secretaryUid?: string;
  secretaryName?: string;
  memberUids?: string[];
  members?: CommissionMemberEntry[];
  goals?: CommissionGoal[];
  status: 'activa' | 'inactiva' | 'archivada';
}

function normalizeMembers(payload: SaveCommissionPayload): {
  members: CommissionMemberEntry[];
  memberUids: string[];
} {
  const map = new Map<string, CommissionMemberEntry>();
  for (const m of payload.members || []) {
    if (m.uid) map.set(m.uid, m);
  }
  if (payload.leaderUid && payload.leaderName) {
    const existing = map.get(payload.leaderUid);
    map.set(payload.leaderUid, {
      uid: payload.leaderUid,
      displayName: payload.leaderName,
      ...(existing?.photoUrl ? { photoUrl: existing.photoUrl } : {}),
      role: 'lider',
      joinedAtIso: existing?.joinedAtIso || new Date().toISOString().slice(0, 10),
    });
  }
  if (payload.secretaryUid && payload.secretaryName && payload.secretaryUid !== payload.leaderUid) {
    const existing = map.get(payload.secretaryUid);
    map.set(payload.secretaryUid, {
      uid: payload.secretaryUid,
      displayName: payload.secretaryName,
      ...(existing?.photoUrl ? { photoUrl: existing.photoUrl } : {}),
      role: 'secretario',
      joinedAtIso: existing?.joinedAtIso || new Date().toISOString().slice(0, 10),
    });
  }
  const members = Array.from(map.values()).slice(0, 40);
  const uidSet = new Set<string>(payload.memberUids || []);
  members.forEach((m) => uidSet.add(m.uid));
  return { members, memberUids: Array.from(uidSet).slice(0, 40) };
}

function optStrField(val: string | undefined, isUpdate: boolean): Record<string, unknown> | unknown {
  const trimmed = val?.trim();
  if (trimmed) return trimmed;
  return isUpdate ? deleteField() : undefined;
}

export async function fetchAllCommissions(): Promise<Commission[]> {
  try {
    const q = query(collection(db, 'commissions'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Commission, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'commissions');
  }
}

export async function saveCommission(
  actor: UserProfile,
  payload: SaveCommissionPayload,
): Promise<string> {
  try {
    const isUpdate = Boolean(payload.id);
    const { members, memberUids } = normalizeMembers(payload);
    const slug = payload.slug?.trim() || slugifyCommissionName(payload.name, payload.id);

    const body: Record<string, unknown> = {
      name: payload.name.trim(),
      slug,
      description: payload.description.trim(),
      accentColor: payload.accentColor || '#7B1832',
      iconName: payload.iconName || 'Building2',
      status: payload.status,
      memberUids,
      members,
      objectives: (payload.objectives || []).map((o) => o.trim()).filter(Boolean).slice(0, 15),
      workLines: (payload.workLines || []).map((w) => w.trim()).filter(Boolean).slice(0, 15),
      updatedAt: serverTimestamp(),
    };

    const assignOpt = (key: string, val: string | undefined) => {
      const resolved = optStrField(val, isUpdate);
      if (resolved !== undefined) body[key] = resolved;
    };

    assignOpt('coverImageUrl', payload.coverImageUrl);
    assignOpt('mission', payload.mission);
    assignOpt('meetingPlace', payload.meetingPlace);
    assignOpt('meetingSchedule', payload.meetingSchedule);
    assignOpt('leaderUid', payload.leaderUid);
    assignOpt('leaderName', payload.leaderName);
    assignOpt('secretaryUid', payload.secretaryUid);
    assignOpt('secretaryName', payload.secretaryName);

    if (payload.goals !== undefined) {
      body.goals = payload.goals.slice(0, 25);
    }

    let targetId = payload.id;
    if (payload.id) {
      await updateDoc(doc(db, 'commissions', payload.id), body);
    } else {
      const ref = await addDoc(collection(db, 'commissions'), {
        ...body,
        createdAt: serverTimestamp(),
      });
      targetId = ref.id;
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: payload.id ? 'COMMISSION_UPDATED' : 'COMMISSION_CREATED',
      targetCollection: 'commissions',
      targetId,
      summary: `Comisión "${payload.name.trim()}" (${payload.status}) guardada.`,
    });
    return targetId || '';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'commissions');
  }
}

export async function updateCommissionStatus(
  actor: UserProfile,
  commission: Commission,
  nextStatus: 'activa' | 'inactiva' | 'archivada',
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commissions', commission.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `COMMISSION_${nextStatus.toUpperCase()}`,
      targetCollection: 'commissions',
      targetId: commission.id,
      summary: `Comisión "${commission.name}" marcada como ${nextStatus}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commissions/${commission.id}`);
  }
}

export async function updateCommissionMembers(
  actor: UserProfile,
  commission: Commission,
  members: CommissionMemberEntry[],
): Promise<void> {
  try {
    const clean = members.slice(0, 40);
    const leader = clean.find((m) => m.role === 'lider');
    const secretary = clean.find((m) => m.role === 'secretario');
    const memberUids = Array.from(new Set(clean.map((m) => m.uid)));

    await updateDoc(doc(db, 'commissions', commission.id), {
      members: clean,
      memberUids,
      ...(leader
        ? { leaderUid: leader.uid, leaderName: leader.displayName }
        : { leaderUid: deleteField(), leaderName: deleteField() }),
      ...(secretary
        ? { secretaryUid: secretary.uid, secretaryName: secretary.displayName }
        : { secretaryUid: deleteField(), secretaryName: deleteField() }),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'COMMISSION_MEMBERS_UPDATED',
      targetCollection: 'commissions',
      targetId: commission.id,
      summary: `Integrantes actualizados en "${commission.name}" (${clean.length} personas).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commissions/${commission.id}`);
  }
}

export async function updateCommissionGoals(
  actor: UserProfile,
  commission: Commission,
  goals: CommissionGoal[],
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commissions', commission.id), {
      goals: goals.slice(0, 25),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'COMMISSION_GOALS_UPDATED',
      targetCollection: 'commissions',
      targetId: commission.id,
      summary: `Plan de trabajo actualizado en "${commission.name}" (${goals.length} metas).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commissions/${commission.id}`);
  }
}
