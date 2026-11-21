import { FormEvent, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import {
  generateSessionCheckinCode,
  selfCheckInWithSessionCode,
} from '../../services/sessionsAttendanceService';
import { AttendanceRecord, PlenarySession, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface SessionQrCheckinModalProps {
  session: PlenarySession | null;
  actor: UserProfile;
  isBoard: boolean;
  attendance: AttendanceRecord[];
  initialCode?: string;
  onClose: () => void;
  onReload: () => Promise<void>;
}

export function SessionQrCheckinModal({
  session,
  actor,
  isBoard,
  attendance,
  initialCode = '',
  onClose,
  onReload,
}: SessionQrCheckinModalProps) {
  const { showToast } = useToast();
  const [qrUrl, setQrUrl] = useState('');
  const [codeInput, setCodeInput] = useState(initialCode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode.toUpperCase());
    }
  }, [initialCode]);

  useEffect(() => {
    if (!session?.checkinCode) {
      setQrUrl('');
      return;
    }
    const checkUrl = `${window.location.origin}/portal?asistencia=${encodeURIComponent(
      session.id,
    )}&code=${encodeURIComponent(session.checkinCode)}`;
    void QRCode.toDataURL(checkUrl, { width: 220, margin: 1 }).then(setQrUrl);
  }, [session?.id, session?.checkinCode]);

  if (!session) return null;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await generateSessionCheckinCode(actor, session.id);
      showToast('Código QR de asistencia activado.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo generar el código.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSelfCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await selfCheckInWithSessionCode(actor, session, codeInput, attendance);
      showToast('Tu asistencia ha sido registrada como PRESENTE.', 'success');
      setCodeInput('');
      await onReload();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Código incorrecto.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(session)} onClose={onClose} title={`Asistencia QR · ${session.title}`}>
      <div className="space-y-5">
        {isBoard && (
          <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-stone-800 dark:text-slate-100">
                Control de Mesa Directiva
              </p>
              <Button size="sm" variant="outline" loading={busy} onClick={() => void handleGenerate()}>
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{session.checkinCode ? 'Rotar código QR' : 'Generar código QR'}</span>
              </Button>
            </div>
            {session.checkinCode && (
              <div className="mt-4 flex flex-col items-center gap-3 text-center">
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt={`Código QR de asistencia para ${session.title}`}
                    className="h-44 w-44 rounded-lg border border-stone-200 bg-white p-2"
                  />
                )}
                <div>
                  <p className="text-xs text-stone-500 dark:text-slate-400">Código activo de sesión:</p>
                  <p className="font-mono-tabular mt-0.5 text-2xl font-bold tracking-widest text-[#7B1832] dark:text-[#D9B245]">
                    {session.checkinCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSelfCheckIn} className="space-y-3">
          <Input
            label="Registrar mi propia asistencia con código"
            required
            maxLength={12}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Ingresa el código de 6 caracteres"
          />
          <Button type="submit" loading={busy} className="w-full">
            Confirmar mi asistencia (Presente)
          </Button>
        </form>
      </div>
    </Modal>
  );
}
