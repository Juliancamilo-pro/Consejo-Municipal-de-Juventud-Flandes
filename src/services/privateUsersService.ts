import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  CouncilInfo,
  CounselorAchievement,
  CounselorSocialLinks,
  ProfileReviewStatus,
  PublicFieldVisibility,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types/models';
import { slugifyCouncilorName } from '../utils/avatarCrop';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  buildPublicDirectoryPayload,
  publishCouncilorPublicProfile,
  sanitizeAchievements,
  sanitizeSocialLinks,
  syncAdminPublicProfile,
  unpublishOwnPublicProfile,
} from './publicDirectoryBuilder';
import { rotateInvitationCodeOnServer } from './sessionApi';

export {
  buildPublicDirectoryPayload,
  publishCouncilorPublicProfile,
  syncAdminPublicProfile,
  unpublishOwnPublicProfile,
};

export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function updateOwnProfile(
  actor: UserProfile,
  updates: {
    displayName: string;
    photoUrl?: string;
    positionTitle?: string;
    sector?: string;
    shortBio?: string;
    fullBio?: string;
    educationOccupation?: string;
    motivation?: string;
    proposals?: string;
    workAxes?: string[];
    achievements?: CounselorAchievement[];
    skills?: string[];
    featuredQuote?: string;
    projectIds?: string[];
    socialLinks?: CounselorSocialLinks;
    publicEmail?: string;
    fieldVisibility?: PublicFieldVisibility;
    habeasDataAccepted?: boolean;
    isMinor?: boolean;
    emailNotifications?: boolean;
    profileReviewStatus?: ProfileReviewStatus;
  },
): Promise<void> {
  if (updates.profileReviewStatus === 'revision' && !updates.habeasDataAccepted) {
    throw new Error(
      'Debes aceptar la autorización de tratamiento de datos (Habeas Data · Ley 1581 de 2012) antes de solicitar publicación.',
    );
  }

  try {
    const slug = actor.slug || slugifyCouncilorName(updates.displayName, actor.uid);
    const cleanSocials = sanitizeSocialLinks(updates.socialLinks) || {};
    const cleanWorkAxes = updates.workAxes
      ?.map((w) => w.trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 8);
    const cleanSkills = updates.skills
      ?.map((s) => s.trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 12);
    const cleanAchievements =
      updates.achievements !== undefined ? sanitizeAchievements(updates.achievements) : undefined;

    await updateDoc(doc(db, 'users', actor.uid), {
      displayName: updates.displayName.trim(),
      slug,
      ...(updates.photoUrl !== undefined ? { photoUrl: updates.photoUrl.trim() } : {}),
      ...(updates.positionTitle !== undefined
        ? { positionTitle: updates.positionTitle.trim().slice(0, 120) }
        : {}),
      ...(updates.sector !== undefined ? { sector: updates.sector.trim().slice(0, 120) } : {}),
      ...(updates.shortBio !== undefined
        ? {
            shortBio: updates.shortBio.trim().slice(0, 280),
            bio: updates.shortBio.trim().slice(0, 280),
          }
        : {}),
      ...(updates.fullBio !== undefined
        ? { fullBio: updates.fullBio.trim().slice(0, 3000) }
        : {}),
      ...(updates.educationOccupation !== undefined
        ? { educationOccupation: updates.educationOccupation.trim().slice(0, 240) }
        : {}),
      ...(updates.motivation !== undefined
        ? { motivation: updates.motivation.trim().slice(0, 1500) }
        : {}),
      ...(updates.proposals !== undefined
        ? { proposals: updates.proposals.trim().slice(0, 2500) }
        : {}),
      ...(cleanWorkAxes !== undefined ? { workAxes: cleanWorkAxes } : {}),
      ...(cleanSkills !== undefined ? { skills: cleanSkills } : {}),
      ...(cleanAchievements !== undefined ? { achievements: cleanAchievements } : {}),
      ...(updates.featuredQuote !== undefined
        ? { featuredQuote: updates.featuredQuote.trim().slice(0, 140) }
        : {}),
      ...(updates.projectIds !== undefined ? { projectIds: updates.projectIds.slice(0, 12) } : {}),
      socialLinks: cleanSocials,
      ...(updates.publicEmail !== undefined
        ? { publicEmail: updates.publicEmail.trim().slice(0, 160) }
        : {}),
      ...(updates.fieldVisibility ? { fieldVisibility: updates.fieldVisibility } : {}),
      ...(typeof updates.habeasDataAccepted === 'boolean'
        ? {
            habeasDataAccepted: updates.habeasDataAccepted,
            ...(updates.habeasDataAccepted && !actor.habeasDataAcceptedAt
              ? { habeasDataAcceptedAt: new Date().toISOString() }
              : {}),
          }
        : {}),
      ...(typeof updates.isMinor === 'boolean' ? { isMinor: updates.isMinor } : {}),
      ...(typeof updates.emailNotifications === 'boolean'
        ? { emailNotifications: updates.emailNotifications }
        : {}),
      ...(updates.profileReviewStatus
        ? { profileReviewStatus: updates.profileReviewStatus }
        : {}),
      period: actor.period || '2026-2029',
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROFILE_UPDATE',
      targetCollection: 'users',
      targetId: actor.uid,
      summary:
        updates.profileReviewStatus === 'revision'
          ? 'Actualización y envío de ficha pública a revisión de Mesa Directiva.'
          : 'Actualización de ficha institucional personal.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${actor.uid}`);
  }
}

export async function manageCouncilorAccount(
  actor: UserProfile,
  target: UserProfile,
  next: {
    role: UserRole;
    status: UserStatus;
    positionTitle?: string;
    commissionId?: string;
  },
): Promise<void> {
  if (target.role === 'secretario_admin') {
    throw new Error('La cuenta de Secretario Administrador es inamovible.');
  }
  if (next.role === 'secretario_admin') {
    throw new Error('No está permitido asignar el rol de Secretario Administrador.');
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', target.uid), {
      role: next.role,
      status: next.status,
      ...(next.positionTitle !== undefined ? { positionTitle: next.positionTitle.trim() } : {}),
      ...(next.commissionId !== undefined ? { commissionId: next.commissionId } : {}),
      approvedByUid: actor.uid,
      updatedAt: serverTimestamp(),
    });

    const mergedTarget: UserProfile = {
      ...target,
      role: next.role,
      status: next.status,
      positionTitle: next.positionTitle ?? target.positionTitle,
      commissionId: next.commissionId ?? target.commissionId,
    };
    batch.set(doc(db, 'public_directory', target.uid), buildPublicDirectoryPayload(mergedTarget));
    await batch.commit();

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'USER_ROLE_STATUS_CHANGE',
      targetCollection: 'users',
      targetId: target.uid,
      summary: `Cambio de estado (${next.status}) y rol (${next.role}) para ${target.displayName}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function saveCouncilInfo(
  actor: UserProfile,
  info: Omit<CouncilInfo, 'kind' | 'updatedAt'>,
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'council_info'), {
      kind: 'council_info',
      mission: info.mission.trim(),
      vision: info.vision.trim(),
      ...(info.address?.trim() ? { address: info.address.trim() } : {}),
      ...(info.emailPublic?.trim() ? { emailPublic: info.emailPublic.trim() } : {}),
      ...(info.schedule?.trim() ? { schedule: info.schedule.trim() } : {}),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'COUNCIL_INFO_UPDATE',
      targetCollection: 'settings',
      targetId: 'council_info',
      summary: 'Actualización de misión, visión y canales de contacto.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/council_info');
  }
}

export async function rotateInvitationCode(actor: UserProfile, newCode: string): Promise<number> {
  const { encryptedSetting } = await rotateInvitationCodeOnServer(newCode);
  try {
    await setDoc(doc(db, 'settings', 'invitation'), {
      ...encryptedSetting,
      updatedByUid: actor.uid,
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'INVITATION_CODE_ROTATED',
      targetCollection: 'settings',
      targetId: 'invitation',
      summary: `Rotación del código de invitación (versión ${encryptedSetting.version}).`,
    });
    return encryptedSetting.version;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/invitation');
  }
}
