import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { api, ApiError } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Bar, Button, Card, s } from '@/ui';

interface Project { id: string; code: string; name: string; location: string | null; progressPercent: number; status: string }

export default function Projects() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await api<Project[]>('/projects/overview'));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.full : 'Gagal memuat proyek');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.pad}
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            <Text style={s.sub}>Halo, {user?.name} ({user?.role})</Text>
            {error ? <Banner tone="error">{error}</Banner> : null}
          </View>
        }
        ListEmptyComponent={!refreshing && !error ? <Banner tone="info">Belum ada proyek yang ditugaskan kepada Anda. Hubungi admin.</Banner> : null}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/project/${item.id}`)}>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>{item.code}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
            <Text style={s.sub}>{item.location ?? '-'}</Text>
            <View style={s.row}><Text style={s.sub}>Progres fisik</Text><Text style={{ fontWeight: '700' }}>{item.progressPercent}%</Text></View>
            <Bar percent={item.progressPercent} />
          </Card>
        )}
        ListFooterComponent={<View style={{ marginTop: 12 }}><Button title="Keluar" variant="secondary" onPress={logout} /></View>}
      />
    </View>
  );
}
