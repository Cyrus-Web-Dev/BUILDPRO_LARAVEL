'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID, num, rupiah, todayISO } from '@/lib/format';
import { OpnameView, Project, RabItem, WorkOrderView } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Select } from '@/components/ui';

interface Props { project: Project; isOwner: boolean; onChanged: () => void }
const STATUS = {
  DRAFT: { label: 'Draft', tone: 'slate' }, APPROVED: { label: 'Disetujui, belum dibayar', tone: 'amber' },
  PAID: { label: 'Dibayar', tone: 'green' }, CANCELLED: { label: 'Dibatalkan', tone: 'slate' },
} as const;

type Modal_ =
  | { kind: 'spk' }
  | { kind: 'opname'; wo: WorkOrderView; edit?: OpnameView }
  | { kind: 'pay'; o: OpnameView }
  | null;

export function OpnameTab({ project, isOwner, onChanged }: Props) {
  const base = `/projects/${project.id}`;
  const wos = useFetch<WorkOrderView[]>(`${base}/work-orders`);
  const ops = useFetch<OpnameView[]>(`${base}/opnames`);
  const rab = useFetch<RabItem[]>(`${base}/rab-items`);
  const [modal, setModal] = useState<Modal_>(null);
  const [notice, setNotice] = useState('');
  const [msg, setMsg] = useState('');

  const reload = () => { wos.reload(); ops.reload(); onChanged(); };
  async function act(fn: () => Promise<unknown>) {
    setMsg('');
    try { await fn(); reload(); } catch (e) { setMsg(e instanceof ApiError ? e.full : 'Terjadi kesalahan'); }
  }
  const approve = (o: OpnameView) =>
    confirm(`Setujui opname termin ${o.number}? Nilai pekerjaan ${rupiah(o.grossAmount)} akan tercatat sebagai realisasi biaya RAB.`) &&
    act(async () => {
      const r = await api<{ budgetAlert: { message: string } | null }>(`${base}/opnames/${o.id}/approve`, { method: 'POST' });
      setNotice(r.budgetAlert?.message ?? '');
    });
  const cancel = (o: OpnameView) =>
    confirm(`Batalkan opname termin ${o.number}?${o.status === 'APPROVED' ? ' Biaya RAB yang terkait ikut dihapus.' : ''}`) &&
    act(() => api(`${base}/opnames/${o.id}/cancel`, { method: 'POST' }));

  return (
    <div className="space-y-4">
      {notice && (
        <div className="flex justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">SPK & Opname Mandor</h2>
          <p className="text-xs text-slate-500">Opname = pengukuran volume hasil kerja per termin sebagai dasar pembayaran upah.</p>
        </div>
        <Button variant="secondary" onClick={() => setModal({ kind: 'spk' })}>+ SPK Baru</Button>
      </div>
      {(msg || wos.error) && <ErrorBox>{msg || wos.error}</ErrorBox>}
      {wos.loading && !wos.data && <Loading />}
      {wos.data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada SPK. Buat SPK untuk mandor/subkontraktor terlebih dahulu.</Card>}

      {wos.data?.map((wo) => {
        const mine = (ops.data ?? []).filter((o) => o.workOrder.id === wo.id);
        return (
          <Card key={wo.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs text-slate-400">{wo.code}</div>
                <div className="font-semibold">{wo.title}</div>
                <div className="text-sm text-slate-500">{wo.contractorName} · retensi {wo.retentionPercent}%</div>
              </div>
              <div className="flex items-center gap-1">
                {wo.status === 'CLOSED' && <Badge>Ditutup</Badge>}
                {wo.status === 'ACTIVE' && <Button disabled={wo.hasDraft} onClick={() => setModal({ kind: 'opname', wo })}>+ Opname Baru</Button>}
                {wo.status === 'ACTIVE' && <Button variant="ghost" onClick={() => confirm('Tutup SPK ini?') && act(() => api(`${base}/work-orders/${wo.id}/close`, { method: 'POST' }))}>Tutup</Button>}
                {mine.every((o) => o.status === 'DRAFT' || o.status === 'CANCELLED') && (
                  <Button variant="ghost" className="text-red-600" onClick={() => confirm('Hapus SPK ini?') && act(() => api(`${base}/work-orders/${wo.id}`, { method: 'DELETE' }))}>Hapus</Button>
                )}
              </div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <Stat label="Nilai kontrak" value={rupiah(wo.contractValue)} />
              <Stat label={`Terselesaikan (${wo.progressPercent}%)`} value={rupiah(wo.certifiedGross)} />
              <Stat label="Retensi ditahan" value={rupiah(wo.retentionHeld)} />
              <Stat label="Sudah dibayar / belum" value={`${rupiah(wo.paidNet)} / ${rupiah(wo.unpaidNet)}`} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="p-2">Pekerjaan</th><th className="p-2 text-right">Volume kontrak</th><th className="p-2 text-right">Harga satuan</th><th className="p-2 text-right">Selesai (disetujui)</th></tr>
                </thead>
                <tbody>
                  {wo.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.description}</td>
                      <td className="p-2 text-right">{num(l.contractVolume)} {l.unit}</td>
                      <td className="p-2 text-right">{rupiah(l.unitPrice)}</td>
                      <td className="p-2 text-right">{num(l.certifiedVolume)} {l.unit} ({l.contractVolume ? Math.round((l.certifiedVolume / l.contractVolume) * 100) : 0}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mine.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="p-2">Termin</th><th className="p-2">Tanggal</th><th className="p-2">Status</th>
                      <th className="p-2 text-right">Bruto</th><th className="p-2 text-right">Retensi</th><th className="p-2 text-right">Potongan</th><th className="p-2 text-right">Dibayar</th><th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((o) => (
                      <tr key={o.id} className={`border-t ${o.status === 'CANCELLED' ? 'text-slate-400 line-through' : ''}`}>
                        <td className="p-2 font-medium">#{o.number}</td>
                        <td className="p-2">{dateID(o.date)}</td>
                        <td className="p-2"><Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge></td>
                        <td className="p-2 text-right">{rupiah(o.grossAmount)}</td>
                        <td className="p-2 text-right">{rupiah(o.retentionAmount)}</td>
                        <td className="p-2 text-right">{rupiah(o.deduction)}</td>
                        <td className="p-2 text-right font-medium">{rupiah(o.netAmount)}</td>
                        <td className="space-x-1 p-2 text-right whitespace-nowrap">
                          {o.status === 'DRAFT' && <Button variant="ghost" onClick={() => setModal({ kind: 'opname', wo, edit: o })}>Ubah</Button>}
                          {o.status === 'DRAFT' && isOwner && <Button variant="ghost" onClick={() => approve(o)}>Setujui</Button>}
                          {o.status === 'APPROVED' && <Button variant="ghost" onClick={() => setModal({ kind: 'pay', o })}>Tandai dibayar</Button>}
                          {(o.status === 'DRAFT' || (o.status === 'APPROVED' && isOwner)) && <Button variant="ghost" className="text-red-600" onClick={() => cancel(o)}>Batalkan</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {modal?.kind === 'spk' && <SpkModal base={base} rabItems={rab.data ?? []} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.kind === 'opname' && <OpnameModal base={base} wo={modal.wo} edit={modal.edit} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.kind === 'pay' && <PayModal base={base} o={modal.o} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{value}</div></div>;
}

function SpkModal({ base, rabItems, onClose, onDone }: { base: string; rabItems: RabItem[]; onClose: () => void; onDone: () => void }) {
  const upah = rabItems.filter((i) => i.category === 'UPAH');
  const options = upah.length ? upah : rabItems;
  const [f, setF] = useState({ code: '', contractorName: '', title: '', rabItemId: options[0]?.id ?? '', retentionPercent: '5', notes: '' });
  const [lines, setLines] = useState([{ description: '', unit: '', contractVolume: '', unitPrice: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setLine = (i: number, k: string, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.contractVolume) || 0) * (Number(l.unitPrice) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      code: f.code, contractorName: f.contractorName, title: f.title, rabItemId: f.rabItemId,
      retentionPercent: Number(f.retentionPercent) || 0, notes: f.notes || undefined,
      lines: lines.map((l) => ({ description: l.description, unit: l.unit, contractVolume: Number(l.contractVolume), unitPrice: Number(l.unitPrice) })),
    };
    try { await api(`${base}/work-orders`, { method: 'POST', body }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }

  return (
    <Modal title="SPK Baru" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kode SPK"><Input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="SPK-01" /></Field>
          <div className="col-span-2"><Field label="Mandor / subkontraktor"><Input required value={f.contractorName} onChange={(e) => setF({ ...f, contractorName: e.target.value })} /></Field></div>
        </div>
        <Field label="Judul pekerjaan"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Pekerjaan pengecatan" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Dibebankan ke item RAB (upah)">
              <Select required value={f.rabItemId} onChange={(e) => setF({ ...f, rabItemId: e.target.value })}>
                {options.map((r) => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Retensi (%)"><Input type="number" min="0" max="100" step="any" value={f.retentionPercent} onChange={(e) => setF({ ...f, retentionPercent: e.target.value })} /></Field>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">Item pekerjaan</div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-5"><Input required placeholder="Uraian (mis. Cat dinding)" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} /></div>
              <div className="col-span-2"><Input required placeholder="Satuan" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} /></div>
              <div className="col-span-2"><Input required type="number" min="0" step="any" placeholder="Volume" value={l.contractVolume} onChange={(e) => setLine(i, 'contractVolume', e.target.value)} /></div>
              <div className="col-span-2"><Input required type="number" min="0" step="any" placeholder="Harga sat." value={l.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} /></div>
              <button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600 disabled:opacity-30" aria-label="Hapus baris">✕</button>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setLines([...lines, { description: '', unit: '', contractVolume: '', unitPrice: '' }])}>+ Tambah baris</Button>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">Nilai kontrak: <b>{rupiah(total)}</b></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy || !f.rabItemId}>{busy ? 'Menyimpan…' : 'Simpan SPK'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function OpnameModal({ base, wo, edit, onClose, onDone }: { base: string; wo: WorkOrderView; edit?: OpnameView; onClose: () => void; onDone: () => void }) {
  // previous: volume yang sudah disetujui sebelumnya. Saat ubah draft, ambil dari snapshot draft itu.
  const rows = wo.lines.map((l) => {
    const ol = edit?.lines.find((x) => x.lineId === l.id);
    const previous = ol ? ol.previousVolume : l.certifiedVolume;
    return { ...l, previous, initial: ol ? ol.cumulativeVolume : previous };
  });
  const [cum, setCum] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, String(r.initial)])));
  const [date, setDate] = useState(edit ? edit.date.slice(0, 10) : todayISO());
  const [deduction, setDeduction] = useState(edit && edit.deduction ? String(edit.deduction) : '');
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const gross = rows.reduce((s, r) => s + Math.max((Number(cum[r.id]) || 0) - r.previous, 0) * r.unitPrice, 0);
  const retention = Math.round(gross * wo.retentionPercent) / 100;
  const net = gross - retention - (Number(deduction) || 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      date, notes: notes || undefined, deduction: deduction ? Number(deduction) : undefined,
      lines: rows.map((r) => ({ lineId: r.id, cumulativeVolume: Number(cum[r.id]) || 0 })),
    };
    try {
      if (edit) await api(`${base}/opnames/${edit.id}`, { method: 'PUT', body });
      else await api(`${base}/work-orders/${wo.id}/opnames`, { method: 'POST', body });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }

  return (
    <Modal title={`${edit ? `Ubah Opname #${edit.number}` : 'Opname Baru'}: ${wo.code}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <p className="text-sm text-slate-600">Isi <b>volume kumulatif</b>, yaitu total pekerjaan yang sudah selesai sampai hari ini (bukan selisih termin ini).</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="p-2">Pekerjaan</th><th className="p-2 text-right">Kontrak</th><th className="p-2 text-right">Sebelumnya</th><th className="p-2 w-32">Kumulatif</th><th className="p-2 text-right">Termin ini</th><th className="p-2 text-right">Nilai</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const now = Number(cum[r.id]) || 0;
                const diff = now - r.previous;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.description}</td>
                    <td className="p-2 text-right">{num(r.contractVolume)} {r.unit}</td>
                    <td className="p-2 text-right">{num(r.previous)}</td>
                    <td className="p-2"><Input type="number" step="any" min={r.previous} max={r.contractVolume} value={cum[r.id]} onChange={(e) => setCum({ ...cum, [r.id]: e.target.value })} /></td>
                    <td className="p-2 text-right">{diff > 0 ? num(diff) : '-'}</td>
                    <td className="p-2 text-right">{diff > 0 ? rupiah(diff * r.unitPrice) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal opname"><Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Potongan / kasbon (Rp)"><Input type="number" min="0" step="any" value={deduction} onChange={(e) => setDeduction(e.target.value)} /></Field>
        </div>
        <Field label="Catatan"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <Stat label="Nilai pekerjaan (bruto)" value={rupiah(gross)} />
          <Stat label={`Retensi ${wo.retentionPercent}%`} value={rupiah(retention)} />
          <Stat label="Potongan" value={rupiah(Number(deduction) || 0)} />
          <Stat label="Dibayarkan (bersih)" value={rupiah(net)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Draft'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PayModal({ base, o, onClose, onDone }: { base: string; o: OpnameView; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await api(`${base}/opnames/${o.id}/pay`, { method: 'POST', body: { paidDate: date, reference: ref || undefined } }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal'); setBusy(false); }
  }
  return (
    <Modal title={`Pembayaran Opname #${o.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">{o.workOrder.contractorName}: dibayarkan <b>{rupiah(o.netAmount)}</b></div>
        <Field label="Tanggal bayar"><Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="No. referensi transfer / kuitansi"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Tandai Dibayar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
