import { FormEvent, useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import {
  addCommitmentComment,
  updateCommitmentDetails,
} from '../../services/electionsCommitmentsMailboxService';
import { CommitmentItem, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface CommitmentDetailsModalProps {
  commitment: CommitmentItem | null;
  actor: UserProfile;
  isLeaderOrBoard: boolean;
  activeUsers: UserProfile[];
  onClose: () => void;
  onReload: () => Promise<void>;
}

export function CommitmentDetailsModal({
  commitment,
  actor,
  isLeaderOrBoard,
  activeUsers,
  onClose,
  onReload,
}: CommitmentDetailsModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUid, setAssigneeUid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [status, setStatus] = useState<CommitmentItem['status']>('pendiente');
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!commitment) return;
    setTitle(commitment.title);
    setDescription(commitment.description);
    setAssigneeUid(commitment.assigneeUid);
    setDueDate(commitment.dueDate);
    setProgressPercent(commitment.progressPercent);
    setStatus(commitment.status);
  }, [commitment]);

  if (!commitment) {
    return (
      <Modal open={false} onClose={onClose} title="Detalle del compromiso">
        {null}
      </Modal>
    );
  }

  const canEdit = isLeaderOrBoard || commitment.assigneeUid === actor.uid;
  const comments = commitment.comments || [];

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const assignee = activeUsers.find((u) => u.uid === assigneeUid);
      if (isLeaderOrBoard) {
        await updateCommitmentDetails(commitment.id, {
          title: title.trim(),
          description: description.trim(),
          assigneeUid: assignee?.uid || commitment.assigneeUid,
          assigneeName: assignee?.displayName || commitment.assigneeName,
          dueDate,
          progressPercent: Number(progressPercent),
          status,
        });
      } else {
        await updateCommitmentDetails(commitment.id, {
          progressPercent: Number(progressPercent),
          status,
        });
      }
      showToast('Compromiso actualizado correctamente.', 'success');
      onClose();
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    try {
      await addCommitmentComment(actor, commitment.id, comments, commentText);
      setCommentText('');
      showToast('Nota añadida al compromiso.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(commitment)} onClose={onClose} title={commitment.title} maxWidth="lg">
      <div className="space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          {isLeaderOrBoard && (
            <>
              <Input label="Título" required minLength={3} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Responsable" value={assigneeUid} onChange={(e) => setAssigneeUid(e.target.value)}>
                  {activeUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>{u.displayName}</option>
                  ))}
                </Select>
                <Input label="Fecha límite" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Textarea label="Descripción" required rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </>
          )}

          {!isLeaderOrBoard && (
            <p className="text-sm text-stone-600 dark:text-slate-300">{commitment.description}</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Avance (%)"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
            />
            <Select
              label="Estado"
              disabled={!canEdit}
              value={status}
              onChange={(e) => setStatus(e.target.value as CommitmentItem['status'])}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
              <option value="cumplido">Cumplido</option>
              <option value="vencido">Vencido</option>
            </Select>
          </div>

          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
              <Button type="submit" loading={saving}>Guardar cambios</Button>
            </div>
          )}
        </form>

        <div className="border-t border-stone-200 pt-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-slate-300">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Comentarios de seguimiento ({comments.length})</span>
          </h3>

          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">Sin notas de seguimiento todavía.</p>
            ) : (
              comments.map((cm) => (
                <div key={cm.id} className="rounded-lg border border-stone-200 bg-[#FAF8F4] p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex justify-between gap-2 text-[11px] text-stone-500">
                    <span className="font-semibold text-stone-800 dark:text-slate-200">{cm.authorName}</span>
                    <span className="font-mono-tabular">{cm.createdAtIso.slice(0, 10)}</span>
                  </div>
                  <p className="mt-1 text-stone-700 dark:text-slate-300">{cm.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              maxLength={800}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe una novedad o avance..."
              aria-label="Nuevo comentario sobre compromiso"
              className="min-h-[38px] flex-1 rounded-lg border border-stone-300 bg-white px-3 text-xs text-stone-900 focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Button type="button" size="sm" disabled={saving || !commentText.trim()} onClick={() => void handleAddComment()}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Enviar</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
