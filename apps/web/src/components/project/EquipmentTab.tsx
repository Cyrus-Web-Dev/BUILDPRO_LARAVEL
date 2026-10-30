'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID, num, rupiah, todayISO } from '@/lib/format';
import { BudgetStatus, Project, RabItem, Rental, RentalUsage, RentalUsageResult } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, ProgressBar, Select } from '@/components/ui';

interface Props { project: Project; isAdmin: boolean; onChanged: () => void }
const d10 = (s: string) => s.slice(0, 10);

export function EquipmentTab({ project, isAdmin, onChanged }: Props) {
  const base = `/projects/${project.id}/equipment`;
  const rentals = useFetch<Rental[]>(base);
  const rab = useFetch<RabItem[]>(isAdmin ? `/projects/${project.id}/rab-items` : null);
  const [modal, setModal] = useState<{ kind: 'new' } | { kind: 'usage' | 'history' | 'edit'; r: Rental } | null>(null);
  const [notice, setNotice] = useState<{ bad: boolean; text: string }[]>([]);
  const [msg, setMsg] = useState('');

  const reload = () => { rentals.reload(); onChanged(); };
  const active = (rentals.data ?? []).filter((r) => r.status === 'ACTIVE');
  const urgent = active.flatMap((r) => r.alerts.map((a) => ({ bad: r.durationStatus === 'OVERDUE' || r.usageStatus === 'OVER', text: a })));

  async function giveBack(r: Rental) {
    if (!confirm(`Tandai "${r.name}" sudah dikembalikan ke vendor? Setelah ini tidak bisa mencatat pemakaian.`)) return;
    setMsg('');
    try { await api(`${base}/${r.id}/return`, { method: 'POST', body: {} }); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal'); }
  }

  return (
    <div className="space-y-4">
      {urgent.length > 0 && (
        <div className="space-y-1">
          {urgent.map((u, i) => (
            <div key={i} className={`rounded-md border px-3 py-2 text-sm ${u.bad ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{u.text}</div>
          ))}
        </div>
      )}
      {notice.map((n, i) => (
        <div key={i} className={`flex justify-between rounded-md border px-3 py-2 text-sm ${n.bad ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
          <span>{n.text}</span><button onClick={() => setNotice([])} aria-label="Tutup">✕</button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Sewa Alat Berat</h2>
        {isAdmin && <Button variant="secondary" onClick={() => setModal({ kind: 'new' })}>+ Sewa Baru</Button>}
      </div>
      {(msg || rentals.error) && <ErrorBox>{msg || rentals.error}</ErrorBox>}
      {rentals.loading && !rentals.data && <Loading />}
      {rentals.data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada alat berat yang disewa di proyek ini.</Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        {rentals.data?.map((r) => {
          const pct = r.plannedQuantity ? Math.round((r.usedQuantity / r.plannedQuantity) * 100) : null;
          return (
            <Card key={r.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-slate-500">{[r.code, r.vendor].filter(Boolean).join(' · ') || '-'}</div>
                </div>
                <DurationBadge r={r} />
              </div>
              <div className="text-xs text-slate-500">Masa sewa {dateID(r.startDate)} – {dateID(r.endDate)}</div>
              {isAdmin && r.rate !== null && (
                <div className="text-xs text-slate-500">
                  Tarif {rupiah(r.rate)}/{r.unit}{r.operatorRate ? ` + operator ${rupiah(r.operatorRate)}/${r.unit}` : ''}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Terpakai</span>
                  <span className="font-medium">{num(r.usedQuantity)}{r.plannedQuantity ? ` / ${num(r.plannedQuantity)}` : ''} {r.unit}</span>
                </div>
                {pct !== null && <ProgressBar percent={pct} status={r.usageStatus as BudgetStatus} />}
              </div>
              {isAdmin && r.totalCost !== null && <div className="text-sm">Total biaya: <b>{rupiah(r.totalCost)}</b></div>}
              <div className="flex flex-wrap gap-1">
                {r.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setModal({ kind: 'usage', r })}>Catat Pemakaian</Button>}
                <Button variant="ghost" onClick={() => setModal({ kind: 'history', r })}>Riwayat</Button>
                {isAdmin && r.status === 'ACTIVE' && <Button variant="ghost" onClick={() => setModal({ kind: 'edit', r })}>Perpanjang/Ubah</Button>}
                {isAdmin && r.status === 'ACTIVE' && <Button variant="ghost" className="text-red-600" onClick={() => giveBack(r)}>Kembalikan</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {modal?.kind === 'new' && <NewRental base={base} rabItems={rab.data ?? []} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal?.kind === 'usage' && (
        <UsageModal base={base} r={modal.r} isAdmin={isAdmin} onClose={() => setModal(null)}
          onDone={(res) => {
            setModal(null);
            const n: { bad: boolean; text: string }[] = res.rental.alerts.map((t) => ({ bad: res.rental.durationStatus === 'OVERDUE' || res.rental.usageStatus === 'OVER', text: t }));
            if (res.budgetAlert) n.push({ bad: res.budgetAlert.level === 'OVER', text: res.budgetAlert.message });
            setNotice(n);
            reload();
          }} />
      )}
      {modal?.kind === 'history' && <HistoryModal base={base} r={modal.r} isAdmin={isAdmin} onClose={() => setModal(null)} onChanged={reload} />}
      {modal?.kind === 'edit' && <EditModal base={base} r={modal.r} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </div>
  );
}

function DurationBadge({ r }: { r: Rental }) {
  if (r.durationStatus === 'RETURNED') return <Badge>Dikembalikan</Badge>;
  if (r.durationStatus === 'OVERDUE') return <Badge tone="amber"><span className="text-red-700">Lewat {Math.abs(r.daysRemaining)} hari</span></Badge>;
  if (r.durationStatus === 'EXPIRING') return <Badge tone="amber">{r.daysRemaining === 0 ? 'Berakhir hari ini' : `${r.daysRemaining} hari lagi`}</Badge>;
  return <Badge tone="green">{r.daysRemaining} hari lagi</Badge>;
}

function NewRental({ base, rabItems, onClose, onDone }: { base: string; rabItems: RabItem[]; onClose: () => void; onDone: () => void }) {
  const alat = rabItems.filter((i) => i.category === 'ALAT');
  const options = alat.length ? alat : rabItems;
  const [f, setF] = useState({
    name: '', code: '', vendor: '', rateType: 'DAILY', rate: '', operatorRate: '', plannedQuantity: '',
    startDate: todayISO(), endDate: todayISO(), rabItemId: options[0]?.id ?? '', notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const unit = f.rateType === 'HOURLY' ? 'jam' : 'hari';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: f.name, code: f.code || undefined, vendor: f.vendor || undefined, rateType: f.rateType, rate: Number(f.rate),
      operatorRate: f.operatorRate ? Number(f.operatorRate) : undefined,
      plannedQuantity: f.plannedQuantity ? Number(f.plannedQuantity) : undefined,
      startDate: f.startDate, endDate: f.endDate, rabItemId: f.rabItemId, notes: f.notes || undefined,
    };
    try { await api(base, { method: 'POST', body }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }

  return (
    <Modal title="Sewa Alat Baru" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Field label="Nama alat"><Input required value={f.name} onChange={set('name')} placeholder="Excavator PC200" /></Field></div>
          <Field label="Kode / plat"><Input value={f.code} onChange={set('code')} /></Field>
        </div>
        <Field label="Vendor / penyewaan"><Input value={f.vendor} onChange={set('vendor')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sistem tarif">
            <Select value={f.rateType} onChange={set('rateType')}><option value="DAILY">Per hari</option><option value="HOURLY">Per jam</option></Select>
          </Field>
          <Field label={`Tarif sewa (Rp/${unit})`}><Input required type="number" min="1" step="any" value={f.rate} onChange={set('rate')} /></Field>
          <Field label={`Operator (Rp/${unit})`} hint="Kosongkan bila sudah termasuk"><Input type="number" min="0" step="any" value={f.operatorRate} onChange={set('operatorRate')} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mulai sewa"><Input required type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Berakhir (masa berlaku)"><Input required type="date" value={f.endDate} onChange={set('endDate')} /></Field>
          <Field label={`Rencana total (${unit})`} hint="Dasar peringatan pembengkakan"><Input type="number" min="0" step="any" value={f.plannedQuantity} onChange={set('plannedQuantity')} /></Field>
        </div>
        <Field label="Dibebankan ke item RAB">
          <Select required value={f.rabItemId} onChange={set('rabItemId')}>
            {options.map((r) => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)}
          </Select>
        </Field>
        <Field label="Catatan"><Input value={f.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy || !f.rabItemId}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function UsageModal({ base, r, isAdmin, onClose, onDone }: { base: string; r: Rental; isAdmin: boolean; onClose: () => void; onDone: (res: RentalUsageResult) => void }) {
  const [f, setF] = useState({ date: todayISO(), quantity: '', extraCost: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const est = r.rate !== null ? (Number(f.quantity) || 0) * (r.rate + (r.operatorRate ?? 0)) + (Number(f.extraCost) || 0) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { date: f.date, quantity: Number(f.quantity), extraCost: f.extraCost ? Number(f.extraCost) : undefined, note: f.note || undefined };
    try { onDone(await api<RentalUsageResult>(`${base}/${r.id}/usage`, { method: 'POST', body })); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }

  return (
    <Modal title={`Catat Pemakaian: ${r.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal"><Input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={`Jumlah (${r.unit})`}><Input required type="number" min="0.01" step="any" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
        </div>
        {isAdmin && <Field label="Biaya tambahan (BBM, mobilisasi) Rp"><Input type="number" min="0" step="any" value={f.extraCost} onChange={(e) => setF({ ...f, extraCost: e.target.value })} /></Field>}
        <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="mis. Galian pondasi blok B" /></Field>
        {est !== null && <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">Estimasi biaya: <b>{rupiah(est)}</b> (otomatis masuk realisasi RAB)</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ base, r, isAdmin, onClose, onChanged }: { base: string; r: Rental; isAdmin: boolean; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useFetch<RentalUsage[]>(`${base}/${r.id}/usage`);
  const [msg, setMsg] = useState('');
  async function voidIt(u: RentalUsage) {
    if (!confirm('Batalkan catatan ini? Biaya di realisasi RAB ikut dihapus.')) return;
    setMsg('');
    try { await api(`${base}/usage/${u.id}/void`, { method: 'POST' }); reload(); onChanged(); }
    catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal'); }
  }
  return (
    <Modal title={`Riwayat Pemakaian: ${r.name}`} onClose={onClose} wide>
      {(msg || error) && <ErrorBox>{msg || error}</ErrorBox>}
      {loading && !data && <Loading />}
      {data?.length === 0 && <div className="py-6 text-center text-sm text-slate-500">Belum ada pemakaian.</div>}
      {data && data.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr><th className="p-2">Tanggal</th><th className="p-2 text-right">Jumlah</th>{isAdmin && <th className="p-2 text-right">Biaya</th>}<th className="p-2">Catatan</th>{isAdmin && <th className="p-2" />}</tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className={`border-t ${u.voidedAt ? 'text-slate-400 line-through' : ''}`}>
                <td className="p-2">{dateID(u.date)}</td>
                <td className="p-2 text-right">{num(u.quantity)} {r.unit}</td>
                {isAdmin && <td className="p-2 text-right">{u.cost !== null ? rupiah(u.cost) : '-'}</td>}
                <td className="p-2">{u.note}</td>
                {isAdmin && <td className="p-2 text-right">{!u.voidedAt && <Button variant="ghost" className="text-red-600" onClick={() => voidIt(u)}>Batalkan</Button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function EditModal({ base, r, onClose, onDone }: { base: string; r: Rental; onClose: () => void; onDone: () => void }) {
  const [endDate, setEndDate] = useState(d10(r.endDate));
  const [planned, setPlanned] = useState(r.plannedQuantity ? String(r.plannedQuantity) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await api(`${base}/${r.id}`, { method: 'PATCH', body: { endDate, plannedQuantity: planned ? Number(planned) : null } }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.full : 'Gagal menyimpan'); setBusy(false); }
  }
  return (
    <Modal title={`Perpanjang / Ubah: ${r.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Masa sewa berakhir"><Input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        <Field label={`Rencana total (${r.unit})`}><Input type="number" min="0" step="any" value={planned} onChange={(e) => setPlanned(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
