import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  LoaderCircle,
  PackageSearch,
  RotateCw,
  ShieldCheck,
  Star,
  Store,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import { titleCase } from "../../lib/format";
import type {
  Channel3ProductDetailResult,
  Channel3ProductResult,
  ProductCategory,
} from "../../lib/types";

interface Channel3SearchPanelProps {
  configured: boolean;
  autoQuery: string;
  autoSearchKey: number;
  focusCategory: ProductCategory | null;
}

const CATEGORY_ROWS: { id: ProductCategory; label: string; discoveryQuery: string }[] = [
  { id: "laptops", label: "Laptops", discoveryQuery: "programming laptop with 16GB RAM and all-day battery under $700" },
  { id: "headphones", label: "Headphones", discoveryQuery: "comfortable wireless noise cancelling headphones for studying under $100" },
  { id: "smartphones", label: "Smartphones", discoveryQuery: "smartphone with long battery life and a strong camera under $250" },
];

export function formatChannel3Price(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function bestOffer(product: Channel3ProductResult) {
  return product.offers
    .filter((offer) => offer.availability === "InStock")
    .sort((first, second) => first.price - second.price)[0] ?? product.offers[0];
}

export function Channel3ProductTile({
  product,
  onDetails,
}: {
  product: Channel3ProductResult;
  onDetails: (product: Channel3ProductResult) => void;
}) {
  const offer = bestOffer(product);

  return (
    <article className="channel3-product">
      <div className="channel3-product-image">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} loading="lazy" />
        ) : (
          <Store size={18} />
        )}
      </div>
      <div className="channel3-product-copy">
        {product.brand ? <span className="channel3-brand">{product.brand}</span> : null}
        <h3>{product.title}</h3>
        <div className="channel3-best-offer">
          {offer ? (
            <>
              <strong>{formatChannel3Price(offer.price, offer.currency)}</strong>
              <span>{offer.domain} · {offer.availability === "InStock" ? "in stock" : "check stock"}</span>
            </>
          ) : (
            <span>Live pricing unavailable</span>
          )}
        </div>
        <button className="channel3-detail-button" type="button" onClick={() => onDetails(product)}>
          <PackageSearch size={13} /> Product details <ArrowUpRight size={12} />
        </button>
      </div>
    </article>
  );
}

