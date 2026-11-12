import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { getProduct } from "../data/catalog.js";
import {
  PayPalError,
  capturePayPalOrder,
  createPayPalOrder,
  paypalEnv,
} from "../services/paypalClient.js";
import {
  getOrder,
  getReceipt,
  recentReceipts,
  recordOrder,
  recordReceipt,
} from "../services/transactionStore.js";
import type { OrderLine, OrderReceipt, Product } from "../types.js";

export const ordersRouter = Router();

const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

const money = (value: number) => value.toFixed(2);

function checkoutLog(
  stage: string,
  context: Record<string, string | number | boolean | undefined> = {},
): void {
  console.info("[ShopMate checkout]", {
    timestamp: new Date().toISOString(),
    layer: "server",
    stage,
    ...context,
  });
}

function checkoutWarning(
  stage: string,
  context: Record<string, string | number | boolean | undefined> = {},
): void {
  console.warn("[ShopMate checkout] warning", {
    timestamp: new Date().toISOString(),
    layer: "server",
    stage,
    ...context,
  });
}

function amountInCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function sendPayPalError(res: Response, error: PayPalError): void {
  res.status(error.statusCode).json({
    error: error.message,
    paypal_issue: error.issue,
    paypal_debug_id: error.debugId,
    fallback_available: true,
    hint: "Switch to simulated sandbox and retry. PayPal debug IDs can be used for support investigations.",
  });
}

function quickStartFor(products: Product[]): string[] {
  const tips: string[] = [];
  const add = (tip: string) => {
    if (!tips.includes(tip)) tips.push(tip);
  };

  for (const product of products) {
    if (product.category === "laptops") {
      add("Charge the laptop fully, then install your editor and sign in to your accounts.");
      add("Enable battery saver before long unplugged sessions.");
    }
    if (product.category === "headphones") {
      add("Pair over Bluetooth, then set your preferred EQ in the companion app.");
      add("Charge the headphones fully over USB-C before the first long session.");
    }
    if (product.category === "smartphones") {
      add("Charge fully, then transfer data with the manufacturer's migration tool.");
      add("Turn on automatic backups and a screen lock before adding accounts.");
    }
  }

  add("Keep this receipt — the PayPal order ID is your proof of purchase.");
  return tips.slice(0, 5);
}

function warrantyFor(products: Product[]): string {
  const brands = [...new Set(products.map((product) => product.brand))];
  return `Standard manufacturer warranty applies to every item (${brands.join(", ")}). ShopMate AI does not extend, shorten or alter manufacturer coverage. Keep this captured PayPal receipt as proof of purchase.`;
}

