import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Info, Trash2 } from 'lucide-react';
import { AttendanceRecord, CalendarEventItem, CommitmentItem, UserProfile } from '../../types/models';
import {
  getWorkspaceAccessToken,
  signInWithGoogleWorkspacePopup,
} from '../../services/firebase';
import {
  deleteWorkspaceLinkFromServer,
  fetchSavedWorkspaceLinks,
  SavedWorkspaceLink,
} from '../../services/workspaceApi';
import { Card } from '../../components/ui/Card';
import { GoogleSignInButton } from '../../components/ui/GoogleSignInButton';
import { Select } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { WorkspaceCalendarPanel } from './WorkspaceCalendarPanel';
import { WorkspaceDocsPanel } from './WorkspaceDocsPanel';
import { WorkspaceSheetsPanel } from './WorkspaceSheetsPanel';

interface WorkspaceModuleProps {
  cmjEvents: CalendarEventItem[];
  users?: UserProfile[];
  attendance?: AttendanceRecord[];
  commitments?: CommitmentItem[];
}

export function WorkspaceModule({
  cmjEvents,
  users = [],
  attendance = [],
  commitments = [],
}: WorkspaceModuleProps) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sheets' | 'docs' | 'calendar' | 'links'>('sheets');
  const [savedLinks, setSavedLinks] = useState<SavedWorkspaceLink[]>([]);
  const [typeFilter, setTypeFilter] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      const list = await fetchSavedWorkspaceLinks();
      setSavedLinks(list);
    } catch {
      // Silencioso si aún no hay enlaces
    }
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const handleConnectWorkspace = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const { accessToken: freshToken } = await signInWithGoogleWorkspacePopup();
      if (!freshToken) {
        setConnectError(
          'No se obtuvo el token de acceso de Google Workspace. Verifica los permisos solicitados.',
        );
      } else {
        setAccessToken(freshToken);
      }
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Error conectando con Google Workspace.',
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    await deleteWorkspaceLinkFromServer(id);
    await loadLinks();
  };

  const filteredLinks = useMemo(
    () => savedLinks.filter((l) => !typeFilter || l.resourceType === typeFilter),
    [savedLinks, typeFilter],
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
              Integración Oficial Google Workspace
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">
              Google Sheets, Docs y Calendar
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
              El acceso OAuth permanece únicamente en la memoria de tu sesión actual y solicita
              confirmación explícita antes de crear o modificar hojas, documentos o eventos.
            </p>
          </div>

          <div className="w-full sm:w-64">
            {accessToken ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Google Workspace activo
                </span>
                <button
                  type="button"
                  onClick={() => void handleConnectWorkspace()}
                  className="underline hover:no-underline"
                >
                  Renovar
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                label="Conectar Sheets, Docs y Calendar"
                loading={connecting}
                onClick={() => void handleConnectWorkspace()}
              />
            )}
          </div>
        </div>

        {!accessToken && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-stone-200 bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-stone-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
            <span>
              Inicia sesión con tu cuenta Google institucional arriba para listar o exportar tablas a Google Sheets, crear actas en Google Docs o sincronizar la agenda en Calendar.
            </span>
          </div>
        )}

        {connectError && (
          <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-400">{connectError}</p>
        )}
      </Card>

      <Tabs
        ariaLabel="Herramientas de Google Workspace"
        activeId={tab}
        onChange={setTab}
        options={[
          { id: 'sheets', label: 'Google Sheets' },
          { id: 'docs', label: 'Google Docs y Drive' },
          { id: 'calendar', label: 'Google Calendar' },
          { id: 'links', label: `Referencias CMJ (${savedLinks.length})` },
        ]}
      />

      {tab === 'sheets' && (
        <WorkspaceSheetsPanel
          accessToken={accessToken}
          users={users}
          attendance={attendance}
          commitments={commitments}
          onRefreshLinks={loadLinks}
        />
      )}

      {tab === 'docs' && (
        <WorkspaceDocsPanel accessToken={accessToken} onRefreshLinks={loadLinks} />
      )}

      {tab === 'calendar' && (
        <WorkspaceCalendarPanel
          accessToken={accessToken}
          cmjEvents={cmjEvents}
          onRefreshLinks={loadLinks}
        />
      )}

      {tab === 'links' && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
              Hojas, documentos y eventos vinculados en Firestore
            </h3>
            <div className="w-52">
              <Select label="Filtrar tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Todos ({savedLinks.length})</option>
                <option value="sheet">Google Sheets</option>
                <option value="doc">Google Docs</option>
                <option value="calendar_event">Google Calendar</option>
              </Select>
            </div>
          </div>
          {filteredLinks.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-slate-400">
              Aún no hay enlaces guardados que coincidan con este filtro.
            </p>
          ) : (
            <ul className="divide-y divide-stone-200 dark:divide-slate-800">
              {filteredLinks.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-[#7B1832] uppercase dark:text-[#D9B245]">
                      {item.resourceType === 'sheet'
                        ? 'Google Sheets'
                        : item.resourceType === 'doc'
                          ? 'Google Doc'
                          : 'Google Calendar'}
                      {item.folderTag ? ` · ${item.folderTag}` : ''}
                    </span>
                    <p className="font-medium text-stone-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Vinculado por {item.linkedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLink(item.id)}
                      className="text-xs text-red-700 hover:text-red-900 dark:text-red-400"
                      title="Quitar referencia"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
