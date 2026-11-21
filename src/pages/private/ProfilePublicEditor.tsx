import { useState } from 'react';
import { Clock, Eye, RotateCcw } from 'lucide-react';
import { useProfileEditorState } from '../../hooks/useProfileEditorState';
import {
  AttendanceRecord,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  ElectionItem,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { ProfileEditorTabId } from '../../utils/profileCompleteness';
import { AvatarWebpCropper } from '../../components/media/AvatarWebpCropper';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { PrivateSection } from './PortalSidebar';
import { ProfileActivityTab } from './ProfileActivityTab';
import { ProfileChecklistBanner } from './ProfileChecklistBanner';
import { ProfileLivePreview } from './ProfileLivePreview';
import { ProfileNarrativeFields } from './ProfileNarrativeFields';
import { ProfilePrivacyAndConsent } from './ProfilePrivacyAndConsent';
import { ProfilePublishTimeline } from './ProfilePublishTimeline';
import { ProfileSecurityPanel } from './ProfileSecurityPanel';
import { ProfileSocialsTab } from './ProfileSocialsTab';

interface ProfilePublicEditorProps {
  profile: UserProfile;
  projects: ProjectItem[];
  commissions: Commission[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  elections: ElectionItem[];
  events: CalendarEventItem[];
  onReload: () => Promise<void>;
  onNavigateSection: (section: PrivateSection) => void;
  onRevokeAllDevices?: () => Promise<void>;
}

export function ProfilePublicEditor({
  profile,
  projects,
  commissions,
  sessions,
  attendance,
  commitments,
  elections,
  events,
  onReload,
  onNavigateSection,
  onRevokeAllDevices,
}: ProfilePublicEditorProps) {
  const [activeTab, setActiveTab] = useState<ProfileEditorTabId>('ficha');
  const [mobilePreview, setMobilePreview] = useState(false);

  const state = useProfileEditorState(profile, commissions, attendance, commitments, onReload);

  const myCommissionName = commissions.find(
    (c) =>
      c.id === profile.commissionId ||
      c.leaderUid === profile.uid ||
      c.secretaryUid === profile.uid ||
      (c.memberUids || []).includes(profile.uid),
  )?.name;

  const jumpToField = (tab: ProfileEditorTabId, fieldId: string) => {
    setMobilePreview(false);
    setActiveTab(tab);
    window.setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus();
      }
    }, 80);
  };

  return (
    <div className="mt-5 space-y-5">
      <ProfileChecklistBanner completeness={state.completeness} onJumpToField={jumpToField} />

      <ProfilePublishTimeline
        reviewStatus={profile.profileReviewStatus || 'borrador'}
        slug={profile.slug}
        updatedAt={profile.updatedAt}
        reviewComment={profile.profileReviewComment}
        reviewedByName={profile.profileReviewedByName}
        saving={state.saving}
        unpublishing={state.unpublishing}
        hasUnsavedChanges={state.hasUnsavedChanges}
        onSaveDraft={() => void state.saveWithStatus('borrador')}
        onRequestPublish={() => void state.saveWithStatus('revision')}
        onUnpublish={() => void state.handleUnpublish()}
      />

      {state.localSavedAtMs && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
            <span>
              Borrador respaldado localmente{' '}
              {state.savedMinsAgo === 0 ? 'hace menos de 1 min' : `hace ${state.savedMinsAgo} min`}.
            </span>
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={state.handleDiscardLocalDraft}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restaurar guardado en servidor</span>
          </Button>
        </div>
      )}

      {state.notice && (
        <p
          role={state.notice.type === 'err' ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-xs font-medium ${
            state.notice.type === 'err'
              ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {state.notice.text}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 lg:hidden">
        <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
          Modo de vista móvil
        </span>
        <Button
          type="button"
          size="sm"
          variant={mobilePreview ? 'primary' : 'outline'}
          onClick={() => setMobilePreview((p) => !p)}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{mobilePreview ? 'Volver a editar' : 'Vista previa'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`space-y-5 lg:col-span-7 ${mobilePreview ? 'hidden lg:block' : ''}`}>
          <Tabs
            ariaLabel="Secciones de Mi perfil"
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as ProfileEditorTabId)}
            options={[
              { id: 'ficha', label: 'Mi ficha pública' },
              { id: 'redes', label: 'Redes y contacto' },
              { id: 'privacidad', label: 'Privacidad y consentimiento' },
              { id: 'seguridad', label: 'Seguridad' },
              { id: 'actividad', label: 'Mi actividad' },
            ]}
          />

          {activeTab === 'ficha' && (
            <div className="space-y-5">
              <AvatarWebpCropper
                userUid={profile.uid}
                displayName={state.displayName}
                currentPhotoUrl={state.photoUrl}
                onUploaded={state.setPhotoUrl}
              />
              <ProfileNarrativeFields
                displayName={state.displayName} onChangeDisplayName={state.setDisplayName}
                positionTitle={state.positionTitle} onChangePositionTitle={state.setPositionTitle}
                sector={state.sector} onChangeSector={state.setSector}
                educationOccupation={state.educationOccupation} onChangeEducationOccupation={state.setEducationOccupation}
                shortBio={state.shortBio} onChangeShortBio={state.setShortBio}
                fullBio={state.fullBio} onChangeFullBio={state.setFullBio}
                motivation={state.motivation} onChangeMotivation={state.setMotivation}
                proposals={state.proposals} onChangeProposals={state.setProposals}
                featuredQuote={state.featuredQuote} onChangeFeaturedQuote={state.setFeaturedQuote}
                workAxes={state.workAxes} onChangeWorkAxes={state.setWorkAxes}
                skills={state.skills} onChangeSkills={state.setSkills}
                achievements={state.achievements} onChangeAchievements={state.setAchievements}
                projects={projects} projectIds={state.projectIds}
                onToggleProject={(id) =>
                  state.setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
              />
            </div>
          )}

          {activeTab === 'redes' && (
            <ProfileSocialsTab
              socials={state.socials}
              onChangeSocials={state.setSocials}
              publicEmail={state.publicEmail}
              onChangePublicEmail={state.setPublicEmail}
            />
          )}

          {activeTab === 'privacidad' && (
            <ProfilePrivacyAndConsent
              visibility={state.visibility}
              onToggleVisibility={(k) => state.setVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
              isMinor={state.isMinor}
              onChangeIsMinor={state.setIsMinor}
              guardianAuthorizationNote={profile.guardianAuthorizationNote}
              emailNotifications={state.emailNotifications}
              onChangeEmailNotifications={state.setEmailNotifications}
              habeasDataAccepted={state.habeasDataAccepted}
              habeasDataAcceptedAt={profile.habeasDataAcceptedAt}
              onChangeHabeasData={state.setHabeasDataAccepted}
            />
          )}

          {activeTab === 'seguridad' && (
            <ProfileSecurityPanel profile={profile} onRevokeAllDevices={onRevokeAllDevices} />
          )}

          {activeTab === 'actividad' && (
            <ProfileActivityTab
              profile={profile}
              sessions={sessions}
              attendance={attendance}
              commitments={commitments}
              commissions={commissions}
              elections={elections}
              events={events}
              onNavigateSection={onNavigateSection}
            />
          )}
        </div>

        <aside className={`lg:col-span-5 ${mobilePreview ? 'block' : 'hidden lg:block'}`}>
          <div className="lg:sticky lg:top-6">
            <ProfileLivePreview
              displayName={state.displayName} role={profile.role} photoUrl={state.photoUrl}
              positionTitle={state.positionTitle} sector={state.sector} commissionName={myCommissionName}
              educationOccupation={state.educationOccupation} shortBio={state.shortBio}
              fullBio={state.fullBio} motivation={state.motivation} proposals={state.proposals}
              featuredQuote={state.featuredQuote} workAxes={state.workAxes}
              skills={state.skills} achievements={state.achievements}
              projectIds={state.projectIds} projects={projects}
              socials={state.socials} publicEmail={state.publicEmail} visibility={state.visibility}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
