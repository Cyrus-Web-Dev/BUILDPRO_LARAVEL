'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError, saveSession } from '@/lib/api';
import { User } from '@/lib/types';
import { Button, Card, ErrorBox, Field, Input } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ companyName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ accessToken: string; user: User }>('/auth/register-company', { method: 'POST', body: f });
      saveSession(r.accessToken, r.user);
      router.push('/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal mendaftar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold text-brand-600">Daftarkan Perusahaan</h1>
          <p className="text-sm text-slate-500">Anda akan menjadi Owner perusahaan ini</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {error && <ErrorBox>{error}</ErrorBox>}
          <Field label="Nama perusahaan"><Input required value={f.companyName} onChange={set('companyName')} /></Field>
          <Field label="Nama Anda"><Input required value={f.name} onChange={set('name')} /></Field>
          <Field label="Email"><Input type="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="Minimal 8 karakter"><Input type="password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Daftar'}</Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          Sudah punya akun? <Link href="/login" className="text-brand-600 hover:underline">Masuk</Link>
        </p>
      </Card>
    </main>
  );
}
