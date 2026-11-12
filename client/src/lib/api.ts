import type {
  AgentResult,
  AppConfig,
  Channel3ProductDetailResult,
  Channel3SearchResponse,
  OrderCreateResponse,
  OrderReceipt,
  Requirements,
} from "./types";
import { checkoutFailure } from "./checkoutDiagnostics";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  fallbackAvailable: boolean;
  paypalDebugId?: string;
  paypalIssue?: string;
  channel3Status?: number;
  channel3RequestId?: string;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    fallbackAvailable = false,
    paypalDebugId?: string,
    paypalIssue?: string,
    channel3Status?: number,
    channel3RequestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.fallbackAvailable = fallbackAvailable;
    this.paypalDebugId = paypalDebugId;
    this.paypalIssue = paypalIssue;
    this.channel3Status = channel3Status;
    this.channel3RequestId = channel3RequestId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const isDiagnosticRequest =
    path === "/api/config" || path.startsWith("/api/orders") || path.startsWith("/api/channel3");
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (cause) {
    if (isDiagnosticRequest) {
      checkoutFailure("api.network", cause, {
        method,
        path,
        provider: path.startsWith("/api/channel3") ? "Channel3" : "PayPal",
      });
    }
    throw cause;
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new ApiError(
      typeof data.error === "string" ? data.error : `Request failed (${response.status})`,
      response.status,
      data.details ?? data,
      Boolean(data.fallback_available),
      typeof data.paypal_debug_id === "string" ? data.paypal_debug_id : undefined,
      typeof data.paypal_issue === "string" ? data.paypal_issue : undefined,
      typeof data.channel3_status === "number" ? data.channel3_status : undefined,
      typeof data.channel3_request_id === "string" ? data.channel3_request_id : undefined,
    );
    if (isDiagnosticRequest) {
      checkoutFailure("api.response", error, {
        method,
        path,
        provider: path.startsWith("/api/channel3") ? "Channel3" : "PayPal",
      });
    }
    throw error;
  }
  return data as T;
}

const post = (path: string, body: unknown, headers?: Record<string, string>) =>
  request<unknown>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });

export const api = {
  config: () => request<AppConfig>("/api/config"),

  query: (prompt: string) =>
    post("/api/agent/query", { prompt }) as Promise<AgentResult>,

  refine: (requirements: Requirements, removed: string[]) =>
    post("/api/agent/refine", { requirements, removed }) as Promise<AgentResult>,

  search: (requirements: Requirements) =>
    post("/api/agent/search", { requirements }) as Promise<AgentResult>,

  channel3Search: (query: string, mode: "default" | "agentic" = "agentic", limit = 6) =>
    post("/api/channel3/search", { query, mode, limit }) as Promise<Channel3SearchResponse>,

  channel3Product: (productId: string, selectedOptions: Record<string, string> = {}) =>
    post(`/api/channel3/products/${encodeURIComponent(productId)}`, { selectedOptions }) as Promise<Channel3ProductDetailResult>,

  createOrder: (
    productIds: string[],
    sessionId: string,
    simulated: boolean,
    requestId?: string,
  ) =>
    post(
      "/api/orders/create",
      { productIds, sessionId },
      {
        ...(simulated ? { "x-shopmate-payment-mode": "simulated" } : {}),
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
    ) as Promise<OrderCreateResponse>,

  captureOrder: (orderID: string) =>
    post("/api/orders/capture", { orderID }) as Promise<OrderReceipt>,

  receipt: (orderID: string) =>
    request<OrderReceipt>(`/api/orders/${encodeURIComponent(orderID)}/receipt`),
};
