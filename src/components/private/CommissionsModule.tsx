import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  FolderKanban,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { isLeadershipTier } from '../../lib/security';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AccessTier,
  Commission,
  CommissionTask,
  GalleryItem,
  PortalDocument,
  PublicCouncilor,
  RoleLabel,
  TaskStatus,
} from '../../types/cmj';
import { MediaPreviewModal, type PreviewMediaPayload } from '../MediaPreviewModal';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function CommissionsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  myCommissionId,
  commissions,
  commissionTasks,
  publicCouncilors,
  documents,
  galleryItems,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  myCommissionId: string;
  commissions: Commission[];
  commissionTasks: CommissionTask[];
  publicCouncilors: PublicCouncilor[];
  documents: PortalDocument[];
  galleryItems: GalleryItem[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);

  const sortedCommissions = useMemo(
    () => commissions.slice().sort((a, b) => a.number - b.number),
    [commissions]
  );

  const [selectedId, setSelectedId] = useState(
    myCommissionId || sortedCommissions[0]?.id || 'comision-1'
  );
  const currentComm =
    sortedCommissions.find((c) => c.id === selectedId) || sortedCommissions[0];

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWorkPlan, setEditWorkPlan] = useState('');
  const [editCoordUid, setEditCoordUid] = useState('');
  const [editingComm, setEditingComm] = useState(false);

  // Tareas de comisión
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigned, setTaskAssigned] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Galería y vista previa
  const [evidTitle, setEvidTitle] = useState('');
  const [preview, setPreview] = useState<PreviewMediaPayload | null>(null);

  if (!currentComm) return null;

  const canEditThisComm = isLeader || currentComm.coordinatorUid === uid;
  const members = publicCouncilors.filter(
    (c) => c.active && c.commissionId === currentComm.id
  );
  const tasks = commissionTasks.filter((t) => t.commissionId === currentComm.id);
  const commDocs = documents.filter((d) => d.commissionId === currentComm.id);
  const commGallery = galleryItems.filter((g) => g.commissionId === currentComm.id);

  const progressPct = tasks.length
    ? Math.round(
        tasks.reduce(
          (acc, t) => acc + (t.status === 'hecha' ? 100 : t.status === 'en_curso' ? 50 : 0),
          0
        ) / tasks.length
      )
    : 0;

  const openEditComm = () => {
    setEditName(currentComm.name);
    setEditDesc(currentComm.description);
    setEditWorkPlan(currentComm.workPlanSummary || '');
    setEditCoordUid(currentComm.coordinatorUid || '');
    setEditingComm(true);
  };

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const coord = publicCouncilors.find((c) => c.uid === editCoordUid);
      const payload: Record<string, unknown> = {
        description: editDesc.trim(),
        workPlanSummary: editWorkPlan.trim(),
        updatedAt: serverTimestamp(),
      };
      if (isLeader) {
        payload.name = editName.trim() || currentComm.name;
        if (coord) {
          payload.coordinatorUid = coord.uid;
          payload.coordinatorName = coord.fullName;
        }
      }
      await updateDoc(doc(db, 'commissions', currentComm.id), payload);
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó información de comisión',
        module: 'Comisiones',
        targetTitle: currentComm.name,
      });
      setEditingComm(false);
      showToast('Comisión actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la comisión', 'error');
    }
  };

  const handleCoverUploaded = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first) return;
    try {
      if (currentComm.storagePath) {
        await deleteStorageFile(currentComm.storagePath, currentComm.coverUrl);
      }
      await updateDoc(doc(db, 'commissions', currentComm.id), {
        coverUrl: first.url,
        storagePath: first.storagePath || '',
        updatedAt: serverTimestamp(),
      });
      showToast('Portada de comisión actualizada', 'success');
    } catch {
      showToast('Error al guardar la portada', 'error');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setAddingTask(true);
    try {
      await addDoc(collection(db, 'commission_tasks'), {
        commissionId: currentComm.id,
        title: taskTitle.trim(),
        status: 'pendiente' as TaskStatus,
        assignedName: taskAssigned.trim() || actorName,
        dueDate: taskDue,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTaskTitle('');
      setTaskAssigned('');
      setTaskDue('');
      showToast('Tarea agregada a la comisión', 'success');
    } catch {
      showToast('No se pudo crear la tarea', 'error');
    } finally {
      setAddingTask(false);
    }
  };

  const cycleTaskStatus = async (task: CommissionTask) => {
    const next: TaskStatus =
      task.status === 'pendiente'
        ? 'en_curso'
        : task.status === 'en_curso'
        ? 'hecha'
        : 'pendiente';
    try {
      await updateDoc(doc(db, 'commission_tasks', task.id), {
        status: next,
        updatedAt: serverTimestamp(),
      });
    } catch {
      showToast('Error al actualizar tarea', 'error');
    }
  };

  const handleDeleteTask = async (task: CommissionTask) => {
    try {
      await deleteDoc(doc(db, 'commission_tasks', task.id));
      showToast('Tarea eliminada', 'info');
    } catch {
      showToast('No tienes permisos para eliminar esta tarea', 'error');
    }
  };

  const handleEvidenceUploaded = async (files: UploadedFileInfo[]) => {
    for (const file of files) {
      await addDoc(collection(db, 'gallery_items'), {
        title: evidTitle.trim() || file.fileName.replace(/\.[^.]+$/, ''),
        description: `Evidencia de ${currentComm.name}`,
        mediaType: file.category === 'video' ? 'video' : 'image',
        videoSource: file.videoSource || 'upload',
        url: file.url,
        thumbnailUrl: file.thumbnailUrl || '',
        storagePath: file.storagePath || '',
        thumbnailStoragePath: file.thumbnailStoragePath || '',
        commissionId: currentComm.id,
        authorUid: uid,
        authorName: actorName,
        status: 'publicado',
        createdAt: serverTimestamp(),
      });
    }
    setEvidTitle('');
    await recordAudit({
      uid,
      actorName,
      actorRoleLabel,
      action: 'Subió evidencia multimedia de comisión',
      module: 'Comisiones',
      targetTitle: currentComm.name,
    });
  };

  const handleDeleteGalleryItem = async (item: GalleryItem) => {
    try {
      await deleteStorageFile(item.storagePath, item.url);
      if (item.thumbnailStoragePath) {
        await deleteStorageFile(item.thumbnailStoragePath, item.thumbnailUrl);
      }
      await deleteDoc(doc(db, 'gallery_items', item.id));
      showToast('Evidencia eliminada de Firestore y Storage', 'info');
    } catch {
      showToast('No se pudo eliminar la evidencia', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de las 5 comisiones */}
      <div className="flex flex-wrap gap-2">
        {sortedCommissions.map((comm) => (
          <button
            key={comm.id}
            type="button"
            onClick={() => {
              setSelectedId(comm.id);
              setEditingComm(false);
            }}
            className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              currentComm.id === comm.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400'
            }`}
          >
            {comm.name}
          </button>
        ))}
      </div>

      {/* Tarjeta principal de la comisión */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {currentComm.coverUrl && (
          <div className="h-44 w-full bg-slate-900 overflow-hidden">
            <img
              src={currentComm.coverUrl}
              alt={currentComm.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-blue-600 dark:text-cyan-400">
                <FolderKanban className="h-3.5 w-3.5" /> Comisión {currentComm.number}
              </span>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {currentComm.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {currentComm.description}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Coordinación:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {currentComm.coordinatorName || 'Por asignar'}
                </strong>{' '}
                · {members.length} consejero(s)
              </p>
            </div>

            {canEditThisComm && (
              <button
                type="button"
                onClick={openEditComm}
                className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Editar comisión y plan
              </button>
            )}
          </div>

          {/* Avance automático calculado desde tareas */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-200">
                Avance automático de tareas ({tasks.filter((t) => t.status === 'hecha').length}/{tasks.length})
              </span>
              <span className="font-mono-num text-blue-600 dark:text-cyan-400">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: currentComm.accentColor || '#2563EB',
                }}
              />
            </div>
            {currentComm.workPlanSummary && (
              <p className="pt-2 text-xs text-slate-600 dark:text-slate-300">
                <strong>Plan de trabajo:</strong> {currentComm.workPlanSummary}
              </p>
            )}
          </div>

          {editingComm && (
            <form
              onSubmit={handleSaveComm}
              className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isLeader && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Nombre de la comisión</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Coordinador(a)</label>
                      <select
                        value={editCoordUid}
                        onChange={(e) => setEditCoordUid(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      >
                        <option value="">Por asignar</option>
                        {publicCouncilors
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.uid} value={c.uid}>
                              {c.fullName} ({c.roleLabel})
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descripción temática</label>
                <textarea
                  rows={2}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Resumen del plan de trabajo</label>
                <textarea
                  rows={2}
                  value={editWorkPlan}
                  onChange={(e) => setEditWorkPlan(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <MediaUploader
                storageFolder={`commissions/${currentComm.id}`}
                imagePreset="cover"
                label="Cambiar portada de la comisión"
                onUploaded={handleCoverUploaded}
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditingComm(false)}
                  className="rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Tareas y Miembros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Tareas de {currentComm.name}
          </h3>

          <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Nueva tarea o entregable..."
              className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={taskAssigned}
              onChange={(e) => setTaskAssigned(e.target.value)}
              placeholder="Responsable"
              className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={addingTask}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Crear
            </button>
          </form>

          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Aún no hay tareas registradas en esta comisión.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => cycleTaskStatus(task)}
                    title="Clic para cambiar estado: pendiente → en curso → hecha"
                    className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
                  >
                    {task.status === 'hecha' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : task.status === 'en_curso' ? (
                      <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          task.status === 'hecha'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {task.assignedName || 'Sin asignar'} {task.dueDate ? `· Límite ${task.dueDate}` : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        task.status === 'hecha'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : task.status === 'en_curso'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {task.status === 'hecha'
                        ? 'Hecha'
                        : task.status === 'en_curso'
                        ? 'En curso'
                        : 'Pendiente'}
                    </span>
                    {(isLeader || task.createdByUid === uid) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Integrantes ({members.length})
            </h3>
            {members.length === 0 ? (
              <p className="text-xs text-slate-500">Sin consejeros asignados aún.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {m.fullName}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">{m.roleLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Documentos ({commDocs.length})
            </h3>
            {commDocs.length === 0 ? (
              <p className="text-xs text-slate-500">No hay actas o informes asociados.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {commDocs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          title: d.title,
                          url: d.fileUrl,
                          fileName: d.fileName,
                          mediaType: d.mimeType.includes('pdf') ? 'pdf' : 'document',
                        })
                      }
                      className="text-left font-medium text-blue-600 dark:text-cyan-400 hover:underline truncate w-full cursor-pointer"
                    >
                      {d.title} ({d.version})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Galería y evidencias de la comisión */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Evidencias y Galería de {currentComm.name}
          </h3>
          <p className="text-xs text-slate-500">
            Sube fotos (optimización automática WebP), videos MP4 o enlaza YouTube/Vimeo.
          </p>
        </div>

        <input
          type="text"
          value={evidTitle}
          onChange={(e) => setEvidTitle(e.target.value)}
          placeholder="Título descriptivo para la siguiente evidencia (opcional)"
          className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />

        <MediaUploader
          storageFolder={`gallery/${currentComm.id}`}
          imagePreset="gallery"
          multiple
          allowExternalVideo
          label="Subir evidencias de la comisión"
          onUploaded={handleEvidenceUploaded}
        />

        {commGallery.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {commGallery.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPreview({
                      title: g.title,
                      subtitle: g.description,
                      url: g.url,
                      thumbnailUrl: g.thumbnailUrl,
                      videoSource: g.videoSource,
                      mediaType: g.mediaType,
                    })
                  }
                  className="aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer"
                >
                  <img
                    src={g.thumbnailUrl || g.url}
                    alt={g.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="p-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">{g.title}</p>
                  {(isLeader || g.authorUid === uid) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(g)}
                      title="Eliminar de galería y Storage"
                      className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
