import { FormEvent, useEffect, useState } from 'react';
import { Send, UserCheck } from 'lucide-react';
import { persistValidatedMailboxEntry } from '../../services/publicService';
import { submitMailboxValidationOnServer } from '../../services/sessionApi';
import { Commission, PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';

interface MailboxSubmitFormProps {
  targetCouncilor: PublicDirectoryMember | null;
  targetCommission: Commission | null;
  onIssuedCode: (code: string) => void;
}

export function MailboxSubmitForm({
  targetCouncilor,
  targetCommission,
  onIssuedCode,
}: MailboxSubmitFormProps) {
  const [category, setCategory] = useState<'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd'>(
    'propuesta',
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderNeighborhood, setSenderNeighborhood] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (targetCouncilor) {
      setSubject((prev) =>
        prev.trim() ? prev : `Mensaje para ${targetCouncilor.displayName}: `,
      );
    } else if (targetCommission) {
      setSubject((prev) =>
        prev.trim() ? prev : `Participación en ${targetCommission.name}: `,
      );
    }
  }, [targetCouncilor, targetCommission]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const serverCheck = await submitMailboxValidationOnServer({
        category,
        isAnonymous,
        senderName: isAnonymous ? undefined : senderName,
        senderEmail: isAnonymous ? undefined : senderEmail,
        senderNeighborhood,
        subject,
        message,
        honeypot,
      });

      await persistValidatedMailboxEntry(serverCheck.sanitized);
      onIssuedCode(serverCheck.trackingCode);
      setSubject('');
      setMessage('');
      setSenderName('');
      setSenderEmail('');
      setSenderNeighborhood('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo completar la radicación.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        {targetCouncilor && (
          <div className="flex items-start gap-3 rounded-xl border border-[#7B1832]/25 bg-[#FBF4F6] p-3.5 text-xs text-stone-700 dark:border-[#D9B245]/30 dark:bg-slate-800/70 dark:text-slate-200">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">
                Mensaje dirigido a {targetCouncilor.displayName} ({ROLE_LABELS[targetCouncilor.role]})
              </p>
              <p className="mt-0.5">
                Se tramitará por el buzón institucional con código único de seguimiento, sin exponer datos personales del consejero ni del remitente.
              </p>
            </div>
          </div>
        )}

        <div className="hidden" aria-hidden="true">
          <label htmlFor="website_url">No completar este campo</label>
          <input
            id="website_url"
            name="website_url"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Select
            label="Tipo de radicación"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd')
            }
          >
            <option value="propuesta">Propuesta juvenil</option>
            <option value="inquietud">Inquietud ciudadana</option>
            <option value="denuncia">Denuncia / Veeduría</option>
            <option value="pqrsd">PQRSD formal</option>
          </Select>

          <Input
            label="Barrio o vereda de Flandes (opcional)"
            value={senderNeighborhood}
            onChange={(e) => setSenderNeighborhood(e.target.value)}
            placeholder="Ej. Centro, Gaitán, Las Quintas, Topacio"
            maxLength={120}
          />
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-[#F7F4EE] px-4 py-2.5 text-sm text-stone-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="h-4 w-4 accent-[#7B1832]"
          />
          <span>Radicar de forma anónima (no se solicitará ni guardará tu identidad)</span>
        </label>

        {!isAnonymous && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label="Nombre completo"
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Tu nombre y apellido"
              maxLength={120}
            />
            <Input
              label="Correo de contacto (opcional)"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              maxLength={160}
            />
          </div>
        )}

        <Input
          label="Asunto"
          required
          minLength={4}
          maxLength={180}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Resume tu propuesta o solicitud"
        />

        <Textarea
          label="Descripción detallada"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe los hechos, propuesta o requerimiento para el municipio de Flandes..."
        />

        {formError && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {formError}
          </p>
        )}

        <Button type="submit" loading={submitting}>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span>Radicar en el buzón</span>
        </Button>
      </form>
    </Card>
  );
}
