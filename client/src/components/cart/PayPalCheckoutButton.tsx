import { useEffect } from "react";
import {
  INSTANCE_LOADING_STATE,
  PayPalOneTimePaymentButton,
  PayPalProvider,
  usePayPal,
  type OnErrorData,
} from "@paypal/react-paypal-js/sdk-v6";
import { checkoutEvent, checkoutFailure } from "../../lib/checkoutDiagnostics";

interface PayPalCheckoutButtonProps {
  surface: "cart" | "workspace";
  clientId: string;
  environment: "sandbox" | "live";
  onCreateOrder: (requestId: string) => Promise<string>;
  onApprove: (orderId: string) => Promise<void>;
  onCancel: () => void;
  onError: (error: OnErrorData) => void;
}

function PayPalButtonSession({
  surface,
  environment,
  onCreateOrder,
  onApprove,
  onCancel,
  onError,
}: Omit<PayPalCheckoutButtonProps, "clientId">) {
  const { loadingStatus, error } = usePayPal();

  useEffect(() => {
    if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) {
      checkoutEvent("paypal.sdk.loading", { surface, environment });
    } else if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) {
      checkoutFailure("paypal.sdk.load", error ?? new Error("PayPal SDK failed to load"), {
        surface,
        environment,
      });
    } else {
      checkoutEvent("paypal.sdk.ready", { surface, environment });
    }
  }, [environment, error, loadingStatus, surface]);

  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) {
    return <div className="paypal-sdk-status">Loading secure PayPal checkout…</div>;
  }

  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) {
    return (
      <div className="paypal-sdk-status paypal-sdk-error" role="alert">
        PayPal checkout could not load{error?.message ? `: ${error.message}` : "."}
      </div>
    );
  }

  return (
    <PayPalOneTimePaymentButton
      type="checkout"
      presentationMode="auto"
      testBuyerCountry={environment === "sandbox" ? "US" : undefined}
      createOrder={async () => {
        const requestId = crypto.randomUUID();
        checkoutEvent("paypal.order.create.start", { surface, requestId });
        try {
          const orderId = await onCreateOrder(requestId);
          checkoutEvent("paypal.order.create.complete", { surface, orderId, requestId });
          return { orderId };
        } catch (cause) {
          checkoutFailure("paypal.order.create", cause, { surface, requestId });
          throw cause;
        }
      }}
      onApprove={async (data) => {
        checkoutEvent("paypal.approval.received", {
          surface,
          orderId: data.orderId,
          fundingSource: data.fundingSource,
        });
        await onApprove(data.orderId);
      }}
      onCancel={() => {
        checkoutEvent("paypal.approval.cancelled", { surface });
        onCancel();
      }}
      onError={(cause) => {
        checkoutFailure("paypal.sdk.callback", cause, { surface, environment });
        onError(cause);
      }}
    />
  );
}

export function PayPalCheckoutButton(props: PayPalCheckoutButtonProps) {
  const { surface, clientId, environment, ...callbacks } = props;

  return (
    <PayPalProvider
      clientId={clientId}
      environment={environment === "live" ? "production" : "sandbox"}
      components={["paypal-payments"]}
      pageType="checkout"
      debug={environment === "sandbox"}
    >
      <PayPalButtonSession surface={surface} environment={environment} {...callbacks} />
    </PayPalProvider>
  );
}
