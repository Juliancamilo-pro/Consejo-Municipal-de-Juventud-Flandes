import { FormEvent, useMemo, useState } from 'react';
import { Edit3, LayoutGrid, List, Newspaper } from 'lucide-react';
import { deleteNewsItem, saveNewsItem } from '../../services/privateContentService';
import { NewsItem, UserProfile } from '../../types/models';
import { MediaStudioModal, MediaStudioResult } from '../../components/media/MediaStudioModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { MediaDisplay } from '../../components/ui/MediaDisplay';
import { Modal } from '../../components/ui/Modal';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { NewsEditorCard } from './NewsEditorCard';

interface NewsContentPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  news: NewsItem[];
  onReload: () => Promise<void>;
}

type ConfirmNewsAction =
  | { kind: 'archive'; item: NewsItem }
  | { kind: 'delete'; item: NewsItem };

export function NewsContentPanel({ actor, isBoard, news, onReload }: NewsContentPanelProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsType, setNewsType] = useState<'noticia' | 'comunicado' | 'galeria'>('noticia');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsStatus, setNewsStatus] = useState<'borrador' | 'publicada' | 'archivada'>('borrador');
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null);
  const [savingNews, setSavingNews] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [confirmAction, setConfirmAction] = useState<ConfirmNewsAction | null>(null);
  const [busyConfirm, setBusyConfirm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return news.filter((n) => {
      if (typeFilter && n.type !== typeFilter) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [news, search, typeFilter, statusFilter]);

  const resetForm = () => {
    setEditingId(null);
    setNewsTitle('');
    setNewsType('noticia');
    setNewsSummary('');
    setNewsContent('');
    setNewsStatus('borrador');
    setScheduledPublishAt('');
    setTagsInput('');
    setSeoTitle('');
    setSeoDescription('');
    setMediaUrl('');
  };

  const startEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setNewsTitle(item.title);
    setNewsType(item.type);
    setNewsSummary(item.summary);
    setNewsContent(item.content);
    setNewsStatus(item.status);
    setScheduledPublishAt(item.scheduledPublishAt || '');
    setTagsInput((item.tags || []).join(', '));
    setSeoTitle(item.seoTitle || '');
    setSeoDescription(item.seoDescription || '');
    setMediaUrl(item.imageUrl || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveNews = async (e: FormEvent) => {
    e.preventDefault();
    setSavingNews(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      await saveNewsItem(actor, {
        ...(editingId ? { id: editingId } : {}),
        title: newsTitle,
        type: newsType,
        summary: newsSummary,
        content: newsContent,
        imageUrl: mediaUrl || undefined,
        tags,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
        status: newsStatus,
        scheduledPublishAt: scheduledPublishAt || undefined,
      });
      showToast(editingId ? 'Publicación actualizada.' : 'Publicación guardada correctamente.', 'success');
      resetForm();
      await onReload();
    } finally {
      setSavingNews(false);
    }
  };

  const handleStudioComplete = (result: MediaStudioResult) => {
    setMediaUrl(result.url);
    setPendingMediaFile(null);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setBusyConfirm(true);
    try {
      if (confirmAction.kind === 'archive') {
        await saveNewsItem(actor, { ...confirmAction.item, status: 'archivada' });
        showToast('Publicación archivada.', 'info');
      } else {
        await deleteNewsItem(actor, confirmAction.item.id);
        showToast('Publicación eliminada.', 'info');
      }
      setConfirmAction(null);
      await onReload();
    } finally {
      setBusyConfirm(false);
    }
  };

  const columns: TableColumn<NewsItem>[] = [
    { key: 'title', header: 'Título', sortValue: (n) => n.title, render: (n) => <span className="font-semibold">{n.title}</span> },
    { key: 'type', header: 'Tipo', sortValue: (n) => n.type, render: (n) => <span className="capitalize">{n.type}</span> },
    { key: 'tags', header: 'Etiquetas', render: (n) => <span className="text-xs text-stone-500">{(n.tags || []).join(', ') || '—'}</span> },
    { key: 'author', header: 'Autor', sortValue: (n) => n.authorName, render: (n) => <span>{n.authorName}</span> },
    { key: 'status', header: 'Estado', sortValue: (n) => n.status, render: (n) => <StatusText label={n.status} tone={n.status === 'publicada' ? 'success' : 'neutral'} /> },
  ];

  return (
    <div className="space-y-6">
      {isBoard && (
        <NewsEditorCard
          editingId={editingId}
          newsTitle={newsTitle}
          newsType={newsType}
          newsSummary={newsSummary}
          newsContent={newsContent}
          newsStatus={newsStatus}
          scheduledPublishAt={scheduledPublishAt}
          tagsInput={tagsInput}
          seoTitle={seoTitle}
          seoDescription={seoDescription}
          mediaUrl={mediaUrl}
          savingNews={savingNews}
          onChangeTitle={setNewsTitle}
          onChangeType={setNewsType}
          onChangeSummary={setNewsSummary}
          onChangeContent={setNewsContent}
          onChangeStatus={setNewsStatus}
          onChangeScheduledPublishAt={setScheduledPublishAt}
          onChangeTagsInput={setTagsInput}
          onChangeSeoTitle={setSeoTitle}
          onChangeSeoDescription={setSeoDescription}
          onClearMedia={() => setMediaUrl('')}
          onFileSelected={setPendingMediaFile}
          onResetForm={resetForm}
          onOpenPreview={() => setPreviewOpen(true)}
          onSubmit={handleSaveNews}
        />
      )}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Publicaciones ({filtered.length})
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, resumen o etiqueta..." />
          <Select label="Tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="noticia">Noticia</option>
            <option value="comunicado">Comunicado</option>
            <option value="galeria">Galería</option>
          </Select>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="publicada">Publicada</option>
            <option value="borrador">Borrador</option>
            <option value="archivada">Archivada</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={Newspaper} title="Sin publicaciones que coincidan" description="Crea borradores o publica noticias, comunicados y videos oficiales." />
      ) : viewMode === 'table' ? (
        <Card>
          <DataTable rows={filtered} columns={columns} rowKey={(n) => n.id} exportFileName="cmj-flandes-publicaciones" exportTitle="Noticias y Comunicados — CMJ Flandes" />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <Card key={n.id} padding="sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  {n.imageUrl && (
                    <MediaDisplay src={n.imageUrl} alt={n.title} className="h-16 w-24 shrink-0 rounded-lg border border-stone-200 dark:border-slate-700" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                      <span className="capitalize">{n.type}</span>
                      <StatusText label={n.status} tone={n.status === 'publicada' ? 'success' : 'neutral'} />
                      {n.scheduledPublishAt && <span className="font-mono-tabular">Prog: {n.scheduledPublishAt.replace('T', ' ')}</span>}
                      {(n.tags || []).length > 0 && <span>· {(n.tags || []).join(' · ')}</span>}
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{n.title}</h3>
                  </div>
                </div>
                {isBoard && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(n)}>
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /><span>Editar</span>
                    </Button>
                    {n.status !== 'publicada' && (
                      <Button size="sm" onClick={() => void saveNewsItem(actor, { ...n, status: 'publicada' }).then(onReload)}>Publicar</Button>
                    )}
                    {n.status !== 'archivada' && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmAction({ kind: 'archive', item: n })}>Archivar</Button>
                    )}
                    {actor.role === 'secretario_admin' && (
                      <Button size="sm" variant="danger" onClick={() => setConfirmAction({ kind: 'delete', item: n })}>Eliminar</Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Vista previa antes de publicar" maxWidth="lg">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7B1832] dark:text-[#D9B245]">{newsType}</p>
          <h3 className="font-display text-2xl font-semibold text-stone-950 dark:text-white">{newsTitle}</h3>
          <p className="text-sm font-medium text-stone-600 dark:text-slate-300">{newsSummary}</p>
          {mediaUrl && <MediaDisplay src={mediaUrl} alt={newsTitle} className="max-h-72 w-full rounded-xl" />}
          <div className="whitespace-pre-line text-sm leading-relaxed text-stone-700 dark:text-slate-200">{newsContent}</div>
        </div>
      </Modal>

      <Dialog
        open={Boolean(confirmAction)}
        destructive
        loading={busyConfirm}
        title={confirmAction?.kind === 'delete' ? '¿Eliminar publicación permanentemente?' : '¿Archivar publicación?'}
        description={confirmAction?.kind === 'delete' ? `Se eliminará "${confirmAction.item.title}" del repositorio.` : `La publicación "${confirmAction?.item.title || ''}" dejará de mostrarse en el sitio público.`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <MediaStudioModal open={Boolean(pendingMediaFile)} file={pendingMediaFile} visibility="publico" title="Editar fotografía o video para publicación" onClose={() => setPendingMediaFile(null)} onComplete={handleStudioComplete} />
    </div>
  );
}
