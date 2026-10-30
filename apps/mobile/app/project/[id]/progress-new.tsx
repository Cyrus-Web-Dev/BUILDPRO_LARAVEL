import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { api, ApiError } from '@/api';
import { Banner, Button, colors, Field, s, toNumber } from '@/ui';

const MAX_PHOTOS = 5;
interface Fix { latitude: number; longitude: number; accuracy: number | null; at: number }

export default function NewProgress() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [percent, setPercent] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locError, setLocError] = useState('');
  const [locBusy, setLocBusy] = useState(false);
  const [last, setLast] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lockLocation = useCallback(async () => {
    setLocBusy(true);
    setLocError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Izin lokasi ditolak. Aktifkan di pengaturan ponsel.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if ((pos as { mocked?: boolean }).mocked) throw new Error('Lokasi palsu (mock location) terdeteksi. Matikan aplikasi pemalsu lokasi.');
      setFix({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp });
    } catch (e) {
      setFix(null);
      setLocError(e instanceof Error ? e.message : 'Gagal mengambil lokasi');
    } finally {
      setLocBusy(false);
    }
  }, []);

  useEffect(() => {
    lockLocation();
    api<{ percent: number; status: string }[]>(`/projects/${id}/progress`)
      .then((r) => setLast(r.find((x) => x.status !== 'REJECTED')?.percent ?? null))
      .catch(() => undefined);
  }, [id, lockLocation]);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Izin kamera', 'Aktifkan izin kamera di pengaturan ponsel.');
    // quality 0.6 = kompresi JPEG langsung di ponsel sebelum diunggah
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets[0]) setPhotos((p) => [...p, res.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  const pct = toNumber(percent);
  const percentOk = percent !== '' && pct >= 0 && pct <= 100 && (last === null || pct >= last);
  const ready = percentOk && photos.length > 0 && !!fix;

  async function submit() {
    if (!fix) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('percent', String(pct));
    if (notes.trim()) form.append('notes', notes.trim());
    form.append('latitude', String(fix.latitude));
    form.append('longitude', String(fix.longitude));
    if (fix.accuracy !== null) form.append('accuracy', String(fix.accuracy));
    form.append('capturedAt', new Date(fix.at).toISOString());
    photos.forEach((uri, i) => form.append('photos', { uri, name: `foto-${i + 1}.jpg`, type: 'image/jpeg' } as unknown as Blob));
    try {
      await api(`/projects/${id}/progress`, { form, timeoutMs: 120000 });
      Alert.alert('Terkirim', 'Laporan progress berhasil dikirim.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.full : 'Gagal mengirim laporan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Field
        label={`Progres keseluruhan proyek (%)${last !== null ? ` · laporan terakhir ${last}%` : ''}`}
        value={percent} onChangeText={setPercent} keyboardType="decimal-pad" placeholder="mis. 45"
      />
      {percent !== '' && !percentOk ? (
        <Banner tone="warn">{pct > 100 || pct < 0 ? 'Isi angka 0 sampai 100.' : `Tidak boleh lebih kecil dari laporan terakhir (${last}%).`}</Banner>
      ) : null}

      <Field label="Catatan pekerjaan hari ini" value={notes} onChangeText={setNotes} multiline placeholder="mis. Pengecoran lantai 2 selesai" />

      <View style={{ gap: 8 }}>
        <Text style={s.label}>Foto kondisi lapangan (wajib, maks {MAX_PHOTOS})</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {photos.map((uri, i) => (
            <Pressable key={uri} onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
              <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 8 }} />
              <Text style={{ position: 'absolute', right: 4, top: 2, color: '#fff', fontWeight: '800' }}>✕</Text>
            </Pressable>
          ))}
        </ScrollView>
        {photos.length > 0 && <Text style={s.sub}>Ketuk foto untuk menghapus.</Text>}
        <Button title={photos.length ? '+ Tambah foto' : '📷 Ambil foto'} variant="secondary" onPress={takePhoto} disabled={photos.length >= MAX_PHOTOS} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.label}>Lokasi GPS</Text>
        {fix ? (
          <Banner tone="info">
            📍 {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}{fix.accuracy ? ` (akurasi ±${Math.round(fix.accuracy)} m)` : ''}
          </Banner>
        ) : (
          <Banner tone={locError ? 'error' : 'warn'}>{locError || 'Mengambil lokasi…'}</Banner>
        )}
        <Button title="Perbarui lokasi" variant="secondary" onPress={lockLocation} loading={locBusy} />
      </View>

      <Button title="Kirim Laporan" onPress={submit} loading={busy} disabled={!ready} />
      {!ready && <Text style={[s.sub, { color: colors.muted }]}>Syarat kirim: persentase valid, minimal 1 foto, dan lokasi GPS terkunci.</Text>}
    </ScrollView>
  );
}
