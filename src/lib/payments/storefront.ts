import { badRequest, internalError, notFound } from "@/lib/http/errors";
import { requireEnv } from "@/lib/env";

type StorefrontPaymentOrder = {
  orderId: string;
  paymentStatus: string;
  providerStatus: string | null;
};

type StorefrontPaymentStatusResponse = {
  ok?: boolean;
  order?: StorefrontPaymentOrder;
  message?: string;
};

function getStorefrontBaseUrl() {
  return requireEnv("STOREFRONT_BASE_URL").replace(/\/+$/, "");
}

export async function syncOrderPaymentViaStorefront(
  orderId: string,
): Promise<StorefrontPaymentOrder> {
  const url = new URL(`${getStorefrontBaseUrl()}/api/payments/pesapal/status`);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("refresh", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | StorefrontPaymentStatusResponse
    | null;

  if (!response.ok) {
    const message = payload?.message ?? "Unable to verify payment with the storefront.";

    if (response.status === 400) {
      throw badRequest(message);
    }

    if (response.status === 404) {
      throw notFound(message);
    }

    throw internalError(message);
  }

  if (!payload?.order) {
    throw internalError("Storefront payment response missing order payload.");
  }

  return payload.order;
}
