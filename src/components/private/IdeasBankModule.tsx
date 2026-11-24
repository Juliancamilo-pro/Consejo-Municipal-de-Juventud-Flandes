import React, { useState } from 'react';
import { Edit3, Lightbulb, Save, ThumbsUp, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type { AccessTier, Commission, IdeaItem, PublicCouncilor, RoleLabel } from '../../types/cmj';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function IdeasBankModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  ideas,
  publicCouncilors = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  ideas: IdeaItem[];
  publicCouncilors?: PublicCouncilor[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Participación');
  const [commissionId, setCommissionId] = useState('');

  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCommissionId, setEditCommissionId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    try {
      await apiRequest('/api/ideas', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          commissionId,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Propuso iniciativa en Buzón de Ideas',
        module: 'Buzón de Ideas',
        targetTitle: title.trim(),
      });
      setTitle('');
      setDescription('');
      showToast('Iniciativa publicada', 'success');
    } catch {
      showToast('No se pudo publicar la idea', 'error');
    }
  };

  const startEditIdea = (idea: IdeaItem) => {
    setEditingIdeaId(idea.id);
    setEditTitle(idea.title);
    setEditDescription(idea.description);
    setEditCategory(idea.category || 'Participación');
    setEditCommissionId(idea.commissionId || '');
  };

  const handleSaveEditIdea = async (idea: IdeaItem) => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory.trim() || 'Participación',
          commissionId: editCommissionId,
        },
      });
      setEditingIdeaId(null);
      showToast('Iniciativa actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la idea', 'error');
    }
  };

  const handleToggleVote = async (idea: IdeaItem) => {
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}/upvote`, {
        method: 'POST',
      });
    } catch {
      showToast('No se pudo registrar apoyo', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Banco Colaborativo de Ideas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de tu iniciativa"
            className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <select
            value={commissionId}
            onChange={(e) => setCommissionId(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="">General / Sin comisión</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoría (ej: Cultura, Empleo)"
            className="sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe brevemente el impacto esperado en Flandes..."
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shrink-0"
          >
            Publicar idea
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ideas.length === 0 ? (
          <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
            Aún no hay ideas propuestas. ¡Publica la primera iniciativa juvenil!
          </div>
        ) : (
          ideas.map((idea) => {
            const upvoted = idea.upvoterUids.includes(uid);
            const canEdit = isLeader || idea.authorUid === uid;
            const commName =
              commissions.find((c) => c.id === idea.commissionId)?.name || 'General';
            const author = publicCouncilors.find((c) => c.uid === idea.authorUid);

            return (
              <div
                key={idea.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                {editingIdeaId === idea.id ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Categoría"
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                      <select
                        value={editCommissionId}
                        onChange={(e) => setEditCommissionId(e.target.value)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">General / Sin comisión</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingIdeaId(null)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditIdea(idea)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-cyan-400">
                          {idea.category} · {commName} · {idea.status.replace('_', ' ')}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                          {idea.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleVote(idea)}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          upvoted
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {idea.upvoterUids.length}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{idea.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <AvatarBadge
                          name={author?.fullName || idea.authorName}
                          photoUrl={author?.photoUrl}
                          thumbUrl={author?.photoThumbUrl}
                          size="xs"
                        />
                        <span className="truncate">Por {idea.authorName}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {isLeader && (
                          <select
                            value={idea.status}
                            onChange={(e) =>
                              apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
                                method: 'PATCH',
                                body: { status: e.target.value },
                              }).catch(() => showToast('No se pudo actualizar el estado', 'error'))
                            }
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]"
                          >
                            <option value="nueva">Nueva</option>
                            <option value="en_revision">En revisión</option>
                            <option value="aprobada">Aprobada</option>
                          </select>
                        )}
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditIdea(idea)}
                              title="Editar idea"
                              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
                                  method: 'DELETE',
                                }).catch(() => showToast('No se pudo eliminar', 'error'))
                              }
                              className="text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export default IdeasBankModule;
