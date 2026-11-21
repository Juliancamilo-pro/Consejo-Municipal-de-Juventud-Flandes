import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import {
  addDocumentComment,
  fetchDocumentComments,
  incrementDocumentDownloadCount,
} from '../../services/documentsExtrasService';
import {
  addDocumentNewVersion,
  fetchDocumentVersions,
  updateDocumentWorkflow,
} from '../../services/documentsService';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import {
  Commission,
  DocumentComment,
  DocumentStatus,
  DocumentVersion,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatFileSize,
} from '../../utils/documentUtils';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { StatusText } from '../../components/ui/StatusText';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { useToast } from '../../components/ui/Toast';
import { DocumentDrawerSections } from './DocumentDrawerSections';

interface DocumentDetailDrawerProps {
  docItem: InstitutionalDocument | null;
  actor: UserProfile;
  isBoard: boolean;
  canCreate: boolean;
  commissions: Commission[];
  sessions: PlenarySession[];
  projects: ProjectItem[];
  onClose: () => void;
  onPreview: (docItem: InstitutionalDocument) => void;
  onReload: () => Promise<void>;
}

export function DocumentDetailDrawer({
  docItem,
  actor,
  isBoard,
  canCreate,
  commissions,
  sessions,
  projects,
  onClose,
  onPreview,
  onReload,
}: DocumentDetailDrawerProps) {
  const { showToast } = useToast();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!docItem) return;
    let active = true;
    Promise.all([
      fetchDocumentVersions(docItem.id).catch(() => []),
      fetchDocumentComments(docItem.id).catch(() => []),
    ]).then(([vList, cList]) => {
      if (!active) return;
      setVersions(vList);
      setComments(cList);
    });
    return () => {
      active = false;
    };
  }, [docItem]);

  if (!docItem) {
    return (
      <Drawer open={false} title="Detalle documental" onClose={onClose}>
        <div />
      </Drawer>
    );
  }

  const commissionName = commissions.find((c) => c.id === docItem.commissionId)?.name;
  const sessionTitle = sessions.find((s) => s.id === docItem.sessionId)?.title;
  const projectTitle = projects.find((p) => p.id === docItem.projectId)?.title;
  const isAuthor = docItem.authorUid === actor.uid;

  const handleTransition = async (
    nextStatus: DocumentStatus,
    nextVisibility: 'publico' | 'interno',
    note?: string,
  ) => {
    setBusy(true);
    try {
      await updateDocumentWorkflow(actor, docItem, nextStatus, nextVisibility, note);
      if (note?.trim()) {
        await addDocumentComment(
          actor,
          docItem.id,
          note,
          nextStatus === 'aprobada' ? 'aprobacion' : 'devolucion',
        );
      }
      showToast(`Estado actualizado a ${DOCUMENT_STATUS_LABELS[nextStatus]}.`, 'success');
      await onReload();
      setComments(await fetchDocumentComments(docItem.id).catch(() => []));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo cambiar el estado.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddComment = async (commentText: string) => {
    setBusy(true);
    try {
      await addDocumentComment(actor, docItem.id, commentText, 'comentario');
      setComments(await fetchDocumentComments(docItem.id));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadVersion = async (file: File, changelog: string) => {
    setBusy(true);
    try {
      const uploaded = await uploadFileToFirebaseStorage(file, docItem.visibility, 'documents');
      await addDocumentNewVersion(actor, docItem, {
        ...uploaded,
        changelog,
        nextStatus: docItem.status,
        nextVisibility: docItem.visibility,
      });
      setVersions(await fetchDocumentVersions(docItem.id));
      showToast('Nueva versión cargada correctamente.', 'success');
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={Boolean(docItem)}
      title={docItem.title}
      subtitle={`${DOCUMENT_CATEGORY_LABELS[docItem.category] || docItem.category}${
        docItem.consecutiveNumber ? ` · ${docItem.consecutiveNumber}` : ''
      }`}
      onClose={onClose}
    >
      <div className="space-y-6 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <StatusText
            label={DOCUMENT_STATUS_LABELS[docItem.status]}
            tone={docItem.status === 'publicada' ? 'success' : 'info'}
          />
          <span className="font-mono-tabular text-xs text-stone-500 dark:text-slate-400">
            v{docItem.currentVersion} · {formatFileSize(docItem.fileSize)} ·{' '}
            {docItem.downloadCount ?? 0} descargas
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onPreview(docItem)}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Vista previa</span>
          </Button>
          <span onClick={() => void incrementDocumentDownloadCount(docItem.id)}>
            <StorageDownloadButton item={docItem} />
          </span>
        </div>

        {docItem.description && (
          <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            {docItem.description}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 p-3 text-xs dark:border-slate-800">
          <div>
            <dt className="text-stone-500 dark:text-slate-400">Autor</dt>
            <dd className="font-medium text-stone-900 dark:text-white">{docItem.authorName}</dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-slate-400">Visibilidad</dt>
            <dd className="font-medium capitalize text-stone-900 dark:text-white">
              {docItem.visibility}
            </dd>
          </div>
          {commissionName && (
            <div className="col-span-2">
              <dt className="text-stone-500 dark:text-slate-400">Comisión</dt>
              <dd className="font-medium text-stone-900 dark:text-white">{commissionName}</dd>
            </div>
          )}
          {sessionTitle && (
            <div className="col-span-2">
              <dt className="text-stone-500 dark:text-slate-400">Sesión</dt>
              <dd className="font-medium text-stone-900 dark:text-white">{sessionTitle}</dd>
            </div>
          )}
          {projectTitle && (
            <div className="col-span-2">
              <dt className="text-stone-500 dark:text-slate-400">Proyecto</dt>
              <dd className="font-medium text-stone-900 dark:text-white">{projectTitle}</dd>
            </div>
          )}
        </dl>

        {docItem.tags && docItem.tags.length > 0 && (
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Etiquetas: {docItem.tags.join(' · ')}
          </p>
        )}

        <DocumentDrawerSections
          docItem={docItem}
          isBoard={isBoard}
          isAuthor={isAuthor}
          canCreate={canCreate}
          versions={versions}
          comments={comments}
          busy={busy}
          onTransition={handleTransition}
          onAddComment={handleAddComment}
          onUploadVersion={handleUploadVersion}
        />
      </div>
    </Drawer>
  );
}
