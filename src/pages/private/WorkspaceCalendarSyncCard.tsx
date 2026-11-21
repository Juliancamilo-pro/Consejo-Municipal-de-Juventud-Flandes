import { CalendarEventItem } from '../../types/models';
import { GoogleCalendarEventSummary } from '../../services/workspaceApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';

export type PendingCalendarAction =
  | {
      kind: 'create';
      summary: string;
      description: string;
      location: string;
      startIso: string;
      endIso: string;
    }
  | { kind: 'delete'; event: GoogleCalendarEventSummary }
  | null;

interface WorkspaceCalendarSyncProps {
  accessToken: string | null;
  cmjEvents: CalendarEventItem[];
  onPushEvent: (ev: CalendarEventItem) => void;
  pendingAction: PendingCalendarAction;
  executing: boolean;
  onCloseModal: () => void;
  onConfirmModal: () => Promise<void>;
}

export function WorkspaceCalendarSyncAndModal({
  accessToken,
  cmjEvents,
  onPushEvent,
  pendingAction,
  executing,
  onCloseModal,
  onConfirmModal,
}: WorkspaceCalendarSyncProps) {
  return (
    <>
      {cmjEvents.length > 0 && (
        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Sincronizar agenda del CMJ hacia Google Calendar
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cmjEvents.slice(0, 6).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-3 text-xs dark:border-slate-800"
              >
                <div>
                  <p className="font-semibold text-stone-900 dark:text-slate-100">{ev.title}</p>
                  <p className="text-stone-500 dark:text-slate-400">
                    {new Date(ev.startIso).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!accessToken}
                  onClick={() => onPushEvent(ev)}
                >
                  Enviar a Google
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(pendingAction)}
        onClose={onCloseModal}
        title="Confirmar cambio en Google Calendar"
        maxWidth="md"
      >
        {pendingAction && (
          <div className="space-y-4 text-sm text-stone-700 dark:text-slate-300">
            {pendingAction.kind === 'create' ? (
              <p>
                ¿Confirmas agregar el evento <strong>“{pendingAction.summary}”</strong> a tu Google
                Calendar ({pendingAction.location || 'Flandes, Tolima'})?
              </p>
            ) : (
              <p>
                ¿Confirmas eliminar permanentemente el evento{' '}
                <strong>“{pendingAction.event.summary}”</strong> de tu Google Calendar?
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onCloseModal}>
                Cancelar
              </Button>
              <Button
                variant={pendingAction.kind === 'delete' ? 'danger' : 'primary'}
                loading={executing}
                onClick={() => void onConfirmModal()}
              >
                Confirmar y continuar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
