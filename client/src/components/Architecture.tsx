import { motion, useReducedMotion } from "framer-motion";
import { Check, Database, Lock, Network } from "lucide-react";

export function Architecture() {
  const reduced = useReducedMotion();

  return (
    <section className="section" id="architecture" aria-labelledby="architecture-heading">
      <div className="wrap">
        <div className="arch-grid">
          <div className="arch-copy">
            <span className="eyebrow">
              <Network size={12} strokeWidth={1.8} />
              Architecture
            </span>
            <h2 id="architecture-heading">The agent proposes. The server decides.</h2>
            <p>
              The ShopMate collection and PayPal trust layer stay separate from Channel3’s live
              retailer catalog. The browser never sends a price it can change.
            </p>

            <div className="arch-steps">
              <div className="arch-step">
                <span className="arch-step-index">01</span>
                <div>
                  <h3>Read the brief</h3>
                  <p>
                    An LLM or the deterministic parser converts the request into typed constraints.
                    The model may interpret language; it may not invent stock, specs or prices.
                  </p>
                </div>
              </div>
              <div className="arch-step">
                <span className="arch-step-index">02</span>
                <div>
                  <h3>Enforce the catalog</h3>
                  <p>
                    Budget and hard filters run in TypeScript against <code>catalog.json</code>. If
                    fewer than two products survive, a clearly labelled stretch lane opens at{" "}
                    <code>+15%</code>.
                  </p>
                </div>
              </div>
              <div className="arch-step">
                <span className="arch-step-index">03</span>
                <div>
                  <h3>Ask, then capture</h3>
                  <p>
                    <code>POST /api/orders/create</code> accepts product IDs only. The server
                    recalculates the total, creates the Orders v2 order, and captures only after the
                    buyer approves.
                  </p>
                </div>
              </div>
            </div>

            <div className="arch-foot">
              <span>
                <Check size={11} strokeWidth={2.2} /> 0 model-written prices
              </span>
              <span>
                <Database size={11} strokeWidth={1.8} /> 24 verified SKUs
              </span>
              <span>
                <Lock size={11} strokeWidth={1.8} /> Orders v2 · sandbox
              </span>
            </div>
          </div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="terminal" aria-label="Example API audit log">
              <div className="terminal-head">
                <div className="terminal-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span className="terminal-title">shopmate · trust boundary · live log</span>
                <span className="terminal-title">UTF-8</span>
              </div>
              <div className="terminal-body">
                <div className="t-comment">// 1 · language becomes constraints</div>
                <div>
                  <span className="t-key">POST</span> /api/agent/query
                </div>
                <div>
                  {"{ "}
                  <span className="t-key">"prompt"</span>:{" "}
                  <span className="t-str">
                    "Programming laptop under $700, 16GB RAM, strong battery"
                  </span>{" "}
                  {"}"}
                </div>
                <div className="t-ok">200 OK · 5 constraints · 4 strict matches</div>

                <div className="terminal-divider" />

                <div className="t-comment">// 2 · the client cannot set a price</div>
                <div>
                  <span className="t-key">POST</span> /api/orders/create
                </div>
                <div>
                  {"{ "}
                  <span className="t-key">"productIds"</span>: [
                  <span className="t-str">"lap-001"</span>],{" "}
                  <span className="t-key">"price"</span>:{" "}
                  <span className="t-num">1.00</span> {"}"}
                </div>
                <div className="t-bad">400 · client-supplied pricing rejected</div>

                <div className="terminal-divider" />

                <div className="t-comment">// 3 · the server re-prices, then asks</div>
                <div>
                  <span className="t-key">POST</span> /api/orders/create
                </div>
                <div>
                  {"{ "}
                  <span className="t-key">"productIds"</span>: [
                  <span className="t-str">"lap-001"</span>,{" "}
                  <span className="t-str">"hp-001"</span>],{" "}
                  <span className="t-key">"sessionId"</span>:{" "}
                  <span className="t-str">"sess_…"</span> {"}"}
                </div>
                <div className="t-ok">
                  200 OK · amount <span className="t-num">"747.00"</span> · approval required
                </div>
                <div className="t-comment">
                  → PayPal POST /v2/checkout/orders · intent CAPTURE
                </div>
              </div>
            </div>
            <p className="terminal-note">
              The exact sum is read from <strong>catalog.json</strong> on every create call. A
              captured amount that does not match the server ledger withholds the receipt.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
