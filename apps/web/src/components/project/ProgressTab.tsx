'use client';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError, fileUrl } from '@/lib/api';
import { useFetch } from '@/lib/hooks';
import { dateID } from '@/lib/format';
import { ProgressReport, Project } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal } from '@/components/ui';

const STATUS = {
  SUBMITTED: { label: 'Menunggu verifikasi', tone: 'amber' },
  VERIFIED: { label: 'Terverifikasi', tone: 'green' },
  REJECTED: { label: 'Ditolak', tone: 'slate' },
} as const;

export function ProgressTab({ project, isAdmin, onChanged }: { project: Project; isAdmin: boolean; onChanged: () => void }) {
  const { data, error, loading, reload } = useFetch<ProgressReport[]>(`/projects/${project.id}/progress`);
  const [photo, setPhoto] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ProgressReport | null>(null);
  const [msg, setMsg] = useState('');

  const changed = () => { reload(); onChanged(); };
  async function act(fn: () => Promise<unknown>) {
    setMsg('');
    try { await fn(); changed(); } catch (e) { setMsg(e instanceof ApiError ? e.full : 'Gagal'); }
  }
  const verify = (r: ProgressReport) => act(() => api(`/projects/${project.id}/progress/${r.id}/verify`, { method: 'PATCH', body: { status: 'VERIFIED' } }));
  const remove = (r: ProgressReport) => confirm('Hapus laporan ini beserta fotonya?') && act(() => api(`/projects/${project.id}/progress/${r.id}`, { method: 'DELETE' }));

  const chart = [...(data ?? [])].filter((r) => r.status !== 'REJECTED').reverse()
    .map((r) => ({ tanggal: dateID(r.reportDate), Progres: r.percent }));
  const latest = (data ?? []).find((r) => r.status !== 'REJECTED');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        Laporan progress dikirim mandor lewat aplikasi mobile (foto, persentase, dan lokasi GPS). Admin memverifikasi di sini.
      </div>
      {(msg || error) && <ErrorBox>{msg || error}</ErrorBox>}
      {loading && !data && <Loading />}
      {data?.length === 0 && <Card className="text-center text-sm text-slate-500">Belum ada laporan progress.</Card>}

      {chart.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">Kurva Progres</span>
            {latest && <span>Terakhir: <b>{latest.percent}%</b></span>}
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tanggal" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} unit="%" width={45} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="Progres" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {data?.map((r) => (
          <Card key={r.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{r.percent}%</span>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </div>
                <div className="text-xs text-slate-500">{dateID(r.reportDate)} · oleh {r.createdBy}</div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  {r.status !== 'VERIFIED' && <Button variant="secondary" onClick={() => verify(r)}>Verifikasi</Button>}
                  {r.status !== 'REJECTED' && <Button variant="ghost" onClick={() => setRejecting(r)}>Tolak</Button>}
                  <Button variant="ghost" className="text-red-600" onClick={() => remove(r)}>Hapus</Button>
                </div>
              )}
            </div>
            {r.notes && <p className="text-sm">{r.notes}</p>}
            {r.reviewComment && <p className="text-xs text-slate-500">Catatan reviewer: {r.reviewComment}</p>}
            {r.latitude !== null && r.longitude !== null && (
              <a className="text-xs text-brand-600 hover:underline" target="_blank" rel="noreferrer"
                 href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}>
                📍 Lokasi GPS {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}{r.accuracy ? ` (±${Math.round(r.accuracy)} m)` : ''}
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              {r.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={fileUrl(p.url)} alt="Foto progress" onClick={() => setPhoto(fileUrl(p.url))}
                     className="h-24 w-24 cursor-pointer rounded-md border object-cover hover:opacity-80" />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {photo && (
        <Modal title="Foto Progress" onClose={() => setPhoto(null)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Foto progress" className="max-h-[70vh] w-full rounded-md object-contain" />
        </Modal>
      )}
      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(null)}
          onSubmit={async (comment) => {
            await api(`/projects/${project.id}/progress/${rejecting.id}/verify`, { method: 'PATCH', body: { status: 'REJECTED', comment } });
            setRejecting(null);
            changed();
          }}
        />
      )}
    </div>
  );
}

function RejectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (c: string) => Promise<void> }) {
  const [c, setC] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title="Tolak Laporan" onClose={onClose}>
      <div className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Alasan penolakan"><Input value={c} onChange={(e) => setC(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="danger" disabled={!c.trim()} onClick={() => onSubmit(c).catch((e) => setError(e instanceof ApiError ? e.full : 'Gagal'))}>Tolak</Button>
        </div>
      </div>
    </Modal>
  );
}
