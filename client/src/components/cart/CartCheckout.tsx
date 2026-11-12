import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { checkoutEvent, checkoutFailure } from "../../lib/checkoutDiagnostics";
import { exactMoney } from "../../lib/format";
import type { AppConfig, Match, OrderCreateResponse, OrderReceipt } from "../../lib/types";
import { ApprovalModal } from "../workspace/ApprovalModal";
import { PayPalCheckoutButton } from "./PayPalCheckoutButton";

interface CartCheckoutProps {
  items: Match[];
  sessionId: string;
  config: AppConfig | null;
  onReceipt: (receipt: OrderReceipt) => void;
}

type PaymentMode = "paypal" | "simulated";

export function CartCheckout({ items, sessionId, config, onReceipt }: CartCheckoutProps) {
  const [mode, setMode] = useState<PaymentMode>("simulated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [order, setOrder] = useState<OrderCreateResponse | null>(null);

  const idsKey = useMemo(() => items.map((item) => item.id).sort().join(","), [items]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price_usd, 0),
    [items],
  );

  useEffect(() => {
    setMode(config?.paypalConfigured ? "paypal" : "simulated");
  }, [config]);

  useEffect(() => {
    setOrder(null);
    setError(null);
  }, [idsKey]);

  const messageFor = (cause: unknown): string => {
    if (cause instanceof ApiError) {
      const message = cause.fallbackAvailable
        ? `${cause.message} Switch to simulated sandbox and retry.`
        : cause.message;
      const reference = [
        cause.paypalIssue ? `PayPal issue ${cause.paypalIssue}` : "",
        cause.paypalDebugId ? `debug ID ${cause.paypalDebugId}` : "",
      ].filter(Boolean).join(" · ");
      return reference ? `${message} (${reference})` : message;
    }
    if (cause instanceof Error) return cause.message;
    return "The checkout request failed. Try the simulated sandbox.";
  };

  const capture = async (orderID: string) => {
    checkoutEvent("capture.start", { surface: "cart", orderID, paymentMode: mode });
    setBusy(true);
    setError(null);
    try {
      const receipt = await api.captureOrder(orderID);
      checkoutEvent("capture.complete", {
        surface: "cart",
        orderID,
        captureID: receipt.captureID,
        status: receipt.status,
      });
      setApprovalOpen(false);
      onReceipt(receipt);
    } catch (cause) {
      checkoutFailure("capture", cause, { surface: "cart", orderID });
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  const createSimulated = async () => {
    checkoutEvent("simulated.checkout.start", { surface: "cart", itemCount: items.length });
    setBusy(true);
    setError(null);
    try {
      const created = await api.createOrder(
        items.map((item) => item.id),
        sessionId,
        true,
      );
      setOrder(created);
      checkoutEvent("simulated.order.create.complete", {
        surface: "cart",
        orderID: created.orderID,
        amount: created.amount,
      });
      await capture(created.orderID);
    } catch (cause) {
      checkoutFailure("simulated.checkout", cause, { surface: "cart" });
      setError(messageFor(cause));
      setBusy(false);
    }
  };

  const paypalEnabled = Boolean(config?.paypalConfigured && config.paypalClientId);

  return (
    <>
      <aside className="cart-summary" aria-label="Order summary">
        <div className="cart-summary-head">
          <div>
            <span className="eyebrow">Order summary</span>
            <h2>Ready when you are.</h2>
          </div>
          <span className="pill pill-emerald">
            <ShieldCheck size={9} strokeWidth={2} />
            server-verified
          </span>
        </div>

        <div className="cart-summary-lines">
          {items.map((item) => (
            <div className="cart-summary-line" key={item.id}>
              <span>{item.name}</span>
              <strong>{exactMoney(item.price_usd)}</strong>
            </div>
          ))}
        </div>

        <div className="cart-totals">
          <div>
            <span>Subtotal</span>
            <strong>{exactMoney(total)}</strong>
          </div>
          <div>
            <span>Shipping</span>
            <span>Included in price</span>
          </div>
          <div>
            <span>Tax</span>
            <span>Included</span>
          </div>
          <div className="cart-total-row">
            <span>Total</span>
            <strong>{exactMoney(total)}</strong>
          </div>
        </div>

        <div className="cart-audit">
          <ShieldCheck size={15} strokeWidth={2} />
          <div>
            <strong>Re-priced from catalog.json</strong>
            <span>
              The server ignores any client amount. The AI cannot set or change the price.
            </span>
          </div>
        </div>

        <div className="cart-pay">
          <div className="cart-pay-head">
            <span className="paypal-wordmark">PayPal</span>
            <span className="payment-note">
              {order
                ? `${order.mode === "simulated" ? "simulated" : "PayPal"} · ${order.status}`
                : paypalEnabled && mode === "paypal"
                  ? `${config?.paypalEnv ?? "sandbox"} · Orders v2 · SDK v6`
                  : "server re-prices"}
            </span>
          </div>

          <div className="payment-modes cart-payment-modes">
            {paypalEnabled ? (
              <div className="payment-toggle" role="group" aria-label="Payment mode">
                <button
                  type="button"
                  data-active={mode === "paypal"}
                  onClick={() => setMode("paypal")}
                  disabled={busy}
                >
                  PayPal sandbox
                </button>
                <button
                  type="button"
                  data-active={mode === "simulated"}
                  onClick={() => setMode("simulated")}
                  disabled={busy}
                >
                  Simulated
                </button>
              </div>
            ) : (
              <span className="pill pill-paypal">
                <LockKeyhole size={9} /> Simulated sandbox
              </span>
            )}
            <span className="payment-note">
              {paypalEnabled && mode === "paypal" ? "real sandbox popup" : "no network"}
            </span>
          </div>

          {error ? (
            <div className="checkout-error">
              <TriangleAlert size={11} style={{ display: "inline", marginRight: 5 }} />
              {error}
            </div>
          ) : null}

          <div className="paypal-slot cart-paypal-slot">
            {paypalEnabled && mode === "paypal" ? (
              <PayPalCheckoutButton
                surface="cart"
                clientId={config?.paypalClientId ?? ""}
                environment={config?.paypalEnv ?? "sandbox"}
                onCreateOrder={async (requestId) => {
                    setBusy(true);
                    setError(null);
                    try {
                      const created = await api.createOrder(
                        items.map((item) => item.id),
                        sessionId,
                        false,
                        requestId,
                      );
                      setOrder(created);
                      return created.orderID;
                    } catch (cause) {
                      setBusy(false);
                      setError(messageFor(cause));
                      throw cause;
                    }
                  }}
                onApprove={capture}
                onCancel={() => {
                    setBusy(false);
                    setError("Approval cancelled. Nothing was captured.");
                  }}
                onError={(cause) => {
                    setBusy(false);
                    setError(
                      `PayPal could not complete this order${cause.code ? ` (${cause.code})` : ""}. ${cause.message || "Switch to simulated sandbox and retry."}`,
                    );
                  }}
              />
            ) : (
              <button
                type="button"
                className="btn btn-paypal cart-approve-btn"
                onClick={() => setApprovalOpen(true)}
                disabled={busy || items.length === 0}
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Capturing…
                  </>
                ) : (
                  <>
                    <LockKeyhole size={14} strokeWidth={2} />
                    Approve {exactMoney(total)} in simulated sandbox
                  </>
                )}
              </button>
            )}
          </div>

          <div className="checkout-security cart-security">
            {!paypalEnabled ? (
              <>
                <ShoppingBag size={10} />
                Add PAYPAL_CLIENT_ID + SECRET to server/.env for the real popup
              </>
            ) : (
              <>
                <ShieldCheck size={10} />
                {mode === "paypal"
                  ? "Sandbox buyer must be a separate Personal account · amount set server-side"
                  : "Only product IDs leave this browser. Amount is set server-side."}
              </>
            )}
          </div>
        </div>

        <div className="cart-next">
          <span className="eyebrow">What happens next</span>
          <ol>
            <li>
              <b>01</b>
              <span>Server re-prices the exact SKUs from catalog.json.</span>
            </li>
            <li>
              <b>02</b>
              <span>You approve in PayPal or the simulated sandbox.</span>
            </li>
            <li>
              <b>03</b>
              <span>Capture returns COMPLETED and an auditable receipt.</span>
            </li>
          </ol>
          <div className="cart-next-note">
            <ArrowRight size={11} strokeWidth={2} />
            No auto-charge. No client-set amount.
          </div>
        </div>
      </aside>

      <ApprovalModal
        open={approvalOpen}
        items={items}
        amount={total}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) setApprovalOpen(false);
        }}
        onApprove={createSimulated}
      />
    </>
  );
}
