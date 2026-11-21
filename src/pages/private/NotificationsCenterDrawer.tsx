import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Send } from 'lucide-react';
import {
  createInternalNotification,
  fetchInternalNotifications,
  markNotificationAsRead,
} from '../../services/notificationsService';
import { UserProfile } from '../../types/models';
import { InternalNotification } from '../../types/participation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { PrivateSection } from './PortalSidebar';

interface NotificationsCenterDrawerProps {
  open: boolean;
  actor: UserProfile;
  isBoard: boolean;
  pendingUsersCount: number;
  mailboxOpenCount: number;
  onClose: () => void;
  onNavigateSection: (section: PrivateSection) => void;
  onUnreadCountChange?: (unread: number) => void;
}

const CATEGORY_LABELS: Record<InternalNotification['category'], string> = {
  aviso: 'Aviso',
  convocatoria_sesion: 'Convocatoria',
  alerta: 'Urgente',
};

export function NotificationsCenterDrawer({
  open,
  actor,
  isBoard,
  pendingUsersCount,
  mailboxOpenCount,
  onClose,
  onNavigateSection,
  onUnreadCountChange,
}: NotificationsCenterDrawerProps) {
  const { showToast } = useToast();
  const [items, setItems] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<InternalNotification['category']>('aviso');
  const [sending, setSending] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchInternalNotifications();
      setItems(list);
      const unread = list.filter((n) => !n.readByUids?.includes(actor.uid)).length;
      onUnreadCountChange?.(unread);
    } catch {
      // Silencio seguro si aún no hay colección o permisos pendientes
    } finally {
      setLoading(false);
    }
  }, [actor.uid, onUnreadCountChange]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, open]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id, actor.uid);
      setItems((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, readByUids: [...(n.readByUids || []), actor.uid] } : n,
        );
        const unread = next.filter((n) => !n.readByUids?.includes(actor.uid)).length;
        onUnreadCountChange?.(unread);
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo marcar como leído.', 'error');
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      await createInternalNotification(actor, { title, body, category });
      setTitle('');
      setBody('');
      showToast('Aviso interno emitido a todo el Consejo.', 'success');
      await loadNotifications();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el aviso.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Drawer
      open={open}
      title="Centro de alertas internas"
      subtitle="Avisos de Mesa Directiva, pendientes de aprobación y buzón ciudadano"
      onClose={onClose}
    >
      <div className="space-y-5 text-xs">
        <div className="space-y-2.5">
          {isBoard && pendingUsersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onNavigateSection('usuarios');
                onClose();
              }}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left text-amber-950 transition-colors hover:bg-amber-100/70 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <p className="font-semibold">
                {pendingUsersCount} cuenta(s) pendiente(s) de aprobación
              </p>
              <p className="mt-0.5 opacity-80">Revisar en Usuarios y Mesa →</p>
            </button>
          )}

          {mailboxOpenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onNavigateSection('agenda');
                onClose();
              }}
              className="w-full rounded-xl border border-stone-200 bg-white p-3.5 text-left text-stone-900 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <p className="font-semibold">
                {mailboxOpenCount} radicado(s) ciudadano(s) sin archivar
              </p>
              <p className="mt-0.5 text-stone-500 dark:text-slate-400">
                Gestionar en Agenda y Buzón →
              </p>
            </button>
          )}
        </div>

        {isBoard && (
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-3.5 dark:border-slate-800 dark:bg-slate-950/50"
          >
            <p className="font-semibold text-stone-900 dark:text-white">
              Emitir aviso interno al Consejo
            </p>
            <Input
              label="Asunto"
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Recordatorio de entrega de actas"
            />
            <Select
              label="Tipo de aviso"
              value={category}
              onChange={(e) => setCategory(e.target.value as InternalNotification['category'])}
            >
              <option value="aviso">Aviso general</option>
              <option value="convocatoria_sesion">Convocatoria a sesión</option>
              <option value="alerta">Alerta urgente</option>
            </Select>
            <Textarea
              label="Mensaje"
              required
              rows={2}
              maxLength={600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button type="submit" size="sm" loading={sending} className="w-full">
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Publicar aviso interno</span>
            </Button>
          </form>
        )}

        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
            Historial de avisos ({items.length})
          </p>

          {loading ? (
            <p className="py-4 text-center text-stone-500 dark:text-slate-400">Cargando avisos...</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-5 text-center text-stone-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <Bell className="mx-auto mb-2 h-5 w-5 opacity-50" aria-hidden="true" />
              No hay avisos internos registrados aún.
            </div>
          ) : (
            items.map((item) => {
              const isRead = item.readByUids?.includes(actor.uid);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 ${
                    isRead
                      ? 'border-stone-200 bg-white/70 opacity-85 dark:border-slate-800 dark:bg-slate-900/50'
                      : 'border-[#7B1832]/30 bg-white shadow-xs dark:border-[#D9B245]/30 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        tone={
                          item.category === 'alerta'
                            ? 'danger'
                            : item.category === 'convocatoria_sesion'
                              ? 'brand'
                              : 'neutral'
                        }
                      >
                        {CATEGORY_LABELS[item.category]}
                      </Badge>
                      {!isRead && <Badge tone="warning">Nuevo</Badge>}
                    </div>
                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(item.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                      >
                        <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Marcar leído</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-2 font-semibold text-stone-950 dark:text-white">{item.title}</p>
                  <p className="mt-1 whitespace-pre-line text-stone-600 dark:text-slate-300">
                    {item.body}
                  </p>
                  <p className="mt-2 text-[11px] text-stone-400 dark:text-slate-500">
                    Emitido por {item.createdByName}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
}
