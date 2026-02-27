"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/lib/cart-context";

export default function Nav() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { itemCount, discountedTotal } = useCart();

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
          <Link href="/discount" className="hover:text-brand-500 transition">
            Discounts
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-brand-500 transition">
              Admin
            </Link>
          )}
          {itemCount > 0 && (
            <Link
              href="/orders/new"
              className="flex items-center gap-1.5 rounded bg-brand-600/20 border border-brand-600/30 px-3 py-1 text-brand-400 hover:bg-brand-600/30 transition"
            >
              <span>Cart ({itemCount})</span>
              <span className="text-green-400 font-medium">
                &pound;{discountedTotal.toFixed(2)}
              </span>
            </Link>
          )}
          <span className="text-gray-500">{session?.user?.email}</span>
          <button
            onClick={() => {
              localStorage.removeItem("tcg-cart");
              signOut({ callbackUrl: "/login" });
            }}
            className="rounded bg-gray-800 px-3 py-1 text-xs hover:bg-gray-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
