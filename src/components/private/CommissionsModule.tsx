import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
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
import { ConfirmDialog, DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function CommissionsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier: _accessTier,
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
  const { can, isCoordinatorOf } = usePermissions();
  const [memberCandidateUid, setMemberCandidateUid] = useState('');
  const [updatingMember, setUpdatingMember] = useState(false);

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
  const [editAccentColor, setEditAccentColor] = useState('#2563EB');
  const [editIconName, setEditIconName] = useState('BookOpen');
  const [editingComm, setEditingComm] = useState(false);

  // Tareas de comisión
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigned, setTaskAssigned] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Búsqueda, filtro y paginación de tareas
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | TaskStatus>('all');
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(8);
  const [exporting, setExporting] = useState(false);

  // Edición de tarea
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskAssigned, setEditTaskAssigned] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('pendiente');

  // Confirmaciones de borrado
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<CommissionTask | null>(null);
  const [deleteGalleryTarget, setDeleteGalleryTarget] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Galería y vista previa
  const [evidTitle, setEvidTitle] = useState('');
  const [preview, setPreview] = useState<PreviewMediaPayload | null>(null);

  if (!currentComm) return null;

  const isGlobalCommAdmin = can('comision.editar_todas');
  const canAssignCoord = can('comision.coordinador_asignar');
  const isCoord = isCoordinatorOf(currentComm.id) || currentComm.coordinatorUid === uid;
  const canEditThisComm =
    isGlobalCommAdmin || can('comision.editar_propia', currentComm.id);
  const canManageMembers =
    isGlobalCommAdmin || can('comision.miembros_gestionar', currentComm.id);
  const canManageTasks =
    isGlobalCommAdmin || can('comision.tareas_gestionar', currentComm.id);
  const canExportComm =
    can('comision.reportes_exportar', currentComm.id) || isGlobalCommAdmin;
  const canUploadCommGallery = can('galeria.gestionar', currentComm.id);

  const members = publicCouncilors.filter(
    (c) => c.active && c.commissionId === currentComm.id
  );
  const availableMemberCandidates = publicCouncilors.filter(
    (c) => c.active && c.commissionId !== currentComm.id
  );
  const allTasks = commissionTasks.filter((t) => t.commissionId === currentComm.id);
  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return allTasks
      .filter((t) => taskStatusFilter === 'all' || t.status === taskStatusFilter)
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.assignedName || '').toLowerCase().includes(q)
      );
  }, [allTasks, taskSearch, taskStatusFilter]);

  const totalTaskPages = Math.max(1, Math.ceil(filteredTasks.length / taskPageSize));
  const safeTaskPage = Math.min(taskPage, totalTaskPages);
  const pagedTasks = filteredTasks.slice(
    (safeTaskPage - 1) * taskPageSize,
    safeTaskPage * taskPageSize
  );

  const commDocs = documents.filter((d) => d.commissionId === currentComm.id);
  const commGallery = galleryItems.filter((g) => g.commissionId === currentComm.id);

  const progressPct = allTasks.length
    ? Math.round(
        allTasks.reduce(
          (acc, t) => acc + (t.status === 'hecha' ? 100 : t.status === 'en_curso' ? 50 : 0),
          0
        ) / allTasks.length
      )
    : 0;

  const handleExportTasks = async () => {
    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: `Comisiones_y_Tareas_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: `Plan y Tareas de ${currentComm.name}`,
        moduleName: 'Comisiones',
        generatedBy: actorName,
        includeSummarySheet: true,
        sheets: [
          {
            name: `Tareas Com. ${currentComm.number}`,
            title: `Tareas de ${currentComm.name}`,
            kpis: [
              { label: 'Total tareas', value: allTasks.length },
              { label: 'Hechas', value: allTasks.filter((t) => t.status === 'hecha').length },
              { label: 'En curso', value: allTasks.filter((t) => t.status === 'en_curso').length },
              { label: 'Avance %', value: `${progressPct}%` },
            ],
            columns: [
              { key: 'titulo', header: 'Tarea / Entregable', type: 'text', minWidth: 28, maxWidth: 48, wrap: true },
              { key: 'responsable', header: 'Responsable', type: 'text', minWidth: 18, maxWidth: 28 },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 14, maxWidth: 18, align: 'center' },
              { key: 'limite', header: 'Fecha Límite', type: 'date', minWidth: 14, maxWidth: 16 },
            ],
            rows: allTasks.map((t) => ({
              titulo: t.title,
              responsable: t.assignedName || 'Sin asignar',
              estado:
                t.status === 'hecha' ? 'Hecha' : t.status === 'en_curso' ? 'En curso' : 'Pendiente',
              limite: t.dueDate || '',
            })),
          },
          {
            name: 'Todas las Comisiones',
            title: 'Consolidado General de las Comisiones CMJ',
            columns: [
              { key: 'numero', header: 'N.º', type: 'integer', minWidth: 8, maxWidth: 10 },
              { key: 'nombre', header: 'Comisión', type: 'text', minWidth: 24, maxWidth: 36 },
              { key: 'coordinador', header: 'Coordinador(a)', type: 'text', minWidth: 20, maxWidth: 30 },
              { key: 'integrantes', header: 'Integrantes', type: 'integer', minWidth: 13, maxWidth: 16 },
              { key: 'tareasTotal', header: 'Tareas', type: 'integer', minWidth: 11, maxWidth: 14 },
              { key: 'avance', header: 'Avance %', type: 'percent', minWidth: 12, maxWidth: 16 },
            ],
            rows: sortedCommissions.map((c) => {
              const cTasks = commissionTasks.filter((t) => t.commissionId === c.id);
              const cPct = cTasks.length
                ? cTasks.reduce(
                    (acc, t) => acc + (t.status === 'hecha' ? 1 : t.status === 'en_curso' ? 0.5 : 0),
                    0
                  ) / cTasks.length
                : 0;
              return {
                numero: c.number,
                nombre: c.name,
                coordinador: c.coordinatorName || 'Por asignar',
                integrantes: publicCouncilors.filter((m) => m.active && m.commissionId === c.id).length,
                tareasTotal: cTasks.length,
                avance: cPct,
              };
            }),
          },
        ],
      });
      showToast('Reporte de comisiones exportado a Excel', 'success');
    } catch {
      showToast('No se pudo generar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const openEditComm = () => {
    setEditName(currentComm.name);
    setEditDesc(currentComm.description);
    setEditWorkPlan(currentComm.workPlanSummary || '');
    setEditCoordUid(currentComm.coordinatorUid || '');
    setEditAccentColor(currentComm.accentColor || '#2563EB');
    setEditIconName(currentComm.iconName || 'BookOpen');
    setEditingComm(true);
  };

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const coord = publicCouncilors.find((c) => c.uid === editCoordUid && c.active);
      const payload: Record<string, unknown> = {
        description: editDesc.trim(),
        workPlanSummary: editWorkPlan.trim(),
      };
      if (isGlobalCommAdmin) {
        payload.name = editName.trim() || currentComm.name;
        payload.accentColor = editAccentColor;
        payload.iconName = editIconName;
      }
      if (canAssignCoord) {
        if (coord) {
          payload.coordinatorUid = coord.uid;
          payload.coordinatorName = coord.fullName;
        } else {
          payload.coordinatorUid = '';
          payload.coordinatorName = 'Por asignar';
        }
      }
      await apiRequest(`/api/commissions/${encodeURIComponent(currentComm.id)}`, {
        method: 'PATCH',
        body: payload,
      });
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
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la comisión',
        'error'
      );
    }
  };

  const handleMemberChange = async (action: 'add' | 'remove', targetUid: string) => {
    if (!targetUid) return;
    setUpdatingMember(true);
    try {
      await apiRequest(`/api/commissions/${encodeURIComponent(currentComm.id)}/members`, {
        method: 'PATCH',
        body: { action, targetUid },
      });
      setMemberCandidateUid('');
      showToast(
        action === 'add' ? 'Integrante vinculado a la comisión' : 'Integrante retirado de la comisión',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la membresía',
        'error'
      );
    } finally {
      setUpdatingMember(false);
    }
  };

  const handleCoverUploaded = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first) return;
    try {
      if (currentComm.storagePath) {
        await deleteStorageFile(currentComm.storagePath, currentComm.coverUrl);
      }
      await apiRequest(`/api/commissions/${encodeURIComponent(currentComm.id)}`, {
        method: 'PATCH',
        body: {
          coverUrl: first.url,
          storagePath: first.storagePath || '',
        },
      });
      showToast('Portada de comisión actualizada', 'success');
    } catch {
      showToast('Error al guardar la portada', 'error');
    }
  };

  const handleRemoveCover = async () => {
    try {
      if (currentComm.storagePath) {
        await deleteStorageFile(currentComm.storagePath, currentComm.coverUrl);
      }
      await apiRequest(`/api/commissions/${encodeURIComponent(currentComm.id)}`, {
        method: 'PATCH',
        body: {
          coverUrl: '',
          storagePath: '',
        },
      });
      showToast('Portada eliminada', 'info');
    } catch {
      showToast('No se pudo quitar la portada', 'error');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setAddingTask(true);
    try {
      await apiRequest('/api/commission-tasks', {
        method: 'POST',
        body: {
          commissionId: currentComm.id,
          title: taskTitle.trim(),
          status: 'pendiente' as TaskStatus,
          assignedName: taskAssigned.trim() || actorName,
          dueDate: taskDue,
        },
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
      await apiRequest(`/api/commission-tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: { status: next },
      });
    } catch {
      showToast('Error al actualizar tarea', 'error');
    }
  };

  const startEditTask = (task: CommissionTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskAssigned(task.assignedName || '');
    setEditTaskDue(task.dueDate || '');
    setEditTaskStatus(task.status);
  };

  const handleSaveEditTask = async (task: CommissionTask) => {
    if (!editTaskTitle.trim()) return;
    try {
      await apiRequest(`/api/commission-tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: {
          title: editTaskTitle.trim(),
          assignedName: editTaskAssigned.trim(),
          dueDate: editTaskDue,
          status: editTaskStatus,
        },
      });
      setEditingTaskId(null);
      showToast('Tarea actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la tarea', 'error');
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!deleteTaskTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/commission-tasks/${encodeURIComponent(deleteTaskTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTaskTarget(null);
      showToast('Tarea eliminada', 'info');
    } catch {
      showToast('No tienes permisos para eliminar esta tarea', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleEvidenceUploaded = async (files: UploadedFileInfo[]) => {
    try {
      for (const file of files) {
        await apiRequest('/api/gallery', {
          method: 'POST',
          body: {
            title: evidTitle.trim() || file.fileName.replace(/\.[^.]+$/, ''),
            description: `Evidencia de ${currentComm.name}`,
            mediaType: file.category === 'video' ? 'video' : 'image',
            videoSource: file.videoSource || 'upload',
            url: file.url,
            thumbnailUrl: file.thumbnailUrl || '',
            storagePath: file.storagePath || '',
            thumbnailStoragePath: file.thumbnailStoragePath || '',
            commissionId: currentComm.id,
            status: 'publicado',
          },
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
      showToast('Evidencia guardada en la galería', 'success');
    } catch {
      showToast('No se pudo registrar la evidencia en el servidor', 'error');
    }
  };

  const handleConfirmDeleteGalleryItem = async () => {
    if (!deleteGalleryTarget) return;
    setDeleting(true);
    try {
      await deleteStorageFile(deleteGalleryTarget.storagePath, deleteGalleryTarget.url);
      if (deleteGalleryTarget.thumbnailStoragePath) {
        await deleteStorageFile(
          deleteGalleryTarget.thumbnailStoragePath,
          deleteGalleryTarget.thumbnailUrl
        );
      }
      await apiRequest(`/api/gallery/${encodeURIComponent(deleteGalleryTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteGalleryTarget(null);
      showToast('Evidencia eliminada del portal y archivo', 'info');
    } catch {
      showToast('No se pudo eliminar la evidencia', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de comisiones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {sortedCommissions.map((comm) => (
            <button
              key={comm.id}
              type="button"
              onClick={() => {
                setSelectedId(comm.id);
                setEditingComm(false);
                setTaskPage(1);
              }}
              className={`min-h-[40px] rounded-2xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                currentComm.id === comm.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
              }`}
            >
              {comm.name}
            </button>
          ))}
        </div>

        {canExportComm && (
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportTasks}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? 'Exportando...' : 'Exportar Excel (.xlsx)'}
          </button>
        )}
      </div>

      {/* Tarjeta principal de la comisión */}
      <div className="cmj-card overflow-hidden">
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
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                <FolderKanban className="h-3.5 w-3.5" /> Comisión {currentComm.number}
              </span>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {currentComm.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {currentComm.description}
              </p>
              <p className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <span>
                  Coordinación:{' '}
                  <strong className="text-slate-800 dark:text-slate-100">
                    {currentComm.coordinatorName || 'Por asignar'}
                  </strong>{' '}
                  · {members.length} consejero(s)
                </span>
                {isCoord && (
                  <span className="rounded-md bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                    Eres coordinador(a) de esta comisión
                  </span>
                )}
              </p>
            </div>

            {canEditThisComm ? (
              <button
                type="button"
                onClick={openEditComm}
                className="min-h-[40px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Editar comisión y plan
              </button>
            ) : (
              <PermissionDeniedBanner
                permission="comision.editar_propia"
                commissionId={currentComm.id}
                compact
                customText="Solo lectura en esta comisión."
              />
            )}
          </div>

          {/* Avance automático */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-200">
                Avance automático de tareas ({allTasks.filter((t) => t.status === 'hecha').length}/{allTasks.length})
              </span>
              <span className="font-mono-num text-emerald-700 dark:text-emerald-400">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: currentComm.accentColor || '#047857',
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
              className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-slate-950 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isGlobalCommAdmin && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Nombre de la comisión</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {canAssignCoord && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Coordinador(a)</label>
                    <select
                      value={editCoordUid}
                      onChange={(e) => setEditCoordUid(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
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
                )}
                {isGlobalCommAdmin && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Ícono institucional</label>
                      <select
                        value={editIconName}
                        onChange={(e) => setEditIconName(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      >
                        <option value="BookOpen">Educación / Libro</option>
                        <option value="Briefcase">Empleo / Emprendimiento</option>
                        <option value="HeartPulse">Salud y Bienestar</option>
                        <option value="Leaf">Ambiente y Territorio</option>
                        <option value="Scale">Derechos y Control Social</option>
                        <option value="Users">Juventudes y Comunidad</option>
                        <option value="Sparkles">Cultura y Creatividad</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Color distintivo</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editAccentColor}
                          onChange={(e) => setEditAccentColor(e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="font-mono-num text-xs text-slate-500">{editAccentColor}</span>
                      </div>
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

              <div className="space-y-2">
                <MediaUploader
                  storageFolder={`commissions/${currentComm.id}`}
                  imagePreset="cover"
                  label="Cambiar portada de la comisión"
                  onUploaded={handleCoverUploaded}
                />
                {currentComm.coverUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-300 dark:border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar imagen de portada
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditingComm(false)}
                  className="min-h-[38px] rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2 text-xs font-semibold cursor-pointer"
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
        <div className="lg:col-span-8 cmj-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tareas de {currentComm.name} ({filteredTasks.length})
            </h3>
          </div>

          {canManageTasks || myCommissionId === currentComm.id ? (
            <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Nueva tarea o entregable..."
                aria-label="Nueva tarea"
                className="sm:col-span-5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={taskAssigned}
                onChange={(e) => setTaskAssigned(e.target.value)}
                placeholder="Responsable"
                aria-label="Responsable"
                className="sm:col-span-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                aria-label="Fecha límite"
                className="sm:col-span-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={addingTask}
                className="sm:col-span-2 min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" /> Crear
              </button>
            </form>
          ) : (
            <PermissionDeniedBanner
              permission="comision.tareas_gestionar"
              commissionId={currentComm.id}
              compact
              customText="No perteneces ni coordinas esta comisión para crear tareas."
            />
          )}

          <DataToolbar
            search={taskSearch}
            onSearchChange={(val) => {
              setTaskSearch(val);
              setTaskPage(1);
            }}
            searchPlaceholder="Filtrar tareas o responsables..."
          >
            <select
              aria-label="Filtrar tareas por estado"
              value={taskStatusFilter}
              onChange={(e) => {
                setTaskStatusFilter(e.target.value as 'all' | TaskStatus);
                setTaskPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_curso">En curso</option>
              <option value="hecha">Hechas</option>
            </select>
          </DataToolbar>

          {pagedTasks.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No hay tareas registradas con este filtro.
            </p>
          ) : (
            <div className="space-y-2">
              {pagedTasks.map((task) => {
                const isEditingTask = editingTaskId === task.id;
                const canEditTask = canManageTasks || task.createdByUid === uid;
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                  >
                    {isEditingTask ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={editTaskTitle}
                          onChange={(e) => setEditTaskTitle(e.target.value)}
                          className="sm:col-span-5 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editTaskAssigned}
                          onChange={(e) => setEditTaskAssigned(e.target.value)}
                          placeholder="Responsable"
                          className="sm:col-span-3 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="date"
                          value={editTaskDue}
                          onChange={(e) => setEditTaskDue(e.target.value)}
                          className="sm:col-span-2 min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                        />
                        <div className="sm:col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEditTask(task)}
                            aria-label="Guardar tarea"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-emerald-700 p-1.5 text-white cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTaskId(null)}
                            aria-label="Cancelar edición"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 p-1.5 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
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
                              {task.assignedName || 'Sin asignar'}{' '}
                              {task.dueDate ? `· Límite ${task.dueDate}` : ''}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
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
                          {canEditTask && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditTask(task)}
                                title="Editar tarea"
                                aria-label={`Editar ${task.title}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTaskTarget(task)}
                                title="Eliminar tarea"
                                aria-label={`Eliminar ${task.title}`}
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

          <PaginationBar
            totalItems={filteredTasks.length}
            page={safeTaskPage}
            pageSize={taskPageSize}
            onPageChange={setTaskPage}
            onPageSizeChange={setTaskPageSize}
          />
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="cmj-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-700" /> Integrantes ({members.length})
            </h3>
            {canManageMembers && (
              <div className="flex gap-1.5">
                <select
                  aria-label="Vincular consejero a comisión"
                  value={memberCandidateUid}
                  onChange={(e) => setMemberCandidateUid(e.target.value)}
                  className="flex-1 min-w-0 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs"
                >
                  <option value="">Agregar consejero activo...</option>
                  {availableMemberCandidates.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.fullName} ({c.roleLabel})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!memberCandidateUid || updatingMember}
                  onClick={() => handleMemberChange('add', memberCandidateUid)}
                  className="min-h-[36px] shrink-0 rounded-xl bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {members.length === 0 ? (
              <p className="text-xs text-slate-500">Sin consejeros asignados aún.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {m.fullName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-500">{m.roleLabel}</span>
                      {canManageMembers && m.uid !== currentComm.coordinatorUid && (
                        <button
                          type="button"
                          disabled={updatingMember}
                          onClick={() => handleMemberChange('remove', m.uid)}
                          title="Retirar de la comisión"
                          aria-label={`Retirar a ${m.fullName}`}
                          className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="cmj-card p-5 space-y-3">
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
      <div className="cmj-card p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Evidencias y Galería de {currentComm.name}
          </h3>
          <p className="text-xs text-slate-500">
            Sube fotos (optimización automática WebP), videos MP4 o enlaza YouTube/Vimeo.
          </p>
        </div>

        {canUploadCommGallery ? (
          <>
            <input
              type="text"
              value={evidTitle}
              onChange={(e) => setEvidTitle(e.target.value)}
              placeholder="Título descriptivo para la siguiente evidencia (opcional)"
              aria-label="Título para la evidencia"
              className="w-full max-w-md min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />

            <MediaUploader
              storageFolder={`gallery/${currentComm.id}`}
              imagePreset="gallery"
              multiple
              allowExternalVideo
              label="Subir evidencias de la comisión"
              onUploaded={handleEvidenceUploaded}
            />
          </>
        ) : (
          <PermissionDeniedBanner
            permission="galeria.gestionar"
            commissionId={currentComm.id}
            compact
            customText="Solo Mesa Directiva o Coordinación de esta comisión pueden subir evidencias."
          />
        )}

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
                  {(canUploadCommGallery || g.authorUid === uid) && (
                    <button
                      type="button"
                      onClick={() => setDeleteGalleryTarget(g)}
                      title="Eliminar de galería y Storage"
                      aria-label={`Eliminar evidencia ${g.title}`}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
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

      <ConfirmDialog
        open={Boolean(deleteTaskTarget)}
        title="Eliminar tarea de comisión"
        description={
          deleteTaskTarget
            ? `¿Deseas eliminar la tarea "${deleteTaskTarget.title}" de ${currentComm.name}?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDeleteTask}
        onCancel={() => setDeleteTaskTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteGalleryTarget)}
        title="Eliminar evidencia multimedia"
        description={
          deleteGalleryTarget
            ? `¿Seguro deseas eliminar "${deleteGalleryTarget.title}" de la galería institucional?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDeleteGalleryItem}
        onCancel={() => setDeleteGalleryTarget(null)}
      />

      <MediaPreviewModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
