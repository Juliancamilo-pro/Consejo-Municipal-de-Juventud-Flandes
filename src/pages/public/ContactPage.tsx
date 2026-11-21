import { ArrowRight, Clock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';

interface ContactPageProps {
  portal: PublicPortalState;
  siteContent: SiteAppearanceConfig;
  onNavigate: (path: AppRoute) => void;
}

export function ContactPage({ portal, siteContent, onNavigate }: ContactPageProps) {
  const info = portal.councilInfo;

  return (
    <div>
      <PageHeader
        eyebrow="Flandes, Tolima · Atención Ciudadana y PQRSD"
        title="Contacto y PQRSD"
        description={siteContent.contactIntro}
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate('/') },
          { label: 'Contacto y PQRSD' },
        ]}
        primaryAction={{ label: 'Radicar solicitud ahora', onClick: () => onNavigate('/participacion') }}
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Card className="group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-[#7B1832]" />
              <MapPin className="h-5 w-5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold text-stone-950 dark:text-white">Sede institucional</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                {info?.address || 'Aún no se ha publicado la dirección física desde el panel.'}
              </p>
              <p className="mt-3 text-xs text-stone-400 dark:text-slate-500">Flandes · Departamento del Tolima</p>
            </Card>

            <Card className="group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-[#1E3A8A]" />
              <Mail className="h-5 w-5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold text-stone-950 dark:text-white">Correo oficial</h2>
              <p className="mt-2 break-all text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                {info?.emailPublic || 'Aún no se ha publicado el correo ciudadano desde el panel.'}
              </p>
              <p className="mt-3 text-xs text-stone-400 dark:text-slate-500">Canal electrónico verificado</p>
            </Card>

            <Card className="group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-[#C59B27]" />
              <Clock className="h-5 w-5 text-[#C59B27]" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold text-stone-950 dark:text-white">Horario de atención</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                {info?.schedule || 'Aún no se ha publicado el horario presencial desde el panel.'}
              </p>
              <p className="mt-3 text-xs text-stone-400 dark:text-slate-500">Atención a juventudes y veedurías</p>
            </Card>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="relative overflow-hidden lg:col-span-8">
              <div className="cmj-tricolor-rule absolute inset-x-0 top-0 h-[3px]" />
              <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                Ventanilla Única Digital
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-stone-950 dark:text-white">
                Radicación electrónica de PQRSD
              </h2>
              <p className="cmj-prose mt-2 text-sm text-stone-600 dark:text-slate-300">
                Para garantizar trazabilidad, recepción segura y asignación automática de código único (formato{' '}
                <span className="font-mono-tabular font-medium">PJ-FLA-AAAA-XXXX</span>), todas las PQRSD ciudadanas se
                radican a través del Buzón de Participación.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => onNavigate('/participacion')}>
                  <span>Ir a radicar PQRSD</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="outline" onClick={() => onNavigate('/consejo')}>
                  <span>Ver Mesa Directiva</span>
                </Button>
              </div>
            </Card>

            <Card variant="subtle" className="lg:col-span-4">
              <ShieldCheck className="h-5 w-5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-semibold text-stone-950 dark:text-white">
                Seguimiento ciudadano
              </h3>
              <p className="cmj-prose mt-2 text-sm text-stone-600 dark:text-slate-300">
                El sistema permite consultar el estado de respuesta de tu solicitud usando únicamente el código de radicado
                asignado, sin exponer datos personales.
              </p>
            </Card>
          </div>
        </FadeInSection>
      </section>
    </div>
  );
}
