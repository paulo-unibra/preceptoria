const pad = (n: number) => String(n).padStart(2, '0');

/** Data local no formato AAAA-MM-DD (não usa UTC, para não virar o dia à noite). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function formatDayLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${pad(d)}/${pad(m)}/${y}`;
}

export function formatRaCode(code: number): string {
  return String(code).padStart(2, '0');
}

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

export const ROLE_LABELS: Record<string, string> = {
  preceptor: 'Preceptor(a)',
  coordenacao: 'Coordenação',
  admin: 'Administração',
};

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  full_time: 'Integral',
};