export function Channel3ProductDetailsDialog({
  product,
  details,
  loading,
  error,
  selectedOptions,
  onSelectOption,
  onRefresh,
  onClose,
}: {
  product: Channel3ProductResult | null;
  details: Channel3ProductDetailResult | null;
  loading: boolean;
  error: string | null;
  selectedOptions: Record<string, string>;
  onSelectOption: (name: string, value: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const detailImage = details ? details.images.find((image) => image.isMain) ?? details.images[0] : null;

  useEffect(() => {
    if (!product) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  return (
    <AnimatePresence>
      {product ? (
        <motion.div
          className="channel3-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="channel3-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="channel3-dialog-title"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="channel3-dialog-head">
              <div>
                <span className="channel3-eyebrow"><Store size={12} /> Channel3 product record</span>
                <h2 id="channel3-dialog-title">{details?.title ?? product.title}</h2>
                <p>{details?.brand ?? product.brand ?? "Retail product"}{details?.category ? ` · ${details.category}` : ""}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close product details" onClick={onClose}>
                <X size={15} />
              </button>
            </header>

            <div className="channel3-dialog-body">
              {loading && !details ? (
                <div className="channel3-detail-loading" role="status">
                  <LoaderCircle size={18} className="channel3-spinner" /> Loading current product data…
                </div>
              ) : null}
              {error ? <p className="channel3-detail-error" role="alert">{error}</p> : null}

              {details ? (
                <>
                  <div className="channel3-detail-overview">
                    <div className="channel3-detail-image">
                      {detailImage ? (
                        <img
                          src={detailImage.url}
                          alt={detailImage.altText ?? details.title}
                        />
                      ) : <PackageSearch size={26} />}
                    </div>
                    <div className="channel3-detail-summary">
                      {details.rating ? (
                        <div className="channel3-rating">
                          <Star size={13} fill="currentColor" />
                          <strong>{details.rating.value.toFixed(1)}</strong>
                          <span>{details.rating.count.toLocaleString()} ratings across {details.rating.sourceCount} sources</span>
                        </div>
                      ) : null}
                      <p>{details.description || "No product description was provided by the retailer catalog."}</p>
                      <div className="channel3-fresh-note"><Check size={12} /> Offer data refreshed for this view</div>
                    </div>
                  </div>

                  {details.keyFeatures.length > 0 ? (
                    <section className="channel3-detail-section">
                      <h3>Key features</h3>
                      <ul className="channel3-feature-list">
                        {details.keyFeatures.slice(0, 8).map((feature) => <li key={feature}>{feature}</li>)}
                      </ul>
                    </section>
                  ) : null}

                  {details.variants?.options.length ? (
                    <section className="channel3-detail-section">
                      <div className="channel3-detail-section-heading">
                        <h3>Choose a variant</h3>
                        <button type="button" onClick={onRefresh} disabled={loading}>
                          {loading ? <LoaderCircle size={12} className="channel3-spinner" /> : <RotateCw size={12} />}
                          Refresh offers
                        </button>
                      </div>
                      <div className="channel3-variant-grid">
                        {details.variants.options.map((option) => (
                          <label className="channel3-variant" key={option.name}>
                            <span>{option.name}</span>
                            <select
                              value={selectedOptions[option.name] ?? details.variants?.selected.find((selected) => selected.name === option.name)?.label ?? ""}
                              onChange={(event) => onSelectOption(option.name, event.target.value)}
                            >
                              {option.values.filter((value) => value.exists).map((value) => (
                                <option key={value.label} value={value.label} disabled={value.available === "OutOfStock"}>
                                  {value.label}{value.available === "OutOfStock" ? " · unavailable" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {Object.keys(details.attributes).length > 0 ? (
                    <section className="channel3-detail-section">
                      <h3>Product attributes</h3>
                      <dl className="channel3-attribute-grid">
                        {Object.entries(details.attributes).slice(0, 12).map(([key, values]) => (
                          <div key={key}>
                            <dt>{titleCase(key)}</dt>
                            <dd>{values.join(", ")}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}

                  <section className="channel3-detail-section">
                    <h3>Current retailer offers</h3>
                    {details.offers.length ? (
                      <div className="channel3-detail-offers">
                        {details.offers.map((offer) => (
                          <a className="channel3-detail-offer" href={offer.url} key={`${offer.domain}-${offer.price}`} target="_blank" rel="noopener noreferrer">
                            <span>
                              <strong>{offer.domain}</strong>
                              <small>{offer.availability === "InStock" ? "In stock" : "Out of stock"}{offer.condition ? ` · ${offer.condition}` : ""}</small>
                            </span>
                            <b>{formatChannel3Price(offer.price, offer.currency)}</b>
                            <ExternalLink size={13} />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="channel3-no-offers">No current retailer offers are available for this product.</p>
                    )}
                    <p className="channel3-checkout-note">
                      <ShieldCheck size={13} /> Retailer links open merchant checkout. PayPal checkout is for verified ShopMate catalog items.
                    </p>
                  </section>
                </>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Channel3SearchPanel({
  configured,
  autoQuery,
  autoSearchKey,
  focusCategory,
}: Channel3SearchPanelProps) {
  const [products, setProducts] = useState<Partial<Record<ProductCategory, Channel3ProductResult[]>>>({});
  const [loading, setLoading] = useState<ProductCategory[]>([]);
  const [errors, setErrors] = useState<Partial<Record<ProductCategory, string>>>({});
  const [activeProduct, setActiveProduct] = useState<Channel3ProductResult | null>(null);
  const [details, setDetails] = useState<Channel3ProductDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const detailRequestId = useRef(0);

  useEffect(() => {
    if (autoSearchKey < 1 || !autoQuery.trim() || !configured) return;
    let cancelled = false;
    setProducts({});
    setErrors({});
    setLoading(CATEGORY_ROWS.map(({ id }) => id));

    for (const category of CATEGORY_ROWS) {
      const usesBrief = category.id === focusCategory;
      const query = (usesBrief ? autoQuery : category.discoveryQuery).slice(0, 300);
      const mode = usesBrief ? "agentic" : "default";
      void api.channel3Search(query, mode, 3)
        .then((response) => {
          if (!cancelled) setProducts((current) => ({ ...current, [category.id]: response.products }));
        })
        .catch((cause) => {
          if (!cancelled) {
            setErrors((current) => ({
              ...current,
              [category.id]: cause instanceof Error ? cause.message : "Product search failed.",
            }));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading((current) => current.filter((item) => item !== category.id));
        });
    }

    return () => { cancelled = true; };
  }, [autoQuery, autoSearchKey, configured, focusCategory]);

  const loadDetails = async (product: Channel3ProductResult, options: Record<string, string> = {}) => {
    const requestId = ++detailRequestId.current;
    setActiveProduct(product);
    setDetailLoading(true);
    setDetailError(null);
    if (!details || details.id !== product.id) setDetails(null);
    try {
      const freshDetails = await api.channel3Product(product.id, options);
      if (requestId !== detailRequestId.current) return;
      setDetails(freshDetails);
      setSelectedOptions(Object.fromEntries(freshDetails.variants?.selected.map(({ name, label }) => [name, label]) ?? []));
    } catch (cause) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(cause instanceof Error ? cause.message : "Could not load current product details.");
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const updateVariantSelection = (name: string, value: string) => {
    setSelectedOptions((current) => ({ ...current, [name]: value }));
  };

  if (autoSearchKey < 1) return null;

  return (
    <>
      <section className="channel3-panel" aria-label="Channel3 live product catalog">
        <div className="channel3-panel-heading">
          <div>
            <span className="channel3-eyebrow"><Store size={12} /> Live product data · Channel3</span>
            <h2>Shop live products across three categories</h2>
            <p>The requested category follows your brief; the other rows add live discovery picks. Open any item for full product data and fresh offers.</p>
          </div>
          <span className="channel3-live-mark"><i /> {configured ? "LIVE" : "OFFLINE"}</span>
        </div>

        {!configured ? (
          <p className="channel3-message" role="status">Add CHANNEL3_API_KEY to server/.env and restart the server to enable live product data.</p>
        ) : null}

        {CATEGORY_ROWS.map(({ id, label }) => {
          const categoryProducts = products[id] ?? [];
          const isLoading = loading.includes(id);
          return (
            <section className="channel3-category-row" key={id} aria-label={`${label} live products`}>
              <div className="channel3-category-heading">
                <h3>{label}</h3>
                <span>{isLoading ? "Searching Channel3…" : `${categoryProducts.length} products · ${id === focusCategory ? "for your brief" : "discovery"}`}</span>
              </div>
              {isLoading ? <div className="channel3-row-loading"><LoaderCircle size={14} className="channel3-spinner" /> Finding current products and offers</div> : null}
              {errors[id] ? <p className="channel3-message channel3-message-error" role="alert">{errors[id]}</p> : null}
              {!isLoading && !errors[id] && categoryProducts.length === 0 ? <p className="channel3-empty-row">No current matching listings returned for this category.</p> : null}
              {categoryProducts.length ? (
                <div className="channel3-products-grid">
                  {categoryProducts.map((product) => (
                    <Channel3ProductTile key={`${id}-${product.id}`} product={product} onDetails={(item) => void loadDetails(item)} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
        <p className="channel3-catalog-footnote">Offer prices and variant availability refresh when you open product details. Retailer checkout opens on the merchant’s site.</p>
      </section>

      <Channel3ProductDetailsDialog
        product={activeProduct}
        details={details}
        loading={detailLoading}
        error={detailError}
        selectedOptions={selectedOptions}
        onSelectOption={updateVariantSelection}
        onRefresh={() => activeProduct && void loadDetails(activeProduct, selectedOptions)}
        onClose={() => {
          detailRequestId.current += 1;
          setActiveProduct(null);
          setDetails(null);
          setDetailError(null);
        }}
      />
    </>
  );
}
