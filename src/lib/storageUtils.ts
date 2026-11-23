import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebase';

export async function deleteStorageFile(storagePath?: string, urlFallback?: string): Promise<void> {
  const path = storagePath?.trim();
  if (path) {
    try {
      await deleteObject(ref(storage, path));
      return;
    } catch {
      // Continuar intentando por URL si la ruta directa no existe
    }
  }

  if (urlFallback && urlFallback.includes('firebasestorage.googleapis.com')) {
    try {
      const parsed = new URL(urlFallback);
      const match = parsed.pathname.match(/\/o\/(.+)$/);
      if (match?.[1]) {
        const decodedPath = decodeURIComponent(match[1]);
        await deleteObject(ref(storage, decodedPath));
      }
    } catch {
      // No bloquear la eliminación en Firestore si el archivo ya fue borrado de Storage
    }
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
