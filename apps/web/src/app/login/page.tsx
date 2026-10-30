'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError, saveSession } from '@/lib/api';
import { User } from '@/lib/types';
import { Button, Card, ErrorBox, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      saveSession(r.accessToken, r.user);
      router.push('/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold text-brand-600">BUILDPRO</h1>
          <p className="text-sm text-slate-500">Masuk ke akun perusahaan Anda</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {error && <ErrorBox>{error}</ErrorBox>}
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Masuk'}</Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          Belum punya akun? <Link href="/register" className="text-brand-600 hover:underline">Daftarkan perusahaan</Link>
        </p>
      </Card>
    </main>
  );
}
