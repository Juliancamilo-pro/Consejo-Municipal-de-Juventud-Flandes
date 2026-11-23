import { apiRequest } from './apiClient';

export async function deleteStorageFile(storagePath?: string, urlFallback?: string): Promise<void> {
  let mediaId = '';
  const path = storagePath?.trim() || '';
  if (path.startsWith('db-media/')) {
    mediaId = path.slice('db-media/'.length);
  } else if (urlFallback && urlFallback.startsWith('/api/media/')) {
    mediaId = urlFallback.slice('/api/media/'.length);
  }

  if (!mediaId) return;

  try {
    await apiRequest(`/api/media/${encodeURIComponent(mediaId)}`, {
      method: 'DELETE',
      skipRefresh: true,
    });
  } catch {
    // No bloquear eliminación del registro si el archivo ya fue borrado
  }
}

export interface ParsedExternalVideo {
  source: 'youtube' | 'vimeo';
  embedUrl: string;
  thumbnailUrl?: string;
}

export function parseVideoEmbedUrl(rawUrl: string): ParsedExternalVideo | null {
  const clean = rawUrl.trim();
  if (!clean) return null;

  try {
    const url = new URL(clean);
    const host = url.hostname.toLowerCase();

    if (host.includes('youtube.com') || host === 'youtu.be') {
      let videoId = '';
      if (host === 'youtu.be') {
        videoId = url.pathname.replace(/^\//, '').split('/')[0];
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2] || '';
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/')[2] || '';
      } else {
        videoId = url.searchParams.get('v') || '';
      }
      if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) return null;
      return {
        source: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }

    if (host.includes('vimeo.com')) {
      const segments = url.pathname.split('/').filter(Boolean);
      const videoId = segments[segments.length - 1] || '';
      if (!/^\d+$/.test(videoId)) return null;
      return {
        source: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  } catch {
    return null;
  }

  return null;
}
