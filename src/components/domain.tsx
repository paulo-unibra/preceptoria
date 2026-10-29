import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, soft, useToneColor } from '@/components/ui/kit';
import { API_BASE, authHeaders } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatRaCode } from '@/lib/format';
import type { Occurrence, RaCode } from '@/lib/types';

/** Preceptor e administração lançam registros; a coordenação só consulta (PDF, seção 4). */
export function useCanWrite() {
  const { user } = useAuth();
  return user?.role === 'preceptor' || user?.role === 'admin';
}

export function useIsStaff() {
  const { user } = useAuth();
  return user?.role === 'admin' || user?.role === 'coordenacao';
}

/** RF-08 — a interface diferencia claramente RAs positivos (verde) e negativos (vermelho). */
export function RaBadge({ code, polarity }: { code: number; polarity: 'positive' | 'negative' }) {
  const tone = polarity === 'positive' ? 'positive' : 'negative';
  return <Badge label={`RA ${formatRaCode(code)} · ${polarity === 'positive' ? 'Positivo' : 'Negativo'}`} tone={tone} />;
}

/** Sinalizações de conferência: divergência (RN03), duplicidade (RN08) e cancelamento. */
export function OccurrenceFlags({ occurrence }: { occurrence: Occurrence }) {
  return (
    <View style={styles.flags}>
      {occurrence.status === 'cancelled' ? <Badge label="Cancelado" tone="neutral" /> : null}
      {occurrence.polarity_divergent ? <Badge label="Divergência: conferir" tone="warning" /> : null}
      {occurrence.possible_duplicate_of_id && occurrence.status === 'active' ? <Badge label="Possível duplicidade" tone="warning" /> : null}
    </View>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

export function StudentAvatar({ id, name, hasPhoto, size = 44 }: { id: number; name: string; hasPhoto?: boolean; size?: number }) {
  const color = useToneColor('info');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: soft(color, '30') }]}>
      {hasPhoto ? (
        <Image
          source={{ uri: `${API_BASE}/students/${id}/photo`, headers: authHeaders() }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          accessibilityLabel={`Foto de ${name}`}
        />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {initials(name)}
        </ThemedText>
      )}
    </View>
  );
}

/** Painel de uma polaridade da legenda: título em destaque e a lista de códigos em duas colunas. */
function RaLegendPanel({ title, tone, items, selected, onSelect }: { title: string; tone: 'positive' | 'negative'; items: RaCode[]; selected: number | null; onSelect: (code: number) => void }) {
  const color = useToneColor(tone);
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];
  return (
    <View style={[styles.legendPanel, { backgroundColor: soft(color, '14'), borderColor: soft(color, '88') }]}>
      <ThemedText type="smallBold" style={[styles.legendTitle, { color }]}>
        {title}
      </ThemedText>
      <View style={styles.legendColumns}>
        {columns.map((col, i) => (
          <View key={i} style={styles.legendColumn}>
            {col.map((c) => {
              const active = c.code === selected;
              return (
                <Pressable
                  key={c.code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`RA ${formatRaCode(c.code)}: ${c.description ?? 'sem descrição'}`}
                  onPress={() => onSelect(c.code)}
                  style={[styles.legendItem, active && { backgroundColor: soft(color, '30') }]}>
                  <ThemedText type="smallBold" style={[styles.legendCode, { color }]}>
                    {formatRaCode(c.code)}
                  </ThemedText>
                  <ThemedText type={active ? 'smallBold' : 'small'} style={styles.legendName}>
                    {c.description ?? '—'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Legenda dos códigos de RA (nome de cada código), em dois painéis: positivo e negativo. Tocar num item seleciona o código. */
export function RaLegend({ codes, selected, onSelect }: { codes: RaCode[]; selected: number | null; onSelect: (code: number) => void }) {
  return (
    <View style={styles.legend}>
      <RaLegendPanel title="RA — POSITIVO" tone="positive" items={codes.filter((c) => c.polarity === 'positive')} selected={selected} onSelect={onSelect} />
      <RaLegendPanel title="RA — NEGATIVO" tone="negative" items={codes.filter((c) => c.polarity === 'negative')} selected={selected} onSelect={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { gap: 12 },
  legendPanel: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 10 },
  legendTitle: { letterSpacing: 1.4 },
  legendColumns: { flexDirection: 'row', gap: 10 },
  legendColumn: { flex: 1, gap: 2 },
  legendItem: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
  legendCode: { minWidth: 22 },
  legendName: { flex: 1 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
