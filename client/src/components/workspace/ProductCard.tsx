import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { money } from "../../lib/format";
import { miniSpecs, specCells } from "../../lib/specs";
import type { Match } from "../../lib/types";

interface ProductCardProps {
  product: Match;
  selected: boolean;
  onToggle: (product: Match) => void;
  variant?: "best" | "compact";
}

export function ProductCard({
  product,
  selected,
  onToggle,
  variant = "compact",
}: ProductCardProps) {
  const fits = product.meets.length > 0 ? product.meets : product.verified_pros.slice(0, 4);
  const costs =
    product.compromises.length > 0
      ? product.compromises.map((compromise) => compromise.detail)
      : product.known_tradeoffs.slice(0, 4);

  if (variant === "best") {
    return (
      <article className="best-card" data-selected={selected}>
        <div className="best-media">
          <img src={product.image_url} alt={product.name} loading="lazy" />
          <div className="best-media-top">
            {product.is_stretch_option ? (
              <span className="mini-badge amber">
                <ArrowUpRight size={8} strokeWidth={2} /> Stretch +{money(product.over_budget_by)}
              </span>
            ) : (
              <span className="mini-badge emerald">
                <Sparkles size={8} strokeWidth={2} /> Best match
              </span>
            )}
            <span className="mini-badge">In stock</span>
          </div>
          <div className="best-media-bottom">
            <span>
              Catalog SKU <strong>{product.sku}</strong>
            </span>
            <span>{product.in_stock ? "Verified" : "Unavailable"}</span>
          </div>
        </div>

        <div className="best-content">
          <div className="best-brand-line">
            <span className="best-brand">{product.brand}</span>
            <span className="best-sku">score {product.match_score.toFixed(1)}</span>
          </div>
          <h3>{product.name}</h3>

          <div className="best-price-row">
            <div>
              <div className="best-price">{money(product.price_usd)}</div>
              <div className="best-price-note">
                {product.is_stretch_option
                  ? `${money(product.over_budget_by)} over your original cap`
                  : "Catalog price · server-verified"}
              </div>
            </div>
            <div className="best-cta">
              <button
                type="button"
                className={`btn btn-sm ${selected ? "btn-ghost" : "btn-primary"}`}
                onClick={() => onToggle(product)}
                aria-pressed={selected}
              >
                {selected ? (
                  <>
                    <Check size={13} strokeWidth={2.2} /> In cart
                  </>
                ) : (
                  <>
                    <ShoppingBag size={13} strokeWidth={1.9} /> Add to cart
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="spec-grid">
            {specCells(product).map((cell) => (
              <div className="spec-cell" key={cell.label}>
                <div className="spec-cell-label">{cell.label}</div>
                <div className="spec-cell-value">{cell.value}</div>
              </div>
            ))}
          </div>

          <div className="fit-columns">
            <div>
              <div className="fit-heading">
                <CheckCircle2 size={10} strokeWidth={2} /> Why we recommend it
              </div>
              <ul className="fit-list">
                {fits.slice(0, 4).map((fit) => (
                  <li key={fit}>
                    <Check className="check" size={10} strokeWidth={2.3} />
                    {fit}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="fit-heading amber">
                <CircleAlert size={10} strokeWidth={2} /> Known compromises
              </div>
              <ul className="fit-list">
                {costs.slice(0, 3).map((cost) => (
                  <li key={cost}>
                    <CircleAlert className="warn" size={10} strokeWidth={2} />
                    {cost}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="product-card" data-selected={selected}>
      <div className="product-media">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        <div className="product-media-badges">
          {product.is_stretch_option ? (
            <span className="mini-badge amber">Stretch +{money(product.over_budget_by)}</span>
          ) : null}
          {selected ? <span className="mini-badge emerald">In cart</span> : null}
        </div>
      </div>
      <div className="product-content">
        <span className="product-brand">{product.brand}</span>
        <h4 className="product-name">{product.name}</h4>
        <div className="product-specs">
          {miniSpecs(product).map((spec) => (
            <span className="product-spec" key={spec}>
              {spec}
            </span>
          ))}
        </div>
        <p className="product-tradeoff">{product.known_tradeoffs[0]}</p>
        <div className="product-foot">
          <span className="product-price">{money(product.price_usd)}</span>
          <button
            type="button"
            className="product-add"
            data-selected={selected}
            onClick={() => onToggle(product)}
            aria-pressed={selected}
          >
            {selected ? (
              <>
                <Check size={9} strokeWidth={2.4} /> Added
              </>
            ) : (
              <>
                <ShoppingBag size={9} strokeWidth={2} /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
