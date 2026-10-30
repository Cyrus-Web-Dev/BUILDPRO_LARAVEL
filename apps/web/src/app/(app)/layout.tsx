'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/api';
import { User } from '@/lib/types';
import { UserCtx } from '@/lib/user-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) router.replace('/login');
    else setUser(u);
  }, [router]);

  if (!user) return null;

  const nav = [
    { href: '/projects', label: 'Proyek' },
    ...(user.role !== 'MANDOR' ? [{ href: '/users', label: 'Pengguna' }] : []),
  ];

  return (
    <UserCtx.Provider value={user}>
      <div className="min-h-screen md:flex">
        <aside className="border-b bg-white md:min-h-screen md:w-56 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between p-4 md:block">
            <div className="text-lg font-bold text-brand-600">BUILDPRO</div>
            <div className="text-xs text-slate-500 md:mt-1">{user.name} · {user.role}</div>
          </div>
          <nav className="flex gap-1 px-2 pb-2 md:flex-col md:pb-0">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx('rounded-md px-3 py-2 text-sm', pathname.startsWith(n.href) ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100')}
              >
                {n.label}
              </Link>
            ))}
            <button
              onClick={() => { clearSession(); router.replace('/login'); }}
              className="rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              Keluar
            </button>
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </UserCtx.Provider>
  );
}
