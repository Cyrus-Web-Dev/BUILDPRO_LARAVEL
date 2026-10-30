import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'bp_token';
const USER_KEY = 'bp_user';

export interface User { id: string; name: string; email: string; role: 'OWNER' | 'ADMIN' | 'MANDOR'; tenantId: string }

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: { field: string; message: string }[]) {
    super(message);
  }
  get full() {
    return this.errors?.length ? `${this.message}: ${this.errors.map((e) => `${e.field} ${e.message}`).join('; ')}` : this.message;
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function loadSession(): Promise<{ token: string; user: User } | null> {
  const [t, u] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)]);
  if (!t || !u) return null;
  token = t;
  return { token: t, user: JSON.parse(u) as User };
}
export async function saveSession(t: string, user: User) {
  token = t;
  await Promise.all([SecureStore.setItemAsync(TOKEN_KEY, t), SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))]);
}
export async function clearSession() {
  token = null;
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
}

export const photoUrl = (rel: string) => `${API_URL}${rel}`;

interface Opts { method?: string; body?: unknown; form?: FormData; timeoutMs?: number }

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.form || opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, `Tidak bisa terhubung ke server (${API_URL}). Periksa sinyal/Wi-Fi dan alamat server.`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? 'Terjadi kesalahan';
    throw new ApiError(res.status, msg, data?.errors);
  }
  return data as T;
}
