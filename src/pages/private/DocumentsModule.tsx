import { useMemo, useState } from 'react';
import {
  Commission,
  DocumentVersion,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { extractDocumentYear } from '../../utils/documentUtils';
import { DocumentDetailDrawer } from './DocumentDetailDrawer';
import {
  DocumentFiltersBar,
  DocumentQuickView,
  DocumentViewMode,
} from './DocumentFiltersBar';
import { DocumentListView } from './DocumentListView';
import { DocumentModals } from './DocumentModals';
import { DocumentUploadCard } from './DocumentUploadCard';

interface DocumentsModuleProps {
  actor: UserProfile;
  documents: InstitutionalDocument[];
  commissions?: Commission[];
  sessions?: PlenarySession[];
  projects?: ProjectItem[];
  onReload: () => Promise<void>;
}

const PAGE_SIZE = 12;

export function DocumentsModule({
  actor,
  documents,
  commissions = [],
  sessions = [],
  projects = [],
  onReload,
}: DocumentsModuleProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);
  const canCreate = isBoard || actor.role === 'lider_comision';

  const [quickView, setQuickView] = useState<DocumentQuickView>('todos');
  const [viewMode, setViewMode] = useState<DocumentViewMode>('tarjetas');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visFilter, setVisFilter] = useState('');
  const [comFilter, setComFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<InstitutionalDocument | null>(null);
  const [versionsList, setVersionsList] = useState<DocumentVersion[]>([]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) || null,
    [documents, selectedDocId],
  );

  const availableYears = useMemo(() => {
    const s = new Set<number>();
    documents.forEach((d) => s.add(extractDocumentYear(d)));
    return Array.from(s).sort((a, b) => b - a);
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = documents.filter((d) => {
      if (quickView === 'mios' && d.authorUid !== actor.uid) return false;
      if (quickView === 'pendientes' && d.status !== 'revision') return false;
      if (catFilter && d.category !== catFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      if (visFilter && d.visibility !== visFilter) return false;
      if (comFilter && d.commissionId !== comFilter) return false;
      if (yearFilter && String(extractDocumentYear(d)) !== yearFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.consecutiveNumber || '').toLowerCase().includes(q) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        d.authorName.toLowerCase().includes(q)
      );
    });
    return quickView === 'recientes' ? list.slice(0, 15) : list;
  }, [
    documents,
    quickView,
    actor.uid,
    catFilter,
    statusFilter,
    visFilter,
    comFilter,
    yearFilter,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {canCreate && (
        <DocumentUploadCard
          actor={actor}
          isBoard={isBoard}
          existingDocuments={documents}
          commissions={commissions}
          sessions={sessions}
          projects={projects}
          onReload={onReload}
        />
      )}

      <DocumentFiltersBar
        documents={documents}
        commissions={commissions}
        availableYears={availableYears}
        quickView={quickView}
        viewMode={viewMode}
        search={search}
        catFilter={catFilter}
        statusFilter={statusFilter}
        comFilter={comFilter}
        visFilter={visFilter}
        yearFilter={yearFilter}
        onQuickView={(next) => {
          setQuickView(next);
          setPage(1);
        }}
        onViewMode={setViewMode}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onCat={(v) => {
          setCatFilter(v);
          setPage(1);
        }}
        onStatus={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onCom={(v) => {
          setComFilter(v);
          setPage(1);
        }}
        onVis={(v) => {
          setVisFilter(v);
          setPage(1);
        }}
        onYear={(v) => {
          setYearFilter(v);
          setPage(1);
        }}
      />

      <DocumentListView
        paged={paged}
        totalCount={filtered.length}
        viewMode={viewMode}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSelect={setSelectedDocId}
        onPreview={setPreviewDoc}
      />

      <DocumentDetailDrawer
        docItem={selectedDoc}
        actor={actor}
        isBoard={isBoard}
        canCreate={canCreate}
        commissions={commissions}
        sessions={sessions}
        projects={projects}
        onClose={() => setSelectedDocId(null)}
        onPreview={(d) => setPreviewDoc(d)}
        onReload={onReload}
      />

      <DocumentModals
        actor={actor}
        canCreate={canCreate}
        previewDoc={previewDoc}
        onClosePreview={() => setPreviewDoc(null)}
        versionsDoc={null}
        versionsList={versionsList}
        onVersionsUpdated={setVersionsList}
        onCloseVersions={() => undefined}
        onReload={onReload}
      />
    </div>
  );
}
