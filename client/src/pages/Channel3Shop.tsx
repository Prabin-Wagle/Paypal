import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Headphones,
  Laptop,
  LoaderCircle,
  Search,
  Smartphone,
  Sparkles,
  Store,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import {
  Channel3ProductDetailsDialog,
  Channel3ProductTile,
} from "../components/workspace/Channel3SearchPanel";
import { SiteFooter } from "../components/SiteFooter";
import { api } from "../lib/api";
import type {
  AppConfig,
  Channel3ProductDetailResult,
  Channel3ProductResult,
  ProductCategory,
} from "../lib/types";

const CATEGORY_BRIEFS: {
  id: ProductCategory;
  label: string;
  description: string;
  query: string;
  icon: typeof Laptop;
}[] = [
  {
    id: "laptops",
    label: "Laptops",
    description: "Work, study, and creative setups",
    query: "Programming laptop with strong battery life under $800",
    icon: Laptop,
  },
  {
    id: "headphones",
    label: "Headphones",
    description: "Wireless, comfortable, and noise cancelling",
    query: "Comfortable wireless noise cancelling headphones under $150",
    icon: Headphones,
  },
  {
    id: "smartphones",
    label: "Smartphones",
    description: "Long battery life and clear cameras",
    query: "Smartphone with long battery life and a good camera under $400",
    icon: Smartphone,
  },
];

