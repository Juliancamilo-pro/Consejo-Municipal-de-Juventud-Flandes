import { useCallback, useEffect, useState } from 'react';
import {
  CalendarEventItem,
  Commission,
  CouncilInfo,
  InstitutionalDocument,
  NewsItem,
  PlenarySession,
  ProjectItem,
  PublicDirectoryMember,
} from '../types/models';
import { toFriendlySpanishError } from '../utils/friendlyErrors';
import {
  fetchCouncilInfo,
  fetchPublicCalendarEvents,
  fetchPublicCommissions,
  fetchPublicDirectory,
  fetchPublicDocuments,
  fetchPublicSessions,
  fetchPublishedNews,
  fetchPublishedProjects,
} from '../services/publicService';

export interface PublicPortalState {
  loading: boolean;
  error: string | null;
  councilInfo: CouncilInfo | null;
  directory: PublicDirectoryMember[];
  commissions: Commission[];
  news: NewsItem[];
  projects: ProjectItem[];
  sessions: PlenarySession[];
  documents: InstitutionalDocument[];
  events: CalendarEventItem[];
  reload: () => Promise<void>;
}

export function usePublicPortalData(): PublicPortalState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [councilInfo, setCouncilInfo] = useState<CouncilInfo | null>(null);
  const [directory, setDirectory] = useState<PublicDirectoryMember[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [sessions, setSessions] = useState<PlenarySession[]>([]);
  const [documents, setDocuments] = useState<InstitutionalDocument[]>([]);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetchCouncilInfo(),
        fetchPublicDirectory(),
        fetchPublicCommissions(),
        fetchPublishedNews(),
        fetchPublishedProjects(),
        fetchPublicSessions(),
        fetchPublicDocuments(),
        fetchPublicCalendarEvents(),
      ]);

      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (rejected.length === results.length) {
        setError(
          toFriendlySpanishError(
            rejected[0]?.reason,
            'No pudimos cargar la información pública en este momento. Intenta nuevamente.',
          ),
        );
      }

      setCouncilInfo(results[0].status === 'fulfilled' ? results[0].value : null);
      setDirectory(results[1].status === 'fulfilled' ? results[1].value : []);
      setCommissions(results[2].status === 'fulfilled' ? results[2].value : []);
      setNews(results[3].status === 'fulfilled' ? results[3].value : []);
      setProjects(results[4].status === 'fulfilled' ? results[4].value : []);
      setSessions(results[5].status === 'fulfilled' ? results[5].value : []);
      setDocuments(results[6].status === 'fulfilled' ? results[6].value : []);
      setEvents(results[7].status === 'fulfilled' ? results[7].value : []);
    } catch (err) {
      setError(
        toFriendlySpanishError(
          err,
          'No fue posible consultar la información pública en este momento.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    error,
    councilInfo,
    directory,
    commissions,
    news,
    projects,
    sessions,
    documents,
    events,
    reload,
  };
}
