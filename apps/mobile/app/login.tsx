import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ApiError } from '@/api';
import { useAuth } from '@/auth';
import { Banner, Button, colors, Field, s } from '@/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.full : 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.screen, { justifyContent: 'center' }]}>
      <View style={s.pad}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.brand }}>BUILDPRO</Text>
        <Text style={s.sub}>Aplikasi lapangan untuk mandor</Text>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Masuk" onPress={submit} loading={busy} disabled={!email || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}
