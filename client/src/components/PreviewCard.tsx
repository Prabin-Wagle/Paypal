import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ShieldCheck, Sparkles } from "lucide-react";

const PROMPT = "Programming laptop under $700, 16GB RAM, strong battery for VS Code";

const PRODUCTS = [
  {
    name: "Lenovo ThinkPad E14",
    meta: "16 GB · 12 h",
    price: "$649",
    image: "/products/laptop-01.jpg",
  },
  {
    name: "Acer Swift Go 14",
    meta: "OLED · 16 GB",
    price: "$679",
    image: "/products/laptop-02.jpg",
  },
  {
    name: "Dell Inspiron 14 Plus",
    meta: "2.2K · 16 GB",
    price: "$699",
    image: "/products/laptop-03.jpg",
  },
];

const PILLS = [
  "Category: Laptop",
  "Max: $700",
  "RAM ≥ 16 GB",
  "Use: Programming",
  "Priority: Battery",
];

const FOOTER_COPY = [
  "Parsing natural language",
  "Typed constraints extracted",
  "3 verified matches ranked",
  "Cart ready · approval required",
];

export function PreviewCard() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(reducedMotion ? 3 : 0);
  const [typed, setTyped] = useState(reducedMotion ? PROMPT : "");

  useEffect(() => {
    if (reducedMotion) {
      setStage(3);
      setTyped(PROMPT);
      return;
    }
    const timer = window.setInterval(() => {
      setStage((current) => (current + 1) % 4);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    if (stage !== 0) {
      setTyped(PROMPT);
      return;
    }
    setTyped("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setTyped(PROMPT.slice(0, index));
      if (index >= PROMPT.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [stage, reducedMotion]);

  return (
    <motion.div
      className="hero-preview"
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="preview-plate" aria-hidden="true" />
      <div className="preview-frame">
        <div className="preview-top">
          <span className="preview-top-label">
            <Sparkles size={11} strokeWidth={1.8} />
            Decision canvas
          </span>
          <span className="preview-live">
            <i className="live-dot" />
            Sandbox live
          </span>
        </div>

        <div className="preview-body">
          <div className="preview-query" aria-live="polite">
            {typed}
            {!reducedMotion && stage === 0 ? <span className="caret" /> : null}
          </div>

          <div className="preview-stage preview-pills" data-active={stage >= 1}>
            {PILLS.map((pill) => (
              <span className="preview-pill" key={pill}>
                {pill}
              </span>
            ))}
            <span className="preview-pill verified">
              <Check size={8} strokeWidth={2.4} /> 16 GB
            </span>
          </div>

          <div className="preview-stage preview-products" data-active={stage >= 2}>
            {PRODUCTS.map((product) => (
              <div className="preview-product" key={product.name}>
                <img src={product.image} alt="" loading="lazy" />
                <div className="min-w-0">
                  <div className="preview-product-name">{product.name}</div>
                  <div className="preview-product-meta">{product.meta}</div>
                </div>
                <span className="preview-product-price">{product.price}</span>
              </div>
            ))}
          </div>

          <div className="preview-stage preview-checkout" data-active={stage >= 3}>
            <div className="preview-checkout-left">
              <span className="preview-checkout-title">
                <ShieldCheck size={9} strokeWidth={2} />
                Server price verified · no auto-charge
              </span>
              <span className="preview-checkout-sub">
                1 item · <span className="paypal-wordmark">PayPal</span> Sandbox
              </span>
            </div>
            <span className="preview-checkout-amount">$649.00</span>
          </div>
        </div>

        <div className="preview-footer">
          <span>
            <i className="live-dot" />
            {FOOTER_COPY[stage]}
          </span>
          <span className="ok">
            <Check size={9} strokeWidth={2.2} />
            grounded in catalog.json
          </span>
        </div>
      </div>
    </motion.div>
  );
}
