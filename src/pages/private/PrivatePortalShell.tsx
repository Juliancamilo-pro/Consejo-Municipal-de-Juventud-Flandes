import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllCalendarEvents,
  fetchAllCommissions,
  fetchAllNews,
  fetchAllProjects,
  fetchAuditLogs,
} from '../../services/privateContentService';
import { fetchAllDocuments } from '../../services/documentsService';
import {
  fetchAllCommitments,
  fetchAllElections,
  fetchAllMailboxEntries,
} from '../../services/electionsCommitmentsMailboxService';
import {
  fetchAllAttendance,
  fetchAllJustifications,
  fetchAllSessions,
} from '../../services/sessionsAttendanceService';
import { fetchAllUsers } from '../../services/privateUsersService';
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
import { RoleGuidedTourModal } from '../../components/portal/RoleGuidedTourModal';
import { Button } from '../../components/ui/Button';
import { SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { NotificationsCenterDrawer } from './NotificationsCenterDrawer';
import { buildSidebarItems, PortalSidebar, PrivateSection } from './PortalSidebar';
import { PrivatePortalHeader } from './PrivatePortalHeader';
import { PrivateSectionContent } from './PrivateSectionContent';
import { SessionTimeoutBanner } from './SessionTimeoutBanner';

interface PrivatePortalShellProps {
  profile: UserProfile;
  siteContent: SiteAppearanceConfig;
  onSiteContentUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  inactivityWarningSeconds?: number | null;
  onExtendSession?: () => Promise<void>;
  onRevokeAllDevices?: () => Promise<void>;
}

export function PrivatePortalShell({
  profile,
  siteContent,
  onSiteContentUpdated,
  onLogout,
  inactivityWarningSeconds,
  onExtendSession,
  onRevokeAllDevices,
}: PrivatePortalShellProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(profile.role);

  const [qrParams] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return { sessionId: sp.get('asistencia'), code: sp.get('code') };
  });

  const [section, setSection] = useState<PrivateSection>(() =>
    qrParams.sessionId ? 'sesiones' : 'resumen',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(
    () => typeof window !== 'undefined' && !localStorage.getItem(`cmj_tour_seen_${profile.uid}`),
  );
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [documents, setDocuments] = useState<InstitutionalDocument[]>([]);
  const [sessions, setSessions] = useState<PlenarySession[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [justifications, setJustifications] = useState<JustificationRecord[]>([]);
  const [elections, setElections] = useState<ElectionItem[]>([]);
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [mailbox, setMailbox] = useState<MailboxEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        fetchAllUsers(),
        fetchAllCommissions(),
        fetchAllNews(),
        fetchAllProjects(),
        fetchAllDocuments(),
        fetchAllSessions(),
        fetchAllAttendance(),
        fetchAllJustifications(),
        fetchAllElections(),
        fetchAllCommitments(),
        fetchAllCalendarEvents(),
        fetchAllMailboxEntries(),
        isBoard ? fetchAuditLogs() : Promise.resolve([]),
      ]);

      const failures = results.filter((r) => r.status === 'rejected').length;
      if (failures >= results.length - 1) {
        setLoadError(
          'No pudimos sincronizar los datos del despacho con el servidor. Verifica tu conexión e intenta nuevamente.',
        );
      }

      setUsers(results[0].status === 'fulfilled' ? results[0].value : []);
      setCommissions(results[1].status === 'fulfilled' ? results[1].value : []);
      setNews(results[2].status === 'fulfilled' ? results[2].value : []);
      setProjects(results[3].status === 'fulfilled' ? results[3].value : []);
      setDocuments(results[4].status === 'fulfilled' ? results[4].value : []);
      setSessions(results[5].status === 'fulfilled' ? results[5].value : []);
      setAttendance(results[6].status === 'fulfilled' ? results[6].value : []);
      setJustifications(results[7].status === 'fulfilled' ? results[7].value : []);
      setElections(results[8].status === 'fulfilled' ? results[8].value : []);
      setCommitments(results[9].status === 'fulfilled' ? results[9].value : []);
      setEvents(results[10].status === 'fulfilled' ? results[10].value : []);
      setMailbox(results[11].status === 'fulfilled' ? results[11].value : []);
      setAuditLogs(results[12].status === 'fulfilled' ? results[12].value : []);
    } catch {
      setLoadError(
        'Ocurrió un inconveniente al cargar el despacho privado. Intenta nuevamente.',
      );
    } finally {
      setLoading(false);
    }
  }, [isBoard]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const pendingUsersCount = users.filter((u) => u.status === 'pendiente').length;
  const mailboxOpenCount = mailbox.filter((m) => m.status !== 'archivado').length;
  const totalAlertsBadge = (isBoard ? pendingUsersCount : 0) + mailboxOpenCount + unreadNotices;

  const navItems = buildSidebarItems(isBoard, {
    pendingUsers: pendingUsersCount,
    mailboxOpen: mailboxOpenCount,
  });

  const activeNavItem = navItems.find((item) => item.id === section) || navItems[0];
  const visibleNavItems = quickFilter.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(quickFilter.trim().toLowerCase()),
      )
    : navItems;

  return (
    <div>
      <PrivatePortalHeader
        profile={profile}
        activeLabel={activeNavItem.label}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
        totalAlertsBadge={totalAlertsBadge}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        onReload={reloadAll}
        onLogout={onLogout}
      />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {typeof inactivityWarningSeconds === 'number' && inactivityWarningSeconds > 0 && (
          <SessionTimeoutBanner
            secondsRemaining={inactivityWarningSeconds}
            onExtendSession={onExtendSession}
            onLogout={onLogout}
          />
        )}
        <div className="lg:flex lg:items-start lg:gap-8">
          <PortalSidebar
            profile={profile}
            activeSection={section}
            onSelect={setSection}
            items={visibleNavItems}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />

          <div className="min-w-0 flex-1">
            {loadError && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-100"
              >
                <span>{loadError}</span>
                <Button size="sm" variant="outline" onClick={() => void reloadAll()}>
                  Reintentar
                </Button>
              </div>
            )}
            {loading ? (
              <div className="space-y-4">
                <SkeletonBlock className="h-28 w-full rounded-xl" />
                <SkeletonBlock className="h-64 w-full rounded-xl" />
              </div>
            ) : (
              <PrivateSectionContent
                section={section}
                isBoard={isBoard}
                profile={profile}
                siteContent={siteContent}
                users={users}
                commissions={commissions}
                news={news}
                projects={projects}
                documents={documents}
                sessions={sessions}
                attendance={attendance}
                justifications={justifications}
                elections={elections}
                commitments={commitments}
                events={events}
                mailbox={mailbox}
                auditLogs={auditLogs}
                pendingUsersCount={pendingUsersCount}
                mailboxOpenCount={mailboxOpenCount}
                qrParams={qrParams}
                onSiteContentUpdated={onSiteContentUpdated}
                onReload={reloadAll}
                onNavigateSection={setSection}
                onRevokeAllDevices={onRevokeAllDevices}
                onOpenTour={() => setTourOpen(true)}
              />
            )}
          </div>
        </div>
      </section>

      <NotificationsCenterDrawer
        open={notificationsOpen}
        actor={profile}
        isBoard={isBoard}
        pendingUsersCount={pendingUsersCount}
        mailboxOpenCount={mailboxOpenCount}
        onClose={() => setNotificationsOpen(false)}
        onNavigateSection={setSection}
        onUnreadCountChange={setUnreadNotices}
      />

      <RoleGuidedTourModal
        profile={profile}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </div>
  );
}
