import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OrderLine, OrderReceipt } from "../types.js";

export interface LedgerEntry {
  orderID: string;
  sessionId: string;
  amount: string;
  currency: "USD";
  items: OrderLine[];
  mode: "paypal" | "simulated";
  paypalEnv: "sandbox" | "live";
  createdAt: string;
  status: "CREATED" | "COMPLETED";
}

interface StoreData {
  orders: LedgerEntry[];
  receipts: OrderReceipt[];
}

const storePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/transactions.json",
);
const orders = new Map<string, LedgerEntry>();
const receipts = new Map<string, OrderReceipt>();

function readStore(): StoreData {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<StoreData>;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[ShopMate checkout] transaction ledger read failed", {
        timestamp: new Date().toISOString(),
        stage: "ledger.read",
        mainError: error instanceof Error ? error.message : String(error),
        errorCode: (error as NodeJS.ErrnoException).code,
      });
    }
    return { orders: [], receipts: [] };
  }
}

function persistStore(): void {
  const data: StoreData = {
    orders: [...orders.values()],
    receipts: [...receipts.values()],
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, storePath);
}

const persisted = readStore();
for (const order of persisted.orders) {
  if (order && typeof order.orderID === "string") orders.set(order.orderID, order);
}
for (const receipt of persisted.receipts) {
  if (receipt && typeof receipt.orderID === "string") receipts.set(receipt.orderID, receipt);
}

export function recordOrder(entry: LedgerEntry): void {
  orders.set(entry.orderID, entry);
  persistStore();
}

export function getOrder(orderID: string): LedgerEntry | undefined {
  return orders.get(orderID);
}

export function recordReceipt(receipt: OrderReceipt): void {
  receipts.set(receipt.orderID, receipt);
  const order = orders.get(receipt.orderID);
  if (order) {
    order.status = "COMPLETED";
    orders.set(order.orderID, order);
  }
  persistStore();
}

export function getReceipt(orderID: string): OrderReceipt | undefined {
  return receipts.get(orderID);
}

export function recentReceipts(limit = 25): OrderReceipt[] {
  return [...receipts.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
