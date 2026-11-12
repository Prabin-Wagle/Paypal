import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  Braces,
  Check,
  CircleAlert,
  Cpu,
  LockKeyhole,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function TrustLayer() {
  const reduced = useReducedMotion();

  return (
    <section className="section" id="trust" aria-labelledby="trust-heading">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={12} strokeWidth={1.8} />
              The trust layer
            </span>
            <h2 id="trust-heading">A language model you can audit.</h2>
          </div>
          <p>
            Three hard boundaries separate what the agent can say from what the system can charge.
            None of them are prompts.
          </p>
        </div>

        <motion.div
          className="trust-grid"
          initial={reduced ? false : "hidden"}
          whileInView={reduced ? undefined : "show"}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.08 }}
        >
          <motion.article className="trust-card" variants={fade} transition={{ duration: 0.5 }}>
            <div className="trust-card-top">
              <span className="trust-index">01 / EXTRACT</span>
              <span className="trust-icon">
                <Braces size={15} strokeWidth={1.7} />
              </span>
            </div>
            <h3>Language in. Constraints out.</h3>
            <p>
              The model reads intent; it never names a product. Every requirement is clamped to a
              typed schema before the catalog is touched.
            </p>
            <div className="trust-visual">
              <div className="messy-prompt">
                “something fast for coding, not too heavy, under 700”
              </div>
              <div className="code-panel">
                <div className="code-head">
                  <span>extracted.json</span>
                  <span>validated</span>
                </div>
                <div className="code-body">
                  {"{"}
                  <br />
                  &nbsp;&nbsp;<span className="key">"category"</span>:{" "}
                  <span className="val">"laptops"</span>,<br />
                  &nbsp;&nbsp;<span className="key">"budget_max"</span>:{" "}
                  <span className="val">700</span>,<br />
                  &nbsp;&nbsp;<span className="key">"hard_filters"</span>: {"{"}{" "}
                  <span className="key">"min_ram_gb"</span>:{" "}
                  <span className="val">16</span> {"}"},<br />
                  &nbsp;&nbsp;<span className="key">"priorities"</span>: [
                  <span className="green">"battery"</span>,{" "}
                  <span className="green">"performance"</span>]<br />
                  {"}"}
                </div>
              </div>
            </div>
          </motion.article>

          <motion.article className="trust-card" variants={fade} transition={{ duration: 0.5 }}>
            <div className="trust-card-top">
              <span className="trust-index">02 / COMPARE</span>
              <span className="trust-icon">
                <Scale size={15} strokeWidth={1.7} />
              </span>
            </div>
            <h3>Trade-offs, not sales talk.</h3>
            <p>
              Every card carries its own compromises, pulled from the catalog record. If the record
              does not say it, the agent cannot claim it.
            </p>
            <div className="trust-visual">
              <div className="matrix-panel">
                <div className="matrix-row satisfies">
                  <Check size={12} strokeWidth={2.2} />
                  <div>
                    <span className="matrix-label">Satisfies</span>
                    16 GB RAM · 12 h battery · under $700
                  </div>
                </div>
                <div className="matrix-row costs">
                  <CircleAlert size={12} strokeWidth={2} />
                  <div>
                    <span className="matrix-label">Costs you</span>
                    300-nit display · 1.45 kg · plastic lid
                  </div>
                </div>
                <div className="matrix-row satisfies">
                  <Check size={12} strokeWidth={2.2} />
                  <div>
                    <span className="matrix-label">Runner-up</span>
                    Brighter OLED, but 2 h less battery
                  </div>
                </div>
              </div>
            </div>
          </motion.article>

          <motion.article className="trust-card" variants={fade} transition={{ duration: 0.5 }}>
            <div className="trust-card-top">
              <span className="trust-index">03 / AUTHORIZE</span>
              <span className="trust-icon">
                <LockKeyhole size={15} strokeWidth={1.7} />
              </span>
            </div>
            <h3>The AI cannot charge you.</h3>
            <p>
              Checkout accepts product IDs, not prices. The server re-prices the cart and PayPal
              capture waits for your explicit approval.
            </p>
            <div className="trust-visual">
              <div className="flow-visual">
                <div className="flow-node">
                  <Cpu size={11} strokeWidth={1.8} />
                  Agent proposes
                  <strong>no price</strong>
                </div>
                <div className="flow-line" aria-hidden="true" />
                <div className="flow-node">
                  <ArrowDown size={11} strokeWidth={1.8} />
                  Server re-prices
                  <strong>catalog.json</strong>
                </div>
                <div className="flow-line" aria-hidden="true" />
                <div className="flow-node flow-node-paypal">
                  <UserCheck size={11} strokeWidth={1.8} />
                  You approve
                  <strong>PayPal capture</strong>
                </div>
              </div>
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  );
}
