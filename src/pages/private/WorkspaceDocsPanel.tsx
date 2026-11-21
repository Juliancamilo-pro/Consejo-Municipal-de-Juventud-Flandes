import { FormEvent, useState } from 'react';
import { ExternalLink, FilePlus2, FileText, Link2, RefreshCw } from 'lucide-react';
import {
  appendTextToGoogleDoc,
  createGoogleDoc,
  GoogleDocSummary,
  listRecentGoogleDocs,
  readGoogleDocText,
  saveWorkspaceLinkToServer,
} from '../../services/workspaceApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Textarea } from '../../components/ui/Input';
import {
  PendingDocAction,
  WorkspaceDocPreviewAndModal,
} from './WorkspaceDocPreviewCard';

interface WorkspaceDocsPanelProps {
  accessToken: string | null;
  onRefreshLinks: () => Promise<void>;
}

export function WorkspaceDocsPanel({ accessToken, onRefreshLinks }: WorkspaceDocsPanelProps) {
  const [docs, setDocs] = useState<GoogleDocSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GoogleDocSummary | null>(null);
  const [docPreview, setDocPreview] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [appendText, setAppendText] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingDocAction>(null);
  const [executing, setExecuting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoadDocs = async () => {
    if (!accessToken) return;
    setLoadingDocs(true);
    setErrorMsg(null);
    try {
      const files = await listRecentGoogleDocs(accessToken);
      setDocs(files);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error listando documentos de Google Docs.');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleInspectDoc = async (doc: GoogleDocSummary) => {
    if (!accessToken) return;
    setSelectedDoc(doc);
    setLoadingPreview(true);
    setErrorMsg(null);
    try {
      const parsed = await readGoogleDocText(accessToken, doc.id);
      setDocPreview(parsed.text || '(El documento está vacío actualmente)');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo leer el contenido del documento.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRequestCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setPendingAction({ kind: 'create', title: newTitle.trim(), body: newBody });
  };

  const handleRequestAppend = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !appendText.trim()) return;
    setPendingAction({ kind: 'append', doc: selectedDoc, text: appendText.trim() });
  };

  const executeConfirmedAction = async () => {
    if (!accessToken || !pendingAction) return;
    setExecuting(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      if (pendingAction.kind === 'create') {
        const created = await createGoogleDoc(accessToken, pendingAction.title, pendingAction.body);
        await saveWorkspaceLinkToServer({
          resourceType: 'doc',
          externalId: created.documentId,
          title: created.title,
          url: created.url,
          notes: 'Documento creado desde el portal CMJ Flandes',
        });
        setNewTitle('');
        setNewBody('');
        setNotice(`Documento "${created.title}" creado en Google Docs y vinculado al CMJ.`);
        await Promise.all([handleLoadDocs(), onRefreshLinks()]);
      } else if (pendingAction.kind === 'append') {
        await appendTextToGoogleDoc(accessToken, pendingAction.doc.id, pendingAction.text);
        setAppendText('');
        setNotice(`Se agregó el bloque de texto al documento "${pendingAction.doc.name}".`);
        await handleInspectDoc(pendingAction.doc);
      }
      setPendingAction(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error ejecutando operación en Google Docs.');
    } finally {
      setExecuting(false);
    }
  };

  const handlePinDocLink = async (doc: GoogleDocSummary) => {
    const url = doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`;
    try {
      await saveWorkspaceLinkToServer({
        resourceType: 'doc',
        externalId: doc.id,
        title: doc.name,
        url,
        notes: 'Enlace institucional de Google Docs',
      });
      await onRefreshLinks();
      setNotice(`Enlace "${doc.name}" fijado en el repositorio del CMJ.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fijando enlace.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                Documentos recientes en Google Drive / Docs
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Consulta borradores de actas, oficios o informes de tu cuenta Google.
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={!accessToken} loading={loadingDocs} onClick={() => void handleLoadDocs()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cargar Docs</span>
            </Button>
          </div>

          {!accessToken ? (
            <p className="mt-4 text-xs text-stone-600 dark:text-slate-300">
              Conecta tu cuenta Google arriba para consultar y editar documentos de Google Docs.
            </p>
          ) : docs.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={FileText}
                title="Haz clic en 'Cargar Docs' para listar tus documentos"
                description="Se mostrarán tus archivos recientes de Google Docs sin modificar nada."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-200 dark:divide-slate-800">
              {docs.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => void handleInspectDoc(doc)}
                    className="text-left font-medium text-stone-900 hover:text-[#7B1832] dark:text-slate-100 dark:hover:text-[#D9B245]"
                  >
                    {doc.name}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePinDocLink(doc)}
                      title="Fijar referencia en el portal CMJ"
                      className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Link2 className="h-3 w-3" aria-hidden="true" />
                      <span>Fijar</span>
                    </button>
                    <a
                      href={doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
            <FilePlus2 className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>Crear nuevo Google Doc institucional</span>
          </h3>
          <form onSubmit={handleRequestCreate} className="mt-4 space-y-3">
            <Input
              label="Título del documento"
              required
              maxLength={180}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Acta Sesión Ordinaria CMJ Flandes"
            />
            <Textarea
              label="Contenido inicial (opcional)"
              rows={5}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Encabezado, orden del día o borrador inicial..."
            />
            <Button type="submit" disabled={!accessToken}>
              Crear en Google Docs
            </Button>
          </form>
        </Card>
      </div>

      {notice && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {errorMsg && <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>}

      <WorkspaceDocPreviewAndModal
        accessToken={accessToken}
        selectedDoc={selectedDoc}
        loadingPreview={loadingPreview}
        docPreview={docPreview}
        appendText={appendText}
        onChangeAppendText={setAppendText}
        onRequestAppend={handleRequestAppend}
        pendingAction={pendingAction}
        executing={executing}
        onCloseModal={() => setPendingAction(null)}
        onConfirmModal={executeConfirmedAction}
      />
    </div>
  );
}