export function Channel3Shop() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [focusCategory, setFocusCategory] = useState<ProductCategory | null>(null);
  const [products, setProducts] = useState<Channel3ProductResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Channel3ProductResult | null>(null);
  const [details, setDetails] = useState<Channel3ProductDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const searchRequestId = useRef(0);
  const detailRequestId = useRef(0);

  useEffect(() => {
    document.title = "ShopMate AI — Live product discovery";
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    let alive = true;
    api.config().then((loaded) => {
      if (!alive) return;
      setConfig(loaded);
      setConfigError(false);
    }).catch(() => {
      if (alive) setConfigError(true);
    });
    return () => {
      alive = false;
      document.title = "ShopMate AI — the shopping agent that cannot charge you";
    };
  }, []);

  const searchProducts = async (rawQuery: string, category: ProductCategory | null = null) => {
    const normalized = rawQuery.trim();
    if (normalized.length < 2 || normalized.length > 300) {
      setSearchError("Enter a product brief between 2 and 300 characters.");
      return;
    }
    if (!config?.channel3Configured) {
      setSearchError("Live product search is unavailable. Check the server’s Channel3 configuration.");
      return;
    }

    const requestId = ++searchRequestId.current;
    setQuery(normalized);
    setSearchedQuery(normalized);
    setFocusCategory(category);
    setSearchLoading(true);
    setSearchError(null);
    setProducts([]);
    try {
      const response = await api.channel3Search(normalized, "agentic", 6);
      if (requestId === searchRequestId.current) setProducts(response.products);
    } catch (cause) {
      if (requestId === searchRequestId.current) {
        setSearchError(cause instanceof Error ? cause.message : "Channel3 search failed. Try again.");
      }
    } finally {
      if (requestId === searchRequestId.current) setSearchLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void searchProducts(query, focusCategory);
  };

  const loadDetails = async (product: Channel3ProductResult, options: Record<string, string> = {}) => {
    const requestId = ++detailRequestId.current;
    setActiveProduct(product);
    setDetailLoading(true);
    setDetailError(null);
    setDetails(null);
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

  const closeDetails = () => {
    detailRequestId.current += 1;
    setActiveProduct(null);
    setDetails(null);
    setDetailError(null);
  };

  const updateVariantSelection = (name: string, value: string) => {
    setSelectedOptions((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className="channel3-shop-page">
      <header className="channel3-shop-nav">
        <div className="wrap channel3-shop-nav-inner">
          <Link to="/" aria-label="ShopMate AI home"><Brand /></Link>
          <nav aria-label="Product discovery navigation">
            <Link to="/">Overview</Link>
            <Link to="/app">Verified shop</Link>
            <span aria-current="page">Live discovery</span>
          </nav>
          <Link className="btn btn-primary btn-sm" to="/app">
            ShopMate collection <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main>
        <section className="channel3-shop-hero" aria-labelledby="channel3-shop-title">
          <div className="wrap">
            <div className="channel3-shop-hero-copy">
              <span className="eyebrow"><span className="live-dot" /> Live discovery · powered by Channel3</span>
              <h1 id="channel3-shop-title">One product. A better view of the market.</h1>
              <p>
                Search current products across retailers. Open a product to inspect its details,
                variants, and fresh offers before choosing where to buy.
              </p>
            </div>

            <form className="channel3-page-search" onSubmit={handleSubmit}>
              <Search size={17} aria-hidden="true" />
              <label className="sr-only" htmlFor="channel3-page-query">Search live products</label>
              <input
                id="channel3-page-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFocusCategory(null);
                }}
                placeholder="Describe what you want to find…"
                maxLength={300}
                disabled={!config?.channel3Configured || searchLoading}
              />
              <button type="submit" disabled={!config?.channel3Configured || searchLoading || query.trim().length < 2}>
                {searchLoading ? <><LoaderCircle size={14} className="channel3-spinner" /> Searching</> : <>Search products <ArrowRight size={14} /></>}
              </button>
            </form>

            {configError ? (
              <p className="channel3-page-config-error" role="alert">ShopMate could not reach its server. Check the local server and refresh this page.</p>
            ) : !config?.channel3Configured ? (
              <p className="channel3-page-config-error" role="status">{config ? "Channel3 is not configured. Add CHANNEL3_API_KEY to server/.env and restart the server." : "Connecting to live product data…"}</p>
            ) : null}
          </div>
        </section>

        <section className="channel3-discovery wrap" aria-label="Live product search results">
          <div className="channel3-discovery-heading">
            <div>
              <span className="eyebrow"><Sparkles size={12} /> Choose a starting point</span>
              <h2>{searchedQuery ? "Live retailer matches" : "Explore a category"}</h2>
              <p>{searchedQuery ? `Results for “${searchedQuery}”` : "Start with a brief or pick a category below."}</p>
            </div>
            {products.length ? <span className="channel3-results-count">{products.length} products</span> : null}
          </div>

          {!searchedQuery ? (
            <div className="channel3-category-cards">
              {CATEGORY_BRIEFS.map(({ id, label, description, query: brief, icon: Icon }) => (
                <button
                  className="channel3-category-card"
                  type="button"
                  key={id}
                  disabled={!config?.channel3Configured || searchLoading}
                  onClick={() => void searchProducts(brief, id)}
                >
                  <span className="channel3-category-icon"><Icon size={18} strokeWidth={1.7} /></span>
                  <span className="channel3-category-card-copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          ) : null}

          {searchLoading ? (
            <div className="channel3-page-loading" role="status">
              <LoaderCircle size={18} className="channel3-spinner" />
              Searching live product data and retailer offers…
            </div>
          ) : null}
          {searchError ? <p className="channel3-message channel3-message-error" role="alert">{searchError}</p> : null}
          {!searchLoading && searchedQuery && !searchError && products.length === 0 ? (
            <div className="channel3-page-empty" role="status">
              <Store size={20} />
              <strong>No live matches yet</strong>
              <span>Try a broader category or a simpler description.</span>
            </div>
          ) : null}
          {products.length ? (
            <div className="channel3-page-products">
              {products.map((product) => (
                <Channel3ProductTile key={product.id} product={product} onDetails={(item) => void loadDetails(item)} />
              ))}
            </div>
          ) : null}

          <aside className="channel3-page-boundary">
            <div className="channel3-boundary-icon"><Store size={15} /></div>
            <div>
              <strong>Retailer offer links open the merchant checkout.</strong>
              <span>ShopMate’s separate verified collection keeps its own PayPal Sandbox cart and server-priced checkout.</span>
            </div>
            <Link to="/app">Open verified shop <ArrowRight size={13} /></Link>
          </aside>
        </section>
      </main>

      <Channel3ProductDetailsDialog
        product={activeProduct}
        details={details}
        loading={detailLoading}
        error={detailError}
        selectedOptions={selectedOptions}
        onSelectOption={updateVariantSelection}
        onRefresh={() => activeProduct && void loadDetails(activeProduct, selectedOptions)}
        onClose={closeDetails}
      />
      <SiteFooter />
    </div>
  );
}
