import crypto from "node:crypto";
import type { OrderLine } from "../types.js";

const clientId = process.env.PAYPAL_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? "";

export const paypalEnv: "sandbox" | "live" =
  process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
export const paypalConfigured = Boolean(clientId && clientSecret);
export const publicPaypalClientId = paypalConfigured ? clientId : null;

const baseUrl =
  paypalEnv === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  statusCode: number;
  details: unknown;
  debugId?: string;
  issue?: string;

  constructor(
    message: string,
    statusCode = 502,
    details?: unknown,
    debugId?: string,
    issue?: string,
  ) {
    super(message);
    this.name = "PayPalError";
    this.statusCode = statusCode;
    this.details = details;
    this.debugId = debugId;
    this.issue = issue;
  }
}

function logPayPalFailure(
  stage: string,
  error: PayPalError,
  context: Record<string, string | number | undefined> = {},
): void {
  console.error("[ShopMate checkout] PayPal API failure", {
    timestamp: new Date().toISOString(),
    stage,
    environment: paypalEnv,
    ...context,
    errorName: error.name,
    mainError: error.message,
    httpStatus: error.statusCode,
    paypalIssue: error.issue,
    paypalDebugId: error.debugId,
  });
}

interface PayPalApiErrorBody {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: { issue?: string; description?: string; field?: string }[];
}

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  if (!paypalConfigured) {
    const error = new PayPalError("PayPal credentials are not configured", 503);
    logPayPalFailure("oauth.configuration", error);
    throw error;
  }
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      console.error("[ShopMate checkout] PayPal transport failure", {
        timestamp: new Date().toISOString(),
        stage: "oauth.request",
        environment: paypalEnv,
        errorName: cause instanceof Error ? cause.name : typeof cause,
        mainError: cause instanceof Error ? cause.message : String(cause),
      });
      throw new PayPalError("Could not reach PayPal to authenticate this checkout", 502);
    }

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    } & PayPalApiErrorBody;

    if (!response.ok || !data.access_token) {
      const error = new PayPalError(
        "PayPal could not authenticate this app. Check the Sandbox app credentials and environment.",
        502,
        data.details,
        data.debug_id ?? response.headers.get("paypal-debug-id") ?? undefined,
        data.details?.[0]?.issue,
      );
      logPayPalFailure("oauth.response", error);
      throw error;
    }

    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 0) * 1000,
    };
    return data.access_token;
  })().finally(() => {
    tokenRequest = null;
  });

  return tokenRequest;
}

function networkError(operation: string): PayPalError {
  return new PayPalError(`Could not reach PayPal to ${operation}. Try again or use simulated sandbox.`, 502);
}

function simulatedId(prefix: string): string {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}

function issueFrom(data: PayPalApiErrorBody): string | undefined {
  return data.details?.find((detail) => detail.issue)?.issue;
}

function requestIdOrNew(value?: string): string {
  return value && /^[A-Za-z0-9._:-]{1,38}$/.test(value) ? value : crypto.randomUUID();
}

export interface PayPalOrderResult {
  orderID: string;
  status: string;
  mode: "paypal" | "simulated";
  paypalEnv: "sandbox" | "live";
}

