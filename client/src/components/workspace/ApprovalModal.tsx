import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { exactMoney } from "../../lib/format";
import type { Match } from "../../lib/types";

interface ApprovalModalProps {
  open: boolean;
  items: Match[];
  amount: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onApprove: () => void;
}

export function ApprovalModal({
  open,
  items,
  amount,
  busy,
  error,
  onClose,
  onApprove,
}: ApprovalModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          <motion.div
            className="approval-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="approval-head">
              <div className="approval-head-title">
                <span className="paypal-wordmark">PayPal</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  SANDBOX APPROVAL
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close approval window"
                onClick={onClose}
                disabled={busy}
                style={{ width: 28, height: 28 }}
              >
                <X size={13} />
              </button>
            </div>

            <div className="approval-body">
              <div className="approval-amount">{exactMoney(amount)}</div>
              <div className="approval-sub">USD · simulated sandbox · no money moves</div>

              <div className="approval-items">
                {items.map((item) => (
                  <div className="approval-item" key={item.id}>
                    <span>{item.name}</span>
                    <span>{exactMoney(item.price_usd)}</span>
                  </div>
                ))}
              </div>

              <div className="approval-note">
                <ShieldCheck size={13} strokeWidth={1.9} style={{ flex: "none", marginTop: 1 }} />
                <span>
                  This is the human boundary. The server has already re-priced the cart from the
                  verified catalog. Nothing is captured until you approve.
                </span>
              </div>

              {error ? <div className="approval-error">{error}</div> : null}
            </div>

            <div className="approval-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-paypal"
                onClick={onApprove}
                disabled={busy}
                autoFocus
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Capturing…
                  </>
                ) : (
                  <>
                    <LockKeyhole size={13} strokeWidth={2} /> Approve &amp; capture
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
