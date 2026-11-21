import { Clock, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface AuthAccountStatusViewProps {
  profile: UserProfile;
  onLogout: () => Promise<void>;
}

export function AuthAccountStatusView({ profile, onLogout }: AuthAccountStatusViewProps) {
  if (profile.status === 'pendiente') {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-stone-950 dark:text-white">
            Cuenta en revisión
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
            Hola <strong>{profile.displayName}</strong>. Tu registro como consejero quedó radicado
            correctamente y se encuentra pendiente de aprobación por el Presidente, Vicepresidente o
            Secretario Administrador.
          </p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => void onLogout()}>
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-stone-950 dark:text-white">
          Cuenta suspendida
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-slate-300">
          Tu acceso al portal privado fue suspendido. Comunícate con la Mesa Directiva del CMJ
          Flandes.
        </p>
        <div className="mt-6">
          <Button variant="outline" onClick={() => void onLogout()}>
            Salir
          </Button>
        </div>
      </Card>
    </section>
  );
}
