'use client';
import { CostCategoryEnum } from '@buildpro/shared';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { CATEGORY_LABEL, num, rupiah } from '@/lib/format';
import { Category, Project, RabItem } from '@/lib/types';
import { Button, Card, ErrorBox, Field, Input, Loading, Modal, Select, Textarea } from '@/components/ui';

interface Props { project: Project; canWrite: boolean; isOwner: boolean; onChanged: () => void }

export function RabTab({ project, canWrite, isOwner, onChanged }: Props) {
  const { data, error, loading, reload } = useFetch<RabItem[]>(`/projects/${project.id}/rab-items`);
  const [form, setForm] = useState<RabItem | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = project.rabStatus === 'DRAFT';
  const editable = draft && canWrite;
  const total = (data ?? []).reduce((s, i) => s + Number(i.budget), 0);

  const changed = () => { reload(); onChanged(); };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg('');
    try { await fn(); changed(); } catch (e) { setMsg(e instanceof ApiError ? e.full : 'Terjadi kesalahan'); }
    setBusy(false);
  }

  const remove = (i: RabItem) =>
    confirm(`Hapus item "${i.name}"?`) && run(() => api(`/projects/${project.id}/rab-items/${i.id}`, { method: 'DELETE' }));
  const approve = () =>
    confirm('Setujui RAB? Setelah disetujui, item RAB terkunci dan realisasi biaya mulai bisa dicatat.') &&
    run(() => api(`/projects/${project.id}/rab/approve`, { method: 'POST' }));
  const reopen = () =>
    confirm('Buka kembali RAB untuk direvisi?') && run(() => api(`/projects/${project.id}/rab/reopen`, { method: 'POST' }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">
          Total RAB: <span className="font-bold text-slate-900">{rupiah(total)}</span>
          {!draft && <span className="ml-2 text-green-700">· Disetujui, terkunci</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button variant="secondary" onClick={() => setBulk(true)}>Impor dari Excel</Button>}
          {editable && <Button variant="secondary" onClick={() => setForm('new')}>+ Item</Button>}
          {isOwner && draft && <Button disabled={busy || !data?.length} onClick={approve}>Setujui RAB</Button>}
          {isOwner && !draft && <Button variant="secondary" disabled={busy} onClick={reopen}>Buka Kembali RAB</Button>}
        </div>
      </div>

      {(msg || error) && <ErrorBox>{msg || error}</ErrorBox>}
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada item RAB.</Card>}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">Kode</th><th className="p-3">Uraian</th><th className="p-3">Kategori</th>
                <th className="p-3 text-right">Volume</th><th className="p-3 text-right">Harga Satuan</th>
                <th className="p-3 text-right">Jumlah</th>{editable && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 text-slate-500">{i.code}</td>
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="p-3">{CATEGORY_LABEL[i.category]}</td>
                  <td className="p-3 text-right">{num(i.volume)} {i.unit}</td>
                  <td className="p-3 text-right">{rupiah(i.unitPrice)}</td>
                  <td className="p-3 text-right font-medium">{rupiah(i.budget)}</td>
                  {editable && (
                    <td className="space-x-1 p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => setForm(i)}>Ubah</Button>
                      <Button variant="ghost" className="text-red-600" onClick={() => remove(i)}>Hapus</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {form && <ItemForm projectId={project.id} item={form === 'new' ? null : form} onClose={() => setForm(null)} onDone={() => { setForm(null); changed(); }} />}
      {bulk && <BulkImport projectId={project.id} onClose={() => setBulk(false)} onDone={() => { setBulk(false); changed(); }} />}
    </div>
  );
}

function ItemForm({ projectId, item, onClose, onDone }: { projectId: string; item: RabItem | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    code: item?.code ?? '', name: item?.name ?? '', category: (item?.category ?? 'MATERIAL') as Category,
    unit: item?.unit ?? '', volume: item ? String(Number(item.volume)) : '', unitPrice: item ? String(Number(item.unitPrice)) : '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = (Number(f.volume) || 0) * (Number(f.unitPrice) || 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...f, volume: Number(f.volume), unitPrice: Number(f.unitPrice) };
    try {
      if (item) await api(`/projects/${projectId}/rab-items/${item.id}`, { method: 'PATCH', body });
      else await api(`/projects/${projectId}/rab-items`, { method: 'POST', body });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal menyimpan');
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? 'Ubah Item RAB' : 'Tambah Item RAB'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kode"><Input required value={f.code} onChange={set('code')} placeholder="A.1" /></Field>
          <div className="col-span-2"><Field label="Uraian pekerjaan / bahan"><Input required value={f.name} onChange={set('name')} /></Field></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <Select value={f.category} onChange={set('category')}>
              {CostCategoryEnum.options.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field label="Satuan"><Input required value={f.unit} onChange={set('unit')} placeholder="m2, sak, ls…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Volume"><Input required type="number" step="any" min="0" value={f.volume} onChange={set('volume')} /></Field>
          <Field label="Harga satuan (Rp)"><Input required type="number" step="any" min="0" value={f.unitPrice} onChange={set('unitPrice')} /></Field>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">Jumlah anggaran: <span className="font-bold">{rupiah(preview)}</span></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const CAT_ALIAS: Record<string, Category> = {
  MATERIAL: 'MATERIAL', BAHAN: 'MATERIAL', UPAH: 'UPAH', TENAGA: 'UPAH', ALAT: 'ALAT', PERALATAN: 'ALAT', LAINNYA: 'LAINNYA',
};
const parseNum = (s: string) => Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));

function parseBulk(text: string) {
  const rows: { code: string; name: string; category: Category; unit: string; volume: number; unitPrice: number }[] = [];
  const errors: string[] = [];
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, idx) => {
    const c = line.split(/\t|;/).map((x) => x.trim());
    if (c.length < 6) return errors.push(`Baris ${idx + 1}: butuh 6 kolom, ditemukan ${c.length}`);
    const category = CAT_ALIAS[c[2].toUpperCase()];
    if (!category) return errors.push(`Baris ${idx + 1}: kategori "${c[2]}" tidak dikenal`);
    const volume = parseNum(c[4]);
    const unitPrice = parseNum(c[5]);
    if (!(volume > 0) || !(unitPrice >= 0)) return errors.push(`Baris ${idx + 1}: volume/harga tidak valid`);
    rows.push({ code: c[0], name: c[1], category, unit: c[3], volume, unitPrice });
  });
  return { rows, errors };
}

function BulkImport({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = parseBulk(text);

  async function submit() {
    if (parsed.errors.length || parsed.rows.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${projectId}/rab-items/bulk`, { method: 'POST', body: { items: parsed.rows } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Gagal mengimpor');
      setBusy(false);
    }
  }

  return (
    <Modal title="Impor Item RAB dari Excel" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Salin baris dari Excel lalu tempel di bawah. Urutan kolom: <b>Kode, Uraian, Kategori, Satuan, Volume, Harga Satuan</b>{' '}
          (pemisah tab atau titik koma). Kategori: Material, Upah, Alat, Lainnya.
        </p>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'A.1;Semen PC 50kg;Material;sak;500;70000'} className="font-mono" />
        {parsed.errors.length > 0 && <ErrorBox><ul className="list-disc pl-4">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul></ErrorBox>}
        {error && <ErrorBox>{error}</ErrorBox>}
        {text && parsed.errors.length === 0 && <div className="text-sm text-green-700">{parsed.rows.length} baris siap diimpor.</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button disabled={busy || parsed.errors.length > 0 || parsed.rows.length === 0} onClick={submit}>{busy ? 'Mengimpor…' : 'Impor'}</Button>
        </div>
      </div>
    </Modal>
  );
}
