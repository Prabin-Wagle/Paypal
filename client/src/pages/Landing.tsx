import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Menu, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Architecture } from "../components/Architecture";
import { Brand } from "../components/Brand";
import { CommerceModes } from "../components/CommerceModes";
import { PreviewCard } from "../components/PreviewCard";
import { PromptStarter } from "../components/PromptStarter";
import { SiteFooter } from "../components/SiteFooter";
import { TrustLayer } from "../components/TrustLayer";
import { DEMO_PROMPTS } from "../lib/demo";

const BUNDLE_PROMPT =
  "Bundle: Programming laptop + ANC study headphones under $750 total";

export function Landing() {
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-nav">
        <div className="wrap nav-inner">
          <Link to="/" aria-label="ShopMate AI home">
            <Brand />
          </Link>

          <nav className="nav-links" aria-label="Main navigation">
            <a className="nav-link" href="#trust">
              How the trust layer works
            </a>
            <a className="nav-link" href="#architecture">
              Architecture
            </a>
            <a className="nav-link" href="#shopping">
              How to shop
            </a>
            <Link className="nav-link" to="/discover">
              Live products
            </Link>
            <Link className="nav-link" to="/app">
              Verified shop
            </Link>
          </nav>

          <div className="nav-actions">
            <Link className="btn btn-primary btn-sm hidden sm:inline-flex" to="/app">
              Open verified shop
              <ArrowUpRight size={14} strokeWidth={2} />
            </Link>
            <button
              type="button"
              className="icon-btn mobile-menu-btn"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        <div className="mobile-menu" id="mobile-navigation" data-open={menuOpen}>
          <a href="#trust" onClick={() => setMenuOpen(false)}>
            How the trust layer works
          </a>
          <a href="#architecture" onClick={() => setMenuOpen(false)}>
            Architecture
          </a>
          <a href="#shopping" onClick={() => setMenuOpen(false)}>
            How to shop
          </a>
          <Link to="/discover" onClick={() => setMenuOpen(false)}>
            Live product discovery
          </Link>
          <Link to="/app" onClick={() => setMenuOpen(false)}>
            Verified shop
          </Link>
          <Link className="btn btn-primary" to="/app" onClick={() => setMenuOpen(false)}>
            Open verified shop
            <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="wrap hero-grid">
            <motion.div
              className="hero-copy"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="eyebrow">
                <i className="live-dot" />
                PayPal Sandbox · Channel3 live discovery
              </span>

              <h1 id="hero-heading">
                <span className="line">Stop comparing 15 tabs.</span>
                <span className="line">Tell the agent what you need.</span>
                <span className="line soft">Approve only when you&rsquo;re sure.</span>
              </h1>

              <p className="hero-lede">
                Start with ShopMate’s reviewed collection for server-priced PayPal Sandbox checkout,
                or open a separate <strong>Channel3 live catalog</strong> to compare current products
                and retailer offers. Each page makes its purchase path clear.
              </p>

              <div className="hero-actions">
                <Link className="btn btn-primary" to="/app">
                  Open verified shop
                  <ArrowUpRight size={15} strokeWidth={2} />
                </Link>
                <Link className="btn btn-ghost" to="/discover">
                  Explore live products
                  <ArrowUpRight size={15} strokeWidth={2} />
                </Link>
              </div>

              <div className="prompt-block">
                <div className="prompt-heading">
                  <span className="eyebrow">Start with a real brief</span>
                  <span>click to preload →</span>
                </div>
                <div className="prompt-grid">
                  {DEMO_PROMPTS.map((item) => (
                    <PromptStarter key={item.id} item={item} />
                  ))}
                </div>
              </div>

              <div className="hero-proof">
                <span>
                  <Check size={11} strokeWidth={2.2} />
                  No invented stock
                </span>
                <span>
                  <Check size={11} strokeWidth={2.2} />
                  Prices recomputed on server
                </span>
                <span>
                  <Check size={11} strokeWidth={2.2} />
                  Capture needs your click
                </span>
              </div>
            </motion.div>

            <PreviewCard />
          </div>
        </section>

        <CommerceModes />
        <TrustLayer />
        <Architecture />

        <section className="close-wrap" id="demo" aria-labelledby="close-heading">
          <div className="wrap">
            <div className="close-band">
              <div className="close-copy">
                <span className="eyebrow">
                  <ShieldCheck size={12} strokeWidth={1.8} />
                  Two clear shopping paths
                </span>
                <h2 id="close-heading">Shop with clear prices. Explore with fresh data.</h2>
                <p>
                  Use the reviewed collection for the PayPal Sandbox checkout demo, or browse
                  Channel3 products and follow a current offer to its retailer. The two paths stay
                  separate, so checkout remains predictable.
                </p>
                <div className="close-actions">
                  <Link
                    className="btn btn-light"
                    to={`/app?prompt=${encodeURIComponent(BUNDLE_PROMPT)}`}
                  >
                    Try the verified shop
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </Link>
                  <Link className="btn btn-ghost" to="/discover">
                    Browse live products
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </Link>
                </div>
                <div className="close-note">
                  <i className="live-dot" />
                  PayPal Sandbox · no real money moves · demo keys optional
                </div>
              </div>
              <div className="close-media">
                <img
                  src="/products/headphones-05.jpg"
                  alt="Cream headphones from the verified catalog on a warm neutral surface"
                  loading="lazy"
                />
                <div className="close-media-overlay">
                  <strong>SM-HP-005</strong>
                  Catalog verified · in stock
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
