import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BundleOption, Match } from "../lib/types";

const CART_KEY = "shopmate.cart.v1";
const SESSION_KEY = "shopmate.session.v1";

function makeSessionId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `sm_${uuid}`;
}

function readCart(): Record<string, Match> {
  try {
    const raw = window.sessionStorage.getItem(CART_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const cart: Record<string, Match> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const item = value as Partial<Match>;
      if (item.id !== id || typeof item.price_usd !== "number") continue;
      cart[id] = item as Match;
    }
    return cart;
  } catch {
    return {};
  }
}

function readSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = makeSessionId();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return makeSessionId();
  }
}

interface CartContextValue {
  items: Record<string, Match>;
  selected: Match[];
  count: number;
  total: number;
  sessionId: string;
  add: (product: Match) => void;
  toggle: (product: Match) => void;
  addBundle: (bundle: BundleOption) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, Match>>(readCart);
  const [sessionId] = useState(readSessionId);

  useEffect(() => {
    try {
      if (Object.keys(items).length === 0) window.sessionStorage.removeItem(CART_KEY);
      else window.sessionStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Session storage can be unavailable or full; the in-memory cart still works.
    }
  }, [items]);

  const add = useCallback((product: Match) => {
    setItems((current) => {
      if (current[product.id]) return current;
      return { ...current, [product.id]: product };
    });
  }, []);

  const toggle = useCallback((product: Match) => {
    setItems((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = product;
      return next;
    });
  }, []);

  const addBundle = useCallback((bundle: BundleOption) => {
    setItems((current) => {
      const next = { ...current };
      for (const item of bundle.items) next[item.id] = item;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const selected = useMemo(() => Object.values(items), [items]);
  const count = selected.length;
  const total = useMemo(
    () => selected.reduce((sum, item) => sum + item.price_usd, 0),
    [selected],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      selected,
      count,
      total,
      sessionId,
      add,
      toggle,
      addBundle,
      remove,
      clear,
    }),
    [items, selected, count, total, sessionId, add, toggle, addBundle, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
