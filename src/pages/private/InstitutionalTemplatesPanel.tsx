import { useMemo, useState } from 'react';
import { Copy, Download, FileText, Hash } from 'lucide-react';
import { reserveConsecutiveDocumentNumber } from '../../services/documentsService';
import { ROLE_LABELS, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface TemplateDef {
  id: string;
  title: string;
  subtitle: string;
  body: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: 'oficio',
    title: 'Oficio interinstitucional',
    subtitle: 'Comunicación formal hacia Alcaldía de Flandes, Personería o entidades territoriales',
    body: `Oficio N.º {{consecutivo}}
{{municipio}}, {{fecha}}

Señores:
{{destinatario}}
E. S. D.

Asunto: {{asunto}}

Cordial saludo:

En ejercicio de las funciones de interlocución, concertación y veeduría conferidas por la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018 al Consejo Municipal de Juventud (CMJ) de {{municipio}} (periodo 2026–2029), nos permitimos manifestar respetuosamente:

{{cuerpo}}

Agradecemos su pronta respuesta en los términos legales vigentes al correo institucional del Consejo.

Atentamente,

{{nombre}}
{{cargo}} · CMJ {{municipio}}`,
  },
  {
    id: 'convocatoria',
    title: 'Convocatoria a sesión plenaria',
    subtitle: 'Citación formal con orden del día reglamentario',
    body: `CONSEJO MUNICIPAL DE JUVENTUD DE {{municipio}} (2026–2029)
CITACIÓN OFICIAL N.º {{consecutivo}} · {{fecha}}

Para: {{destinatario}}
Referencia: {{asunto}}

Orden del día propuesto:
1. Llamado a lista y verificación de quórum deliberatorio y decisorio.
2. Lectura y aprobación del orden del día y del acta anterior.
3. {{cuerpo}}
4. Proposiciones, compromisos y varios.

Convoca: {{nombre}} ({{cargo}})`,
  },
  {
    id: 'peticion',
    title: 'Derecho de Petición Juvenil (Art. 23 C.P.)',
    subtitle: 'Solicitud formal ante autoridad pública (Ley 1755 de 2015)',
    body: `{{municipio}}, {{fecha}} · Radicado interno {{consecutivo}}

Señores: {{destinatario}}
Ref.: DERECHO DE PETICIÓN DE INTERÉS GENERAL — {{asunto}}

Respetados señores:

En mi calidad de {{cargo}} del Consejo Municipal de Juventud de {{municipio}}, invocando el artículo 23 de la Constitución Política y la Ley 1755 de 2015, presento respetuosamente:

HECHOS Y PETICIÓN:
{{cuerpo}}

Solicitamos respuesta de fondo dentro del término legal vigente.

Cordialmente,
{{nombre}} · CMJ {{municipio}}`,
  },
  {
    id: 'acta_comision',
    title: 'Acta base de comisión permanente',
    subtitle: 'Formato limpio para trabajo en comisiones',
    body: `ACTA N.º {{consecutivo}} · COMISIÓN PERMANENTE CMJ {{municipio}}
Comisión: {{destinatario}}
Tema: {{asunto}} · Fecha: {{fecha}}

Resumen de deliberación, votación interna y compromisos:
{{cuerpo}}

Suscribe: {{nombre}} ({{cargo}})`,
  },
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function InstitutionalTemplatesPanel({ actor }: { actor: UserProfile }) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(TEMPLATES[0].id);
  const [destinatario, setDestinatario] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [consecutive, setConsecutive] = useState('SIN-RADICAR');
  const [reserving, setReserving] = useState(false);

  const active = TEMPLATES.find((t) => t.id === selectedId) || TEMPLATES[0];

  const renderedText = useMemo(() => {
    const vars: Record<string, string> = {
      '{{nombre}}': actor.displayName,
      '{{cargo}}': actor.positionTitle || ROLE_LABELS[actor.role],
      '{{fecha}}': new Date().toLocaleDateString('es-CO', { dateStyle: 'long' }),
      '{{consecutivo}}': consecutive,
      '{{municipio}}': 'Flandes, Tolima',
      '{{destinatario}}': destinatario.trim() || '[Destinatario o comisión]',
      '{{asunto}}': asunto.trim() || '[Asunto institucional]',
      '{{cuerpo}}': cuerpo.trim() || '[Contenido principal del oficio o documento]',
    };
    return Object.entries(vars).reduce((acc, [key, val]) => acc.split(key).join(val), active.body);
  }, [active.body, actor.displayName, actor.positionTitle, actor.role, consecutive, destinatario, asunto, cuerpo]);

  const handleReserveConsecutive = async () => {
    setReserving(true);
    try {
      const code = await reserveConsecutiveDocumentNumber('oficio', new Date().getFullYear());
      setConsecutive(code);
      showToast(`Consecutivo ${code} reservado.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo reservar consecutivo.', 'error');
    } finally {
      setReserving(false);
    }
  };

  const handleDownloadWord = () => {
    const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(active.title)}</title></head><body style="font-family:Calibri,Arial,sans-serif;white-space:pre-wrap;line-height:1.5;">${escapeHtml(renderedText)}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cmj-flandes-${active.id}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFillColor(123, 24, 50);
    doc.rect(0, 0, 210, 7, 'F');
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(renderedText, 180), 15, 20);
    doc.save(`cmj-flandes-${active.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setSelectedId(tpl.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              tpl.id === selectedId
                ? 'border-[#7B1832] bg-[#7B1832]/5 dark:border-[#D9B245] dark:bg-[#D9B245]/10'
                : 'border-stone-200 bg-white hover:bg-stone-50 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <FileText className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <p className="mt-2 font-display text-sm font-semibold text-stone-950 dark:text-white">{tpl.title}</p>
            <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">{tpl.subtitle}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Variables y consecutivo oficial
          </h2>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            Variables automáticas: {'{{nombre}}'}, {'{{cargo}}'}, {'{{fecha}}'}, {'{{consecutivo}}'}, {'{{municipio}}'}.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Consecutivo" value={consecutive} onChange={(e) => setConsecutive(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" loading={reserving} onClick={() => void handleReserveConsecutive()}>
                <Hash className="h-3.5 w-3.5" aria-hidden="true" /><span>Reservar</span>
              </Button>
            </div>
            <Input label="Destinatario / Comisión" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Ej. Secretaría de Desarrollo Social" />
            <Input label="Asunto o referencia" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Ej. Solicitud de espacio juvenil" />
            <Textarea label="Contenido principal" rows={6} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">Vista previa lista para usar</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(renderedText).then(() => showToast('Copiado al portapapeles.', 'success'))}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /><span>Copiar</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadWord}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>Word (.doc)</span>
              </Button>
              <Button size="sm" onClick={() => void handleDownloadPdf()}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>PDF</span>
              </Button>
            </div>
          </div>
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 font-sans text-xs leading-relaxed whitespace-pre-wrap text-stone-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {renderedText}
          </pre>
        </Card>
      </div>
    </div>
  );
}
