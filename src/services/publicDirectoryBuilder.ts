import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  AttendanceRecord,
  Commission,
  CommitmentItem,
  CounselorAchievement,
  CounselorSocialLinks,
  ProfileReviewStatus,
  PublicFieldVisibility,
  UserProfile,
} from '../types/models';
import { slugifyCouncilorName } from '../utils/avatarCrop';
import { normalizeAndValidateSocialUrl, SocialPlatform } from '../utils/socialLinks';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export function sanitizeSocialLinks(
  links?: CounselorSocialLinks,
): CounselorSocialLinks | undefined {
  if (!links) return undefined;
  const clean: CounselorSocialLinks = {};
  const keys: SocialPlatform[] = [
    'instagram',
    'facebook',
    'x',
    'tiktok',
    'linkedin',
    'youtube',
    'website',
  ];
  for (const key of keys) {
    const raw = links[key]?.trim();
    if (!raw) continue;
    const checked = normalizeAndValidateSocialUrl(key, raw);
    if (checked.valid && checked.normalizedUrl) {
      clean[key] = checked.normalizedUrl;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export function sanitizeAchievements(items?: CounselorAchievement[]): CounselorAchievement[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      year: String(item.year || '').trim().slice(0, 12),
      title: String(item.title || '').trim().slice(0, 120),
      ...(item.description?.trim()
        ? { description: item.description.trim().slice(0, 240) }
        : {}),
    }))
    .filter((item) => item.title.length >= 2)
    .slice(0, 12);
}

export function buildPublicDirectoryPayload(
  source: UserProfile,
  options?: {
    commissions?: Commission[];
    attendance?: AttendanceRecord[];
    commitments?: CommitmentItem[];
    forceActive?: boolean;
  },
): Record<string, unknown> {
  const vis: PublicFieldVisibility = {
    photo: true,
    shortBio: true,
    fullBio: true,
    education: true,
    motivation: true,
    proposals: true,
    projects: true,
    socials: true,
    workAxes: true,
    achievements: true,
    skills: true,
    featuredQuote: true,
    publicEmail: false,
    ...(source.fieldVisibility || {}),
  };

  const slug = source.slug?.trim() || slugifyCouncilorName(source.displayName, source.uid);
  const commissionName = options?.commissions?.find((c) => c.id === source.commissionId)?.name;

  const showKpis = Boolean(source.showManagementKpis);
  const kpiSessionsAttended = showKpis
    ? (options?.attendance || []).filter(
        (a) => a.userUid === source.uid && a.status === 'presente',
      ).length
    : undefined;
  const kpiCommitmentsFulfilled = showKpis
    ? (options?.commitments || []).filter(
        (c) => c.assigneeUid === source.uid && c.status === 'cumplido',
      ).length
    : undefined;

  const socials = vis.socials ? sanitizeSocialLinks(source.socialLinks) : undefined;
  const workAxes = vis.workAxes
    ? (source.workAxes || []).map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 8)
    : [];
  const skills = vis.skills
    ? (source.skills || []).map((x) => x.trim().slice(0, 50)).filter(Boolean).slice(0, 12)
    : [];
  const achievements = vis.achievements ? sanitizeAchievements(source.achievements) : [];

  const cleanPhotoUrl = source.photoUrl?.trim();
  const safePhotoUrl = cleanPhotoUrl && cleanPhotoUrl.length <= 1500 ? cleanPhotoUrl : undefined;

  return {
    uid: source.uid,
    slug: slug.slice(0, 140),
    displayName: source.displayName.trim().slice(0, 120),
    role: source.role,
    status: options?.forceActive || source.status === 'activo' ? 'activo' : 'inactivo',
    period: (source.period || '2026-2029').slice(0, 32),
    ...(vis.photo && safePhotoUrl ? { photoUrl: safePhotoUrl } : {}),
    ...(source.commissionId ? { commissionId: source.commissionId.slice(0, 128) } : {}),
    ...(commissionName ? { commissionName: commissionName.trim().slice(0, 140) } : {}),
    ...(source.positionTitle ? { positionTitle: source.positionTitle.trim().slice(0, 120) } : {}),
    ...(source.sector ? { sector: source.sector.trim().slice(0, 120) } : {}),
    ...(vis.shortBio && (source.shortBio || source.bio)
      ? { shortBio: (source.shortBio || source.bio || '').trim().slice(0, 280) }
      : {}),
    ...(vis.shortBio && source.bio ? { bio: source.bio.trim().slice(0, 800) } : {}),
    ...(vis.fullBio && source.fullBio ? { fullBio: source.fullBio.trim().slice(0, 3000) } : {}),
    ...(vis.education && source.educationOccupation
      ? { educationOccupation: source.educationOccupation.trim().slice(0, 240) }
      : {}),
    ...(vis.motivation && source.motivation
      ? { motivation: source.motivation.trim().slice(0, 1500) }
      : {}),
    ...(vis.proposals && source.proposals
      ? { proposals: source.proposals.trim().slice(0, 2500) }
      : {}),
    ...(vis.featuredQuote && source.featuredQuote?.trim()
      ? { featuredQuote: source.featuredQuote.trim().slice(0, 140) }
      : {}),
    ...(workAxes.length > 0 ? { workAxes } : {}),
    ...(skills.length > 0 ? { skills } : {}),
    ...(achievements.length > 0 ? { achievements } : {}),
    ...(vis.projects && source.projectIds && source.projectIds.length > 0
      ? { projectIds: source.projectIds.slice(0, 12) }
      : {}),
    ...(socials ? { socialLinks: socials } : {}),
    ...(vis.publicEmail && source.publicEmail
      ? { publicEmail: source.publicEmail.trim().slice(0, 160) }
      : {}),
    showManagementKpis: showKpis,
    ...(typeof kpiSessionsAttended === 'number' ? { kpiSessionsAttended } : {}),
    ...(typeof kpiCommitmentsFulfilled === 'number' ? { kpiCommitmentsFulfilled } : {}),
    updatedAt: serverTimestamp(),
  };
}

