import type { AccessTier, RoleLabel } from '../types/cmj';

// Token almacenado únicamente en memoria de la aplicación (nunca en localStorage ni sessionStorage)
let inMemoryBearerToken: string | null = null;
const stateRefreshListeners = new Set<() => void>();

export function setAuthTokenInMemory(token: string | null) {
  inMemoryBearerToken = token;
}

export function clearAuthTokenInMemory() {
  inMemoryBearerToken = null;
}

export function subscribePortalRefresh(listener: () => void): () => void {
  stateRefreshListeners.add(listener);
  return () => {
    stateRefreshListeners.delete(listener);
  };
}

export function triggerPortalRefresh() {
  stateRefreshListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export interface ApiErrorPayload {
  error: string;
  hint?: string;
  code?: string;
}

export class ApiRequestError extends Error {
  status: number;
  hint?: string;
  code?: string;

  constructor(status: number, message: string, hint?: string, code?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
    this.code = code;
  }
}

const AUTH_SYNC_CHANNEL = 'cmj_auth_sync_v1';

export function getApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  const raw = (env.VITE_API_URL || env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw || raw === '/' || raw === 'MY_API_URL' || raw === 'MY_APP_URL') {
    return '';
  }
  if (!raw.startsWith('https://') && !raw.startsWith('http://')) {
    return '';
  }
  return raw.replace(/\/+$/, '');
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('http://')) {
    return pathOrUrl;
  }
  const base = getApiBaseUrl();
  if (!base) return pathOrUrl;
  return pathOrUrl.startsWith('/') ? `${base}${pathOrUrl}` : `${base}/${pathOrUrl}`;
}

export function notifyAuthSync(event: 'login' | 'logout'): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.postMessage({ type: event, ts: Date.now() });
      channel.close();
    }
  } catch {
    // ignore BroadcastChannel failures
  }
  try {
    localStorage.setItem(AUTH_SYNC_CHANNEL, JSON.stringify({ type: event, ts: Date.now() }));
  } catch {
    // ignore storage access errors in private browsing
  }
}

export function subscribeAuthSync(handler: (event: 'login' | 'logout') => void): () => void {
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.onmessage = (e) => {
        const type = e?.data?.type;
        if (type === 'login' || type === 'logout') handler(type);
      };
    }
  } catch {
    channel = null;
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== AUTH_SYNC_CHANNEL || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { type?: string };
      if (parsed.type === 'login' || parsed.type === 'logout') {
        handler(parsed.type);
      }
    } catch {
      // ignore malformed storage sync event
    }
  };

  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    try {
      channel?.close();
    } catch {
      // ignore
    }
  };
}

function getWindowContextHeader(): 'iframe' | 'top' {
  try {
    return window.self !== window.top ? 'iframe' : 'top';
  } catch {
    return 'iframe';
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    skipRefresh?: boolean;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const targetUrl = resolveApiUrl(url);
  const headers: Record<string, string> = {
    'X-Requested-With': 'CMJ-Flandes',
    'X-CMJ-Context': getWindowContextHeader(),
  };
  if (inMemoryBearerToken) {
    headers.Authorization = `Bearer ${inMemoryBearerToken}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiRequestError(
      0,
      'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.',
      'Si estás usando una red móvil o Wi-Fi inestable, recarga la página y vuelve a intentar.',
      'NETWORK_ERROR'
    );
  }

  if (res.status === 413) {
    throw new ApiRequestError(
      413,
      'El archivo o solicitud supera el límite permitido de 4.5 MB en Vercel.',
      'Reduce el tamaño o resolución del archivo antes de subirlo, o usa un enlace externo.',
      'PAYLOAD_TOO_LARGE'
    );
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text().catch(() => '');
  let data: Partial<T> & Partial<ApiErrorPayload> = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText) as Partial<T> & Partial<ApiErrorPayload>;
    } catch {
      const looksLikeHtml =
        contentType.includes('text/html') || rawText.trimStart().startsWith('<');
      if (looksLikeHtml || !res.ok) {
        throw new ApiRequestError(
          res.status || 502,
          'El servidor /api no respondió en formato JSON en este despliegue.',
          'Verifica en Vercel que la función serverless /api/index esté activa y que las variables de base de datos estén configuradas.',
          'NON_JSON_API_RESPONSE'
        );
      }
    }
  } else if (!res.ok && !contentType.includes('json')) {
    throw new ApiRequestError(
      res.status || 502,
      `El servidor respondió con error HTTP ${res.status}.`,
      'Verifica que la función /api y la base de datos PostgreSQL estén disponibles.',
      'EMPTY_ERROR_RESPONSE'
    );
  }

  if (!res.ok) {
    const fallbackMessage =
      res.status >= 500
        ? `Error del servidor (${res.status}). Verifica la conexión con la base de datos.`
        : `No se pudo completar la operación (código ${res.status}).`;
    throw new ApiRequestError(
      res.status,
      data.error || fallbackMessage,
      data.hint,
      data.code
    );
  }

  if (method !== 'GET' && !options.skipRefresh) {
    triggerPortalRefresh();
  }

  return data as T;
}

export interface SessionUser {
  uid: string;
  email: string;
  accessTier: AccessTier;
  roleLabel: RoleLabel;
  commissionId: string;
  phone: string;
  active: boolean;
  mustChangePassword: boolean;
  fullName: string;
}
