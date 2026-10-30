'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { CATEGORY_LABEL, dateID, rupiah, todayISO } from '@/lib/format';
import { CreateRealizationResult, Project, RabItem, Realization } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Select } from '@/components/ui';

interface Props { project: Project; canWrite: boolean; onChanged: () => void }

const SOURCE_LABEL = { MANUAL: 'Manual', STOK: 'Stok', SEWA_ALAT: 'Sewa alat', OPNAME: 'Opname' } as const;

export function RealizationTab({ project, canWrite, onChanged }: Props) {
  const [filter, setFilter] = useState('');
  const path = `/projects/${project.id}/realizations${filter ? `?rabItemId=${filter}` : ''}`;
  const list = useFetch<Realization[]>(path);
  const items = useFetch<RabItem[]>(`/projects/${project.id}/rab-items`);
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<{ level: string; message: string } | null>(null);
  const [msg, setMsg] = useState('');
  const approved = project.rabStatus === 'APPROVED';
  const total = (list.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const changed = () => { list.reload(); onChanged(); };

  async function remove(r: Realization) {
    if (!confirm('Hapus catatan biaya ini?')) return;
    setMsg('');
    try { await api(`/projects/${project.id}/realizations/${r.id}`, { method: 'DELETE' }); changed(); }
    catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal menghapus'); }
  }

  return (
    <div className="space-y-4">
      {!approved && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Realisasi biaya baru bisa dicatat setelah RAB disetujui Owner (tab “Item RAB”).
        </div>
      )}

      {alert && (
        <div className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm ${alert.level === 'OVER' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          <span><b>{alert.level === 'OVER' ? 'Melebihi anggaran! ' : 'Waspada! '}</b>{alert.message}</span>
          <button onClick={() => setAlert(null)} aria-label="Tutup">✕</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-64">
            <option value="">Semua item RAB</option>
            {items.data?.map((i) => <option key={i.id} value={i.id}>{i.code} – {i.name}</option>)}
          </Select>
          <span className="text-sm text-slate-600">Total: <b>{rupiah(total)}</b></span>
        </div>
        {canWrite && approved && <Button onClick={() => setOpen(true)}>+ Catat Biaya</Button>}
      </div>

      {(msg || list.error) && <ErrorBox>{msg || list.error}</ErrorBox>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada realisasi biaya.</Card>}

      {list.data && list.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">Tanggal</th><th className="p-3">Item RAB</th><th className="p-3">Keterangan</th>
                <th className="p-3">Vendor</th><th className="p-3">Sumber</th><th className="p-3 text-right">Jumlah</th>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{dateID(r.date)}</td>
                  <td className="p-3"><div className="font-medium">{r.rabItem.code} – {r.rabItem.name}</div><div className="text-xs text-slate-400">{CATEGORY_LABEL[r.rabItem.category]}</div></td>
                  <td className="p-3">
                    {r.description}
                    {r.receiptUrl && <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand-600 hover:underline">nota</a>}
                  </td>
                  <td className="p-3">{r.vendor ?? '-'}</td>
                  <td className="p-3"><Badge tone={r.source === 'MANUAL' ? 'slate' : 'blue'}>{SOURCE_LABEL[r.source]}</Badge></td>
                  <td className="p-3 text-right font-medium">{rupiah(r.amount)}</td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      {r.source === 'MANUAL' && <Button variant="ghost" className="text-red-600" onClick={() => remove(r)}>Hapus</Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && (
        <RealizationForm
          projectId={project.id}
          items={items.data ?? []}
          onClose={() => setOpen(false)}
          onDone={(a) => { setOpen(false); setAlert(a); changed(); }}
        />
      )}
    </div>
  );
}

function RealizationForm({ projectId, items, onClose, onDone }: {
  projectId: string; items: RabItem[]; onClose: () => void;
  onDone: (alert: { level: string; message: string } | null) => void;
}) {
  const [f, setF] = useState({
    rabItemId: items[0]?.id ?? '', date: todayISO(),
    description: '', amount: '', vendor: '', receiptUrl: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body: Record<string, unknown> = { rabItemId: f.rabItemId, date: f.date, description: f.description, amount: Number(f.amount) };
    if (f.vendor) body.vendor = f.vendor;
    if (f.receiptUrl) body.receiptUrl = f.receiptUrl;
    try {
      const r = await api<CreateRealizationResult>(`/projects/${projectId}/realizations`, { method: 'POST', body });
      onDone(r.alert);
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal menyimpan');
      setBusy(false);
    }
  }

  return (
    <Modal title="Catat Realisasi Biaya" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Item RAB">
          <Select required value={f.rabItemId} onChange={set('rabItemId')}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} – {i.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal"><Input required type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="Jumlah (Rp)"><Input required type="number" min="1" step="any" value={f.amount} onChange={set('amount')} /></Field>
        </div>
        <Field label="Keterangan"><Input required value={f.description} onChange={set('description')} placeholder="mis. Beli semen 450 sak" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor / toko"><Input value={f.vendor} onChange={set('vendor')} /></Field>
          <Field label="Link foto nota" hint="Opsional"><Input type="url" value={f.receiptUrl} onChange={set('receiptUrl')} placeholder="https://…" /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy || !f.rabItemId}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
