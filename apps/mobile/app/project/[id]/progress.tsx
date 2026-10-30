import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, ApiError, photoUrl } from '@/api';
import { Banner, Card, colors, dateID, s } from '@/ui';

interface Report {
  id: string; reportDate: string; percent: number; notes: string | null; status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  reviewComment: string | null; photos: { id: string; url: string }[];
}
const STATUS = {
  SUBMITTED: { label: 'Menunggu verifikasi', color: colors.amber },
  VERIFIED: { label: 'Terverifikasi', color: colors.green },
  REJECTED: { label: 'Ditolak', color: colors.red },
} as const;

export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await api<Report[]>(`/projects/${id}/progress`)); setError(''); }
    catch (e) { setError(e instanceof ApiError ? e.full : 'Gagal memuat'); }
    finally { setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.pad}
      data={items}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={error ? <Banner tone="error">{error}</Banner> : null}
      ListEmptyComponent={!refreshing && !error ? <Banner tone="info">Belum ada laporan.</Banner> : null}
      renderItem={({ item: r }) => (
        <Card>
          <View style={s.row}>
            <Text style={{ fontSize: 20, fontWeight: '800' }}>{r.percent}%</Text>
            <Text style={{ color: STATUS[r.status].color, fontWeight: '600', fontSize: 12 }}>{STATUS[r.status].label}</Text>
          </View>
          <Text style={s.sub}>{dateID(r.reportDate)}</Text>
          {r.notes ? <Text>{r.notes}</Text> : null}
          {r.reviewComment ? <Text style={s.sub}>Catatan reviewer: {r.reviewComment}</Text> : null}
          <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
            {r.photos.map((p) => <Image key={p.id} source={{ uri: photoUrl(p.url) }} style={{ width: 80, height: 80, borderRadius: 8 }} />)}
          </ScrollView>
        </Card>
      )}
    />
  );
}
