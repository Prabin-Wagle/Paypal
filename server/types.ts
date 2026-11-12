export type ProductCategory = "laptops" | "headphones" | "smartphones";
export type SearchTarget = ProductCategory | "bundle" | "all";

export interface ProductSpecs {
  ram_gb?: number;
  storage_gb?: number;
  battery_hours: number;
  weight_kg: number;
  display: string;
  processor?: string;
  anc_level?: number;
  comfort_rating?: number;
  camera_mp?: number;
  screen_inches?: number;
  charging_watts?: number;
  wireless?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price_usd: number;
  in_stock: boolean;
  image_url: string;
  specs: ProductSpecs;
  ideal_for: string[];
  verified_pros: string[];
  known_tradeoffs: string[];
}

export interface HardFilters {
  min_ram_gb?: number;
  min_storage_gb?: number;
  min_battery_hours?: number;
  max_weight_kg?: number;
  wireless?: boolean;
  anc?: boolean;
  min_comfort_rating?: number;
  min_camera_mp?: number;
}

export interface Requirements {
  category: SearchTarget;
  bundle_categories: ProductCategory[];
  budget_max: number | null;
  budget_was_explicit: boolean;
  hard_filters: HardFilters;
  use_case: string;
  priorities: string[];
  source: "llm" | "rules";
  interpretation: string;
}

export interface Match extends Product {
  match_score: number;
  meets: string[];
  compromises: { label: string; detail: string }[];
  is_stretch_option: boolean;
  over_budget_by: number;
}

export interface BundleOption {
  id: string;
  items: Match[];
  total: number;
  budget_max: number | null;
  remaining: number | null;
  score: number;
  is_stretch_option: boolean;
  over_budget_by: number;
}

export interface Recommendation {
  kind: "product" | "bundle";
  product_id?: string;
  bundle_id?: string;
  headline: string;
  summary: string;
  why: { label: string; detail: string }[];
  compromises: { label: string; detail: string }[];
  runner_up_note?: string;
}

export interface PipelineStep {
  id: "extract" | "filter" | "evaluate" | "approve";
  label: string;
  status: "complete";
  detail: string;
}

export interface PipelineMeta {
  catalog_size: number;
  strict_matches: number;
  stretch_applied: boolean;
  relaxed_budget: number | null;
  elapsed_ms: number;
  steps: PipelineStep[];
  grounded: true;
}

export interface Channel3OfferResult {
  url: string;
  domain: string;
  price: number;
  currency: string;
  availability: "InStock" | "OutOfStock";
  condition: "new" | "used" | null;
  commissionRate?: number;
}

export interface Channel3ProductResult {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  description: string | null;
  offers: Channel3OfferResult[];
}

export interface Channel3ProductDetailResult extends Channel3ProductResult {
  images: { url: string; altText: string | null; isMain: boolean }[];
  category: string | null;
  keyFeatures: string[];
  attributes: Record<string, string[]>;
  variants: {
    options: {
      name: string;
      values: {
        label: string;
        exists: boolean;
        available: "InStock" | "OutOfStock" | null;
        thumbnailUrl: string | null;
      }[];
    }[];
    selected: { name: string; label: string }[];
  } | null;
  rating: { value: number; count: number; sourceCount: number } | null;
}

export interface AgentResult {
  requirements: Requirements;
  results: Match[];
  bundles: BundleOption[];
  recommendation: Recommendation | null;
  channel3Products?: Channel3ProductResult[];
  meta: PipelineMeta;
}

export interface OrderLine {
  productId: string;
  sku: string;
  name: string;
  unitAmount: string;
  quantity: number;
  image_url: string;
}

export interface OrderReceipt {
  orderID: string;
  captureID: string;
  status: "COMPLETED";
  timestamp: string;
  amount: string;
  currency: "USD";
  mode: "paypal" | "simulated";
  paypalEnv: "sandbox" | "live";
  payerName: string;
  payerEmail: string;
  items: OrderLine[];
  quickStart: string[];
  warranty: string;
  audit: { label: string; at: string; detail: string }[];
}
