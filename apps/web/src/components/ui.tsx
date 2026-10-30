'use client';
import clsx from 'clsx';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { BudgetStatus } from '@/lib/types';

export function Button({
  variant = 'primary', className, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        className,
      )}
    />
  );
}

const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(fieldCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(fieldCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(fieldCls, p.className)} />;

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={clsx('mt-10 w-full rounded-lg bg-white shadow-xl', wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Tutup">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const STATUS = {
  OK: { cls: 'bg-green-100 text-green-700', label: 'Aman' },
  WARNING: { cls: 'bg-amber-100 text-amber-700', label: 'Waspada' },
  OVER: { cls: 'bg-red-100 text-red-700', label: 'Melebihi RAB' },
} as const;

export function StatusBadge({ status }: { status: BudgetStatus }) {
  const s = STATUS[status];
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'blue' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700' };
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function ProgressBar({ percent, status }: { percent: number; status: BudgetStatus }) {
  const color = status === 'OVER' ? 'bg-red-500' : status === 'WARNING' ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={clsx('h-full', color)} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>;
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-slate-400">Memuat…</div>;
}
