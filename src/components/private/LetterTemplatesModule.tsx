import React, { useMemo, useState } from 'react';
import { Edit3, FileText, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type { AccessTier, LetterTemplate } from '../../types/cmj';
import { useToast } from '../ToastProvider';

export function LetterTemplatesModule({
  actorName,
  accessTier,
  templates,
}: {
  uid?: string;
  actorName: string;
  accessTier: AccessTier;
  templates: LetterTemplate[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const selected = templates.find((t) => t.id === selectedId) || templates[0] || null;

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

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newBody.trim().length < 10) return;
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
    } catch {
      showToast('No se pudo guardar la plantilla', 'error');
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
    } catch {
      showToast('No se pudo actualizar la plantilla', 'error');
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
      {isLeader && (
        <form
          onSubmit={handleCreateTemplate}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3 no-print"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" /> Plantillas de Oficios y Cartas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoría"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
          </div>
          <textarea
            rows={4}
            required
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Guardar nueva plantilla
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3 no-print">
          <h3 className="text-sm font-bold">Plantillas disponibles ({templates.length})</h3>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-2xl border p-3.5 cursor-pointer flex items-center justify-between gap-2 ${
                selected?.id === t.id
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{t.title}</p>
                <p className="text-[11px] text-slate-500">{t.category}</p>
              </div>
              {isLeader && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(t.id);
                      startEditTemplate(t);
                    }}
                    title="Editar plantilla"
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 p-1 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      apiRequest(`/api/templates/${encodeURIComponent(t.id)}`, {
                        method: 'DELETE',
                      }).catch(() => showToast('No se pudo eliminar', 'error'));
                    }}
                    className="text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-4">
          {isLeader && editingTplId && (
            <form
              onSubmit={handleSaveEditTemplate}
              className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-900 p-5 space-y-3 no-print"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Editando plantilla oficial
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTplId(null)}
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
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="Categoría"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editHeaderText}
                  onChange={(e) => setEditHeaderText(e.target.value)}
                  placeholder="Encabezado institucional"
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={editSignatoryRole}
                  onChange={(e) => setEditSignatoryRole(e.target.value)}
                  placeholder="Cargo firmante"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Asunto"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Cuerpo o detalle de la solicitud"
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-blue-700">
                      {selected.headerText || 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
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
    </div>
  );
}
export default LetterTemplatesModule;
