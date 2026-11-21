import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Award, Ban, FileDown, LayoutGrid, List } from 'lucide-react';
import {
  CERTIFICATE_TYPE_LABELS,
  exportCertificatePdfWithQr,
  fetchAllCertificates,
  issueCertificate,
  revokeCertificate,
} from '../../services/certificatesService';
import { CertificateRecord, CertificateType, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface CertificatesPanelProps {
  actor: UserProfile;
  users: UserProfile[];
}

export function CertificatesPanel({ actor, users }: CertificatesPanelProps) {
  const { showToast } = useToast();
  const [certs, setCerts] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientUid, setRecipientUid] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [certType, setCertType] = useState<CertificateType>('asistencia');
  const [title, setTitle] = useState('Constancia Oficial de Gestión Juvenil');
  const [issuedFor, setIssuedFor] = useState('');
  const [issuedAtIso, setIssuedAtIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [revokeTarget, setRevokeTarget] = useState<CertificateRecord | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const loadCerts = async () => {
    setLoading(true);
    try {
      setCerts(await fetchAllCertificates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCerts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.recipientName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    });
  }, [certs, search, statusFilter]);

  const handleSelectUser = (uid: string) => {
    setRecipientUid(uid);
    const matched = users.find((u) => u.uid === uid);
    if (matched) setRecipientName(matched.displayName);
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await issueCertificate(actor, {
        recipientUid: recipientUid || undefined,
        recipientName,
        certificateType: certType,
        title,
        issuedFor,
        issuedAtIso,
      });
      setRecipientName('');
      setRecipientUid('');
      setIssuedFor('');
      showToast(`Certificado ${created.code} expedido correctamente.`, 'success');
      await loadCerts();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeCertificate(actor, revokeTarget.code);
      showToast(`Certificado ${revokeTarget.code} revocado.`, 'info');
      setRevokeTarget(null);
      await loadCerts();
    } finally {
      setRevoking(false);
    }
  };

  const activeCounselors = useMemo(
    () => users.filter((u) => u.status === 'activo'),
    [users],
  );

  const handleBatchIssue = async () => {
    if (activeCounselors.length === 0) return;
    setBatchBusy(true);
    try {
      for (const counselor of activeCounselors) {
        await issueCertificate(actor, {
          recipientUid: counselor.uid,
          recipientName: counselor.displayName,
          certificateType: 'membresia',
          title: 'Constancia de Consejero Municipal de Juventud Activo (2026–2029)',
          issuedFor: `Certificación oficial de participación y ejercicio activo como integrante del Consejo Municipal de Juventud de Flandes, Tolima (${counselor.sector || 'Delegación juvenil'}).`,
          issuedAtIso,
        });
      }
      showToast(`Se expidieron ${activeCounselors.length} certificados en lote con QR.`, 'success');
      setBatchOpen(false);
      await loadCerts();
    } finally {
      setBatchBusy(false);
    }
  };

  const columns: TableColumn<CertificateRecord>[] = [
    { key: 'code', header: 'Código', sortValue: (c) => c.code, render: (c) => <span className="font-mono-tabular font-semibold">{c.code}</span> },
    { key: 'recipientName', header: 'Beneficiario', sortValue: (c) => c.recipientName, render: (c) => <span className="font-semibold">{c.recipientName}</span> },
    { key: 'title', header: 'Título', sortValue: (c) => c.title, render: (c) => <span>{c.title}</span> },
    { key: 'issuedAtIso', header: 'Fecha', sortValue: (c) => c.issuedAtIso, render: (c) => <span className="font-mono-tabular">{c.issuedAtIso}</span> },
    { key: 'status', header: 'Estado', sortValue: (c) => c.status, render: (c) => <StatusText label={c.status} tone={c.status === 'vigente' ? 'success' : 'danger'} /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Expedir certificado PDF con verificación QR
        </h2>
        <form onSubmit={handleIssue} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Consejero registrado (opcional)" value={recipientUid} onChange={(e) => handleSelectUser(e.target.value)}>
              <option value="">Persona externa / otro</option>
              {users.filter((u) => u.status === 'activo').map((u) => (
                <option key={u.uid} value={u.uid}>{u.displayName}</option>
              ))}
            </Select>
            <Input label="Nombre completo en certificado" required minLength={3} maxLength={120} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            <Select label="Tipo de certificado" value={certType} onChange={(e) => setCertType(e.target.value as CertificateType)}>
              {Object.entries(CERTIFICATE_TYPE_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
            </Select>
            <Input label="Fecha de expedición" type="date" required value={issuedAtIso} onChange={(e) => setIssuedAtIso(e.target.value)} />
          </div>
          <Input label="Título del certificado" required minLength={5} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Objeto o motivo de la certificación" required minLength={10} maxLength={500} rows={2} value={issuedFor} onChange={(e) => setIssuedFor(e.target.value)} placeholder="Ej. Por su asistencia y participación activa en las sesiones ordinarias del periodo 2026..." />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              <Award className="h-4 w-4" aria-hidden="true" />
              <span>Expedir y generar código QR</span>
            </Button>
            {activeCounselors.length > 0 && (
              <Button type="button" variant="outline" onClick={() => setBatchOpen(true)}>
                <span>Expedición en lote ({activeCounselors.length} activos)</span>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Certificados expedidos ({filtered.length})
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === 'cards' ? 'primary' : 'outline'} onClick={() => setViewMode('cards')}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /><span>Tarjetas</span>
            </Button>
            <Button size="sm" variant={viewMode === 'table' ? 'primary' : 'outline'} onClick={() => setViewMode('table')}>
              <List className="h-3.5 w-3.5" aria-hidden="true" /><span>Tabla y Exportar</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Buscar por código, nombre o título" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="vigente">Vigentes</option>
            <option value="revocado">Revocados</option>
          </Select>
        </div>
      </Card>

      {!loading && filtered.length === 0 ? (
        <EmptyState icon={Award} title="Sin certificados que coincidan" description="Cada certificado genera un código único verificable públicamente mediante QR." />
      ) : viewMode === 'table' ? (
        <Card><DataTable rows={filtered} columns={columns} rowKey={(c) => c.id} exportFileName="cmj-flandes-certificados" exportTitle="Certificados Expedidos — CMJ Flandes" /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} padding="sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">{c.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{c.issuedAtIso}</span>
                    <StatusText label={c.status === 'vigente' ? 'Vigente' : 'Revocado'} tone={c.status === 'vigente' ? 'success' : 'danger'} />
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{c.recipientName} — {c.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void exportCertificatePdfWithQr(c)}>
                    <FileDown className="h-3.5 w-3.5" aria-hidden="true" /><span>PDF + QR</span>
                  </Button>
                  {c.status === 'vigente' && (
                    <Button size="sm" variant="outline" onClick={() => setRevokeTarget(c)}>
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" /><span>Revocar</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(revokeTarget)}
        destructive
        loading={revoking}
        title="¿Revocar certificado oficial?"
        description={`El certificado ${revokeTarget?.code || ''} a nombre de ${revokeTarget?.recipientName || ''} quedará marcado como revocado en la verificación QR pública.`}
        confirmLabel="Sí, revocar certificado"
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />

      <Dialog
        open={batchOpen}
        loading={batchBusy}
        title="¿Expedir certificados en lote?"
        description={`Se generarán ${activeCounselors.length} certificados individuales con código QR verificable para todos los consejeros con estado activo.`}
        confirmLabel={`Sí, expedir ${activeCounselors.length}`}
        onConfirm={handleBatchIssue}
        onCancel={() => setBatchOpen(false)}
      />
    </div>
  );
}
