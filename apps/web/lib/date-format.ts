/**
 * Safe date and time formatting utilities.
 * Guarantees no "Invalid Date" strings are rendered in the UI.
 */

export function formatSafeTime(rawDate: unknown, fallback = ''): string {
  if (rawDate === null || rawDate === undefined || rawDate === '') return fallback;
  const d = new Date(rawDate as string | number | Date);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatSafeDate(rawDate: unknown, fallback = ''): string {
  if (rawDate === null || rawDate === undefined || rawDate === '') return fallback;
  const d = new Date(rawDate as string | number | Date);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSafeDateTime(rawDate: unknown, fallback = ''): string {
  if (rawDate === null || rawDate === undefined || rawDate === '') return fallback;
  const d = new Date(rawDate as string | number | Date);
  if (isNaN(d.getTime())) return fallback;
  return `${formatSafeDate(d, fallback)} ${formatSafeTime(d, fallback)}`.trim();
}
