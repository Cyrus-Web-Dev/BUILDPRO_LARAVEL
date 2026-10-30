export const rupiah = (n: number | string) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));

/** Tanggal hari ini (zona waktu perangkat) dalam format YYYY-MM-DD. toISOString() memakai UTC sehingga salah hari di WIB dini hari. */
export const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const num = (n: number | string) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(Number(n));

export const dateID = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export const CATEGORY_LABEL: Record<string, string> = {
  MATERIAL: 'Material', UPAH: 'Upah', ALAT: 'Alat', LAINNYA: 'Lainnya',
};
