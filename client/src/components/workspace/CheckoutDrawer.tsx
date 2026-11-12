import { useEffect, useMemo, useState } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { checkoutEvent, checkoutFailure } from "../../lib/checkoutDiagnostics";
import { exactMoney, shortId } from "../../lib/format";
import type { AppConfig, Match, OrderCreateResponse, OrderReceipt } from "../../lib/types";
import { ApprovalModal } from "./ApprovalModal";
import { PayPalCheckoutButton } from "../cart/PayPalCheckoutButton";

interface CheckoutDrawerProps {
  selected: Match[];
  onRemove: (id: string) => void;
  sessionId: string;
  config: AppConfig | null;
  onReceipt: (receipt: OrderReceipt) => void;
  onAgentNote: (text: string) => void;
}

type PaymentMode = "paypal" | "simulated";

export function CheckoutDrawer({
  selected,
  onRemove,
  sessionId,
  config,
  onReceipt,
  onAgentNote,
}: CheckoutDrawerProps) {
  const [mode, setMode] = useState<PaymentMode>("simulated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [order, setOrder] = useState<OrderCreateResponse | null>(null);

  const idsKey = useMemo(
    () => selected.map((item) => item.id).sort().join(","),
    [selected],
  );
  const total = useMemo(
    () => selected.reduce((sum, item) => sum + item.price_usd, 0),
    [selected],
  );

  useEffect(() => {
    if (config?.paypalConfigured) setMode("paypal");
    else setMode("simulated");
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
    checkoutEvent("capture.start", { surface: "workspace", orderID, paymentMode: mode });
    setBusy(true);
    setError(null);
    try {
      const receipt = await api.captureOrder(orderID);
      checkoutEvent("capture.complete", {
        surface: "workspace",
        orderID,
        captureID: receipt.captureID,
        status: receipt.status,
      });
      setApprovalOpen(false);
      onReceipt(receipt);
      onAgentNote(
        `PayPal capture ${receipt.status}. ${exactMoney(receipt.amount)} was captured after your approval.`,
      );
    } catch (cause) {
      checkoutFailure("capture", cause, { surface: "workspace", orderID });
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  const createSimulated = async () => {
    checkoutEvent("simulated.checkout.start", { surface: "workspace", itemCount: selected.length });
    setBusy(true);
    setError(null);
    try {
      const created = await api.createOrder(
        selected.map((item) => item.id),
        sessionId,
        true,
      );
      setOrder(created);
      checkoutEvent("simulated.order.create.complete", {
        surface: "workspace",
        orderID: created.orderID,
        amount: created.amount,
      });
      await capture(created.orderID);
    } catch (cause) {
      checkoutFailure("simulated.checkout", cause, { surface: "workspace" });
      setError(messageFor(cause));
      setBusy(false);
    }
  };

  const paypalEnabled = Boolean(config?.paypalConfigured && config.paypalClientId);

  return (
    <>
      <div className="checkout-drawer">
        <div className="audit-strip">
          <span>
            <ShieldCheck size={11} strokeWidth={2} />
            Catalog price verified on server · AI cannot auto-charge
          </span>
          <span className="audit-right">
            {order
              ? `${order.mode === "simulated" ? "SIMULATED" : "PAYPAL"} ${shortId(order.orderID, 10, 4)}`
              : "Awaiting explicit approval"}
          </span>
        </div>

        <div className="checkout-main">
          <div className="checkout-items">
            {selected.slice(0, 3).map((item) => (
              <div className="checkout-thumb" key={item.id}>
                <img src={item.image_url} alt={item.name} />
                <button
                  type="button"
                  aria-label={`Remove ${item.name} from cart`}
                  onClick={() => onRemove(item.id)}
                  disabled={busy}
                >
                  <X size={8} strokeWidth={2.4} />
                </button>
              </div>
            ))}
            <div className="checkout-item-names">
              <strong>
                {selected[0]?.name ?? "Cart"}
                {selected.length > 1 ? ` + ${selected.length - 1} more` : ""}
              </strong>
              <span>
                {selected.length} item{selected.length === 1 ? "" : "s"} · re-priced from catalog
              </span>
            </div>
          </div>

          <div className="checkout-total">
            <div className="checkout-total-label">Server total</div>
            <div className="checkout-total-value">{exactMoney(total)}</div>
            <div className="checkout-total-note">USD · before PayPal capture</div>
          </div>

          <div className="checkout-actions">
            <div className="payment-modes">
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
                {paypalEnabled && mode === "paypal"
                  ? `${config?.paypalEnv ?? "sandbox"} · Orders v2 · SDK v6`
                  : "no network · server re-prices"}
              </span>
            </div>

            {error ? (
              <div className="checkout-error">
                <TriangleAlert size={10} style={{ display: "inline", marginRight: 4 }} />
                {error}
              </div>
            ) : null}

            <div className="paypal-slot">
              {paypalEnabled && mode === "paypal" ? (
                <PayPalCheckoutButton
                  surface="workspace"
                  clientId={config?.paypalClientId ?? ""}
                  environment={config?.paypalEnv ?? "sandbox"}
                  onCreateOrder={async (requestId) => {
                      setBusy(true);
                      setError(null);
                      try {
                        const created = await api.createOrder(
                          selected.map((item) => item.id),
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
                  className="btn btn-paypal"
                  style={{ width: "100%", minHeight: 38, fontSize: 11 }}
                  onClick={() => setApprovalOpen(true)}
                  disabled={busy || selected.length === 0}
                >
                  {busy ? (
                    <>
                      <span className="spinner" /> Capturing…
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={13} strokeWidth={2} />
                      Approve {exactMoney(total)} in simulated sandbox
                    </>
                  )}
                </button>
              )}
            </div>

            {!paypalEnabled ? (
              <div className="checkout-security">
                <ShoppingBag size={9} />
                Add PAYPAL_CLIENT_ID + SECRET to server/.env for the real popup
              </div>
            ) : (
              <div className="checkout-security">
                <ShieldCheck size={9} />
                {mode === "paypal"
                  ? "Sandbox buyer must be a separate Personal account · amount set server-side"
                  : "Only product IDs leave this browser. Amount is set server-side."}
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalModal
        open={approvalOpen}
        items={selected}
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
