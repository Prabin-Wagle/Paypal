import { Link } from "react-router-dom";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand badge={false} />
            <p>
              A shopping agent with two clear paths: a reviewed ShopMate collection with PayPal
              Sandbox checkout, and a separate Channel3 catalog for live retailer discovery.
            </p>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/#trust">Trust layer</Link>
            <Link to="/#architecture">Architecture</Link>
            <Link to="/app">Verified shop</Link>
            <Link to="/discover">Live product discovery</Link>
            <Link to="/app?prompt=Bundle%3A%20Programming%20laptop%20%2B%20ANC%20study%20headphones%20under%20%24750%20total">
              Bundle demo
            </Link>
          </div>

          <div className="footer-col">
            <h4>Boundary</h4>
            <span>ShopMate prices set on server</span>
            <span>PayPal Orders v2 Sandbox</span>
            <span>Channel3 merchant offers</span>
            <span>Human capture approval</span>
          </div>

          <div className="footer-col">
            <h4>Notes</h4>
            <span>24 reviewed shop products</span>
            <span>Live laptops, audio, and phones</span>
            <span>Product photography via Unsplash</span>
            <span>No real money moves</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 ShopMate AI · a hackathon prototype</span>
          <span>
            PayPal is a trademark of PayPal, Inc. Catalog imagery is representative stand-in
            photography.
          </span>
        </div>
      </div>
    </footer>
  );
}
