'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY_LABEL, num, rupiah } from '@/lib/format';
import { Summary } from '@/lib/types';
import { Card, ErrorBox, Loading, ProgressBar, StatusBadge } from '@/components/ui';

const compact = (n: number) =>
  new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function SummaryTab({ summary, loading, error }: { summary: Summary | null; loading: boolean; error: string | null }) {
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (loading && !summary) return <Loading />;
  if (!summary) return null;
  const { totals } = summary;

  if (summary.items.length === 0) {
    return <Card className="text-center text-sm text-slate-500">RAB belum diisi. Buka tab “Item RAB” untuk menyusun anggaran.</Card>;
  }

  const catData = summary.byCategory.map((c) => ({ name: CATEGORY_LABEL[c.category], RAB: c.budget, Realisasi: c.realized }));
  const itemData = summary.items.map((i) => ({ name: i.code, RAB: i.budget, Realisasi: i.realized }));

  return (
    <div className="space-y-4">
      {summary.project.rabStatus === 'DRAFT' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          RAB masih berstatus draft. Realisasi biaya baru bisa dicatat setelah RAB disetujui oleh Owner.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Total RAB</div><div className="text-lg font-bold">{rupiah(totals.budget)}</div></Card>
        <Card><div className="text-xs text-slate-500">Total Realisasi</div><div className="text-lg font-bold">{rupiah(totals.realized)}</div></Card>
        <Card>
          <div className="text-xs text-slate-500">Sisa Anggaran</div>
          <div className={`text-lg font-bold ${totals.remaining < 0 ? 'text-red-600' : ''}`}>{rupiah(totals.remaining)}</div>
        </Card>
        <Card className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Terpakai</span><StatusBadge status={totals.status} /></div>
          <div className="text-lg font-bold">{totals.usagePercent}%</div>
          <ProgressBar percent={totals.usagePercent} status={totals.status} />
        </Card>
      </div>

      {summary.alerts.length > 0 && (
        <Card className="space-y-2 border-red-200">
          <div className="text-sm font-semibold text-red-700">Peringatan anggaran ({summary.alerts.length})</div>
          <ul className="space-y-1 text-sm">
            {summary.alerts.map((a) => (
              <li key={a.itemId} className="flex items-center justify-between gap-2">
                <span>{a.code} – {a.name}</span>
                <span className="flex items-center gap-2"><span className="text-slate-500">{a.usagePercent}%</span><StatusBadge status={a.status} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-sm font-semibold">Per Kategori</div>
          <ChartBox data={catData} />
        </Card>
        <Card>
          <div className="mb-2 text-sm font-semibold">Per Item Pekerjaan</div>
          <ChartBox data={itemData} />
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-3">Kode</th><th className="p-3">Item</th><th className="p-3">Kategori</th>
              <th className="p-3 text-right">Volume</th><th className="p-3 text-right">RAB</th>
              <th className="p-3 text-right">Realisasi</th><th className="p-3 text-right">Sisa</th>
              <th className="p-3 w-40">Terpakai</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3 text-slate-500">{i.code}</td>
                <td className="p-3 font-medium">{i.name}</td>
                <td className="p-3">{CATEGORY_LABEL[i.category]}</td>
                <td className="p-3 text-right">{num(i.volume)} {i.unit}</td>
                <td className="p-3 text-right">{rupiah(i.budget)}</td>
                <td className="p-3 text-right">{rupiah(i.realized)}</td>
                <td className={`p-3 text-right ${i.remaining < 0 ? 'text-red-600' : ''}`}>{rupiah(i.remaining)}</td>
                <td className="p-3"><div className="space-y-1"><ProgressBar percent={i.usagePercent} status={i.status} /><div className="text-xs text-slate-500">{i.usagePercent}%</div></div></td>
                <td className="p-3"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ChartBox({ data }: { data: { name: string; RAB: number; Realisasi: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={compact} width={50} />
          <Tooltip formatter={(v: number) => rupiah(v)} />
          <Legend />
          <Bar dataKey="RAB" fill="#94a3b8" />
          <Bar dataKey="Realisasi" fill="#ea580c" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
