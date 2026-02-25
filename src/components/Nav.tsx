"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Nav() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <nav className="border-b border-[#1e1e2e] bg-[#12121a] px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/catalog" className="text-lg font-bold text-brand-500">
          TCG Wholesale
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/catalog" className="hover:text-brand-500 transition">
            Catalog
          </Link>
          <Link href="/orders" className="hover:text-brand-500 transition">
            Orders
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-brand-500 transition">
              Admin
            </Link>
          )}
          <span className="text-gray-500">{session?.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded bg-gray-800 px-3 py-1 text-xs hover:bg-gray-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
