"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from "react";
import { applyVolumeDiscount } from "@/lib/pricing";

export interface CardData {
  id: number;
  cardNumber: string;
  sku: string;
  name: string;
  setCode: string | null;
  setName: string | null;
  price: number;
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
  flushSync: () => Promise<void>;
  total: number;
  discountedTotal: number;
  itemCount: number;
  volumeDiscountPct: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "tcg-cart";
const SYNC_DEBOUNCE_MS = 1500;

/** Migrate old cart items that used priceExVat → price */
function migrateCartItems(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    const card = item.card as CardData & { priceExVat?: number };
    if (card.price == null && card.priceExVat != null) {
      const { priceExVat, ...rest } = card;
      return { ...item, card: { ...rest, price: priceExVat } as CardData };
    }
    return item;
  });
}

function mergeItems(local: CartItem[], server: CartItem[]): CartItem[] {
  const map = new Map<number, CartItem>();
  for (const item of server) {
    map.set(item.card.id, item);
  }
  for (const item of local) {
    const existing = map.get(item.card.id);
    if (existing) {
      // Take higher quantity, local card data wins (fresher)
      map.set(item.card.id, {
        card: item.card,
        quantity: Math.max(item.quantity, existing.quantity),
      });
    } else {
      map.set(item.card.id, item);
    }
  }
  return Array.from(map.values());
}

export function CartProvider({
  children,
  volumeDiscountPct = 0,
}: {
  children: ReactNode;
  volumeDiscountPct?: number;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingFromServer = useRef(false);

  // Debounced PUT to server
  const syncToServer = useCallback((cartItems: CartItem[]) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems }),
      }).catch(() => {
        // Silent failure — localStorage is the fallback
      });
    }, SYNC_DEBOUNCE_MS);
  }, []);

  // On mount: hydrate from localStorage, then merge with server
  useEffect(() => {
    let localItems: CartItem[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = migrateCartItems(parsed);
          setItems(localItems);
        }
      }
    } catch {}
    setHydrated(true);

    // Async fetch from server and merge
    fetch("/api/cart")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((serverItems: CartItem[]) => {
        if (!Array.isArray(serverItems)) return;

        if (localItems.length === 0 && serverItems.length > 0) {
          // No local items — just use server
          isSyncingFromServer.current = true;
          setItems(serverItems);
        } else if (localItems.length > 0 && serverItems.length > 0) {
          // Both have items — merge
          const merged = mergeItems(localItems, serverItems);
          isSyncingFromServer.current = true;
          setItems(merged);
        } else if (localItems.length > 0 && serverItems.length === 0) {
          // Local only — sync up to server (first-time migration)
          syncToServer(localItems);
        }
        // Both empty: nothing to do
      })
      .catch(() => {
        // Not logged in or network error — localStorage-only mode
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change, and sync to server
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    if (isSyncingFromServer.current) {
      // This change came from server merge — sync merged result back
      isSyncingFromServer.current = false;
      syncToServer(items);
      return;
    }

    syncToServer(items);
  }, [items, hydrated, syncToServer]);

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

  const clear = useCallback(() => {
    setItems([]);
    // Immediately clear server cart (don't debounce)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    fetch("/api/cart", { method: "DELETE" }).catch(() => {});
  }, []);

  // Flush any pending debounced sync immediately (e.g. before sign out)
  const flushSync = useCallback(async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (items.length > 0) {
      await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }
  }, [items]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.card.price * i.quantity, 0),
    [items]
  );

  const discountedTotal = useMemo(
    () => applyVolumeDiscount(total, volumeDiscountPct),
    [total, volumeDiscountPct]
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
        flushSync,
        total,
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
