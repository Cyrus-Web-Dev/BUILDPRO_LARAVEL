import { User } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
/** URL foto dari API bersifat relatif (/files/...), tambahkan alamat dasar API. */
export const fileUrl = (rel: string) => `${BASE}${rel}`;
const TOKEN_KEY = 'bp_token';
const USER_KEY = 'bp_user';

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: { field: string; message: string }[]) {
    super(message);
  }
  /** Pesan lengkap untuk ditampilkan ke pengguna, termasuk detail field. */
  get full() {
    if (!this.errors?.length) return this.message;
    return `${this.message}: ${this.errors.map((e) => `${e.field} ${e.message}`).join('; ')}`;
  }
}

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Tidak bisa terhubung ke server (${BASE}). Pastikan API berjalan.`);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearSession();
      window.location.href = '/login';
    }
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? 'Terjadi kesalahan';
    throw new ApiError(res.status, msg, data?.errors);
  }
  return data as T;
}
