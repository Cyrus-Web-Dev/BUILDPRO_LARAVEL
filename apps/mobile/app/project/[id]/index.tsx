import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { api } from '@/api';
import { Button, s } from '@/ui';

export default function ProjectMenu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<{ code: string; name: string; location: string | null } | null>(null);

  useEffect(() => { api<typeof project>(`/projects/${id}`).then(setProject).catch(() => undefined); }, [id]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={{ fontSize: 12, color: '#94a3b8' }}>{project?.code}</Text>
      <Text style={s.title}>{project?.name ?? 'Memuat…'}</Text>
      <Text style={s.sub}>{project?.location ?? ''}</Text>
      <Button title="📷  Lapor Progress Hari Ini" onPress={() => router.push(`/project/${id}/progress-new`)} />
      <Button title="📦  Stok Gudang & Pemakaian Material" variant="secondary" onPress={() => router.push(`/project/${id}/stock`)} />
      <Button title="🚜  Alat Berat: Catat Jam Kerja" variant="secondary" onPress={() => router.push(`/project/${id}/equipment`)} />
      <Button title="🕘  Riwayat Laporan Progress" variant="secondary" onPress={() => router.push(`/project/${id}/progress`)} />
    </ScrollView>
  );
}
