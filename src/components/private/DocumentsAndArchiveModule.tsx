import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Folder,
  Globe,
  History,
  Lock,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { formatBytes } from '../../lib/mediaProcessor';
import { isLeadershipTier } from '../../lib/security';
import { deleteStorageFile } from '../../lib/storageUtils';
import type { AccessTier, Commission, PortalDocument, RoleLabel } from '../../types/cmj';
import { MediaPreviewModal, type PreviewMediaPayload } from '../MediaPreviewModal';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

function inferPreviewMediaType(mimeType: string, fileName: string): PreviewMediaPayload['mediaType'] {
  const m = (mimeType || '').toLowerCase();
  const n = (fileName || '').toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

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
  const [commissionId, setCommissionId] = useState('');

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('todas');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [commissionFilter, setCommissionFilter] = useState('todas');
  const [preview, setPreview] = useState<PreviewMediaPayload | null>(null);

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [editCategory, setEditCategory] = useState('Acta');
  const [editVersion, setEditVersion] = useState('v1.0');
  const [editCommId, setEditCommId] = useState('');

  // Control de versiones
  const [versioningDoc, setVersioningDoc] = useState<PortalDocument | null>(null);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');
  const [historyDoc, setHistoryDoc] = useState<PortalDocument | null>(null);

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
      .filter((d) => categoryFilter === 'todas' || d.category === categoryFilter)
      .filter((d) => commissionFilter === 'todas' || (d.commissionId || '') === commissionFilter)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q)
      );
  }, [documents, folderFilter, categoryFilter, commissionFilter, search]);

  const handleUploadedDoc = async (files: UploadedFileInfo[]) => {
    try {
      for (const file of files) {
        const docTitle = title.trim() || file.fileName.replace(/\.[^.]+$/, '');
        await apiRequest('/api/documents', {
          method: 'POST',
          body: {
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
          },
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
      showToast('Documento guardado en el archivo', 'success');
    } catch {
      showToast('No se pudo registrar el documento en la base de datos', 'error');
    }
  };

  const handleUploadNewVersion = async (files: UploadedFileInfo[]) => {
    const file = files[0];
    if (!file || !versioningDoc) return;
    try {
      const res = await apiRequest<{ ok: boolean; version: string }>(
        `/api/documents/${encodeURIComponent(versioningDoc.id)}/version`,
        {
          method: 'POST',
          body: {
            version: newVersionLabel.trim() || undefined,
            note: newVersionNote.trim() || undefined,
            fileUrl: file.url,
            storagePath: file.storagePath || '',
            fileName: file.fileName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
          },
        }
      );
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Publicó versión ${res.version}`,
        module: 'Documentos',
        targetTitle: versioningDoc.title,
      });
      setVersioningDoc(null);
      setNewVersionLabel('');
      setNewVersionNote('');
      showToast(`Nueva versión ${res.version} registrada`, 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo subir la nueva versión';
      showToast(msg, 'error');
    }
  };

  const startEditDoc = (d: PortalDocument) => {
    setEditingDocId(d.id);
    setEditTitle(d.title);
    setEditFolder(d.folder || 'General');
    setEditCategory(d.category);
    setEditVersion(d.version);
    setEditCommId(d.commissionId || '');
  };

  const handleSaveDocEdit = async (d: PortalDocument) => {
    if (!editTitle.trim()) return;
    try {
      await apiRequest(`/api/documents/${encodeURIComponent(d.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          folder: editFolder.trim() || 'General',
          category: editCategory,
          version: editVersion.trim() || 'v1.0',
          commissionId: editCommId,
        },
      });
      setEditingDocId(null);
      showToast('Metadatos del documento actualizados', 'success');
    } catch {
      showToast('No se pudo actualizar el documento', 'error');
    }
  };

  const handleToggleApprove = async (d: PortalDocument) => {
    try {
      await apiRequest(`/api/documents/${encodeURIComponent(d.id)}`, {
        method: 'PATCH',
        body: { approvedByPresidente: !d.approvedByPresidente },
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
      await apiRequest(`/api/documents/${encodeURIComponent(d.id)}`, {
        method: 'PATCH',
        body: { visibility: next },
      });
      showToast(`Visibilidad cambiada a ${next}`, 'info');
    } catch {
      showToast('No se pudo cambiar la visibilidad', 'error');
    }
  };

  const handleDeleteDoc = async (d: PortalDocument) => {
    try {
      await deleteStorageFile(d.storagePath, d.fileUrl);
      await apiRequest(`/api/documents/${encodeURIComponent(d.id)}`, {
        method: 'DELETE',
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Eliminó documento',
        module: 'Documentos',
        targetTitle: d.title,
      });
      showToast('Documento eliminado del archivo institucional', 'info');
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
            Sube actas, oficios, reglamentos, hojas de cálculo y presentaciones al repositorio seguro del CMJ con historial de versiones.
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
          <option value="">General / Sin comisión específica</option>
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
        <div className="flex flex-col gap-3">
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

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documento por título, archivo o categoría..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="todas">Todos los tipos</option>
              <option value="Acta">Acta</option>
              <option value="Acuerdo">Acuerdo</option>
              <option value="Oficio">Oficio</option>
              <option value="Informe">Informe</option>
              <option value="Plan">Plan</option>
            </select>
            <select
              value={commissionFilter}
              onChange={(e) => setCommissionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="todas">Todas las comisiones</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            No hay documentos en esta carpeta todavía.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((d) => {
              const isEditingDoc = editingDocId === d.id;
              const prevCount = d.versionHistory?.length || 0;
              return (
                <div key={d.id} className="py-3.5 space-y-2.5">
                  {isEditingDoc && isLeader ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título"
                        className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editFolder}
                        onChange={(e) => setEditFolder(e.target.value)}
                        placeholder="Carpeta"
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      >
                        <option value="Acta">Acta</option>
                        <option value="Acuerdo">Acuerdo</option>
                        <option value="Oficio">Oficio</option>
                        <option value="Informe">Informe</option>
                        <option value="Plan">Plan</option>
                      </select>
                      <input
                        type="text"
                        value={editVersion}
                        onChange={(e) => setEditVersion(e.target.value)}
                        placeholder="v1.0"
                        className="sm:col-span-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      />
                      <select
                        value={editCommId}
                        onChange={(e) => setEditCommId(e.target.value)}
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      >
                        <option value="">General</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="sm:col-span-1 flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveDocEdit(d)}
                          className="rounded-lg bg-emerald-600 p-1.5 text-white cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDocId(null)}
                          className="rounded-lg bg-slate-200 dark:bg-slate-800 p-1.5 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {d.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d.folder || 'General'} · {d.category} ·{' '}
                            <strong className="text-blue-600 dark:text-cyan-400">{d.version}</strong> ·{' '}
                            {d.fileName}
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
                              mimeType: d.mimeType,
                              mediaType: inferPreviewMediaType(d.mimeType, d.fileName),
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
                        {prevCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setHistoryDoc(d)}
                            title="Ver historial de versiones"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                          >
                            <History className="h-3 w-3" /> {prevCount + 1} v
                          </button>
                        )}
                        {isLeader && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setVersioningDoc(d);
                                setNewVersionLabel('');
                                setNewVersionNote('');
                              }}
                              title="Subir nueva versión"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 cursor-pointer"
                            >
                              <UploadCloud className="h-3 w-3" /> Nueva versión
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditDoc(d)}
                              title="Editar metadatos"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Subir Nueva Versión */}
      {versioningDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setVersioningDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-blue-600 dark:text-cyan-400">
                  Control de Versiones · Actual {versioningDoc.version}
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {versioningDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVersioningDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="Ej: v2.0 (opcional auto)"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newVersionNote}
                onChange={(e) => setNewVersionNote(e.target.value)}
                placeholder="Nota de cambios (opcional)"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <MediaUploader
              storageFolder={`documents/${versioningDoc.folder || 'general'}`}
              label="Seleccionar archivo actualizado"
              onUploaded={handleUploadNewVersion}
            />
          </div>
        </div>
      )}

      {/* Modal Historial de Versiones */}
      {historyDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setHistoryDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                  Historial de Versiones
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {historyDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {historyDoc.version} (Vigente)
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{historyDoc.fileName}</p>
                </div>
                <a
                  href={historyDoc.fileUrl}
                  download={historyDoc.fileName || true}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-white font-semibold"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
              </div>

              {(historyDoc.versionHistory || []).map((v, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white">{v.version}</span>{' '}
                    <span className="text-slate-500">
                      · {new Date(v.uploadedAt).toLocaleDateString('es-CO')} · {v.uploadedByName}
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 truncate">{v.fileName}</p>
                    {v.notes && <p className="text-[11px] text-slate-500 mt-0.5">{v.notes}</p>}
                  </div>
                  <a
                    href={v.fileUrl}
                    download={v.fileName || true}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 font-semibold shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <MediaPreviewModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
export default DocumentsAndArchiveModule;
