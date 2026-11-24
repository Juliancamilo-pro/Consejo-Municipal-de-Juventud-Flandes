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
    res = await fetch(url, {
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
