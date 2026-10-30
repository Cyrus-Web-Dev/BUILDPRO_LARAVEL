'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID } from '@/lib/format';
import { Project, Summary } from '@/lib/types';
import { Badge, Button, ErrorBox, Field, Input, Loading, Modal } from '@/components/ui';
import { SummaryTab } from '@/components/project/SummaryTab';
import { RabTab } from '@/components/project/RabTab';
import { RealizationTab } from '@/components/project/RealizationTab';
import { StockTab } from '@/components/project/StockTab';
import { ProgressTab } from '@/components/project/ProgressTab';
import { TeamTab } from '@/components/project/TeamTab';
import { EquipmentTab } from '@/components/project/EquipmentTab';
import { OpnameTab } from '@/components/project/OpnameTab';
import { useUser } from '@/lib/user-context';

const ALL_TABS = [
  { key: 'summary', label: 'RAB vs Realisasi', staffOnly: true },
  { key: 'rab', label: 'Item RAB', staffOnly: true },
  { key: 'realization', label: 'Realisasi Biaya', staffOnly: true },
  { key: 'stock', label: 'Stok Gudang', staffOnly: false },
  { key: 'progress', label: 'Progress Lapangan', staffOnly: false },
  { key: 'equipment', label: 'Sewa Alat', staffOnly: false },
  { key: 'opname', label: 'Opname Mandor', staffOnly: true },
  { key: 'team', label: 'Tim', staffOnly: true },
] as const;
type TabKey = (typeof ALL_TABS)[number]['key'];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const canWrite = user.role !== 'MANDOR';
  const tabs = ALL_TABS.filter((t) => canWrite || !t.staffOnly);
  const [tab, setTab] = useState<TabKey>(canWrite ? 'summary' : 'progress');
  const [editing, setEditing] = useState(false);
  const project = useFetch<Project>(`/projects/${id}`);
  const summary = useFetch<Summary>(canWrite ? `/projects/${id}/rab-summary` : null);

  const refreshAll = () => { project.reload(); summary.reload(); };

  if (project.loading && !project.data) return <Loading />;
  if (project.error) return <ErrorBox>{project.error}</ErrorBox>;
  const p = project.data!;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/projects" className="text-sm text-slate-500 hover:text-brand-600">← Semua proyek</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs text-slate-400">{p.code}</div>
            <h1 className="text-xl font-bold">{p.name}</h1>
            <div className="text-sm text-slate-500">
              {p.location ?? '-'} · Klien: {p.clientName ?? '-'} · {dateID(p.startDate)} – {dateID(p.endDate)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canWrite && <Badge tone={p.rabStatus === 'APPROVED' ? 'green' : 'amber'}>RAB {p.rabStatus === 'APPROVED' ? 'disetujui' : 'draft'}</Badge>}
            {canWrite && <Button variant="secondary" onClick={() => setEditing(true)}>Ubah</Button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx('-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm', tab === t.key ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab summary={summary.data} loading={summary.loading} error={summary.error} />}
      {tab === 'rab' && <RabTab project={p} canWrite={canWrite} isOwner={user.role === 'OWNER'} onChanged={refreshAll} />}
      {tab === 'realization' && <RealizationTab project={p} canWrite={canWrite} onChanged={refreshAll} />}
      {tab === 'stock' && <StockTab project={p} isAdmin={canWrite} onChanged={refreshAll} />}
      {tab === 'progress' && <ProgressTab project={p} isAdmin={canWrite} onChanged={refreshAll} />}
      {tab === 'equipment' && <EquipmentTab project={p} isAdmin={canWrite} onChanged={refreshAll} />}
      {tab === 'opname' && canWrite && <OpnameTab project={p} isOwner={user.role === 'OWNER'} onChanged={refreshAll} />}
      {tab === 'team' && canWrite && <TeamTab project={p} />}

      {editing && <EditProject project={p} onClose={() => setEditing(false)} onDone={() => { setEditing(false); refreshAll(); }} />}
    </div>
  );
}

function EditProject({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: () => void }) {
  const d = (s: string | null) => (s ? s.slice(0, 10) : '');
  const [f, setF] = useState({
    name: project.name, location: project.location ?? '', clientName: project.clientName ?? '',
    startDate: d(project.startDate), endDate: d(project.endDate),
  });
  const [status, setStatus] = useState(project.status);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    try {
      await api(`/projects/${project.id}`, { method: 'PATCH', body });
      if (status !== project.status) await api(`/projects/${project.id}/status`, { method: 'PATCH', body: { status } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal menyimpan');
      setBusy(false);
    }
  }

  return (
    <Modal title="Ubah Proyek" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Nama proyek"><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Lokasi"><Input value={f.location} onChange={set('location')} /></Field>
        <Field label="Pemilik / klien"><Input value={f.clientName} onChange={set('clientName')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Target selesai"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        </div>
        <Field label="Status proyek">
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
            <option value="PLANNING">Perencanaan</option>
            <option value="ONGOING">Berjalan</option>
            <option value="DONE">Selesai</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
