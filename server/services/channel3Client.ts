import { Channel3, Channel3Error } from "@channel3/sdk";
import type { Channel3Api } from "@channel3/sdk";
import type {
  Channel3OfferResult,
  Channel3ProductDetailResult,
  Channel3ProductResult,
} from "../types.js";

export class Channel3ApiError extends Error {
  statusCode: number;
  upstreamStatus?: number;
  requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    upstreamStatus?: number,
    requestId?: string,
  ) {
    super(message);
    this.name = "Channel3ApiError";
    this.statusCode = statusCode;
    this.upstreamStatus = upstreamStatus;
    this.requestId = requestId;
  }
}

let client: Channel3 | null = null;
type Channel3Product = Awaited<ReturnType<Channel3["products"]["retrieve"]>>;
type Channel3Offer = NonNullable<Channel3Product["offers"]>[number];

function getChannel3Client(): Channel3 {
  const apiKey = process.env.CHANNEL3_API_KEY?.trim();
  if (!apiKey) {
    const error = new Channel3ApiError(
      "Channel3 is not configured. Add CHANNEL3_API_KEY to server/.env and restart the server.",
      503,
    );
    console.error("[ShopMate Channel3] configuration error", {
      timestamp: new Date().toISOString(),
      stage: "client.configuration",
      mainError: error.message,
    });
    throw error;
  }

  if (!client) {
    client = new Channel3({
      apiKey,
      country: "US",
      currency: "USD",
      language: "en",
      timeoutInSeconds: 20,
      maxRetries: 1,
    });
  }
  return client;
}

function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapOffers(offers?: Channel3Offer[]): Channel3OfferResult[] {
  return (offers ?? []).flatMap((offer) => {
    const url = safeHttpUrl(offer.url);
    if (!url || !Number.isFinite(offer.price?.price)) return [];
    return [{
      url,
      domain: offer.domain,
      price: offer.price.price,
      currency: offer.price.currency,
      availability: offer.availability,
      condition: offer.condition ?? null,
      commissionRate: offer.max_commission_rate,
    }];
  }).sort((a, b) => a.price - b.price);
}

function mapProduct(product: Channel3Product): Channel3ProductResult {
  const mainImage = product.images?.find((image) => image.is_main_image) ?? product.images?.[0];
  return {
    id: product.id,
    title: product.title,
    brand: product.brands?.[0]?.name ?? null,
    imageUrl: safeHttpUrl(mainImage?.cleaned_url) ?? safeHttpUrl(mainImage?.url),
    description: product.description ?? null,
    offers: mapOffers(product.offers).slice(0, 8),
  };
}

function mapApiError(stage: string, cause: unknown, productId?: string): Channel3ApiError {
  const upstreamStatus = cause instanceof Channel3Error ? cause.statusCode : undefined;
  const requestId = cause instanceof Channel3Error ? cause.requestId : undefined;
  const errorName = cause instanceof Error ? cause.name : typeof cause;
  const mainError = cause instanceof Error ? cause.message : String(cause);
  console.error("[ShopMate Channel3] request failed", {
    timestamp: new Date().toISOString(),
    stage,
    productId,
    errorName,
    mainError,
    upstreamStatus,
    requestId,
  });

  const message =
    upstreamStatus === 401 || upstreamStatus === 403
      ? "Channel3 rejected the server API key. Check CHANNEL3_API_KEY in server/.env."
      : upstreamStatus === 404
        ? "Channel3 could not find that product. Search again for a current match."
        : upstreamStatus
          ? `Channel3 request failed with upstream status ${upstreamStatus}.`
          : "Channel3 could not be reached. Check the server connection and try again.";
  return new Channel3ApiError(message, upstreamStatus === 404 ? 404 : 502, upstreamStatus, requestId);
}

export async function searchChannel3Products(
  query: string,
  options: { mode?: "default" | "agentic"; limit?: number } = {},
): Promise<Channel3ProductResult[]> {
  const started = performance.now();
  const channel3 = getChannel3Client();
  const mode = options.mode ?? "default";
  const limit = Math.max(1, Math.min(options.limit ?? 8, 8));

  try {
    const page = await channel3.products.search(
      {
        query,
        limit,
        config: { mode, language: "en", country: "US", currency: "USD" },
      },
      { timeoutInSeconds: 20, maxRetries: 1 },
    );
    const products = page.data
      .map(mapProduct)
      .filter((product) => product.offers.length > 0);

    console.info("[ShopMate Channel3] search complete", {
      timestamp: new Date().toISOString(),
      mode,
      resultCount: products.length,
      elapsedMs: Math.round(performance.now() - started),
    });
    return products;
  } catch (cause) {
    throw mapApiError("products.search", cause);
  }
}

export async function getChannel3ProductDetails(
  productId: string,
  selectedOptions: Record<string, string> = {},
): Promise<Channel3ProductDetailResult> {
  const channel3 = getChannel3Client();
  try {
    const product = await channel3.products.retrieve(
      {
        product_id: productId,
        country: "US",
        currency: "USD",
        language: "en",
        ...(Object.keys(selectedOptions).length > 0 ? { selected_options: selectedOptions } : {}),
      },
      { timeoutInSeconds: 20, maxRetries: 1 },
    );
    const summary = mapProduct(product);
    return {
      ...summary,
      images: (product.images ?? []).flatMap((image) => {
        const url = safeHttpUrl(image.cleaned_url) ?? safeHttpUrl(image.url);
        return url ? [{ url, altText: image.alt_text ?? null, isMain: Boolean(image.is_main_image) }] : [];
      }),
      category: product.category?.title ?? null,
      keyFeatures: product.key_features ?? [],
      attributes: product.structured_attributes ?? {},
      variants: product.variants
        ? {
            options: product.variants.options.map((option: Channel3Api.VariantOption) => ({
              name: option.name,
              values: option.values.map((value) => ({
                label: value.label,
                exists: value.exists,
                available: value.available ?? null,
                thumbnailUrl: safeHttpUrl(value.thumbnail_url),
              })),
            })),
            selected: product.variants.selected.map(({ name, label }) => ({ name, label })),
          }
        : null,
      rating: product.ratings
        ? {
            value: product.ratings.value,
            count: product.ratings.count,
            sourceCount: product.ratings.source_count,
          }
        : null,
    };
  } catch (cause) {
    throw mapApiError("products.retrieve", cause, productId);
  }
}
