import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  AttendanceRecord,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  ElectionItem,
  InstitutionalDocument,
  MailboxEntry,
  PlenarySession,
  ProjectItem,
  ROLE_LABELS,
  UserProfile,
} from '../../types/models';
import { formatFirestoreDate } from '../../utils/formatDate';
import {
  exportFullManagementExcel,
  exportFullManagementPdf,
} from '../../utils/managementReportExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DashboardCouncilInfoCard } from './DashboardCouncilInfoCard';
import { DashboardImmediateQueue } from './DashboardImmediateQueue';
import { DashboardMyDayAndChecklist } from './DashboardMyDayAndChecklist';
import { DashboardOperationalCharts } from './DashboardOperationalCharts';
import { DashboardStatsGrid } from './DashboardStatsGrid';
import { DashboardSystemHealthCard } from './DashboardSystemHealthCard';
import { PrivateSection } from './PortalSidebar';
import { ProfilePublicEditor } from './ProfilePublicEditor';
import { SiteAnalyticsCard } from './SiteAnalyticsCard';

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

interface DashboardOverviewProps {
  profile: UserProfile;
  users: UserProfile[];
  projects: ProjectItem[];
  commissions: Commission[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  documents: InstitutionalDocument[];
  elections: ElectionItem[];
  events: CalendarEventItem[];
  mailbox?: MailboxEntry[];
  counts: {
    users: number;
    pendingUsers: number;
    documents: number;
    sessions: number;
    commitments: number;
    mailboxOpen: number;
  };
  onReload: () => Promise<void>;
  onNavigateSection: (section: PrivateSection) => void;
  onRevokeAllDevices?: () => Promise<void>;
}

function getCutoffMs(period: PeriodFilter): number | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return Date.now() - days * 86_400_000;
}

function toTimestampMs(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return Number.isNaN(ms) ? null : ms;
  }
  const iso = formatFirestoreDate(val);
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

export function DashboardOverview({
  profile,
  users,
  projects,
  commissions,
  sessions,
  attendance,
  commitments,
  documents,
  elections,
  events,
  mailbox = [],
  counts,
  onReload,
  onNavigateSection,
  onRevokeAllDevices,
}: DashboardOverviewProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(profile.role);
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const cutoffMs = getCutoffMs(period);
  const reportData = { users, projects, sessions, attendance, commitments, documents };

  const scopedCommitments = useMemo(
    () =>
      cutoffMs === null
        ? commitments
        : commitments.filter((c) => {
            const ms = toTimestampMs(c.createdAt) ?? toTimestampMs(c.dueDate);
            return ms === null || ms >= cutoffMs;
          }),
    [commitments, cutoffMs],
  );

  const scopedProjects = useMemo(
    () =>
      cutoffMs === null
        ? projects
        : projects.filter((p) => {
            const ms = toTimestampMs(p.createdAt) ?? toTimestampMs(p.updatedAt);
            return ms === null || ms >= cutoffMs;
          }),
    [projects, cutoffMs],
  );

  return (
    <div className="space-y-8">
      <DashboardStatsGrid
        isBoard={isBoard}
        counts={counts}
        onNavigateSection={onNavigateSection}
      />

      <DashboardImmediateQueue
        role={profile.role}
        isBoard={isBoard}
        pendingUsers={counts.pendingUsers}
        commitments={commitments}
        sessions={sessions}
        mailbox={mailbox}
        documents={documents}
        onNavigateSection={onNavigateSection}
      />

      <DashboardMyDayAndChecklist
        profile={profile}
        sessions={sessions}
        attendance={attendance}
        commitments={commitments}
        onNavigateSection={onNavigateSection}
      />

      <Card padding="sm" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-stone-900 dark:text-white">
            Informe Integral de Gestión · Periodo 2026–2029
          </p>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Filtra por ventana temporal y descarga el consolidado oficial en PDF o Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-stone-200 bg-[#FAF8F4] p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
            {(['7d', '30d', '90d', 'all'] as PeriodFilter[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPeriod(opt)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  period === opt
                    ? 'bg-[#7B1832] text-white dark:bg-[#C59B27] dark:text-slate-950'
                    : 'text-stone-600 hover:text-stone-950 dark:text-slate-300'
                }`}
              >
                {opt === '7d' ? '7 días' : opt === '30d' ? '30 días' : opt === '90d' ? '90 días' : 'Todo'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => exportFullManagementPdf(reportData)}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Informe PDF</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void exportFullManagementExcel(reportData)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Informe Excel</span>
          </Button>
        </div>
      </Card>

      <DashboardOperationalCharts commitments={scopedCommitments} projects={scopedProjects} />

      {isBoard && <SiteAnalyticsCard />}

      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[#7B1832]" />
        <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
          {ROLE_LABELS[profile.role]}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">
          Mi perfil institucional y ficha pública
        </h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          Gestiona tu ficha pública, redes sociales verificadas, privacidad por campo, seguridad de acceso y tu actividad en el consejo.
        </p>

        <ProfilePublicEditor
          profile={profile}
          projects={projects}
          commissions={commissions}
          sessions={sessions}
          attendance={attendance}
          commitments={commitments}
          elections={elections}
          events={events}
          onReload={onReload}
          onNavigateSection={onNavigateSection}
          onRevokeAllDevices={onRevokeAllDevices}
        />
      </Card>

      {profile.role === 'secretario_admin' && <DashboardSystemHealthCard />}

      {isBoard && <DashboardCouncilInfoCard profile={profile} />}
    </div>
  );
}
