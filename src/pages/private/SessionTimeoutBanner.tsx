import { Button } from '../../components/ui/Button';

interface SessionTimeoutBannerProps {
  secondsRemaining: number;
  onExtendSession?: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function SessionTimeoutBanner({
  secondsRemaining,
  onExtendSession,
  onLogout,
}: SessionTimeoutBannerProps) {
  if (secondsRemaining <= 0) return null;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = String(secondsRemaining % 60).padStart(2, '0');

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <div>
        <p className="font-semibold">
          Tu sesión está por cerrarse automáticamente por inactividad (
          <span className="font-mono-tabular">
            {mins}:{secs}
          </span>
          )
        </p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-200/90">
          Por seguridad institucional, confirma si deseas continuar trabajando en el despacho.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {onExtendSession && (
          <Button size="sm" onClick={() => void onExtendSession()}>
            Mantener sesión activa
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void onLogout()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
