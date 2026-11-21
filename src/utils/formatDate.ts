export function formatFirestoreDate(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: () => Date }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof raw === 'object' && 'seconds' in raw && typeof (raw as { seconds: number }).seconds === 'number') {
    return new Date((raw as { seconds: number }).seconds * 1000).toISOString();
  }
  return '';
}
