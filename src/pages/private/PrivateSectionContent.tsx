import { lazy, Suspense } from 'react';
import {
  AttendanceRecord,
  AuditLogEntry,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  ElectionItem,
  InstitutionalDocument,
  JustificationRecord,
  MailboxEntry,
  NewsItem,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { PrivateSection } from './PortalSidebar';

const DashboardOverview = lazy(() =>
  import('./DashboardOverview').then((m) => ({ default: m.DashboardOverview })),
);
const SiteAppearancePanel = lazy(() =>
  import('./SiteAppearancePanel').then((m) => ({ default: m.SiteAppearancePanel })),
);
const WorkspaceModule = lazy(() =>
  import('./WorkspaceModule').then((m) => ({ default: m.WorkspaceModule })),
);
const UsersAndBoardModule = lazy(() =>
  import('./UsersAndBoardModule').then((m) => ({ default: m.UsersAndBoardModule })),
);
const ParticipationAdminPanel = lazy(() =>
  import('./ParticipationAdminPanel').then((m) => ({ default: m.ParticipationAdminPanel })),
);
const CommissionsAndContentModule = lazy(() =>
  import('./CommissionsAndContentModule').then((m) => ({ default: m.CommissionsAndContentModule })),
);
const DocumentsModule = lazy(() =>
  import('./DocumentsModule').then((m) => ({ default: m.DocumentsModule })),
);
const SessionsAttendanceModule = lazy(() =>
  import('./SessionsAttendanceModule').then((m) => ({ default: m.SessionsAttendanceModule })),
);
const ElectionsAndCommitmentsModule = lazy(() =>
  import('./ElectionsAndCommitmentsModule').then((m) => ({
    default: m.ElectionsAndCommitmentsModule,
  })),
);
const CalendarMailboxAuditModule = lazy(() =>
  import('./CalendarMailboxAuditModule').then((m) => ({ default: m.CalendarMailboxAuditModule })),
);
const InstitutionalTemplatesPanel = lazy(() =>
  import('./InstitutionalTemplatesPanel').then((m) => ({ default: m.InstitutionalTemplatesPanel })),
);
const PlanCertsInitiativesModule = lazy(() =>
  import('./PlanCertsInitiativesModule').then((m) => ({ default: m.PlanCertsInitiativesModule })),
);
const HelpGuidePanel = lazy(() =>
  import('./HelpGuidePanel').then((m) => ({ default: m.HelpGuidePanel })),
);

interface PrivateSectionContentProps {
  section: PrivateSection;
  isBoard: boolean;
  profile: UserProfile;
  siteContent: SiteAppearanceConfig;
  users: UserProfile[];
  commissions: Commission[];
  news: NewsItem[];
  projects: ProjectItem[];
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  justifications: JustificationRecord[];
  elections: ElectionItem[];
  commitments: CommitmentItem[];
  events: CalendarEventItem[];
  mailbox: MailboxEntry[];
  auditLogs: AuditLogEntry[];
  pendingUsersCount: number;
  mailboxOpenCount: number;
  qrParams: { sessionId: string | null; code: string | null };
  onSiteContentUpdated: () => Promise<void>;
  onReload: () => Promise<void>;
  onNavigateSection: (s: PrivateSection) => void;
  onRevokeAllDevices?: () => Promise<void>;
  onOpenTour?: () => void;
}

function ModuleFallback() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-10 w-64 rounded-lg" />
      <SkeletonBlock className="h-44 w-full rounded-xl" />
    </div>
  );
}

export function PrivateSectionContent(props: PrivateSectionContentProps) {
  const { section, isBoard, profile } = props;

  return (
    <Suspense fallback={<ModuleFallback />}>
      {section === 'resumen' && (
        <DashboardOverview
          profile={profile}
          users={props.users}
          projects={props.projects}
          commissions={props.commissions}
          sessions={props.sessions}
          attendance={props.attendance}
          commitments={props.commitments}
          documents={props.documents}
          elections={props.elections}
          events={props.events}
          mailbox={props.mailbox}
          counts={{
            users: props.users.length,
            pendingUsers: props.pendingUsersCount,
            documents: props.documents.length,
            sessions: props.sessions.length,
            commitments: props.commitments.length,
            mailboxOpen: props.mailboxOpenCount,
          }}
          onReload={props.onReload}
          onNavigateSection={props.onNavigateSection}
          onRevokeAllDevices={props.onRevokeAllDevices}
        />
      )}
      {section === 'apariencia' && isBoard && (
        <SiteAppearancePanel
          actor={profile}
          currentContent={props.siteContent}
          onUpdated={props.onSiteContentUpdated}
        />
      )}
      {section === 'workspace' && (
        <WorkspaceModule
          cmjEvents={props.events}
          users={props.users}
          attendance={props.attendance}
          commitments={props.commitments}
        />
      )}
      {section === 'usuarios' && (
        <UsersAndBoardModule
          actor={profile}
          users={props.users}
          commissions={props.commissions}
          attendance={props.attendance}
          commitments={props.commitments}
          onReload={props.onReload}
        />
      )}
      {section === 'participacion_admin' && isBoard && <ParticipationAdminPanel actor={profile} />}
      {section === 'comisiones' && (
        <CommissionsAndContentModule
          actor={profile}
          users={props.users}
          commissions={props.commissions}
          news={props.news}
          projects={props.projects}
          documents={props.documents}
          sessions={props.sessions}
          commitments={props.commitments}
          events={props.events}
          auditLogs={props.auditLogs}
          onReload={props.onReload}
        />
      )}
      {section === 'documentos' && (
        <DocumentsModule
          actor={profile}
          documents={props.documents}
          commissions={props.commissions}
          sessions={props.sessions}
          projects={props.projects}
          onReload={props.onReload}
        />
      )}
      {section === 'sesiones' && (
        <SessionsAttendanceModule
          actor={profile}
          users={props.users}
          sessions={props.sessions}
          attendance={props.attendance}
          justifications={props.justifications}
          documents={props.documents}
          elections={props.elections}
          initialCheckinSessionId={props.qrParams.sessionId}
          initialCheckinCode={props.qrParams.code}
          onReload={props.onReload}
        />
      )}
      {section === 'votaciones' && (
        <ElectionsAndCommitmentsModule
          actor={profile}
          users={props.users}
          elections={props.elections}
          commitments={props.commitments}
          onReload={props.onReload}
        />
      )}
      {section === 'plan_certificados' && (
        <PlanCertsInitiativesModule
          actor={profile}
          isBoard={isBoard}
          users={props.users}
          commissions={props.commissions}
        />
      )}
      {section === 'agenda' && (
        <CalendarMailboxAuditModule
          actor={profile}
          users={props.users}
          events={props.events}
          mailbox={props.mailbox}
          auditLogs={props.auditLogs}
          backupData={{
            users: props.users,
            commissions: props.commissions,
            news: props.news,
            projects: props.projects,
            documents: props.documents,
            sessions: props.sessions,
            attendance: props.attendance,
            justifications: props.justifications,
            elections: props.elections,
            commitments: props.commitments,
            events: props.events,
            mailbox: props.mailbox,
            auditLogs: props.auditLogs,
          }}
          onReload={props.onReload}
        />
      )}
      {section === 'plantillas' && <InstitutionalTemplatesPanel actor={profile} />}
      {section === 'ayuda' && <HelpGuidePanel onOpenTour={props.onOpenTour} />}
    </Suspense>
  );
}
