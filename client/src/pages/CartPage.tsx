import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { CartCheckout } from "../components/cart/CartCheckout";
import { ReceiptView } from "../components/workspace/ReceiptView";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { BUNDLE_PROMPT, DEMO_PROMPTS } from "../lib/demo";
import { exactMoney, shortId } from "../lib/format";
import { specCells } from "../lib/specs";
import type { AppConfig, Match, OrderReceipt } from "../lib/types";

function CartItem({
  item,
  index,
  onRemove,
}: {
  item: Match;
  index: number;
  onRemove: (id: string) => void;
}) {
  const specs = specCells(item).slice(0, 4);
  const fit = item.meets[0] ?? item.ideal_for[0] ?? "Matches the brief";
  const compromise = item.compromises[0];

  return (
    <motion.article
      className="cart-item"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <div className="cart-item-media">
        <img src={item.image_url} alt={item.name} loading="lazy" />
        <span className="cart-item-index">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="cart-item-info">
        <div className="cart-item-kicker">
          {item.brand} <span aria-hidden="true">·</span> {item.sku}
        </div>
        <h3>{item.name}</h3>

        <div className="cart-specs">
          {specs.map((spec) => (
            <span key={spec.label}>
              <span>{spec.label}</span>
              <b>{spec.value}</b>
            </span>
          ))}
        </div>

        <div className="cart-item-fit">
          <CheckCircle2 size={11} strokeWidth={2} />
          {fit}
        </div>

        {compromise ? (
          <div className="cart-item-compromise">
            <CircleAlert size={11} strokeWidth={2} />
            <b>{compromise.label}</b> {compromise.detail}
          </div>
        ) : null}

        {item.is_stretch_option ? (
          <span className="pill pill-amber cart-stretch-pill">stretch lane</span>
        ) : null}
      </div>

      <div className="cart-item-side">
        <span className="cart-item-qty">Qty 1</span>
        <strong className="cart-item-price">{exactMoney(item.price_usd)}</strong>
        <span className="cart-item-price-note">catalog price</span>
        <button
          type="button"
          className="cart-remove"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} from cart`}
        >
          <Trash2 size={13} strokeWidth={1.8} />
          Remove
        </button>
      </div>
    </motion.article>
  );
}

function EmptyCart() {
  return (
    <motion.section
      className="cart-empty"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="cart-empty-icon" aria-hidden="true">
        <ShoppingBag size={26} strokeWidth={1.5} />
      </span>
      <span className="eyebrow">Cart empty</span>
      <h1>No verified SKUs selected yet.</h1>
      <p>
        Run a brief on the decision canvas, then add the product or bundle you want to review.
        Nothing can be charged from here until you explicitly approve it.
      </p>
      <Link to="/app" className="btn btn-primary">
        Open the decision canvas
        <ArrowRight size={14} strokeWidth={2} />
      </Link>

      <div className="cart-empty-prompts">
        <span>
          <Sparkles size={11} strokeWidth={2} />
          Or start with a demo brief
        </span>
        <div>
          {DEMO_PROMPTS.slice(0, 3).map((prompt) => (
            <Link key={prompt.id} to={`/app?prompt=${encodeURIComponent(prompt.prompt)}`}>
              {prompt.title}
              <ArrowRight size={11} strokeWidth={2} />
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const { selected, count, total, remove, clear, sessionId } = useCart();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((loaded) => {
        if (!alive) return;
        setConfig(loaded);
        setConfigError(false);
      })
      .catch(() => {
        if (alive) setConfigError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.title = "ShopMate AI — Cart";
    return () => {
      document.title = "ShopMate AI — the shopping agent that cannot charge you";
    };
  }, []);

  useEffect(() => {
    if (receipt) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [receipt]);

  const handleReceipt = (captured: OrderReceipt) => {
    setReceipt(captured);
    clear();
  };

  const handleStartOver = () => {
    setReceipt(null);
    clear();
    navigate("/app");
  };

  const handleRunBundle = () => {
    setReceipt(null);
    clear();
    navigate(`/app?prompt=${encodeURIComponent(BUNDLE_PROMPT)}`);
  };

  return (
    <div className="cart-page">
      <header className="cart-header">
        <div className="cart-header-inner">
          <div className="cart-header-left">
            <Link to="/" aria-label="ShopMate AI home">
              <Brand compact />
            </Link>
            <span className="workspace-crumb cart-crumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <b>Cart</b>
            </span>
          </div>

          <div className="cart-header-right">
            <span className="pill pill-emerald hide-mobile">
              <ShieldCheck size={9} strokeWidth={2} />
              {config ? `${config.catalog.products} verified SKUs` : "verified catalog"}
            </span>
            <span className="pill hide-mobile">session {shortId(sessionId, 8, 4)}</span>
            {configError ? (
              <span className="pill pill-amber">
                <CircleAlert size={9} strokeWidth={2} />
                API offline
              </span>
            ) : null}
            <Link className="btn btn-ghost btn-sm cart-header-action" to="/app">
              <ArrowLeft size={13} strokeWidth={2} />
              <span className="cart-header-action-label">Decision canvas</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="cart-main">
        {receipt ? (
          <motion.div
            className="cart-receipt-wrap"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cart-receipt-top">
              <Link to="/app" className="cart-back-link">
                <ArrowLeft size={12} strokeWidth={2} />
                Decision canvas
              </Link>
              <span className="pill pill-emerald">
                <CheckCircle2 size={9} strokeWidth={2.2} />
                capture complete
              </span>
            </div>
            <ReceiptView
              receipt={receipt}
              onStartOver={handleStartOver}
              onRunBundle={handleRunBundle}
            />
          </motion.div>
        ) : count === 0 ? (
          <EmptyCart />
        ) : (
          <>
            <motion.section
              className="cart-hero"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="cart-hero-copy">
                <span className="eyebrow">
                  <span className="live-dot" />
                  Cart review · server-priced
                </span>
                <h1>
                  Review the exact SKUs.
                  <br />
                  <em>Then approve the capture.</em>
                </h1>
                <p>
                  Every line below is a catalog record. The server re-prices the full cart before
                  PayPal sees it — and only your click can complete the capture.
                </p>
              </div>

              <div className="cart-hero-stamp" aria-label="Cart total">
                <span className="cart-stamp-label">Server total</span>
                <strong>{exactMoney(total)}</strong>
                <span className="cart-stamp-meta">
                  {count} verified item{count === 1 ? "" : "s"} · USD
                </span>
                <div className="cart-stamp-rule" />
                <span className="cart-stamp-note">
                  <ShieldCheck size={10} strokeWidth={2} />
                  Re-priced from catalog.json
                </span>
              </div>
            </motion.section>

            <div className="cart-trust-strip">
              <span>
                <ShieldCheck size={11} strokeWidth={2} />
                Server re-priced
              </span>
              <span>
                <LockKeyhole size={11} strokeWidth={2} />
                Explicit approval
              </span>
              <span>
                <CheckCircle2 size={11} strokeWidth={2} />
                PayPal capture verified
              </span>
            </div>

            <div className="cart-layout">
              <section className="cart-items" aria-label="Cart items">
                <div className="cart-items-head">
                  <div>
                    <span className="eyebrow">Selected</span>
                    <h2>
                      {count} verified item{count === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <button type="button" className="cart-clear" onClick={clear}>
                    Clear cart
                  </button>
                </div>

                <div className="cart-item-list">
                  {selected.map((item, index) => (
                    <CartItem key={item.id} item={item} index={index} onRemove={remove} />
                  ))}
                </div>

                <Link to="/app" className="cart-continue">
                  <ArrowLeft size={13} strokeWidth={2} />
                  Continue on the decision canvas
                </Link>
              </section>

              <CartCheckout
                items={selected}
                sessionId={sessionId}
                config={config}
                onReceipt={handleReceipt}
              />
            </div>
          </>
        )}
      </main>

      <footer className="cart-footer">
        <span>ShopMate AI · agentic commerce, with a deterministic brake.</span>
        <span>Prices from catalog.json · PayPal Orders v2</span>
      </footer>
    </div>
  );
}
