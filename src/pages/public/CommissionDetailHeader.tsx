import { ArrowLeft } from 'lucide-react';
import { Commission } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { getCommissionAccent, getCommissionIcon, getCommissionSlug } from '../../utils/commissionUtils';
import { Button } from '../../components/ui/Button';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface CommissionDetailHeaderProps {
  commission: Commission;
  onNavigate: (path: AppRoute) => void;
}

export function CommissionDetailHeader({ commission, onNavigate }: CommissionDetailHeaderProps) {
  const accent = getCommissionAccent(commission.accentColor);
  const Icon = getCommissionIcon(commission.iconName);
  const commissionSlug = getCommissionSlug(commission);

  return (
    <section className="border-b border-stone-200 bg-[#F7F4EE] dark:border-slate-800 dark:bg-slate-900/50">
      <div
        className="relative h-44 w-full sm:h-56"
        style={
          commission.coverImageUrl
            ? undefined
            : { background: `linear-gradient(125deg, ${accent}, #0F172A)` }
        }
      >
        {commission.coverImageUrl && (
          <img
            src={commission.coverImageUrl}
            alt={commission.name}
            loading="eager"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/30 to-transparent" />
        <div className="mx-auto flex h-full max-w-6xl items-start justify-between px-4 pt-5 sm:px-6 lg:px-8">
          <Button size="sm" variant="outline" onClick={() => onNavigate('/comisiones')}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Comisiones</span>
          </Button>
          <span className="rounded-md bg-stone-950/65 px-2.5 py-1 text-xs text-white/90">
            Inicio / Comisiones / {commission.name}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
              style={{ backgroundColor: accent }}
            >
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                Comisión de trabajo · CMJ Flandes
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-stone-950 dark:text-white">
                {commission.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                {commission.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <WhatsAppShareButton
              text={`Conoce la ${commission.name} del CMJ Flandes (2026–2029):`}
            />
            <Button
              onClick={() =>
                onNavigate(`/participacion?tab=convocatorias&comision=${commissionSlug}`)
              }
            >
              <span>Quiero participar</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
