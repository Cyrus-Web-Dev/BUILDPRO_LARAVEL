import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, Text, View } from 'react-native';
import { api, ApiError } from '@/api';
import { Banner, Button, Card, colors, Field, num, s, toNumber } from '@/ui';

interface Item { id: string; name: string; unit: string; minStock: number; currentQty: number; status: 'OK' | 'LOW' | 'EMPTY' }
const COLOR = { OK: colors.green, LOW: colors.amber, EMPTY: colors.red } as const;
const LABEL = { OK: 'Aman', LOW: 'Menipis', EMPTY: 'Habis' } as const;

export default function Stock() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<Item | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await api<Item[]>(`/projects/${id}/stock/items`)); setError(''); }
    catch (e) { setError(e instanceof ApiError ? e.full : 'Gagal memuat stok'); }
    finally { setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const close = () => { setTarget(null); setQty(''); setNote(''); setFormError(''); };

  async function submit() {
    if (!target) return;
    setBusy(true);
    setFormError('');
    try {
      const r = await api<{ alert: { message: string } | null }>(`/projects/${id}/stock/out`, {
        body: { stockItemId: target.id, quantity: toNumber(qty), date: new Date().toISOString(), note: note.trim() || undefined },
      });
      setNotice(r.alert?.message ?? '');
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
            {notice ? <Banner tone="warn">{notice}</Banner> : null}
            <Text style={s.sub}>Ketuk material untuk mencatat pemakaian.</Text>
          </View>
        }
        ListEmptyComponent={!refreshing && !error ? <Banner tone="info">Belum ada material di gudang proyek ini.</Banner> : null}
        renderItem={({ item }) => (
          <Card onPress={() => setTarget(item)}>
            <View style={s.row}>
              <Text style={{ fontSize: 16, fontWeight: '700', flex: 1 }}>{item.name}</Text>
              <Text style={{ color: COLOR[item.status], fontWeight: '700', fontSize: 12 }}>{LABEL[item.status]}</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>{num(item.currentQty)} <Text style={s.sub}>{item.unit}</Text></Text>
            {item.minStock > 0 && <Text style={s.sub}>Batas minimum: {num(item.minStock)} {item.unit}</Text>}
          </Card>
        )}
      />

      <Modal visible={!!target} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={s.title}>Pakai: {target?.name}</Text>
            <Text style={s.sub}>Stok tersedia: {target ? `${num(target.currentQty)} ${target.unit}` : ''}</Text>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            <Field label={`Jumlah dipakai (${target?.unit ?? ''})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
            <Field label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="mis. Cor lantai 2" />
            <Button title="Simpan Pemakaian" onPress={submit} loading={busy} disabled={!(toNumber(qty) > 0)} />
            <Button title="Batal" variant="secondary" onPress={close} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