export async function createPayPalOrder(params: {
  amount: string;
  currency: "USD";
  items: OrderLine[];
  sessionId: string;
  requestId?: string;
  forceSimulated?: boolean;
}): Promise<PayPalOrderResult> {
  if (!paypalConfigured || params.forceSimulated) {
    return {
      orderID: simulatedId("SIM"),
      status: "CREATED",
      mode: "simulated",
      paypalEnv,
    };
  }

  const token = await getAccessToken();
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `shopmate-${params.sessionId.slice(0, 12)}`,
        description: "ShopMate AI — verified catalog cart",
        custom_id: params.sessionId,
        amount: {
          currency_code: params.currency,
          value: params.amount,
          breakdown: {
            item_total: { currency_code: params.currency, value: params.amount },
          },
        },
        items: params.items.map((item) => ({
          name: item.name.slice(0, 127),
          sku: item.sku,
          quantity: String(item.quantity),
          category: "PHYSICAL_GOODS",
          unit_amount: { currency_code: params.currency, value: item.unitAmount },
        })),
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestIdOrNew(params.requestId),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (cause) {
    console.error("[ShopMate checkout] PayPal transport failure", {
      timestamp: new Date().toISOString(),
      stage: "order.create.request",
      environment: paypalEnv,
      requestId: params.requestId,
      errorName: cause instanceof Error ? cause.name : typeof cause,
      mainError: cause instanceof Error ? cause.message : String(cause),
    });
    throw networkError("create the order");
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  } & PayPalApiErrorBody;

  if (!response.ok || !data.id) {
    const error = new PayPalError(
      data.message ?? `PayPal rejected the order (${response.status})`,
      response.status,
      data.details,
      data.debug_id ?? response.headers.get("paypal-debug-id") ?? undefined,
      issueFrom(data),
    );
    logPayPalFailure("order.create.response", error, { requestId: params.requestId });
    throw error;
  }

  return {
    orderID: data.id,
    status: data.status ?? "CREATED",
    mode: "paypal",
    paypalEnv,
  };
}

export interface PayPalCaptureResult {
  captureID: string;
  status: "COMPLETED";
  amount: string;
  currency: string;
  payerName: string;
  payerEmail: string;
}

export async function capturePayPalOrder(
  orderID: string,
  mode: "paypal" | "simulated",
): Promise<PayPalCaptureResult> {
  if (mode === "simulated") {
    return {
      captureID: simulatedId("SIMCAP"),
      status: "COMPLETED",
      amount: "0.00",
      currency: "USD",
      payerName: "Sandbox Buyer",
      payerEmail: "sb-buyer@personal.example.com",
    };
  }

  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `capture-${crypto.createHash("sha256").update(orderID).digest("hex").slice(0, 28)}`,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch (cause) {
    console.error("[ShopMate checkout] PayPal transport failure", {
      timestamp: new Date().toISOString(),
      stage: "order.capture.request",
      environment: paypalEnv,
      orderID,
      errorName: cause instanceof Error ? cause.name : typeof cause,
      mainError: cause instanceof Error ? cause.message : String(cause),
    });
    throw networkError("capture the approved order");
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    payer?: {
      name?: { given_name?: string; surname?: string };
      email_address?: string;
    };
    purchase_units?: {
      payments?: {
        captures?: {
          id?: string;
          status?: string;
          amount?: { value?: string; currency_code?: string };
        }[];
      };
    }[];
  } & PayPalApiErrorBody;

  if (!response.ok) {
    const error = new PayPalError(
      data.message ?? `PayPal could not capture the order (${response.status})`,
      response.status,
      data.details,
      data.debug_id ?? response.headers.get("paypal-debug-id") ?? undefined,
      issueFrom(data),
    );
    logPayPalFailure("order.capture.response", error, { orderID });
    throw error;
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (data.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id) {
    const error = new PayPalError(
      "PayPal did not return a COMPLETED capture",
      502,
      undefined,
      data.debug_id,
      issueFrom(data),
    );
    logPayPalFailure("order.capture.incomplete", error, {
      orderID,
      paypalOrderStatus: data.status,
      paypalCaptureStatus: capture?.status,
    });
    throw error;
  }

  const payerName = [data.payer?.name?.given_name, data.payer?.name?.surname]
    .filter(Boolean)
    .join(" ");

  return {
    captureID: capture.id,
    status: "COMPLETED",
    amount: capture.amount?.value ?? "0.00",
    currency: capture.amount?.currency_code ?? "USD",
    payerName: payerName || "Sandbox Buyer",
    payerEmail: data.payer?.email_address ?? "not-shared@example.com",
  };
}