ordersRouter.post(
  "/orders/create",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const forceSimulated = req.get("x-shopmate-payment-mode") === "simulated";
    checkoutLog("order.create.received", {
      itemCount: Array.isArray(body.productIds) ? body.productIds.length : 0,
      paymentMode: forceSimulated ? "simulated" : "paypal",
    });
    const forbidden = ["price", "amount", "total", "currency", "unit_amount"].filter(
      (key) => key in body,
    );
    if (forbidden.length > 0) {
      checkoutWarning("order.create.rejected", {
        reason: "client-supplied-pricing",
        rejectedFieldCount: forbidden.length,
      });
      res.status(400).json({
        error:
          "Client-supplied pricing is rejected by the trust layer. Send productIds only; the server reads price_usd from catalog.json.",
        rejected_fields: forbidden,
      });
      return;
    }

    const productIds = body.productIds;
    const sessionId = body.sessionId;

    if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 8) {
      checkoutWarning("order.create.rejected", { reason: "invalid-product-count" });
      res.status(400).json({ error: "productIds must contain between 1 and 8 product IDs." });
      return;
    }
    if (productIds.some((id) => typeof id !== "string")) {
      checkoutWarning("order.create.rejected", { reason: "non-string-product-id" });
      res.status(400).json({ error: "Every productId must be a string." });
      return;
    }
    if (new Set(productIds).size !== productIds.length) {
      checkoutWarning("order.create.rejected", { reason: "duplicate-product-id" });
      res.status(400).json({ error: "Duplicate productIds are not allowed." });
      return;
    }
    if (typeof sessionId !== "string" || sessionId.length < 3 || sessionId.length > 120) {
      checkoutWarning("order.create.rejected", { reason: "invalid-session-id" });
      res.status(400).json({ error: "A valid sessionId is required." });
      return;
    }

    const products: Product[] = [];
    for (const id of productIds as string[]) {
      const product = getProduct(id);
      if (!product) {
        checkoutWarning("order.create.rejected", {
          reason: "product-not-in-catalog",
          productId: id,
        });
        res.status(404).json({ error: `Product ${id} is not in the verified catalog.` });
        return;
      }
      if (!product.in_stock) {
        checkoutWarning("order.create.rejected", {
          reason: "product-out-of-stock",
          productId: id,
        });
        res.status(409).json({ error: `${product.name} is out of stock.` });
        return;
      }
      products.push(product);
    }

    // The price is always recomputed here, from catalog.json. There is no
    // client path to the amount that reaches PayPal.
    const lines: OrderLine[] = products.map((product) => ({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitAmount: money(product.price_usd),
      quantity: 1,
      image_url: product.image_url,
    }));
    const total = products.reduce((sum, product) => sum + product.price_usd, 0);
    const amount = money(total);
    const requestId = req.get("paypal-request-id") ?? undefined;

    if (requestId && !/^[A-Za-z0-9._:-]{1,38}$/.test(requestId)) {
      checkoutWarning("order.create.rejected", { reason: "invalid-paypal-request-id" });
      res.status(400).json({ error: "PayPal-Request-Id must be 1–38 letters, numbers, or . _ : - characters." });
      return;
    }

    try {
      checkoutLog("order.create.paypal-request", {
        paymentMode: forceSimulated ? "simulated" : "paypal",
        paypalEnv,
        itemCount: lines.length,
        amount,
        requestId,
      });
      const paypalOrder = await createPayPalOrder({
        amount,
        currency: "USD",
        items: lines,
        sessionId,
        requestId,
        forceSimulated,
      });

      const createdAt = new Date().toISOString();
      recordOrder({
        orderID: paypalOrder.orderID,
        sessionId,
        amount,
        currency: "USD",
        items: lines,
        mode: paypalOrder.mode,
        paypalEnv: paypalOrder.paypalEnv,
        createdAt,
        status: "CREATED",
      });

      checkoutLog("order.create.complete", {
        orderID: paypalOrder.orderID,
        status: paypalOrder.status,
        paymentMode: paypalOrder.mode,
        paypalEnv: paypalOrder.paypalEnv,
        amount,
        currency: "USD",
      });

      res.json({
        orderID: paypalOrder.orderID,
        status: paypalOrder.status,
        mode: paypalOrder.mode,
        paypalEnv: paypalOrder.paypalEnv,
        amount,
        currency: "USD",
        lines,
        sessionId,
        verified_at: createdAt,
        audit: {
          source: "server/catalog.json",
          client_price_accepted: false,
          recalculated_total: amount,
          sku_count: lines.length,
        },
      });
    } catch (error) {
      if (error instanceof PayPalError) {
        checkoutWarning("order.create.failed", {
          requestId,
          mainError: error.message,
          httpStatus: error.statusCode,
          paypalIssue: error.issue,
          paypalDebugId: error.debugId,
        });
        sendPayPalError(res, error);
        return;
      }
      throw error;
    }
  }),
);

