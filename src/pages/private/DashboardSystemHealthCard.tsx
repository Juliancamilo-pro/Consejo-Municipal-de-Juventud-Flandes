import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toFriendlySpanishError } from '../../utils/friendlyErrors';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SkeletonBlock } from '../../components/ui/MotionPrimitives';

interface HealthPayload {
  status: 'ok' | 'degraded';
  firebaseAdminConfigured: boolean;
  adminEmailConfigured?: boolean;
  invitationCodeConfigured?: boolean;
  sessionSecretValid?: boolean;
  rescueTokenConfigured?: boolean;
  rescueTokenStatus?: string;
  firebaseAdminMessage?: string;
  missingEnvironmentVariables: string[];
}

const ENV_GUIDANCE: Record<string, { label: string; guide: string }> = {
  ADMIN_EMAIL: {
    label: 'Correo institucional del administrador (ADMIN_EMAIL)',
    guide: 'Define en Vercel el correo oficial del Secretario Administrador para activar y validar el acceso principal.',
  },
  CMJ_INVITATION_CODE: {
    label: 'Código de invitación inicial (CMJ_INVITATION_CODE)',
    guide: 'Configura la clave compartida con los consejeros para permitir el registro por invitación.',
  },
  SESSION_SECRET: {
    label: 'Llave de firma de sesiones (SESSION_SECRET)',
    guide: 'Debe tener al menos 32 caracteres aleatorios en el servidor para firmar cookies y tokens de forma segura.',
  },
  FIREBASE_SERVICE_ACCOUNT: {
    label: 'Cuenta de servicio Firebase Admin (FIREBASE_SERVICE_ACCOUNT)',
    guide: 'Permite URLs firmadas de documentos internos, numeración consecutiva atómica y escritura segura del servidor.',
  },
};

export function DashboardSystemHealthCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('No se pudo consultar el diagnóstico del servidor.');
      }
      const data = (await res.json()) as HealthPayload;
      setHealth(data);
    } catch (err) {
      setError(
        toFriendlySpanishError(
          err,
          'No pudimos verificar el estado del sistema en este momento. Intenta de nuevo.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const missingSet = new Set(health?.missingEnvironmentVariables || []);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7B1832]/10 text-[#7B1832] dark:bg-[#D9B245]/15 dark:text-[#D9B245]">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                Estado del sistema
              </h2>
              {health && !loading && (
                <Badge tone={health.status === 'ok' ? 'success' : 'warning'}>
                  {health.status === 'ok' ? 'Operativo' : 'Requiere configuración'}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-slate-400">
              Verificación privada de variables del servidor y servicios institucionales (solo Secretaría General).
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadHealth()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Reintentar</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SkeletonBlock className="h-14 w-full rounded-lg" />
          <SkeletonBlock className="h-14 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadHealth()}>
            Reintentar
          </Button>
        </div>
      ) : health ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Object.entries(ENV_GUIDANCE).map(([key, meta]) => {
            const missing = missingSet.has(key);
            return (
              <div
                key={key}
                className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                  missing
                    ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/30'
                    : 'border-stone-200 bg-[#FAF8F4] dark:border-slate-800 dark:bg-slate-900/60'
                }`}
              >
                {missing ? (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 dark:text-white">
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600 dark:text-slate-400">
                    {missing
                      ? meta.guide
                      : 'Configurada y lista en el servidor actual.'}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-[#FAF8F4] p-3 sm:col-span-2 dark:border-slate-800 dark:bg-slate-900/60">
            <CheckCircle2
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                health.rescueTokenConfigured
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-slate-400'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-900 dark:text-white">
                Rescate administrativo sin código ({health.rescueTokenStatus || 'opcional (rescate)'})
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600 dark:text-slate-400">
                {health.rescueTokenConfigured
                  ? 'Clave de rescate temporal activa en este servidor. Una vez recuperes la cuenta administradora, bórrala de Vercel y vuelve a desplegar.'
                  : 'Opcional y desactivada por defecto. Solo se configura temporalmente en Vercel si la cuenta administradora queda bloqueada por una verificación antigua.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
