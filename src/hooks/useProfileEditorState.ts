import { useEffect, useMemo, useState } from 'react';
import {
  syncAdminPublicProfile,
  unpublishOwnPublicProfile,
  updateOwnProfile,
} from '../services/privateUsersService';
import {
  AttendanceRecord,
  Commission,
  CommitmentItem,
  CounselorAchievement,
  CounselorSocialLinks,
  PublicFieldVisibility,
  UserProfile,
} from '../types/models';
import { evaluateProfileCompleteness } from '../utils/profileCompleteness';
import { DEFAULT_PROFILE_VISIBILITY } from '../pages/private/ProfileNarrativeFields';

export function getProfileDraftKey(uid: string) {
  return `cmj_profile_draft_${uid}`;
}

export function useProfileEditorState(
  profile: UserProfile,
  commissions: Commission[],
  attendance: AttendanceRecord[],
  commitments: CommitmentItem[],
  onReload: () => Promise<void>,
) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');
  const [positionTitle, setPositionTitle] = useState(profile.positionTitle || '');
  const [sector, setSector] = useState(profile.sector || '');
  const [shortBio, setShortBio] = useState(profile.shortBio || profile.bio || '');
  const [fullBio, setFullBio] = useState(profile.fullBio || '');
  const [educationOccupation, setEducationOccupation] = useState(profile.educationOccupation || '');
  const [motivation, setMotivation] = useState(profile.motivation || '');
  const [proposals, setProposals] = useState(profile.proposals || '');
  const [featuredQuote, setFeaturedQuote] = useState(profile.featuredQuote || '');
  const [workAxes, setWorkAxes] = useState<string[]>(profile.workAxes || []);
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [achievements, setAchievements] = useState<CounselorAchievement[]>(profile.achievements || []);
  const [projectIds, setProjectIds] = useState<string[]>(profile.projectIds || []);
  const [publicEmail, setPublicEmail] = useState(profile.publicEmail || '');
  const [socials, setSocials] = useState<CounselorSocialLinks>(profile.socialLinks || {});
  const [visibility, setVisibility] = useState<PublicFieldVisibility>({
    ...DEFAULT_PROFILE_VISIBILITY,
    ...(profile.fieldVisibility || {}),
  });
  const [habeasDataAccepted, setHabeasDataAccepted] = useState(Boolean(profile.habeasDataAccepted));
  const [isMinor, setIsMinor] = useState(Boolean(profile.isMinor));
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications !== false);

  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [localSavedAtMs, setLocalSavedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const snapshotJson = useMemo(
    () =>
      JSON.stringify({
        displayName, photoUrl, positionTitle, sector, shortBio, fullBio,
        educationOccupation, motivation, proposals, featuredQuote, workAxes,
        skills, achievements, projectIds, publicEmail, socials, visibility,
        habeasDataAccepted, isMinor, emailNotifications,
      }),
    [
      displayName, photoUrl, positionTitle, sector, shortBio, fullBio,
      educationOccupation, motivation, proposals, featuredQuote, workAxes,
      skills, achievements, projectIds, publicEmail, socials, visibility,
      habeasDataAccepted, isMinor, emailNotifications,
    ],
  );

  const serverJson = useMemo(
    () =>
      JSON.stringify({
        displayName: profile.displayName,
        photoUrl: profile.photoUrl || '',
        positionTitle: profile.positionTitle || '',
        sector: profile.sector || '',
        shortBio: profile.shortBio || profile.bio || '',
        fullBio: profile.fullBio || '',
        educationOccupation: profile.educationOccupation || '',
        motivation: profile.motivation || '',
        proposals: profile.proposals || '',
        featuredQuote: profile.featuredQuote || '',
        workAxes: profile.workAxes || [],
        skills: profile.skills || [],
        achievements: profile.achievements || [],
        projectIds: profile.projectIds || [],
        publicEmail: profile.publicEmail || '',
        socials: profile.socialLinks || {},
        visibility: { ...DEFAULT_PROFILE_VISIBILITY, ...(profile.fieldVisibility || {}) },
        habeasDataAccepted: Boolean(profile.habeasDataAccepted),
        isMinor: Boolean(profile.isMinor),
        emailNotifications: profile.emailNotifications !== false,
      }),
    [profile],
  );

  const hasUnsavedChanges = snapshotJson !== serverJson;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(getProfileDraftKey(profile.uid), snapshotJson);
        setLocalSavedAtMs(Date.now());
      } catch {
        // Ignore storage quota issues
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hasUnsavedChanges, profile.uid, snapshotJson]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!localSavedAtMs) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [localSavedAtMs]);

  const savedMinsAgo = localSavedAtMs ? Math.max(0, Math.floor((nowMs - localSavedAtMs) / 60_000)) : null;

  const completeness = useMemo(
    () =>
      evaluateProfileCompleteness({
        photoUrl, positionTitle, shortBio, fullBio, motivation, proposals,
        socialLinks: socials, habeasDataAccepted,
      }),
    [photoUrl, positionTitle, shortBio, fullBio, motivation, proposals, socials, habeasDataAccepted],
  );

  const saveWithStatus = async (targetReviewStatus: 'borrador' | 'revision') => {
    setSaving(true);
    setNotice(null);
    try {
      await updateOwnProfile(profile, {
        displayName, photoUrl, positionTitle, sector, shortBio, fullBio,
        educationOccupation, motivation, proposals, featuredQuote, workAxes,
        skills, achievements, projectIds, socialLinks: socials, publicEmail,
        fieldVisibility: visibility, habeasDataAccepted, isMinor,
        emailNotifications, profileReviewStatus: targetReviewStatus,
      });

      const isBoardRole = ['secretario_admin', 'presidente', 'vicepresidente'].includes(profile.role);
      const canSyncPublic =
        isBoardRole &&
        profile.status === 'activo' &&
        (!isMinor || Boolean(profile.guardianAuthorizationNote?.trim())) &&
        (targetReviewStatus === 'revision' || profile.profileReviewStatus === 'publicada');

      if (canSyncPublic) {
        await syncAdminPublicProfile(
          {
            ...profile, displayName, photoUrl, positionTitle, sector, shortBio,
            bio: shortBio, fullBio, educationOccupation, motivation, proposals,
            featuredQuote, workAxes, skills, achievements, projectIds,
            socialLinks: socials, publicEmail, fieldVisibility: visibility,
          },
          commissions, attendance, commitments,
        );
      }

      localStorage.removeItem(getProfileDraftKey(profile.uid));
      setLocalSavedAtMs(null);
      setNotice({
        type: 'ok',
        text:
          targetReviewStatus === 'revision'
            ? 'Ficha enviada a revisión de la Mesa Directiva para su publicación.'
            : 'Borrador guardado correctamente en el servidor.',
      });
      await onReload();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'No se pudo guardar la ficha.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setNotice(null);
    try {
      await unpublishOwnPublicProfile(profile);
      setNotice({ type: 'ok', text: 'Tu ficha pública fue retirada del directorio ciudadano.' });
      await onReload();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'No se pudo despublicar la ficha.' });
    } finally {
      setUnpublishing(false);
    }
  };

  const handleDiscardLocalDraft = () => {
    localStorage.removeItem(getProfileDraftKey(profile.uid));
    setDisplayName(profile.displayName);
    setPhotoUrl(profile.photoUrl || '');
    setPositionTitle(profile.positionTitle || '');
    setSector(profile.sector || '');
    setShortBio(profile.shortBio || profile.bio || '');
    setFullBio(profile.fullBio || '');
    setEducationOccupation(profile.educationOccupation || '');
    setMotivation(profile.motivation || '');
    setProposals(profile.proposals || '');
    setFeaturedQuote(profile.featuredQuote || '');
    setWorkAxes(profile.workAxes || []);
    setSkills(profile.skills || []);
    setAchievements(profile.achievements || []);
    setProjectIds(profile.projectIds || []);
    setPublicEmail(profile.publicEmail || '');
    setSocials(profile.socialLinks || {});
    setVisibility({ ...DEFAULT_PROFILE_VISIBILITY, ...(profile.fieldVisibility || {}) });
    setHabeasDataAccepted(Boolean(profile.habeasDataAccepted));
    setIsMinor(Boolean(profile.isMinor));
    setEmailNotifications(profile.emailNotifications !== false);
    setLocalSavedAtMs(null);
  };

  return {
    displayName, setDisplayName, photoUrl, setPhotoUrl, positionTitle, setPositionTitle,
    sector, setSector, shortBio, setShortBio, fullBio, setFullBio,
    educationOccupation, setEducationOccupation, motivation, setMotivation,
    proposals, setProposals, featuredQuote, setFeaturedQuote,
    workAxes, setWorkAxes, skills, setSkills, achievements, setAchievements,
    projectIds, setProjectIds, publicEmail, setPublicEmail, socials, setSocials,
    visibility, setVisibility, habeasDataAccepted, setHabeasDataAccepted,
    isMinor, setIsMinor, emailNotifications, setEmailNotifications,
    saving, unpublishing, notice, localSavedAtMs, savedMinsAgo,
    hasUnsavedChanges, completeness, saveWithStatus, handleUnpublish, handleDiscardLocalDraft,
  };
}
