import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export const colors = {
  brand: '#ea580c', bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0',
  text: '#1e293b', muted: '#64748b', green: '#16a34a', amber: '#d97706', red: '#dc2626', blue: '#2563eb',
};

export function Button({ title, onPress, disabled, variant = 'primary', loading }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger';
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && { backgroundColor: colors.brand },
        variant === 'secondary' && { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { backgroundColor: colors.red },
        (off || pressed) && { opacity: off ? 0.5 : 0.8 },
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? colors.text : '#fff'} /> : (
        <Text style={[s.btnText, variant === 'secondary' && { color: colors.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#94a3b8" {...p} style={[s.input, p.multiline && { height: 90, textAlignVertical: 'top' }, p.style]} />
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const body = <View style={s.card}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Banner({ tone, children }: { tone: 'error' | 'warn' | 'info'; children: ReactNode }) {
  const c = tone === 'error' ? { bg: '#fef2f2', fg: '#991b1b', bd: '#fecaca' } : tone === 'warn' ? { bg: '#fffbeb', fg: '#92400e', bd: '#fde68a' } : { bg: '#eff6ff', fg: '#1e40af', bd: '#bfdbfe' };
  return (
    <View style={{ backgroundColor: c.bg, borderColor: c.bd, borderWidth: 1, borderRadius: 8, padding: 10 }}>
      <Text style={{ color: c.fg, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export function Bar({ percent, color = colors.blue }: { percent: number; color?: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
      <View style={{ height: 8, width: `${Math.min(Math.max(percent, 0), 100)}%`, backgroundColor: color }} />
    </View>
  );
}

export const dateID = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export const num = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(n);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});

/** Keyboard Indonesia menghasilkan koma desimal ("45,5"); ubah ke angka. NaN bila tidak valid. */
export const toNumber = (t: string) => Number(t.trim().replace(',', '.'));

/** Tanggal hari ini (zona waktu perangkat) YYYY-MM-DD. */
export const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
