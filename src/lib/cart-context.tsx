"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import { applyVolumeDiscount } from "@/lib/pricing";

export interface CardData {
  id: number;
  cardNumber: string;
  sku: string;
  name: string;
  setCode: string | null;
  setName: string | null;
  priceExVat: number;
}

export interface CartItem {
  card: CardData;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (card: CardData, qty?: number) => void;
  removeItem: (cardId: number) => void;
  updateQuantity: (cardId: number, qty: number) => void;
  clear: () => void;
  totalExVat: number;
  discountedTotal: number;
  itemCount: number;
  volumeDiscountPct: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  volumeDiscountPct = 0,
}: {
  children: ReactNode;
  volumeDiscountPct?: number;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tcg-cart");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("tcg-cart", JSON.stringify(items));
    }
  }, [items, hydrated]);

  const addItem = useCallback((card: CardData, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.card.id === card.id);
      if (existing) {
        return prev.map((i) =>
          i.card.id === card.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { card, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((cardId: number) => {
    setItems((prev) => prev.filter((i) => i.card.id !== cardId));
  }, []);

  const updateQuantity = useCallback((cardId: number, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.card.id !== cardId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.card.id === cardId ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalExVat = useMemo(
    () => items.reduce((sum, i) => sum + i.card.priceExVat * i.quantity, 0),
    [items]
  );

  const discountedTotal = useMemo(
    () => applyVolumeDiscount(totalExVat, volumeDiscountPct),
    [totalExVat, volumeDiscountPct]
  );

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clear,
        totalExVat,
        discountedTotal,
        itemCount,
        volumeDiscountPct,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
