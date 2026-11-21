export function toFriendlySpanishError(
  error: unknown,
  fallback = 'Ocurrió un inconveniente al completar la operación. Intenta de nuevo.',
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!raw.trim()) return fallback;

  // Si el error viene serializado como JSON interno de Firestore, extraer el mensaje base
  let extracted = raw.trim();
  if (extracted.startsWith('{') && extracted.endsWith('}')) {
    try {
      const parsed = JSON.parse(extracted) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        extracted = parsed.error.trim();
      }
    } catch {
      // mantener cadena original
    }
  }

  const lower = extracted.toLowerCase();

  if (
    lower.includes('insufficient permissions') ||
    lower.includes('permission-denied') ||
    lower.includes('permission denied')
  ) {
    return 'No cuentas con permisos suficientes para consultar o modificar este recurso.';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('unavailable') ||
    lower.includes('offline')
  ) {
    return 'No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.';
  }

  if (lower.includes('deadline-exceeded') || lower.includes('timeout')) {
    return 'La consulta tardó demasiado en responder. Intenta de nuevo en unos segundos.';
  }

  if (lower.includes('unauthenticated') || lower.includes('id-token-expired')) {
    return 'Tu sesión venció. Inicia sesión nuevamente para continuar.';
  }

  if (lower.includes('quota-exceeded') || lower.includes('resource-exhausted')) {
    return 'Se alcanzó temporalmente la capacidad de consultas del servicio. Intenta en unos minutos.';
  }

  // Evitar mostrar trazas técnicas o códigos crudos de Firebase
  if (lower.includes('firebaseerror') || lower.includes('stack') || extracted.length > 260) {
    return fallback;
  }

  return extracted;
}
