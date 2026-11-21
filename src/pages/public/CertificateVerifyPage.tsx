import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, QrCode, Search, ShieldAlert } from 'lucide-react';
import {
  CERTIFICATE_TYPE_LABELS,
  verifyCertificateByCode,
} from '../../services/certificatesService';
import { CertificateRecord } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusText } from '../../components/ui/StatusText';

interface CertificateVerifyPageProps {
  initialCode?: string | null;
  onNavigate: (route: AppRoute) => void;
}

export function CertificateVerifyPage({
  initialCode,
  onNavigate,
}: CertificateVerifyPageProps) {
  const [code, setCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [result, setResult] = useState<CertificateRecord | null>(null);
  const [checked, setChecked] = useState(false);

  const runVerify = async (target: string) => {
    const clean = target.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setChecked(false);
    try {
      const found = await verifyCertificateByCode(clean);
      setResult(found);
      setChecked(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      void runVerify(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    onNavigate(`/verificar/${encodeURIComponent(clean)}`);
    void runVerify(clean);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Autenticidad Documental · Flandes, Tolima"
        title="Verificación oficial de certificados"
        description="Valida mediante código único o QR la vigencia de constancias y certificaciones emitidas por el CMJ Flandes (sin exponer datos privados)."
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate('/') },
          { label: 'Gestión', onClick: () => onNavigate('/gestion') },
          { label: 'Verificar certificado' },
        ]}
      />

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Código de certificación"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. CMJ-CERT-2026-AB12CD"
              className="flex-1 font-mono-tabular"
            />
            <Button type="submit" loading={loading}>
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Verificar</span>
            </Button>
          </form>
        </Card>

        {checked && !result && (
          <Card className="border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-red-700 dark:text-red-400" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-semibold text-red-900 dark:text-red-200">
                  Certificado no encontrado
                </h2>
                <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                  El código {code} no coincide con ningún registro oficial en la base de datos del CMJ de Flandes.
                </p>
              </div>
            </div>
          </Card>
        )}

        {result && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <CheckCircle2
                  className={`h-5 w-5 ${
                    result.status === 'vigente' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono-tabular text-sm font-semibold text-stone-900 dark:text-white">
                  {result.code}
                </span>
              </div>
              <StatusText
                label={result.status === 'vigente' ? 'Certificado vigente' : 'Certificado revocado'}
                tone={result.status === 'vigente' ? 'success' : 'danger'}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  {CERTIFICATE_TYPE_LABELS[result.certificateType]}
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-stone-950 dark:text-white">
                  {result.title}
                </h2>
              </div>

              <dl className="grid grid-cols-1 gap-4 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 text-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/60">
                <div>
                  <dt className="text-xs text-stone-500 dark:text-slate-400">Otorgado a</dt>
                  <dd className="font-semibold text-stone-950 dark:text-white">{result.recipientName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500 dark:text-slate-400">Fecha de expedición</dt>
                  <dd className="font-mono-tabular font-medium text-stone-900 dark:text-slate-200">
                    {result.issuedAtIso}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-stone-500 dark:text-slate-400">Motivo / alcance</dt>
                  <dd className="mt-0.5 text-stone-700 dark:text-slate-300">{result.issuedFor}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-stone-500 dark:text-slate-400">Autorizado por</dt>
                  <dd className="font-medium text-stone-900 dark:text-slate-200">{result.issuedByName}</dd>
                </div>
              </dl>

              <p className="flex items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                <QrCode className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span>Verificación oficial directa sobre registro institucional del CMJ Flandes.</span>
              </p>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
