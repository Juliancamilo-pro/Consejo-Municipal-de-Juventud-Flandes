import { FormEvent, useMemo, useState } from 'react';
import { FileText, Hash, Upload } from 'lucide-react';
import {
  createDocumentWithVersion,
  reserveConsecutiveDocumentNumber,
} from '../../services/documentsService';
import { uploadFileResumableToFirebaseStorage } from '../../services/storageService';
import {
  Commission,
  DocumentCategory,
  DocumentStatus,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { suggestMetadataFromFilename } from '../../utils/documentMetadataParser';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  findPotentialDuplicateDocuments,
  parseTagsInput,
} from '../../utils/documentUtils';
import {
  compressImageBeforeUpload,
  computeFileSha256,
  validateFileMagicBytes,
} from '../../utils/fileValidation';
import { MediaStudioModal } from '../../components/media/MediaStudioModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DocumentActaTemplateModal } from './DocumentActaTemplateModal';
import { DocumentUploadQueue, QueuedDocumentFile } from './DocumentUploadQueue';

interface DocumentUploadCardProps {
  actor: UserProfile;
  isBoard: boolean;
  existingDocuments: InstitutionalDocument[];
  commissions: Commission[];
  sessions: PlenarySession[];
  projects: ProjectItem[];
  onReload: () => Promise<void>;
}

