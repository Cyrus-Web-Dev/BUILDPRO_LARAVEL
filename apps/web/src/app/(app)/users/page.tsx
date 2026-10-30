'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { User } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Select } from '@/components/ui';
import { useUser } from '@/lib/user-context';

export default function UsersPage() {
  const me = useUser();
  const { data, error, loading, reload } = useFetch<User[]>(me.role === 'MANDOR' ? null : '/auth/users');
  const [open, setOpen] = useState(false);

  if (me.role === 'MANDOR') return <ErrorBox>Anda tidak punya akses ke halaman ini.</ErrorBox>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pengguna</h1>
          <p className="text-sm text-slate-500">Kelola akun admin dan mandor perusahaan</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Pengguna Baru</Button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && <Loading />}
      {data && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Role</th></tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3"><Badge tone={u.role === 'OWNER' ? 'amber' : u.role === 'ADMIN' ? 'blue' : 'slate'}>{u.role}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {open && <CreateUser isOwner={me.role === 'OWNER'} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </div>
  );
}

function CreateUser({ isOwner, onClose, onDone }: { isOwner: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'MANDOR' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/users', { method: 'POST', body: f });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal menyimpan');
      setBusy(false);
    }
  }

  return (
    <Modal title="Pengguna Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Nama"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="Minimal 8 karakter"><Input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="MANDOR">Mandor</option>
            <option value="ADMIN">Admin</option>
            {isOwner && <option value="OWNER">Owner</option>}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
