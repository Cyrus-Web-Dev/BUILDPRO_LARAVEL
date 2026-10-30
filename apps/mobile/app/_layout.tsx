import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth';
import { colors } from '@/ui';

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    if (!user && !onLogin) router.replace('/login');
    else if (user && onLogin) router.replace('/');
  }, [user, loading, segments, router]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;
  }
  return (
    <Stack screenOptions={{ headerTintColor: colors.brand, headerTitleStyle: { color: colors.text } }}>
      <Stack.Screen name="index" options={{ title: 'Proyek Saya' }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/index" options={{ title: 'Proyek' }} />
      <Stack.Screen name="project/[id]/progress-new" options={{ title: 'Lapor Progress' }} />
      <Stack.Screen name="project/[id]/progress" options={{ title: 'Riwayat Progress' }} />
      <Stack.Screen name="project/[id]/stock" options={{ title: 'Stok Gudang' }} />
      <Stack.Screen name="project/[id]/equipment" options={{ title: 'Alat Berat' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}
