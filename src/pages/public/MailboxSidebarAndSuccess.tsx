import { CheckCircle2, FileSearch, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface MailboxSuccessCardProps {
  issuedCode: string;
  onLookupCode: (code: string) => void;
  onReset: () => void;
}

export function MailboxSuccessCard({
  issuedCode,
  onLookupCode,
  onReset,
}: MailboxSuccessCardProps) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-1 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-400"
          aria-hidden="true"
        />
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-950 dark:text-white">
            Radicación registrada con éxito
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-slate-300">
            Guarda este código único para consultar el estado y la respuesta oficial del Consejo
            Municipal de Juventud:
          </p>
          <p className="mt-4 inline-block rounded-lg border border-stone-300 bg-[#F7F4EE] px-4 py-2.5 font-mono-tabular text-lg font-semibold text-[#7B1832] dark:border-slate-700 dark:bg-slate-800 dark:text-[#D9B245]">
            {issuedCode}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => onLookupCode(issuedCode)}>
              Consultar este código
            </Button>
            <Button variant="primary" onClick={onReset}>
              Enviar otra solicitud
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MailboxSidebar() {
  return (
    <aside className="space-y-5 lg:col-span-4">
      <Card>
        <div className="flex items-start gap-3">
          <FileSearch
            className="mt-0.5 h-5 w-5 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
              Seguimiento con código único
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
              Cada solicitud recibe un radicado institucional con formato{' '}
              <span className="font-mono-tabular font-semibold text-stone-900 dark:text-slate-100">
                PJ-FLA-AAAA-XXXX
              </span>{' '}
              para consultar la respuesta oficial sin exponer datos personales.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Lock
            className="mt-0.5 h-5 w-5 shrink-0 text-[#1E3A8A] dark:text-[#60A5FA]"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
              Garantía de reserva y control
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
              Si eliges radicación anónima, no se almacenan nombres ni correos. Las propuestas
              urbanas y rurales de Flandes son revisadas en sesión de Mesa Directiva y comisiones.
            </p>
          </div>
        </div>
      </Card>
    </aside>
  );
}