export async function publishCouncilorPublicProfile(
  actor: UserProfile,
  target: UserProfile,
  options: {
    approvePublic: boolean;
    showManagementKpis: boolean;
    guardianAuthorizationNote?: string;
    reviewComment?: string;
    commissions: Commission[];
    attendance: AttendanceRecord[];
    commitments: CommitmentItem[];
  },
): Promise<void> {
  if (target.isMinor && options.approvePublic && !options.guardianAuthorizationNote?.trim()) {
    throw new Error(
      'Para publicar la ficha de un consejero menor de edad debes registrar la autorización de su acudiente.',
    );
  }

  try {
    const batch = writeBatch(db);
    const nextReviewStatus: ProfileReviewStatus = options.approvePublic ? 'publicada' : 'borrador';
    const slug = target.slug?.trim() || slugifyCouncilorName(target.displayName, target.uid);

    const trimmedGuardianNote = options.guardianAuthorizationNote?.trim();
    const shouldWriteGuardianNote =
      trimmedGuardianNote !== undefined &&
      (trimmedGuardianNote.length > 0 || Boolean(target.guardianAuthorizationNote));
    const trimmedReviewComment = options.reviewComment?.trim() ?? '';

    batch.update(doc(db, 'users', target.uid), {
      slug,
      profileReviewStatus: nextReviewStatus,
      showManagementKpis: options.showManagementKpis,
      profileReviewComment: options.approvePublic ? '' : trimmedReviewComment.slice(0, 500),
      profileReviewedByName: actor.displayName.slice(0, 120),
      profileReviewedAt: new Date().toISOString(),
      ...(shouldWriteGuardianNote
        ? { guardianAuthorizationNote: trimmedGuardianNote.slice(0, 400) }
        : {}),
      updatedAt: serverTimestamp(),
    });

    const updatedTarget: UserProfile = {
      ...target,
      slug,
      profileReviewStatus: nextReviewStatus,
      showManagementKpis: options.showManagementKpis,
    };

    if (options.approvePublic && target.status === 'activo') {
      batch.set(
        doc(db, 'public_directory', target.uid),
        buildPublicDirectoryPayload(updatedTarget, {
          commissions: options.commissions,
          attendance: options.attendance,
          commitments: options.commitments,
        }),
      );
    } else if (!options.approvePublic) {
      batch.delete(doc(db, 'public_directory', target.uid));
    }

    await batch.commit();

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: options.approvePublic ? 'PUBLIC_PROFILE_APPROVED' : 'PUBLIC_PROFILE_RETURNED',
      targetCollection: 'public_directory',
      targetId: target.uid,
      summary: options.approvePublic
        ? `Aprobación y publicación de ficha pública de ${target.displayName}.`
        : `Ficha pública de ${target.displayName} devuelta a borrador.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `public_directory/${target.uid}`);
  }
}

export async function unpublishOwnPublicProfile(actor: UserProfile): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', actor.uid), {
      profileReviewStatus: 'borrador',
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(doc(db, 'public_directory', actor.uid)).catch(() => undefined);

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PUBLIC_PROFILE_UNPUBLISHED',
      targetCollection: 'public_directory',
      targetId: actor.uid,
      summary: 'Retiro voluntario de ficha del directorio público.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `public_directory/${actor.uid}`);
  }
}

export async function syncAdminPublicProfile(
  actor: UserProfile,
  commissions: Commission[] = [],
  attendance: AttendanceRecord[] = [],
  commitments: CommitmentItem[] = [],
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'public_directory', actor.uid),
      buildPublicDirectoryPayload(actor, {
        commissions,
        attendance,
        commitments,
        forceActive: true,
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `public_directory/${actor.uid}`);
  }
}
