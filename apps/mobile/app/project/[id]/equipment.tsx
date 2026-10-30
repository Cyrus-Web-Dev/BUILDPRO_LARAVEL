import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, Text, View } from 'react-native';
import { api, ApiError } from '@/api';
import { Banner, Bar, Button, Card, colors, dateID, Field, num, s, todayISO, toNumber } from '@/ui';

interface Rental {
  id: string; name: string; code: string | null; unit: string; status: 'ACTIVE' | 'RETURNED';
  plannedQuantity: number | null; usedQuantity: number; endDate: string; daysRemaining: number;
  durationStatus: 'OK' | 'EXPIRING' | 'OVERDUE' | 'RETURNED'; usageStatus: 'OK' | 'WARNING' | 'OVER'; alerts: string[];
}
const DUR = {
  OK: { label: '', color: colors.green }, EXPIRING: { label: 'Segera berakhir', color: colors.amber },
  OVERDUE: { label: 'Masa sewa lewat', color: colors.red }, RETURNED: { label: 'Dikembalikan', color: colors.muted },
} as const;

export default function Equipment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<Rental[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<Rental | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await api<Rental[]>(`/projects/${id}/equipment`)); setError(''); }
    catch (e) { setError(e instanceof ApiError ? e.full : 'Gagal memuat data alat'); }
    finally { setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const close = () => { setTarget(null); setQty(''); setNote(''); setFormError(''); };

  async function submit() {
    if (!target) return;
    setBusy(true);
    setFormError('');
    try {
      const r = await api<{ rental: Rental }>(`/projects/${id}/equipment/${target.id}/usage`, {
        body: { date: todayISO(), quantity: toNumber(qty), note: note.trim() || undefined },
      });
      setNotice(r.rental.alerts);
      close();
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.full : 'Gagal menyimpan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.pad}
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            {error ? <Banner tone="error">{error}</Banner> : null}
            {notice.map((n) => <Banner key={n} tone="warn">{n}</Banner>)}
            <Text style={s.sub}>Ketuk alat aktif untuk mencatat jam/hari kerja hari ini.</Text>
          </View>
        }
        ListEmptyComponent={!refreshing && !error ? <Banner tone="info">Belum ada alat berat yang disewa di proyek ini.</Banner> : null}
        renderItem={({ item }) => {
          const pct = item.plannedQuantity ? (item.usedQuantity / item.plannedQuantity) * 100 : null;
          const dur = DUR[item.durationStatus];
          return (
            <Card onPress={item.status === 'ACTIVE' ? () => setTarget(item) : undefined}>
              <View style={s.row}>
                <Text style={{ fontSize: 16, fontWeight: '700', flex: 1 }}>{item.name}</Text>
                {dur.label ? <Text style={{ color: dur.color, fontWeight: '700', fontSize: 12 }}>{dur.label}</Text> : null}
              </View>
              {item.code ? <Text style={s.sub}>{item.code}</Text> : null}
              <Text style={s.sub}>
                Sewa sampai {dateID(item.endDate)}
                {item.status === 'ACTIVE' ? ` (${item.daysRemaining >= 0 ? `${item.daysRemaining} hari lagi` : `lewat ${Math.abs(item.daysRemaining)} hari`})` : ''}
              </Text>
              <Text style={{ fontWeight: '700' }}>
                Terpakai {num(item.usedQuantity)}{item.plannedQuantity ? ` / ${num(item.plannedQuantity)}` : ''} {item.unit}
              </Text>
              {pct !== null && <Bar percent={pct} color={item.usageStatus === 'OVER' ? colors.red : item.usageStatus === 'WARNING' ? colors.amber : colors.green} />}
            </Card>
          );
        }}
      />

      <Modal visible={!!target} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={s.title}>Catat kerja: {target?.name}</Text>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            <Field label={`Jumlah (${target?.unit ?? ''}) hari ini`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
            <Field label="Catatan pekerjaan (opsional)" value={note} onChangeText={setNote} placeholder="mis. Galian pondasi blok B" />
            <Button title="Simpan" onPress={submit} loading={busy} disabled={!(toNumber(qty) > 0)} />
            <Button title="Batal" variant="secondary" onPress={close} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
