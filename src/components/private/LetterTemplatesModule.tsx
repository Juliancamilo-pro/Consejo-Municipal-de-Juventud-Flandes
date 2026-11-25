import React, { useMemo, useState } from 'react';
import { Edit3, FileText, Plus, Printer, Save, Search, Trash2, X } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import type { AccessTier, LetterTemplate } from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { ConfirmDialog } from '../ui/DataTableUI';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function LetterTemplatesModule({
  actorName,
  accessTier: _accessTier,
  templates,
}: {
  uid?: string;
  actorName: string;
  accessTier: AccessTier;
  templates: LetterTemplate[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canManageTemplates = can('plantillas.gestionar');
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const selected = templates.find((t) => t.id === selectedId) || templates[0] || null;
  const [tplSearch, setTplSearch] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Oficio');
  const [newBody, setNewBody] = useState(
    'Flandes, Tolima, {{fecha}}\n\nSeñor(a) {{destinatario}}\nAsunto: {{asunto}}\n\nCordial saludo.\n\n{{contenido}}\n\nAtentamente,\n{{firmante}}'
  );

  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editHeaderText, setEditHeaderText] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSignatoryRole, setEditSignatoryRole] = useState('');

  const [destinatario, setDestinatario] = useState('Secretaría de Gobierno / Alcaldía de Flandes');
  const [asunto, setAsunto] = useState('Gestión juvenil');
  const [contenido, setContenido] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<LetterTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
    );
  }, [templates, tplSearch]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newBody.trim().length < 10) {
      showToast('Ingresa un nombre y al menos 10 caracteres en el cuerpo', 'error');
      return;
    }
    try {
      const res = await apiRequest<{ id: string; ok: boolean }>('/api/templates', {
        method: 'POST',
        body: {
          title: newTitle.trim(),
          category: newCategory,
          headerText: 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES – TOLIMA',
          bodyTemplate: newBody.trim(),
          signatoryRole: 'Presidencia y Secretaría',
        },
      });
      setSelectedId(res.id);
      setNewTitle('');
      showToast('Plantilla guardada', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo guardar la plantilla';
      showToast(msg, 'error');
    }
  };

  const startEditTemplate = (tpl: LetterTemplate) => {
    setEditingTplId(tpl.id);
    setEditTitle(tpl.title);
    setEditCategory(tpl.category || 'Oficio');
    setEditHeaderText(tpl.headerText || 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES – TOLIMA');
    setEditBody(tpl.bodyTemplate);
    setEditSignatoryRole(tpl.signatoryRole || 'Secretario');
  };

  const handleSaveEditTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTplId || !editTitle.trim() || !editBody.trim()) return;
    try {
      await apiRequest(`/api/templates/${encodeURIComponent(editingTplId)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          category: editCategory.trim() || 'Oficio',
          headerText: editHeaderText.trim(),
          bodyTemplate: editBody,
          signatoryRole: editSignatoryRole.trim() || 'Secretario',
        },
      });
      setEditingTplId(null);
      showToast('Plantilla actualizada', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la plantilla';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/templates/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      showToast('Plantilla eliminada', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const renderedLetter = useMemo(() => {
    if (!selected) return '';
    return selected.bodyTemplate
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-CO'))
      .replace(/\{\{destinatario\}\}/g, destinatario)
      .replace(/\{\{asunto\}\}/g, asunto)
      .replace(/\{\{contenido\}\}/g, contenido || '...')
      .replace(/\{\{firmante\}\}/g, actorName);
  }, [selected, destinatario, asunto, contenido, actorName]);

  return (
    <div className="space-y-6">
      {canManageTemplates ? (
        <form onSubmit={handleCreateTemplate} className="cmj-card p-6 space-y-3 no-print">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-400" /> Plantillas de Oficios y Cartas
          </h2>
          <p className="text-xs text-slate-500">
            Variables disponibles: {'{{fecha}}'}, {'{{destinatario}}'}, {'{{asunto}}'}, {'{{contenido}}'}, {'{{firmante}}'}.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nombre de la plantilla"
              aria-label="Nombre de la plantilla"
              className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoría"
              aria-label="Categoría"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
          </div>
          <textarea
            rows={4}
            required
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            aria-label="Cuerpo de la plantilla"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono"
          />
          <button
            type="submit"
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Guardar nueva plantilla
          </button>
        </form>
      ) : (
        <div className="no-print">
          <PermissionDeniedBanner
            permission="plantillas.gestionar"
            customText="Puedes usar e imprimir las plantillas oficiales. Para crear o editar plantillas necesitas permiso especial."
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3 no-print">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Plantillas ({filteredTemplates.length})
            </h3>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={tplSearch}
              onChange={(e) => setTplSearch(e.target.value)}
              placeholder="Filtrar plantillas..."
              aria-label="Filtrar plantillas"
              className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(t.id);
                }
              }}
              className={`rounded-2xl border p-3.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                selected?.id === t.id
                  ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{t.title}</p>
                <p className="text-[11px] text-slate-500">{t.category}</p>
              </div>
              {canManageTemplates && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(t.id);
                      startEditTemplate(t);
                    }}
                    title="Editar plantilla"
                    aria-label={`Editar ${t.title}`}
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 p-1.5 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(t);
                    }}
                    title="Eliminar plantilla"
                    aria-label={`Eliminar ${t.title}`}
                    className="text-rose-500 p-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-4">
          {canManageTemplates && editingTplId && (
            <form
              onSubmit={handleSaveEditTemplate}
              className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-slate-900 p-5 space-y-3 no-print"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Editando plantilla oficial
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTplId(null)}
                  aria-label="Cerrar edición"
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título"
                  className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Categoría"
                  className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editHeaderText}
                  onChange={(e) => setEditHeaderText(e.target.value)}
                  placeholder="Encabezado institucional"
                  className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editSignatoryRole}
                  onChange={(e) => setEditSignatoryRole(e.target.value)}
                  placeholder="Cargo firmante"
                  className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
              </div>
              <textarea
                rows={5}
                required
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTplId(null)}
                  className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar plantilla
                </button>
              </div>
            </form>
          )}

          {selected ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
                <input
                  type="text"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="Destinatario"
                  aria-label="Destinatario"
                  className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Asunto"
                  aria-label="Asunto"
                  className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Cuerpo o detalle de la solicitud"
                  aria-label="Contenido de la solicitud"
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-6 sm:p-8 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300 pb-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-emerald-700">
                      {selected.headerText || 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {renderedLetter}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              Crea una plantilla arriba para redactar e imprimir oficios oficiales.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar plantilla de oficio"
        description={
          deleteTarget
            ? `¿Seguro deseas eliminar la plantilla "${deleteTarget.title}"?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
export default LetterTemplatesModule;
