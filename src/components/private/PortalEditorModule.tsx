import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FolderPlus,
  GripVertical,
  ImageOff,
  Images,
  Palette,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import { FESTIVE_THEMES } from '../../lib/seedData';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AccessTier,
  Commission,
  FestiveThemeId,
  GalleryAlbum,
  GalleryItem,
  NewsEvent,
  PortalSettings,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function PortalEditorModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  settings,
  commissions,
  newsEvents,
  galleryItems,
  galleryAlbums = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  settings: PortalSettings;
  commissions: Commission[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  galleryAlbums?: GalleryAlbum[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);

  const [heroTitle, setHeroTitle] = useState(settings.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle);
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [missionText, setMissionText] = useState(settings.missionText || '');
  const [visionText, setVisionText] = useState(settings.visionText || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactAddress, setContactAddress] = useState(settings.contactAddress || '');
  const [activeTheme, setActiveTheme] = useState<FestiveThemeId>(settings.activeTheme);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setHeroTitle(settings.heroTitle);
    setHeroSubtitle(settings.heroSubtitle);
    setAboutText(settings.aboutText || '');
    setMissionText(settings.missionText || '');
    setVisionText(settings.visionText || '');
    setContactEmail(settings.contactEmail || '');
    setContactAddress(settings.contactAddress || '');
    setActiveTheme(settings.activeTheme);
  }, [settings]);

  // Nueva noticia / evento
  const [newsTitle, setNewsTitle] = useState('');
  const [newsType, setNewsType] = useState<'noticia' | 'evento'>('noticia');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsComm, setNewsComm] = useState('');
  const [newsDate, setNewsDate] = useState('');
  const [newsLocation, setNewsLocation] = useState('');
  const [newsCoverUrl, setNewsCoverUrl] = useState('');
  const [newsStoragePath, setNewsStoragePath] = useState('');

  // Edición de noticia / evento existente
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editNewsTitle, setEditNewsTitle] = useState('');
  const [editNewsType, setEditNewsType] = useState<'noticia' | 'evento'>('noticia');
  const [editNewsSummary, setEditNewsSummary] = useState('');
  const [editNewsContent, setEditNewsContent] = useState('');
  const [editNewsComm, setEditNewsComm] = useState('');
  const [editNewsDate, setEditNewsDate] = useState('');
  const [editNewsLocation, setEditNewsLocation] = useState('');
  const [editNewsStatus, setEditNewsStatus] = useState<'borrador' | 'pendiente' | 'publicado'>('publicado');
  const [editNewsCoverUrl, setEditNewsCoverUrl] = useState('');
  const [editNewsStoragePath, setEditNewsStoragePath] = useState('');

  // Álbumes y subida a galería
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumDate, setAlbumDate] = useState('');
  const [albumComm, setAlbumComm] = useState('');

  const [galTitle, setGalTitle] = useState('');
  const [galDesc, setGalDesc] = useState('');
  const [galAlbumId, setGalAlbumId] = useState('');
  const [galCommId, setGalCommId] = useState('');
  const [galEventDate, setGalEventDate] = useState('');
  const [galVideoUrl, setGalVideoUrl] = useState('');

  // Edición de elemento de galería
  const [editingGalId, setEditingGalId] = useState<string | null>(null);
  const [editGalTitle, setEditGalTitle] = useState('');
  const [editGalDesc, setEditGalDesc] = useState('');
  const [editGalComm, setEditGalComm] = useState('');
  const [editGalAlbumId, setEditGalAlbumId] = useState('');
  const [editGalStatus, setEditGalStatus] = useState<'publicado' | 'archivado'>('publicado');

  // Reordenamiento Drag & Drop de galería
  const [orderedGallery, setOrderedGallery] = useState<GalleryItem[]>(galleryItems);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    setOrderedGallery(galleryItems);
  }, [galleryItems]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: settings.heroImageUrl || '',
          heroStoragePath: settings.heroStoragePath || '',
          aboutText: aboutText.trim(),
          missionText: missionText.trim(),
          visionText: visionText.trim(),
          contactEmail: contactEmail.trim(),
          contactAddress: contactAddress.trim(),
          activeTheme,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó configuración del portal público',
        module: 'Editor del Portal',
        targetTitle: `Tema ${activeTheme}`,
      });
      showToast('Portal público actualizado', 'success');
    } catch {
      showToast('No se pudieron guardar los cambios', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleHeroUpload = async (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (!f) return;
    try {
      if (settings.heroStoragePath) {
        await deleteStorageFile(settings.heroStoragePath, settings.heroImageUrl);
      }
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroImageUrl: f.url,
          heroStoragePath: f.storagePath || '',
        },
      });
      showToast('Portada del portal actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la portada', 'error');
    }
  };

  const handleRemoveHeroImage = async () => {
    try {
      if (settings.heroStoragePath || settings.heroImageUrl) {
        await deleteStorageFile(settings.heroStoragePath, settings.heroImageUrl);
      }
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroImageUrl: '',
          heroStoragePath: '',
        },
      });
      showToast('Imagen de portada retirada', 'info');
    } catch {
      showToast('No se pudo retirar la portada', 'error');
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsSummary.trim() || !newsContent.trim()) return;
    try {
      await apiRequest('/api/news', {
        method: 'POST',
        body: {
          title: newsTitle.trim(),
          type: newsType,
          summary: newsSummary.trim(),
          content: newsContent.trim(),
          coverUrl: newsCoverUrl,
          storagePath: newsStoragePath,
          commissionId: newsComm,
          eventDate: newsDate,
          location: newsLocation.trim(),
          status: isLeader ? 'publicado' : 'pendiente',
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Creó ${newsType}`,
        module: 'Noticias y Eventos',
        targetTitle: newsTitle.trim(),
      });
      setNewsTitle('');
      setNewsSummary('');
      setNewsContent('');
      setNewsDate('');
      setNewsLocation('');
      setNewsCoverUrl('');
      setNewsStoragePath('');
      showToast(
        isLeader ? 'Publicado en el portal ciudadano' : 'Enviado a revisión de Mesa Directiva',
        'success'
      );
    } catch {
      showToast('No se pudo crear la noticia/evento', 'error');
    }
  };

  const startEditNews = (n: NewsEvent) => {
    setEditingNewsId(n.id);
    setEditNewsTitle(n.title);
    setEditNewsType(n.type);
    setEditNewsSummary(n.summary);
    setEditNewsContent(n.content);
    setEditNewsComm(n.commissionId || '');
    setEditNewsDate(n.eventDate || '');
    setEditNewsLocation(n.location || '');
    setEditNewsStatus(n.status);
    setEditNewsCoverUrl(n.coverUrl || '');
    setEditNewsStoragePath(n.storagePath || '');
  };

  const handleSaveEditNews = async (n: NewsEvent) => {
    if (!editNewsTitle.trim() || !editNewsSummary.trim() || !editNewsContent.trim()) return;
    try {
      await apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
        method: 'PATCH',
        body: {
          title: editNewsTitle.trim(),
          type: editNewsType,
          summary: editNewsSummary.trim(),
          content: editNewsContent.trim(),
          commissionId: editNewsComm,
          eventDate: editNewsDate,
          location: editNewsLocation.trim(),
          coverUrl: editNewsCoverUrl,
          storagePath: editNewsStoragePath,
          ...(isLeader ? { status: editNewsStatus } : {}),
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Editó ${editNewsType}`,
        module: 'Noticias y Eventos',
        targetTitle: editNewsTitle.trim(),
      });
      setEditingNewsId(null);
      showToast('Publicación actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la publicación', 'error');
    }
  };

  const handleDeleteNews = async (n: NewsEvent) => {
    try {
      await deleteStorageFile(n.storagePath, n.coverUrl);
      await apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
        method: 'DELETE',
      });
      showToast('Publicación y archivo eliminados', 'info');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim()) return;
    try {
      const res = await apiRequest<{ id: string }>('/api/gallery-albums', {
        method: 'POST',
        body: {
          title: albumTitle.trim(),
          description: albumDesc.trim(),
          eventDate: albumDate,
          commissionId: albumComm,
          status: 'publicado',
        },
      });
      setGalAlbumId(res.id);
      setAlbumTitle('');
      setAlbumDesc('');
      setAlbumDate('');
      showToast('Álbum fotográfico creado', 'success');
    } catch {
      showToast('No se pudo crear el álbum', 'error');
    }
  };

  const handleDeleteAlbum = async (a: GalleryAlbum) => {
    try {
      await apiRequest(`/api/gallery-albums/${encodeURIComponent(a.id)}`, {
        method: 'DELETE',
      });
      if (galAlbumId === a.id) setGalAlbumId('');
      showToast('Álbum eliminado', 'info');
    } catch {
      showToast('No se pudo eliminar el álbum', 'error');
    }
  };

  const handleGalleryUpload = async (files: UploadedFileInfo[]) => {
    for (const f of files) {
      const isVideo = f.mimeType.startsWith('video/');
      await apiRequest('/api/gallery', {
        method: 'POST',
        body: {
          title: galTitle.trim() || f.fileName.replace(/\.[^.]+$/, ''),
          description: galDesc.trim(),
          mediaType: isVideo ? 'video' : 'image',
          videoSource: 'upload',
          url: f.url,
          thumbnailUrl: f.thumbnailUrl || f.thumbUrl || '',
          storagePath: f.storagePath || '',
          thumbnailStoragePath: f.thumbnailStoragePath || '',
          commissionId: galCommId,
          albumId: galAlbumId,
          eventDate: galEventDate,
          mimeType: f.mimeType,
          status: 'publicado',
        },
      });
    }
    setGalTitle('');
    setGalDesc('');
    showToast('Multimedia publicada en galería', 'success');
  };

  const handleAddExternalVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = galVideoUrl.trim();
    if (!url || !galTitle.trim()) return;
    const source = /vimeo\.com/i.test(url) ? 'vimeo' : 'youtube';
    try {
      await apiRequest('/api/gallery', {
        method: 'POST',
        body: {
          title: galTitle.trim(),
          description: galDesc.trim(),
          mediaType: 'video',
          videoSource: source,
          url,
          commissionId: galCommId,
          albumId: galAlbumId,
          eventDate: galEventDate,
          status: 'publicado',
        },
      });
      setGalTitle('');
      setGalDesc('');
      setGalVideoUrl('');
      showToast('Video agregado a la galería', 'success');
    } catch {
      showToast('No se pudo publicar el enlace de video', 'error');
    }
  };

  const handleDropGalleryItem = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !isLeader) return;
    const fromIdx = orderedGallery.findIndex((i) => i.id === draggedId);
    const toIdx = orderedGallery.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const copy = orderedGallery.slice();
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setOrderedGallery(copy);
    setDraggedId(null);
    try {
      await apiRequest('/api/gallery/reorder', {
        method: 'PATCH',
        body: { orderedIds: copy.map((i) => i.id) },
      });
      showToast('Orden de galería guardado', 'success');
    } catch {
      setOrderedGallery(galleryItems);
      showToast('No se pudo guardar el orden', 'error');
    }
  };

  const startEditGallery = (g: GalleryItem) => {
    setEditingGalId(g.id);
    setEditGalTitle(g.title);
    setEditGalDesc(g.description || '');
    setEditGalComm(g.commissionId || '');
    setEditGalAlbumId(g.albumId || '');
    setEditGalStatus(g.status);
  };

  const handleSaveEditGallery = async (g: GalleryItem) => {
    if (!editGalTitle.trim()) return;
    try {
      await apiRequest(`/api/gallery/${encodeURIComponent(g.id)}`, {
        method: 'PATCH',
        body: {
          title: editGalTitle.trim(),
          description: editGalDesc.trim(),
          commissionId: editGalComm,
          albumId: editGalAlbumId,
          status: editGalStatus,
        },
      });
      setEditingGalId(null);
      showToast('Elemento de galería actualizado', 'success');
    } catch {
      showToast('No se pudo actualizar la galería', 'error');
    }
  };

  const handleDeleteGallery = async (g: GalleryItem) => {
    try {
      await deleteStorageFile(g.storagePath, g.url);
      if (g.thumbnailStoragePath) {
        await deleteStorageFile(g.thumbnailStoragePath, g.thumbnailUrl);
      }
      await apiRequest(`/api/gallery/${encodeURIComponent(g.id)}`, {
        method: 'DELETE',
      });
      showToast('Elemento eliminado de galería y archivo', 'info');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Identidad, Temas Festivos y Portada Pública
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {FESTIVE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTheme(t.id)}
                className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  activeTheme === t.id
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${t.accentGradient} mb-2`} />
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-[11px] text-slate-500">{t.subtitle}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Título principal del portal"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              required
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Subtítulo"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <textarea
              rows={2}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="¿Qué es el CMJ Flandes?"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={missionText}
              onChange={(e) => setMissionText(e.target.value)}
              placeholder="Misión"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Visión"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Correo público de contacto"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="Dirección física / punto de encuentro"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>

          <div className="space-y-2">
            {settings.heroImageUrl && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <img
                    src={settings.heroImageUrl}
                    alt="Portada actual"
                    className="h-14 w-24 rounded-xl object-cover"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Portada institucional actual
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveHeroImage}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  <ImageOff className="h-3.5 w-3.5" /> Quitar imagen de portada
                </button>
              </div>
            )}
            <MediaUploader
              storageFolder="public/hero"
              imagePreset="cover"
              label="Imagen de portada institucional (opcional)"
              onUploaded={handleHeroUpload}
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {savingSettings ? 'Guardando...' : 'Guardar configuración pública'}
          </button>
        </form>
      )}

      {/* Noticias y Eventos */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Publicar y Editar Noticias o Eventos
        </h3>
        <form onSubmit={handleCreateNews} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newsTitle}
              onChange={(e) => setNewsTitle(e.target.value)}
              placeholder="Titular"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <select
              value={newsType}
              onChange={(e) => setNewsType(e.target.value as 'noticia' | 'evento')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="noticia">Noticia</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newsComm}
              onChange={(e) => setNewsComm(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">General / Sin comisión</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newsDate}
              onChange={(e) => setNewsDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newsLocation}
              onChange={(e) => setNewsLocation(e.target.value)}
              placeholder="Lugar (opcional)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
          <input
            type="text"
            required
            value={newsSummary}
            onChange={(e) => setNewsSummary(e.target.value)}
            placeholder="Resumen corto para tarjeta"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={3}
            required
            value={newsContent}
            onChange={(e) => setNewsContent(e.target.value)}
            placeholder="Desarrollo completo de la noticia o evento..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="public/news"
            imagePreset="cover"
            label="Foto de portada de la noticia (opcional)"
            onUploaded={(files) => {
              if (files[0]) {
                setNewsCoverUrl(files[0].url);
                setNewsStoragePath(files[0].storagePath || '');
              }
            }}
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            {isLeader ? 'Publicar ahora' : 'Enviar para aprobación'}
          </button>
        </form>

        {newsEvents.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-4">
            {newsEvents.map((n) => {
              const canEdit = isLeader || n.authorUid === uid;
              return (
                <div key={n.id} className="py-3 space-y-3 text-xs">
                  {editingNewsId === n.id ? (
                    <div className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-4 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editNewsTitle}
                          onChange={(e) => setEditNewsTitle(e.target.value)}
                          placeholder="Titular"
                          className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                        />
                        <select
                          value={editNewsType}
                          onChange={(e) =>
                            setEditNewsType(e.target.value as 'noticia' | 'evento')
                          }
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                        >
                          <option value="noticia">Noticia</option>
                          <option value="evento">Evento</option>
                        </select>
                        <select
                          value={editNewsComm}
                          onChange={(e) => setEditNewsComm(e.target.value)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                        >
                          <option value="">General / Sin comisión</option>
                          {commissions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editNewsDate}
                          onChange={(e) => setEditNewsDate(e.target.value)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editNewsLocation}
                          onChange={(e) => setEditNewsLocation(e.target.value)}
                          placeholder="Lugar"
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={editNewsSummary}
                        onChange={(e) => setEditNewsSummary(e.target.value)}
                        placeholder="Resumen"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                      />
                      <textarea
                        rows={3}
                        value={editNewsContent}
                        onChange={(e) => setEditNewsContent(e.target.value)}
                        placeholder="Contenido completo"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isLeader && (
                            <select
                              value={editNewsStatus}
                              onChange={(e) =>
                                setEditNewsStatus(
                                  e.target.value as 'borrador' | 'pendiente' | 'publicado'
                                )
                              }
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                            >
                              <option value="publicado">Publicado</option>
                              <option value="pendiente">Pendiente</option>
                              <option value="borrador">Borrador</option>
                            </select>
                          )}
                          {editNewsCoverUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditNewsCoverUrl('');
                                setEditNewsStoragePath('');
                              }}
                              className="text-rose-500 hover:underline cursor-pointer"
                            >
                              Quitar foto
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNewsId(null)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditNews(n)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 font-semibold text-white cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" /> Guardar cambios
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold uppercase text-blue-600 dark:text-cyan-400">
                          {n.type} · {n.status}
                          {n.eventDate ? ` · ${n.eventDate}` : ''}
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLeader && n.status !== 'publicado' && (
                          <button
                            type="button"
                            onClick={() =>
                              apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
                                method: 'PATCH',
                                body: { status: 'publicado' },
                              }).catch(() => showToast('No se pudo aprobar', 'error'))
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-semibold cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => startEditNews(n)}
                            title="Editar publicación"
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:border-blue-500 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isLeader && (
                          <button
                            type="button"
                            onClick={() => handleDeleteNews(n)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Álbumes, subida y reordenamiento de Galería */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Images className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Álbumes y Galería Multimedia Pública
          </h3>
        </div>

        {/* Crear Álbum */}
        <form
          onSubmit={handleCreateAlbum}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
        >
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <FolderPlus className="h-4 w-4 text-emerald-600" /> Nuevo álbum por evento o campaña
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Nombre del álbum (ej: Semana de la Juventud 2026)"
              className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              placeholder="Descripción breve"
              className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <select
              value={albumComm}
              onChange={(e) => setAlbumComm(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
            >
              <option value="">General</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={albumDate}
              onChange={(e) => setAlbumDate(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              Crear
            </button>
          </div>
          {galleryAlbums.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {galleryAlbums.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-[11px] font-semibold"
                >
                  <span>
                    {a.title}
                    {a.eventDate ? ` (${a.eventDate})` : ''}
                  </span>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAlbum(a)}
                      title="Eliminar álbum"
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </form>

        {/* Subir fotos o videos */}
        <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Subir fotos o videos a la galería pública
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={galTitle}
              onChange={(e) => setGalTitle(e.target.value)}
              placeholder="Título (o usa nombre del archivo)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={galAlbumId}
              onChange={(e) => setGalAlbumId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              <option value="">Sin álbum</option>
              {galleryAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <select
              value={galCommId}
              onChange={(e) => setGalCommId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              <option value="">General / Plenaria</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={galEventDate}
              onChange={(e) => setGalEventDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            />
          </div>
          <input
            type="text"
            value={galDesc}
            onChange={(e) => setGalDesc(e.target.value)}
            placeholder="Descripción o pie de foto (opcional)"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="public/gallery"
            imagePreset="gallery"
            multiple
            label="Subir fotos (WebP optimizado) o videos MP4"
            onUploaded={handleGalleryUpload}
          />
          <form onSubmit={handleAddExternalVideo} className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="url"
              value={galVideoUrl}
              onChange={(e) => setGalVideoUrl(e.target.value)}
              placeholder="O pega enlace de YouTube / Vimeo..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Agregar video externo
            </button>
          </form>
        </div>

        {/* Lista con Drag-and-Drop Reorder + Edición */}
        {orderedGallery.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Elementos publicados ({orderedGallery.length})
              </p>
              {isLeader && (
                <p className="text-[11px] text-slate-500">
                  Arrastra las filas para cambiar el orden público
                </p>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {orderedGallery.map((g) => (
                <div
                  key={g.id}
                  draggable={isLeader && editingGalId !== g.id}
                  onDragStart={() => setDraggedId(g.id)}
                  onDragOver={(e) => {
                    if (isLeader) e.preventDefault();
                  }}
                  onDrop={() => handleDropGalleryItem(g.id)}
                  className={`py-2.5 space-y-2 transition-colors ${
                    draggedId === g.id ? 'opacity-50 bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {editingGalId === g.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-3">
                      <input
                        type="text"
                        value={editGalTitle}
                        onChange={(e) => setEditGalTitle(e.target.value)}
                        placeholder="Título"
                        className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editGalDesc}
                        onChange={(e) => setEditGalDesc(e.target.value)}
                        placeholder="Descripción"
                        className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={editGalAlbumId}
                        onChange={(e) => setEditGalAlbumId(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="">Sin álbum</option>
                        {galleryAlbums.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editGalComm}
                        onChange={(e) => setEditGalComm(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="">General</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editGalStatus}
                        onChange={(e) =>
                          setEditGalStatus(e.target.value as 'publicado' | 'archivado')
                        }
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="publicado">Publicado</option>
                        <option value="archivado">Archivado</option>
                      </select>
                      <div className="sm:col-span-12 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGalId(null)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditGallery(g)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isLeader && (
                          <GripVertical className="h-4 w-4 text-slate-400 cursor-grab shrink-0" />
                        )}
                        <span className="font-semibold truncate">
                          [{g.mediaType} · {g.status}] {g.title}
                        </span>
                        {g.albumId && (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                            {galleryAlbums.find((a) => a.id === g.albumId)?.title || 'Álbum'}
                          </span>
                        )}
                      </div>
                      {(isLeader || g.authorUid === uid) && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditGallery(g)}
                            className="text-slate-600 dark:text-slate-300 hover:text-blue-600 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGallery(g)}
                            className="text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default PortalEditorModule;
