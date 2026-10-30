'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { Project, ProjectMemberUser, User } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Loading, Select } from '@/components/ui';

export function TeamTab({ project }: { project: Project }) {
  const members = useFetch<ProjectMemberUser[]>(`/projects/${project.id}/members`);
  const users = useFetch<User[]>('/auth/users');
  const [pick, setPick] = useState('');
  const [msg, setMsg] = useState('');

  const memberIds = new Set((members.data ?? []).map((m) => m.id));
  const candidates = (users.data ?? []).filter((u) => u.role === 'MANDOR' && !memberIds.has(u.id));

  async function act(fn: () => Promise<unknown>) {
    setMsg('');
    try { await fn(); members.reload(); setPick(''); } catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal'); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Mandor hanya bisa melihat dan melapor pada proyek yang ditugaskan kepadanya.</p>
      {(msg || members.error) && <ErrorBox>{msg || members.error}</ErrorBox>}
      <div className="flex gap-2">
        <Select value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-xs">
          <option value="">Pilih mandor…</option>
          {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </Select>
        <Button disabled={!pick} onClick={() => act(() => api(`/projects/${project.id}/members`, { method: 'POST', body: { userId: pick } }))}>Tugaskan</Button>
      </div>
      {members.loading && !members.data && <Loading />}
      {members.data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada mandor yang ditugaskan. Buat akun mandor di menu Pengguna.</Card>}
      {members.data && members.data.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3 text-sm">
                <div><span className="font-medium">{m.name}</span> <span className="text-slate-500">{m.email}</span></div>
                <div className="flex items-center gap-2">
                  <Badge>{m.role}</Badge>
                  <Button variant="ghost" className="text-red-600" onClick={() => act(() => api(`/projects/${project.id}/members/${m.id}`, { method: 'DELETE' }))}>Cabut</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
