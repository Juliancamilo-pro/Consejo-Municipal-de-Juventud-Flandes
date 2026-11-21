import { FormEvent, useState } from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import {
  createDocumentWithVersion,
  reserveConsecutiveDocumentNumber,
} from '../../services/documentsService';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import { PlenarySession, UserProfile } from '../../types/models';
import { toFriendlySpanishError } from '../../utils/friendlyErrors';
import { computeFileSha256 } from '../../utils/fileValidation';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface DocumentActaTemplateModalProps {
  open: boolean;
  actor: UserProfile;
  sessions: PlenarySession[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

async function renderActaPdfDoc(input: {
  title: string;
  dateIso: string;
  location: string;
  quorumText: string;
  agenda: string;
  development: string;
  decisions: string;
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  doc.setFillColor(123, 24, 50);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFontSize(13);
  doc.text('CONSEJO MUNICIPAL DE JUVENTUD · FLANDES, TOLIMA (2026–2029)', 14, 18);
  doc.setFontSize(11);
  doc.text(input.title, 14, 26);
  doc.setFontSize(9);
  doc.text(`Fecha: ${input.dateIso} · Lugar: ${input.location} · Quórum: ${input.quorumText}`, 14, 32);

  let y = 42;
  const sections: [string, string][] = [
    ['1. Orden del día', input.agenda],
    ['2. Desarrollo e intervenciones', input.development],
    ['3. Decisiones y compromisos aprobados', input.decisions],
  ];
  for (const [heading, body] of sections) {
    doc.setFontSize(10.5);
    doc.text(heading, 14, y);
    y += 5.5;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(body || 'Sin anotaciones.', 182) as string[];
    doc.text(lines, 14, y);
    y += Math.max(10, lines.length * 4.6 + 6);
  }
  return doc;
}

export function DocumentActaTemplateModal({
  open,
  actor,
  sessions,
  onClose,
  onSaved,
}: DocumentActaTemplateModalProps) {
  const { showToast } = useToast();
  const [sessionId, setSessionId] = useState('');
  const [title, setTitle] = useState('Acta de Sesión Plenaria CMJ Flandes');
  const [dateIso, setDateIso] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('Recinto Concejo Municipal / Casa de la Juventud');
  const [quorumText, setQuorumText] = useState('Quórum deliberatorio y decisorio verificado');
  const [agenda, setAgenda] = useState('1. Llamado a lista y quórum\n2. Lectura y aprobación del orden del día\n3. Proposiciones y varios');
  const [development, setDevelopment] = useState('');
  const [decisions, setDecisions] = useState('');
  const [visibility, setVisibility] = useState<'publico' | 'interno'>('interno');
  const [busy, setBusy] = useState(false);

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    const found = sessions.find((s) => s.id === id);
    if (!found) return;
    setTitle(`Acta · ${found.title}`);
    setDateIso(found.dateIso.slice(0, 10) || dateIso);
    setLocation(found.location || location);
    setAgenda(found.agenda || agenda);
  };

  const payload = { title, dateIso, location, quorumText, agenda, development, decisions };

  const handleDownloadOnly = async () => {
    const pdf = await renderActaPdfDoc(payload);
    pdf.save(`acta-cmj-${dateIso}.pdf`);
  };

  const handleSaveToRepo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const pdf = await renderActaPdfDoc(payload);
      const blob = pdf.output('blob');
      const file = new File([blob], `acta-cmj-${dateIso}.pdf`, { type: 'application/pdf' });
      const contentSha256 = await computeFileSha256(file);
      const uploaded = await uploadFileToFirebaseStorage(file, visibility, 'documents');
      const year = new Date().getFullYear();
      const consecutiveNumber = await reserveConsecutiveDocumentNumber('acta', year);

      await createDocumentWithVersion(actor, {
        title: title.trim(),
        category: 'acta',
        description: `Generada desde plantilla oficial CMJ. Quórum: ${quorumText}`,
        tags: ['acta', String(year), 'flandes'],
        consecutiveNumber,
        year,
        sessionId: sessionId || undefined,
        status: 'revision',
        visibility,
        contentSha256,
        ...uploaded,
      });

      showToast('Acta PDF generada y radicada en el repositorio documental.', 'success');
      await onSaved();
      onClose();
    } catch (err) {
      showToast(toFriendlySpanishError(err, 'No se pudo generar y guardar el acta.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generador oficial de Acta CMJ">
      <form onSubmit={handleSaveToRepo} className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Vincular sesión registrada (opcional)" value={sessionId} onChange={(e) => handleSelectSession(e.target.value)}>
            <option value="">Redacción libre</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.dateIso} · {s.title}</option>
            ))}
          </Select>
          <Select label="Visibilidad al guardar" value={visibility} onChange={(e) => setVisibility(e.target.value as 'publico' | 'interno')}>
            <option value="interno">Interno (revisión consejeros)</option>
            <option value="publico">Público (transparencia)</option>
          </Select>
        </div>

        <Input label="Título del acta" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Fecha" type="date" required value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
          <Input label="Lugar" required value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input label="Quórum" required value={quorumText} onChange={(e) => setQuorumText(e.target.value)} />
        </div>
        <Textarea label="Orden del día" rows={2} required value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        <Textarea label="Desarrollo e intervenciones" rows={3} value={development} onChange={(e) => setDevelopment(e.target.value)} />
        <Textarea label="Decisiones y compromisos" rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => void handleDownloadOnly()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Solo descargar PDF</span>
          </Button>
          <Button type="submit" loading={busy}>
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            <span>Radicar PDF en repositorio</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