ordersRouter.post(
  "/orders/capture",
  asyncHandler(async (req, res) => {
    const orderID = typeof req.body?.orderID === "string" ? req.body.orderID.trim() : "";
    if (!orderID) {
      checkoutWarning("order.capture.rejected", { reason: "missing-order-id" });
      res.status(400).json({ error: "orderID is required." });
      return;
    }

    const entry = getOrder(orderID);
    if (!entry) {
      checkoutWarning("order.capture.rejected", {
        reason: "order-not-in-server-ledger",
        orderID,
      });
      res.status(404).json({
        error: "This order is not in the server ledger. Create the order through this API first.",
      });
      return;
    }
    if (entry.status === "COMPLETED") {
      const existing = getReceipt(orderID);
      if (existing) {
        checkoutLog("order.capture.already-completed", { orderID });
        res.json({ ...existing, already_captured: true });
        return;
      }
    }

    let capture;
    try {
      checkoutLog("order.capture.request", {
        orderID,
        paymentMode: entry.mode,
        paypalEnv: entry.paypalEnv,
      });
      capture = await capturePayPalOrder(orderID, entry.mode);
    } catch (error) {
      if (error instanceof PayPalError) {
        checkoutWarning("order.capture.failed", {
          orderID,
          mainError: error.message,
          httpStatus: error.statusCode,
          paypalIssue: error.issue,
          paypalDebugId: error.debugId,
        });
        sendPayPalError(res, error);
        return;
      }
      throw error;
    }

    if (entry.mode === "paypal") {
      if (
        capture.currency !== entry.currency ||
        amountInCents(capture.amount) !== amountInCents(entry.amount)
      ) {
        checkoutWarning("order.capture.amount-mismatch", {
          orderID,
          expectedAmount: entry.amount,
          expectedCurrency: entry.currency,
          capturedAmount: capture.amount,
          capturedCurrency: capture.currency,
        });
        res.status(409).json({
          error: "Captured amount did not match the server-computed total. Receipt withheld.",
          expected: { amount: entry.amount, currency: entry.currency },
          captured: { amount: capture.amount, currency: capture.currency },
        });
        return;
      }
    }

    const capturedAt = new Date().toISOString();
    const items = entry.items;
    const products = items
      .map((item) => getProduct(item.productId))
      .filter((product): product is Product => Boolean(product));

    const receipt: OrderReceipt = {
      orderID,
      captureID: capture.captureID,
      status: "COMPLETED",
      timestamp: capturedAt,
      amount: entry.amount,
      currency: "USD",
      mode: entry.mode,
      paypalEnv: entry.paypalEnv,
      payerName: capture.payerName,
      payerEmail: capture.payerEmail,
      items,
      quickStart: quickStartFor(products),
      warranty: warrantyFor(products),
      audit: [
        {
          label: "Requirements extracted",
          at: entry.createdAt,
          detail: "Natural language converted to typed constraints before checkout.",
        },
        {
          label: "Catalog price verified",
          at: entry.createdAt,
          detail: `${money(Number(entry.amount))} recalculated from ${items.length} SKU${items.length === 1 ? "" : "s"} on the server.`,
        },
        {
          label: "Human approval received",
          at: capturedAt,
          detail:
            entry.mode === "paypal"
              ? "Buyer approved in the PayPal Sandbox window."
              : "Buyer approved in the simulated sandbox window.",
        },
        {
          label: "Capture completed",
          at: capturedAt,
          detail: `PayPal capture ${capture.captureID} returned COMPLETED.`,
        },
      ],
    };

    recordReceipt(receipt);
    checkoutLog("order.capture.complete", {
      orderID,
      captureID: capture.captureID,
      paymentMode: entry.mode,
      paypalEnv: entry.paypalEnv,
      status: capture.status,
      amount: entry.amount,
      currency: entry.currency,
    });
    res.json(receipt);
  }),
);

ordersRouter.get("/orders/recent", (_req, res) => {
  res.json({ receipts: recentReceipts() });
});

ordersRouter.get("/orders/:orderID/receipt", (req, res) => {
  const receipt = getReceipt(req.params.orderID);
  if (!receipt) {
    res.status(404).json({ error: "No receipt recorded for that order." });
    return;
  }
  res.json(receipt);
});
