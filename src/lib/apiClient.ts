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
  };
  if (inMemoryBearerToken) {
    headers.Authorization = `Bearer ${inMemoryBearerToken}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Partial<T> & Partial<ApiErrorPayload>;

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      data.error || 'No se pudo completar la operación.',
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
