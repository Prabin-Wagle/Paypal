import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { exactMoney, timestamp } from "../../lib/format";
import type { OrderReceipt } from "../../lib/types";

interface ReceiptViewProps {
  receipt: OrderReceipt;
  onStartOver: () => void;
  onRunBundle: () => void;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export function ReceiptView({ receipt, onStartOver, onRunBundle }: ReceiptViewProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const raw = JSON.stringify(receipt, null, 2);
  const modeLabel = receipt.mode === "paypal" ? "PayPal Sandbox" : "Simulated sandbox";

  const copy = async (value: string) => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="receipt-shell" aria-label="Captured order receipt">
      <div className="receipt-hero">
        <div className="receipt-hero-left">
          <span className="receipt-check" aria-hidden="true">
            <Check size={21} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow" style={{ fontSize: 9 }}>
              PayPal capture complete
            </span>
            <h2>Receipt issued. The price never moved.</h2>
            <p>
              PayPal returned <strong>COMPLETED</strong> after your explicit approval. The server
              captured exactly the catalog total it recomputed for these SKUs.
            </p>
            {receipt.already_captured ? (
              <p style={{ color: "var(--color-amber)" }}>
                This order was already captured. The existing receipt was returned idempotently; no
                second charge occurred.
              </p>
            ) : null}
          </div>
        </div>

        <div className="receipt-status-block">
          <span className="receipt-status">
            <CheckCircle2 size={10} strokeWidth={2.2} />
            COMPLETED
          </span>
          <span>
            {modeLabel} · {receipt.paypalEnv}
          </span>
          <span>{timestamp(receipt.timestamp)}</span>
        </div>
      </div>

      <div className="receipt-body">
        <div className="receipt-main">
          <div className="receipt-meta">
            <div className="receipt-meta-cell">
              <span>Order ID</span>
              <strong>{receipt.orderID}</strong>
            </div>
            <div className="receipt-meta-cell">
              <span>Capture ID</span>
              <strong>{receipt.captureID}</strong>
            </div>
            <div className="receipt-meta-cell">
              <span>Payer</span>
              <strong>{receipt.payerName}</strong>
            </div>
            <div className="receipt-meta-cell">
              <span>Payer email</span>
              <strong>{receipt.payerEmail}</strong>
            </div>
            <div className="receipt-meta-cell">
              <span>Payment rail</span>
              <strong>
                {modeLabel} · Orders v2
              </strong>
            </div>
            <div className="receipt-meta-cell">
              <span>Captured at</span>
              <strong>{timestamp(receipt.timestamp)}</strong>
            </div>
          </div>

          <div className="receipt-items">
            {receipt.items.map((item) => (
              <div className="receipt-item" key={item.productId}>
                <img src={item.image_url} alt={item.name} loading="lazy" />
                <div>
                  <div className="receipt-item-name">{item.name}</div>
                  <div className="receipt-item-sku">
                    {item.sku} · qty {item.quantity}
                  </div>
                </div>
                <span className="receipt-item-price">{exactMoney(item.unitAmount)}</span>
              </div>
            ))}

            <div className="receipt-total-row">
              <span>Total captured · {receipt.currency}</span>
              <strong>{exactMoney(receipt.amount)}</strong>
            </div>
          </div>

          <div className="receipt-start">
            <h3>
              <Sparkles size={11} strokeWidth={1.9} />
              Quick start
            </h3>
            <ol>
              {receipt.quickStart.map((tip, index) => (
                <li key={`${index}-${tip}`}>{tip}</li>
              ))}
            </ol>

            <div className="receipt-warranty">
              <strong>Warranty.</strong> {receipt.warranty}
            </div>
          </div>
        </div>

        <aside className="receipt-side">
          <h3>
            <ShieldCheck size={11} strokeWidth={1.9} />
            Trust trail
          </h3>

          <div className="audit-timeline">
            {receipt.audit.map((event, index) => (
              <div className="audit-event" key={`${event.label}-${index}`}>
                <span className="audit-event-dot" aria-hidden="true">
                  <Check size={6} strokeWidth={3} />
                </span>
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                  <time dateTime={event.at}>{timestamp(event.at)}</time>
                </div>
              </div>
            ))}
          </div>

          <div className="receipt-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onStartOver}>
              <RotateCcw size={12} strokeWidth={2} />
              New brief
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRunBundle}>
              <Layers size={12} strokeWidth={1.9} />
              Bundle demo
            </button>
          </div>

          <div className="receipt-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void copy(receipt.orderID)}
            >
              <Copy size={12} strokeWidth={1.9} />
              {copied ? "Order ID copied" : "Copy order ID"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRawOpen((open) => !open)}
            >
              <Code2 size={12} strokeWidth={1.9} />
              {rawOpen ? "Hide raw JSON" : "Raw JSON"}
            </button>
          </div>

          {rawOpen ? <pre className="receipt-raw">{raw}</pre> : null}

          <p
            style={{
              margin: "16px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: 7.5,
              lineHeight: 1.55,
              color: "var(--color-slate-light)",
            }}
          >
            Keep this receipt. The PayPal order ID is your proof of purchase. ShopMate AI never
            stores a card number.
          </p>
        </aside>
      </div>
    </div>
  );
}
