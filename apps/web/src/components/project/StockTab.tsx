'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID, num, rupiah, todayISO } from '@/lib/format';
import { Project, RabItem, StockItem, StockMovement, StockOpResult, StockStatus } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Select } from '@/components/ui';

interface Props { project: Project; isAdmin: boolean; onChanged: () => void }
type Op = { mode: 'IN' | 'OUT' | 'ADJUST'; item: StockItem } | null;

const STATUS: Record<StockStatus, { label: string; tone: 'green' | 'amber' | 'blue' | 'slate' }> = {
  OK: { label: 'Aman', tone: 'green' }, LOW: { label: 'Menipis', tone: 'amber' }, EMPTY: { label: 'Habis', tone: 'slate' },
};
const TYPE_LABEL = { IN: 'Masuk', OUT: 'Pakai', ADJUST: 'Penyesuaian' } as const;

export function StockTab({ project, isAdmin, onChanged }: Props) {
  const base = `/projects/${project.id}/stock`;
  const [filter, setFilter] = useState('');
  const items = useFetch<StockItem[]>(`${base}/items`);
  const moves = useFetch<StockMovement[]>(`${base}/movements${filter ? `?stockItemId=${filter}` : ''}`);
  const rab = useFetch<RabItem[]>(isAdmin ? `/projects/${project.id}/rab-items` : null);
  const [op, setOp] = useState<Op>(null);
  const [newItem, setNewItem] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'warn' | 'bad'; text: string }[]>([]);
  const [msg, setMsg] = useState('');

  const reload = () => { items.reload(); moves.reload(); onChanged(); };
  const warn = (r: StockOpResult) => {
    const n: { tone: 'warn' | 'bad'; text: string }[] = [];
    if (r.alert) n.push({ tone: r.alert.level === 'EMPTY' ? 'bad' : 'warn', text: r.alert.message });
    if (r.budgetAlert) n.push({ tone: r.budgetAlert.level === 'OVER' ? 'bad' : 'warn', text: r.budgetAlert.message });
    setNotice(n);
  };

  async function voidMove(m: StockMovement) {
    if (!confirm('Batalkan transaksi ini? Stok dikembalikan dan biaya RAB yang terkait ikut dihapus.')) return;
    setMsg('');
    try { await api(`${base}/movements/${m.id}/void`, { method: 'POST' }); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal membatalkan'); }
  }

  const low = (items.data ?? []).filter((i) => i.status !== 'OK');

  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <b>Stok kritis:</b> {low.map((i) => `${i.name} (${num(i.currentQty)} ${i.unit})`).join(', ')}
        </div>
      )}
      {notice.map((n, i) => (
        <div key={i} className={`flex justify-between rounded-md border px-3 py-2 text-sm ${n.tone === 'bad' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          <span>{n.text}</span><button onClick={() => setNotice([])} aria-label="Tutup">✕</button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Gudang Proyek</h2>
        {isAdmin && <Button variant="secondary" onClick={() => setNewItem(true)}>+ Material</Button>}
      </div>
      {(msg || items.error) && <ErrorBox>{msg || items.error}</ErrorBox>}
      {items.loading && !items.data && <Loading />}
      {items.data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada material di gudang proyek.</Card>}

      {items.data && items.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="p-3">Material</th><th className="p-3 text-right">Stok</th><th className="p-3 text-right">Minimum</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {items.data.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="p-3 text-right font-semibold">{num(i.currentQty)} {i.unit}</td>
                  <td className="p-3 text-right text-slate-500">{num(i.minStock)}</td>
                  <td className="p-3"><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge></td>
                  <td className="space-x-1 p-3 text-right whitespace-nowrap">
                    {isAdmin && <Button variant="ghost" onClick={() => setOp({ mode: 'IN', item: i })}>Masuk</Button>}
                    <Button variant="ghost" onClick={() => setOp({ mode: 'OUT', item: i })}>Pakai</Button>
                    {isAdmin && <Button variant="ghost" onClick={() => setOp({ mode: 'ADJUST', item: i })}>Hitung fisik</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-semibold">Riwayat Transaksi</h2>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-56">
          <option value="">Semua material</option>
          {items.data?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
      </div>
      {moves.data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada transaksi.</Card>}
      {moves.data && moves.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">Tanggal</th><th className="p-3">Material</th><th className="p-3">Jenis</th>
                <th className="p-3 text-right">Jumlah</th><th className="p-3 text-right">Saldo</th>
                {isAdmin && <th className="p-3 text-right">Biaya</th>}<th className="p-3">Keterangan</th>{isAdmin && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {moves.data.map((m) => (
                <tr key={m.id} className={`border-t ${m.voidedAt ? 'text-slate-400 line-through' : ''}`}>
                  <td className="p-3 whitespace-nowrap">{dateID(m.date)}</td>
                  <td className="p-3">{m.stockItem?.name}</td>
                  <td className="p-3"><Badge tone={m.type === 'IN' ? 'green' : m.type === 'OUT' ? 'blue' : 'amber'}>{TYPE_LABEL[m.type]}</Badge></td>
                  <td className="p-3 text-right">{m.quantity > 0 ? '+' : ''}{num(m.quantity)} {m.stockItem?.unit}</td>
                  <td className="p-3 text-right">{num(m.balanceAfter)}</td>
                  {isAdmin && <td className="p-3 text-right">{m.totalCost ? rupiah(m.totalCost) : '-'}</td>}
                  <td className="p-3">{[m.supplier, m.refNo, m.note, m.createdBy && `oleh ${m.createdBy}`].filter(Boolean).join(' · ')}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      {!m.voidedAt && m.type !== 'ADJUST' && <Button variant="ghost" className="text-red-600" onClick={() => voidMove(m)}>Batalkan</Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {op && (
        <OpModal
          op={op} base={base} rabItems={rab.data ?? []} onClose={() => setOp(null)}
          onDone={(r) => { setOp(null); warn(r); reload(); }}
        />
      )}
      {newItem && <NewItemModal base={base} rabItems={rab.data ?? []} onClose={() => setNewItem(false)} onDone={() => { setNewItem(false); reload(); }} />}
    </div>
  );
}

function OpModal({ op, base, rabItems, onClose, onDone }: {
  op: NonNullable<Op>; base: string; rabItems: RabItem[]; onClose: () => void; onDone: (r: StockOpResult) => void;
}) {
  const { mode, item } = op;
  const [f, setF] = useState({
    quantity: '', unitPrice: '', date: todayISO(), supplier: '', refNo: '', note: '',
    rabItemId: item.defaultRabItemId ?? rabItems[0]?.id ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const total = (Number(f.quantity) || 0) * (Number(f.unitPrice) || 0);
  const title = { IN: 'Material Masuk', OUT: 'Pemakaian Material', ADJUST: 'Hitung Fisik (Penyesuaian Stok)' }[mode];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    let path = '', body: Record<string, unknown> = {};
    if (mode === 'IN') {
      path = '/in';
      body = { stockItemId: item.id, quantity: Number(f.quantity), unitPrice: Number(f.unitPrice), date: f.date, rabItemId: f.rabItemId || undefined, supplier: f.supplier || undefined, refNo: f.refNo || undefined, note: f.note || undefined };
    } else if (mode === 'OUT') {
      path = '/out';
      body = { stockItemId: item.id, quantity: Number(f.quantity), date: f.date, note: f.note || undefined };
    } else {
      path = '/adjust';
      body = { stockItemId: item.id, newQuantity: Number(f.quantity), date: f.date, note: f.note };
    }
    try { onDone(await api<StockOpResult>(`${base}${path}`, { method: 'POST', body })); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }

  return (
    <Modal title={`${title}: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">Stok sistem saat ini: <b>{num(item.currentQty)} {item.unit}</b></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === 'ADJUST' ? `Jumlah fisik hasil hitung (${item.unit})` : `Jumlah (${item.unit})`}>
            <Input required type="number" step="any" min={mode === 'ADJUST' ? '0' : '0.001'} value={f.quantity} onChange={set('quantity')} />
          </Field>
          <Field label="Tanggal"><Input required type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
        {mode === 'IN' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga satuan (Rp)"><Input required type="number" step="any" min="0" value={f.unitPrice} onChange={set('unitPrice')} /></Field>
              <Field label="Supplier"><Input value={f.supplier} onChange={set('supplier')} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="No. nota / surat jalan"><Input value={f.refNo} onChange={set('refNo')} /></Field>
              <Field label="Dibebankan ke item RAB">
                <Select required value={f.rabItemId} onChange={set('rabItemId')}>
                  {rabItems.map((r) => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">Nilai pembelian: <b>{rupiah(total)}</b> (otomatis tercatat sebagai realisasi biaya RAB)</div>
          </>
        )}
        <Field label={mode === 'ADJUST' ? 'Alasan penyesuaian (wajib)' : 'Catatan'}>
          <Input required={mode === 'ADJUST'} value={f.note} onChange={set('note')} placeholder={mode === 'OUT' ? 'mis. Cor lantai 2' : ''} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewItemModal({ base, rabItems, onClose, onDone }: { base: string; rabItems: RabItem[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', unit: '', minStock: '', defaultRabItemId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`${base}/items`, { method: 'POST', body: { name: f.name, unit: f.unit, minStock: f.minStock ? Number(f.minStock) : undefined, defaultRabItemId: f.defaultRabItemId || undefined } });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }
  return (
    <Modal title="Material Baru di Gudang" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Field label="Nama material"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Satuan"><Input required value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="sak, batang…" /></Field>
        </div>
        <Field label="Stok minimum" hint="Peringatan muncul bila stok sama dengan atau di bawah angka ini">
          <Input type="number" step="any" min="0" value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value })} />
        </Field>
        <Field label="Item RAB default yang dibebani" hint="Opsional, bisa dipilih ulang saat material masuk">
          <Select value={f.defaultRabItemId} onChange={(e) => setF({ ...f, defaultRabItemId: e.target.value })}>
            <option value="">— tidak ada —</option>
            {rabItems.map((r) => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)}
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
