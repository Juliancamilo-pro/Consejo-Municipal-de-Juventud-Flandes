import { FormEvent, useState } from 'react';
import { Archive, CheckCircle2, MessageSquarePlus, RotateCcw, Send, UploadCloud } from 'lucide-react';
import {
  DocumentComment,
  DocumentStatus,
  DocumentVersion,
  InstitutionalDocument,
} from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';

interface DocumentDrawerSectionsProps {
  docItem: InstitutionalDocument;
  isBoard: boolean;
  isAuthor: boolean;
  canCreate: boolean;
  versions: DocumentVersion[];
  comments: DocumentComment[];
  busy: boolean;
  onTransition: (
    nextStatus: DocumentStatus,
    nextVisibility: 'publico' | 'interno',
    note?: string,
  ) => Promise<void>;
  onAddComment: (commentText: string) => Promise<void>;
  onUploadVersion: (file: File, changelog: string) => Promise<void>;
}

export function DocumentDrawerSections({
  docItem,
  isBoard,
  isAuthor,
  canCreate,
  versions,
  comments,
  busy,
  onTransition,
  onAddComment,
  onUploadVersion,
}: DocumentDrawerSectionsProps) {
  const [reviewNote, setReviewNote] = useState('');
  const [commentText, setCommentText] = useState('');
  const [changelog, setChangelog] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await onAddComment(commentText);
    setCommentText('');
  };

  const submitVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFile) return;
    await onUploadVersion(newFile, changelog);
    setNewFile(null);
    setChangelog('');
  };

  return (
    <>
      <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-slate-800">
        <h3 className="font-display text-sm font-semibold text-stone-950 dark:text-white">
          Flujo editorial
        </h3>
        {isBoard && (
          <Textarea
            label="Observación de revisión (requerida al devolver)"
            rows={2}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {(isAuthor || isBoard) && docItem.status === 'borrador' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onTransition('revision', docItem.visibility)}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Enviar a revisión</span>
            </Button>
          )}
          {isBoard && docItem.status === 'revision' && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onTransition('aprobada', docItem.visibility, reviewNote).then(() =>
                    setReviewNote(''),
                  )
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Aprobar</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !reviewNote.trim()}
                onClick={() =>
                  void onTransition('borrador', docItem.visibility, reviewNote).then(() =>
                    setReviewNote(''),
                  )
                }
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Devolver con comentario</span>
              </Button>
            </>
          )}
          {isBoard && docItem.status !== 'publicada' && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void onTransition('publicada', 'publico', reviewNote).then(() => setReviewNote(''))
              }
            >
              <span>Publicar al ciudadano</span>
            </Button>
          )}
          {isBoard && docItem.status !== 'archivada' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onTransition('archivada', 'interno')}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Archivar</span>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-slate-800">
        <h3 className="font-display text-sm font-semibold text-stone-950 dark:text-white">
          Historial de versiones ({versions.length})
        </h3>
        {canCreate && (
          <form onSubmit={submitVersion} className="space-y-2 rounded-lg bg-white p-3 dark:bg-slate-950/60">
            <Input
              label="Nota de nueva versión"
              required
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Ej. Corrección de firmas"
            />
            <input
              type="file"
              required
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-stone-600 dark:text-slate-300"
            />
            <Button type="submit" size="sm" loading={busy}>
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Subir v{docItem.currentVersion + 1}</span>
            </Button>
          </form>
        )}
        <ul className="space-y-2 text-xs">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 p-2.5 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="font-semibold text-stone-900 dark:text-white">
                  v{v.versionNumber} · {v.fileName}
                </p>
                <p className="truncate text-stone-500 dark:text-slate-400">
                  {v.uploadedByName} · {v.changelog || 'Sin nota'}
                </p>
              </div>
              <StorageDownloadButton
                compact
                item={{
                  fileId: v.fileId,
                  storagePath: v.storagePath,
                  downloadUrl: v.downloadUrl,
                  visibility: docItem.visibility,
                  fileName: v.fileName,
                }}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-slate-800">
        <h3 className="font-display text-sm font-semibold text-stone-950 dark:text-white">
          Comentarios de revisión ({comments.length})
        </h3>
        <form onSubmit={submitComment} className="flex gap-2">
          <Input
            label="Nuevo comentario"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Escribe una observación..."
            className="flex-1"
          />
          <div className="flex items-end">
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </form>
        <div className="space-y-2 text-xs">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-stone-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <p className="font-semibold text-stone-900 dark:text-white">{c.authorName}</p>
              <p className="mt-0.5 text-stone-600 dark:text-slate-300">{c.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
