'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID, rupiah } from '@/lib/format';
import { ProjectOverview } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, ProgressBar, StatusBadge } from '@/components/ui';
import { useUser } from '@/lib/user-context';

const STATUS_LABEL = { PLANNING: 'Perencanaan', ONGOING: 'Berjalan', DONE: 'Selesai' } as const;

export default function ProjectsPage() {
  const user = useUser();
  const { data, error, loading, reload } = useFetch<ProjectOverview[]>('/projects/overview');
  const [open, setOpen] = useState(false);
  const canWrite = user.role !== 'MANDOR';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Proyek</h1>
          <p className="text-sm text-slate-500">Ringkasan anggaran dan realisasi semua proyek</p>
        </div>
        {canWrite && <Button onClick={() => setOpen(true)}>+ Proyek Baru</Button>}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && <Loading />}
      {data && data.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada proyek.</Card>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="space-y-3 transition hover:border-brand-500">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">{p.code}</div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.location ?? '-'}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={p.status === 'ONGOING' ? 'blue' : p.status === 'DONE' ? 'green' : 'slate'}>{STATUS_LABEL[p.status]}</Badge>
                  <Badge tone={p.rabStatus === 'APPROVED' ? 'green' : 'amber'}>RAB {p.rabStatus === 'APPROVED' ? 'disetujui' : 'draft'}</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Progres fisik</span><span>{p.progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(p.progressPercent, 100)}%` }} />
                </div>
              </div>
              {p.budget !== null && p.realized !== null && p.usagePercent !== null && p.budgetStatus !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Realisasi {rupiah(p.realized)}</span>
                    <span>RAB {rupiah(p.budget)}</span>
                  </div>
                  <ProgressBar percent={p.usagePercent} status={p.budgetStatus} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{p.usagePercent}% biaya terpakai</span>
                    {p.budget > 0 && <StatusBadge status={p.budgetStatus} />}
                  </div>
                  {p.budget > 0 && p.usagePercent - p.progressPercent > 15 && (
                    <div className="text-xs text-amber-700">Biaya terpakai jauh di atas progres fisik</div>
                  )}
                </div>
              )}
              <div className="text-xs text-slate-400">{dateID(p.startDate)} – {dateID(p.endDate)}</div>
            </Card>
          </Link>
        ))}
      </div>

      {open && <CreateProject onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </div>
  );
}

function CreateProject({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name: '', location: '', clientName: '', startDate: '', endDate: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    try {
      await api('/projects', { method: 'POST', body });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal menyimpan');
      setBusy(false);
    }
  }

  return (
    <Modal title="Proyek Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kode"><Input required value={f.code} onChange={set('code')} placeholder="PRJ-002" /></Field>
          <div className="col-span-2"><Field label="Nama proyek"><Input required value={f.name} onChange={set('name')} /></Field></div>
        </div>
        <Field label="Lokasi"><Input value={f.location} onChange={set('location')} /></Field>
        <Field label="Pemilik / klien"><Input value={f.clientName} onChange={set('clientName')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Target selesai"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