export function DocumentUploadCard({
  actor,
  isBoard,
  existingDocuments,
  commissions,
  sessions,
  projects,
  onReload,
}: DocumentUploadCardProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('acta');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [visibility, setVisibility] = useState<'publico' | 'interno'>('interno');
  const [status, setStatus] = useState<DocumentStatus>('borrador');
  const [commissionId, setCommissionId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [autoNumber, setAutoNumber] = useState(true);
  const [queue, setQueue] = useState<QueuedDocumentFile[]>([]);
  const [studioTarget, setStudioTarget] = useState<QueuedDocumentFile | null>(null);
  const [actaModalOpen, setActaModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enqueueFiles = async (list: FileList | null) => {
    if (!list) return;
    setErrorMsg(null);
    const items: QueuedDocumentFile[] = [];
    for (const rawFile of Array.from(list).slice(0, 8)) {
      try {
        await validateFileMagicBytes(rawFile);
        const opt = await compressImageBeforeUpload(rawFile);
        const sha256 = await computeFileSha256(opt.file);
        const canPreview = opt.file.type.startsWith('image/') || opt.file.type === 'application/pdf';
        items.push({
          id: crypto.randomUUID(),
          file: opt.file,
          sha256,
          previewUrl: canPreview ? URL.createObjectURL(opt.file) : undefined,
          compressedSavedPct: opt.compressed ? opt.savedPercent : undefined,
          status: 'listo',
          progress: 0,
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Archivo inválido.');
      }
    }
    if (items.length === 0) return;

    if (!title.trim()) {
      const suggested = suggestMetadataFromFilename(items[0].file.name, commissions, sessions);
      setTitle(suggested.title);
      setCategory(suggested.category);
      if (suggested.commissionId) setCommissionId(suggested.commissionId);
      if (suggested.sessionId) setSessionId(suggested.sessionId);
      if (!tagsRaw.trim() && suggested.tags.length > 0) setTagsRaw(suggested.tags.join(', '));
    }
    setQueue((prev) => [...prev, ...items].slice(0, 8));
  };

  const duplicates = useMemo(() => {
    if (queue.length === 0 && title.trim().length < 4) return [];
    const first = queue[0];
    return findPotentialDuplicateDocuments(existingDocuments, title, first?.file.name || '', first?.file.size || 0, first?.sha256);
  }, [existingDocuments, title, queue]);

  const uploadSingleEntry = async (entry: QueuedDocumentFile, index: number, totalCount: number) => {
    setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, status: 'subiendo', errorText: undefined } : q)));
    try {
      const currentYear = new Date().getFullYear();
      const uploaded = entry.editedMedia
        ? {
            fileId: entry.editedMedia.fileId,
            storagePath: entry.editedMedia.storagePath,
            downloadUrl: entry.editedMedia.downloadUrl,
            fileName: entry.editedMedia.fileName,
            fileMime: entry.editedMedia.fileMime,
            fileSize: entry.editedMedia.fileSize,
          }
        : await uploadFileResumableToFirebaseStorage(entry.file, visibility, 'documents', (pct) => {
            setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, progress: pct } : q)));
          });

      const consecutiveNumber = autoNumber ? await reserveConsecutiveDocumentNumber(category, currentYear) : undefined;
      const docTitle =
        totalCount === 1
          ? title.trim()
          : `${title.trim()} (${index + 1}: ${entry.file.name.replace(/\.[^.]+$/, '')})`.slice(0, 200);

      await createDocumentWithVersion(actor, {
        title: docTitle,
        category,
        description,
        tags: parseTagsInput(tagsRaw),
        consecutiveNumber,
        year: currentYear,
        commissionId: commissionId || undefined,
        sessionId: sessionId || undefined,
        projectId: projectId || undefined,
        status,
        visibility,
        contentSha256: entry.sha256,
        ...uploaded,
      });
      setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, status: 'completado', progress: 100 } : q)));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error subiendo archivo.';
      setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, status: 'error', errorText: msg } : q)));
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const pending = queue.filter((q) => q.status !== 'completado');
    if (pending.length === 0) {
      setErrorMsg('Agrega al menos un documento, imagen o video.');
      return;
    }
    setErrorMsg(null);
    setUploading(true);
    let allOk = true;
    for (let i = 0; i < pending.length; i++) {
      if (!(await uploadSingleEntry(pending[i], i, pending.length))) allOk = false;
    }
    setUploading(false);
    await onReload();
    if (allOk) {
      queue.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
      setTitle('');
      setDescription('');
      setTagsRaw('');
      setQueue([]);
    }
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Gestión Documental · Carga múltiple, SHA-256 y trazabilidad
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
              Registrar documento institucional
            </h2>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setActaModalOpen(true)}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Crear Acta desde plantilla CMJ</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Título del documento" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{DOCUMENT_CATEGORY_LABELS[cat]}</option>)}
            </Select>
            <Select label="Visibilidad" value={visibility} onChange={(e) => setVisibility(e.target.value as 'publico' | 'interno')}>
              <option value="interno">Interno (solo consejeros)</option>
              <option value="publico">Público</option>
            </Select>
            <Select label="Estado inicial" value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus)}>
              <option value="borrador">Borrador</option>
              <option value="revision">En revisión</option>
              {isBoard && <option value="aprobada">Aprobada</option>}
              {isBoard && <option value="publicada">Publicada</option>}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Comisión vinculada (opcional)" value={commissionId} onChange={(e) => setCommissionId(e.target.value)}>
              <option value="">Ninguna comisión</option>
              {commissions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Sesión vinculada (opcional)" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Ninguna sesión</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </Select>
            <Select label="Proyecto vinculado (opcional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Ningún proyecto</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Etiquetas (separadas por coma)" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="juventud, 2026, plenaria" />
            <label className="mt-6 flex min-h-[42px] cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 bg-[#FAF8F4] px-3.5 text-xs text-stone-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <input type="checkbox" checked={autoNumber} onChange={(e) => setAutoNumber(e.target.checked)} className="h-4 w-4 accent-[#7B1832]" />
              <Hash className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <span>Numeración consecutiva oficial ({new Date().getFullYear()})</span>
            </label>
          </div>

          <Textarea label="Descripción breve (opcional)" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />

          <DocumentUploadQueue
            queue={queue}
            duplicates={duplicates}
            uploading={uploading}
            onEnqueue={(files) => void enqueueFiles(files)}
            onEditMedia={setStudioTarget}
            onRetryItem={(id) => {
              const found = queue.find((q) => q.id === id);
              if (found) void uploadSingleEntry(found, 0, 1).then((ok) => { if (ok) void onReload(); });
            }}
            onRemove={(id) => {
              const found = queue.find((q) => q.id === id);
              if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
              setQueue((prev) => prev.filter((q) => q.id !== id));
            }}
          />

          {errorMsg && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">{errorMsg}</p>}

          <Button type="submit" loading={uploading}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>{queue.length > 1 ? `Subir ${queue.length} documentos` : 'Subir documento'}</span>
          </Button>
        </form>
      </Card>

      <DocumentActaTemplateModal open={actaModalOpen} actor={actor} sessions={sessions} onClose={() => setActaModalOpen(false)} onSaved={onReload} />
      <MediaStudioModal
        open={Boolean(studioTarget)}
        file={studioTarget?.file || null}
        visibility={visibility}
        title="Ajustar fotografía o video del documento"
        onClose={() => setStudioTarget(null)}
        onComplete={(result) => {
          if (studioTarget) setQueue((prev) => prev.map((q) => (q.id === studioTarget.id ? { ...q, editedMedia: result } : q)));
          setStudioTarget(null);
        }}
      />
    </>
  );
}
