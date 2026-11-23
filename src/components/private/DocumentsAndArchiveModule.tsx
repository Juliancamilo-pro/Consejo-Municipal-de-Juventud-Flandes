import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Folder,
  Globe,
  Lock,
  Search,
  Trash2,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatBytes } from '../../lib/mediaProcessor';
import { isLeadershipTier } from '../../lib/security';
import { deleteStorageFile } from '../../lib/storageUtils';
import type { AccessTier, Commission, PortalDocument, RoleLabel } from '../../types/cmj';
import { MediaPreviewModal, type PreviewMediaPayload } from '../MediaPreviewModal';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function DocumentsAndArchiveModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  documents,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  documents: PortalDocument[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);

  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('Actas');
  const [category, setCategory] = useState('Acta');
  const [version, setVersion] = useState('v1.0');
  const [visibility, setVisibility] = useState<'publico' | 'privado'>(
    isLeader ? 'publico' : 'privado'
  );
  const [commissionId, setCommissionId] = useState(commissions[0]?.id || 'comision-1');

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('todas');
  const [preview, setPreview] = useState<PreviewMediaPayload | null>(null);

  const folders = useMemo(() => {
    const base = ['Actas', 'Acuerdos', 'Oficios', 'Informes', 'Planes'];
    documents.forEach((d) => {
      if (d.folder && !base.includes(d.folder)) base.push(d.folder);
    });
    return base;
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents
      .filter((d) => folderFilter === 'todas' || (d.folder || 'General') === folderFilter)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q)
      );
  }, [documents, folderFilter, search]);

  const handleUploadedDoc = async (files: UploadedFileInfo[]) => {
    for (const file of files) {
      const docTitle = title.trim() || file.fileName.replace(/\.[^.]+$/, '');
      await addDoc(collection(db, 'documents'), {
        title: docTitle,
        folder: folder.trim() || 'General',
        category,
        version: version.trim() || 'v1.0',
        fileUrl: file.url,
        storagePath: file.storagePath || '',
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        visibility: isLeader ? visibility : 'privado',
        commissionId,
        uploadedByUid: uid,
        uploadedByName: actorName,
        approvedByPresidente: actorRoleLabel === 'Presidente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Subió documento al archivo',
        module: 'Documentos',
        targetTitle: docTitle,
      });
    }
    setTitle('');
  };

  const handleToggleApprove = async (d: PortalDocument) => {
    try {
      await updateDoc(doc(db, 'documents', d.id), {
        approvedByPresidente: !d.approvedByPresidente,
        updatedAt: serverTimestamp(),
      });
      showToast(
        !d.approvedByPresidente ? 'Documento aprobado' : 'Aprobación retirada',
        'success'
      );
    } catch {
      showToast('Sin permisos para aprobar documento', 'error');
    }
  };

  const handleToggleVisibility = async (d: PortalDocument) => {
    const next = d.visibility === 'publico' ? 'privado' : 'publico';
    try {
      await updateDoc(doc(db, 'documents', d.id), {
        visibility: next,
        updatedAt: serverTimestamp(),
      });
      showToast(`Visibilidad cambiada a ${next}`, 'info');
    } catch {
      showToast('No se pudo cambiar la visibilidad', 'error');
    }
  };

  const handleDeleteDoc = async (d: PortalDocument) => {
    try {
      await deleteStorageFile(d.storagePath, d.fileUrl);
      await deleteDoc(doc(db, 'documents', d.id));
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Eliminó documento',
        module: 'Documentos',
        targetTitle: d.title,
      });
      showToast('Documento eliminado de Firestore y Storage', 'info');
    } catch {
      showToast('No se pudo eliminar el documento', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Archivo Documental por Carpetas y Versiones
          </h2>
          <p className="text-xs text-slate-500">
            Sube actas, oficios, reglamentos, hojas de cálculo y presentaciones directamente a Firebase Storage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del documento (opcional)"
            className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <input
            type="text"
            list="cmj-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Carpeta (ej: Actas)"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          />
          <datalist id="cmj-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="Acta">Acta</option>
            <option value="Acuerdo">Acuerdo</option>
            <option value="Oficio">Oficio</option>
            <option value="Informe">Informe</option>
            <option value="Plan">Plan</option>
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0"
              className="w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2.5 text-sm"
            />
            {isLeader && (
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'publico' | 'privado')}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2.5 text-sm"
              >
                <option value="publico">Público</option>
                <option value="privado">Privado</option>
              </select>
            )}
          </div>
        </div>

        <select
          value={commissionId}
          onChange={(e) => setCommissionId(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          {commissions.map((c) => (
            <option key={c.id} value={c.id}>
              Asociado a: {c.name}
            </option>
          ))}
        </select>

        <MediaUploader
          storageFolder={`documents/${folder.replace(/[^a-zA-Z0-9_-]/g, '_') || 'general'}`}
          multiple
          label="Seleccionar archivo(s) para subir al archivo"
          onUploaded={handleUploadedDoc}
        />
      </div>

      {/* Lista de documentos */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFolderFilter('todas')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                folderFilter === 'todas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Todas ({documents.length})
            </button>
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFolderFilter(f)}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  folderFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Folder className="h-3.5 w-3.5" /> {f}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento..."
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            No hay documentos en esta carpeta todavía.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((d) => (
              <div
                key={d.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {d.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {d.folder || 'General'} · {d.category} · {d.version} · {d.fileName}
                      {d.fileSize ? ` (${formatBytes(d.fileSize)})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPreview({
                        title: d.title,
                        subtitle: `${d.category} · ${d.version}`,
                        url: d.fileUrl,
                        fileName: d.fileName,
                        mediaType: d.mimeType.includes('pdf') ? 'pdf' : 'document',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </button>
                  <a
                    href={d.fileUrl}
                    download={d.fileName || true}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {isLeader && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(d)}
                        title={d.visibility === 'publico' ? 'Hacer privado' : 'Publicar'}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          d.visibility === 'publico'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {d.visibility === 'publico' ? (
                          <Globe className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {d.visibility}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleApprove(d)}
                        title="Aprobación Presidencia"
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          d.approvedByPresidente
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-600'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {d.approvedByPresidente ? 'Aprobado' : 'Aprobar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d)}
                        title="Eliminar archivo"
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MediaPreviewModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
