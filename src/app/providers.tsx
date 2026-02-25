"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/lib/cart-context";

export function Providers({
  children,
  volumeDiscountPct = 0,
}: {
  children: React.ReactNode;
  volumeDiscountPct?: number;
}) {
  return (
    <SessionProvider>
      <CartProvider volumeDiscountPct={volumeDiscountPct}>
        {children}
      </CartProvider>
    </SessionProvider>
  );
}
