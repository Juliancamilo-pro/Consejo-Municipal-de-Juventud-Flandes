import { useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { MediaDropzone } from '../../components/media/MediaDropzone';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { MediaDisplay } from '../../components/ui/MediaDisplay';

export interface NewsEditorCardProps {
  editingId: string | null;
  newsTitle: string;
  newsType: 'noticia' | 'comunicado' | 'galeria';
  newsSummary: string;
  newsContent: string;
  newsStatus: 'borrador' | 'publicada' | 'archivada';
  scheduledPublishAt: string;
  tagsInput: string;
  seoTitle: string;
  seoDescription: string;
  mediaUrl: string;
  savingNews: boolean;
  onChangeTitle: (v: string) => void;
  onChangeType: (v: 'noticia' | 'comunicado' | 'galeria') => void;
  onChangeSummary: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeStatus: (v: 'borrador' | 'publicada' | 'archivada') => void;
  onChangeScheduledPublishAt: (v: string) => void;
  onChangeTagsInput: (v: string) => void;
  onChangeSeoTitle: (v: string) => void;
  onChangeSeoDescription: (v: string) => void;
  onClearMedia: () => void;
  onFileSelected: (file: File) => void;
  onResetForm: () => void;
  onOpenPreview: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function NewsEditorCard(props: NewsEditorCardProps) {
  const [seoOpen, setSeoOpen] = useState(Boolean(props.seoTitle || props.seoDescription));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
            Publicador Multimedia · Foto y Video
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
            {props.editingId ? 'Editar publicación existente' : 'Publicar noticia, comunicado o galería'}
          </h2>
        </div>
        {props.editingId && (
          <Button size="sm" variant="outline" onClick={props.onResetForm}>
            Cancelar edición
          </Button>
        )}
      </div>

      <form onSubmit={props.onSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Título"
            required
            minLength={3}
            maxLength={180}
            value={props.newsTitle}
            onChange={(e) => props.onChangeTitle(e.target.value)}
          />
          <Select
            label="Tipo"
            value={props.newsType}
            onChange={(e) => props.onChangeType(e.target.value as 'noticia' | 'comunicado' | 'galeria')}
          >
            <option value="noticia">Noticia</option>
            <option value="comunicado">Comunicado</option>
            <option value="galeria">Galería (Foto / Video)</option>
          </Select>
          <Select
            label="Estado"
            value={props.newsStatus}
            onChange={(e) => props.onChangeStatus(e.target.value as 'borrador' | 'publicada' | 'archivada')}
          >
            <option value="borrador">Borrador</option>
            <option value="publicada">Publicada</option>
            <option value="archivada">Archivada</option>
          </Select>
          <Input
            label="Publicación programada (opcional)"
            type="datetime-local"
            value={props.scheduledPublishAt}
            onChange={(e) => props.onChangeScheduledPublishAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Resumen breve"
            required
            minLength={5}
            maxLength={400}
            value={props.newsSummary}
            onChange={(e) => props.onChangeSummary(e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label="Etiquetas temáticas (separadas por coma)"
            value={props.tagsInput}
            onChange={(e) => props.onChangeTagsInput(e.target.value)}
            placeholder="Ej. educación, cultura, ruralidad"
          />
        </div>

        <Textarea
          label="Contenido completo"
          required
          minLength={5}
          maxLength={15000}
          rows={4}
          value={props.newsContent}
          onChange={(e) => props.onChangeContent(e.target.value)}
        />

        <div>
          <button
            type="button"
            onClick={() => setSeoOpen((o) => !o)}
            className="text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
          >
            {seoOpen ? 'Ocultar metadatos SEO y redes' : '+ Configurar título SEO y descripción de compartir'}
          </button>
          {seoOpen && (
            <div className="mt-2 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-[#FAF8F4]/70 p-3 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/50">
              <Input
                label="Título SEO opcional (máx. 120 caracteres)"
                maxLength={120}
                value={props.seoTitle}
                onChange={(e) => props.onChangeSeoTitle(e.target.value)}
                placeholder={props.newsTitle || 'Título corto para buscadores'}
              />
              <Input
                label="Meta descripción SEO opcional (máx. 200 caracteres)"
                maxLength={200}
                value={props.seoDescription}
                onChange={(e) => props.onChangeSeoDescription(e.target.value)}
                placeholder={props.newsSummary || 'Resumen claro para buscadores'}
              />
            </div>
          )}
        </div>

        {props.mediaUrl ? (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-800 dark:text-slate-100">
                Multimedia lista para publicar
              </span>
              <button
                type="button"
                onClick={props.onClearMedia}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Quitar archivo</span>
              </button>
            </div>
            <MediaDisplay
              src={props.mediaUrl}
              alt={props.newsTitle || 'Vista previa multimedia'}
              className="max-h-72 w-full rounded-lg"
            />
          </div>
        ) : (
          <MediaDropzone
            label="Fotografía o Video opcional (con editor de rango, espacio y ángulo)"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            mode="media"
            onFileSelected={props.onFileSelected}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!props.newsTitle.trim()}
            onClick={props.onOpenPreview}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>Vista previa</span>
          </Button>
          <Button type="submit" loading={props.savingNews}>
            {props.editingId ? 'Actualizar publicación' : 'Guardar publicación'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
