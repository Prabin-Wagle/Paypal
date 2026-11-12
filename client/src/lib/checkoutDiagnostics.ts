type DiagnosticContext = Record<string, string | number | boolean | null | undefined>;

function errorFields(cause: unknown): DiagnosticContext {
  const value =
    typeof cause === "object" && cause !== null
      ? (cause as Record<string, unknown>)
      : {};

  return {
    errorName:
      cause instanceof Error
        ? cause.name
        : typeof value.name === "string"
          ? value.name
          : typeof cause,
    errorMessage:
      cause instanceof Error
        ? cause.message
        : typeof value.message === "string"
          ? value.message
          : String(cause),
    errorCode: typeof value.code === "string" ? value.code : undefined,
    httpStatus: typeof value.status === "number" ? value.status : undefined,
    paypalIssue:
      typeof value.paypalIssue === "string"
        ? value.paypalIssue
        : typeof value.paypal_issue === "string"
          ? value.paypal_issue
          : undefined,
    paypalDebugId:
      typeof value.paypalDebugId === "string"
        ? value.paypalDebugId
        : typeof value.paypal_debug_id === "string"
          ? value.paypal_debug_id
          : undefined,
    channel3Status:
      typeof value.channel3Status === "number"
        ? value.channel3Status
        : typeof value.channel3_status === "number"
          ? value.channel3_status
          : undefined,
    channel3RequestId:
      typeof value.channel3RequestId === "string"
        ? value.channel3RequestId
        : typeof value.channel3_request_id === "string"
          ? value.channel3_request_id
          : undefined,
  };
}

export function checkoutEvent(stage: string, context: DiagnosticContext = {}): void {
  console.info("[ShopMate checkout]", {
    timestamp: new Date().toISOString(),
    stage,
    ...context,
  });
}

export function checkoutFailure(
  stage: string,
  cause: unknown,
  context: DiagnosticContext = {},
): void {
  console.error("[ShopMate checkout] failure", {
    timestamp: new Date().toISOString(),
    stage,
    ...context,
    ...errorFields(cause),
  });
}
