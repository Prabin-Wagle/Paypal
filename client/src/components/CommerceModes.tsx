import { ArrowRight, ArrowUpRight, Check, Headphones, Laptop, ShieldCheck, Smartphone, Store } from "lucide-react";
import { Link } from "react-router-dom";

export function CommerceModes() {
  return (
    <section className="commerce-modes-section section" id="shopping" aria-labelledby="commerce-modes-heading">
      <div className="wrap">
        <div className="commerce-modes-heading">
          <div>
            <span className="eyebrow"><Store size={12} /> Two ways to shop</span>
            <h2 id="commerce-modes-heading">Choose the kind of catalog you need.</h2>
          </div>
          <p>
            ShopMate keeps its reviewed collection and PayPal demo checkout separate from live
            products found across retailers.
          </p>
        </div>

        <div className="commerce-mode-grid">
          <Link className="commerce-mode-card commerce-mode-curated" to="/app">
            <div className="commerce-mode-image">
              <img src="/products/laptop-05.jpg" alt="A laptop from ShopMate’s reviewed collection" loading="lazy" />
              <span className="commerce-mode-image-label"><ShieldCheck size={11} /> ShopMate collection</span>
            </div>
            <div className="commerce-mode-copy">
              <span className="commerce-mode-kicker">CURATED · PAYPAL SANDBOX</span>
              <h3>Shop the verified collection</h3>
              <p>Compare 24 reviewed laptops, headphones, and phones. The server sets every price and waits for your approval before capture.</p>
              <div className="commerce-mode-facts">
                <span><Check size={11} /> Server-priced items</span>
                <span><Check size={11} /> PayPal approval flow</span>
              </div>
              <span className="commerce-mode-action">Open ShopMate shop <ArrowRight size={14} /></span>
            </div>
          </Link>

          <Link className="commerce-mode-card commerce-mode-live" to="/discover">
            <div className="commerce-mode-live-visual" aria-hidden="true">
              <div className="commerce-live-topline"><span><i /> CHANNEL3 LIVE CATALOG</span><ArrowUpRight size={14} /></div>
              <div className="commerce-live-tiles">
                <div><Laptop size={21} /><span>Laptops</span></div>
                <div><Headphones size={21} /><span>Headphones</span></div>
                <div><Smartphone size={21} /><span>Phones</span></div>
              </div>
              <div className="commerce-live-offer"><span>Retailer offers</span><strong>Fresh at product view <ArrowRight size={12} /></strong></div>
            </div>
            <div className="commerce-mode-copy">
              <span className="commerce-mode-kicker">LIVE DISCOVERY · CHANNEL3</span>
              <h3>Explore products across retailers</h3>
              <p>Search real product records, inspect features and variants, then compare current merchant offers before choosing where to buy.</p>
              <div className="commerce-mode-facts">
                <span><Check size={11} /> Live product details</span>
                <span><Check size={11} /> Merchant checkout links</span>
              </div>
              <span className="commerce-mode-action">Browse live products <ArrowRight size={14} /></span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
