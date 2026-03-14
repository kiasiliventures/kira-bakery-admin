import "server-only";

import { requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

type PesapalTokenResponse = {
  token?: string;
  status?: string;
  message?: string | null;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  };
};

export type PesapalTransactionStatusResponse = {
  payment_method?: string;
  amount?: number;
  created_date?: string;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  message?: string;
  status_code?: number | string;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  };
};

export type NormalizedPesapalPaymentState = "paid" | "failed" | "cancelled" | "pending";

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function getBaseUrl(): string {
  return requireEnv("PESAPAL_BASE_URL").replace(/\/+$/, "");
}

async function parsePesapalResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected Pesapal response (${response.status}): ${text}`);
  }
}

async function requestPesapal<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pesapal request failed (${response.status}): ${text}`);
  }

  return parsePesapalResponse<T>(response);
}

export async function getPesapalAuthToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  logger.info("pesapal_token_request_start", { baseUrl: getBaseUrl() });

  const response = await requestPesapal<PesapalTokenResponse>("/api/Auth/RequestToken", {
    method: "POST",
    body: JSON.stringify({
      consumer_key: requireEnv("PESAPAL_CONSUMER_KEY"),
      consumer_secret: requireEnv("PESAPAL_CONSUMER_SECRET"),
    }),
  });

  if (!response.token) {
    logger.error("pesapal_token_request_failed", {
      status: response.status ?? null,
      message: response.message ?? null,
      errorCode: response.error?.code ?? null,
      errorType: response.error?.type ?? null,
      errorMessage: response.error?.message ?? null,
    });

    throw new Error(
      response.error?.message ?? response.error?.code ?? response.message ?? response.status ?? "Pesapal token request failed.",
    );
  }

  tokenCache = {
    token: response.token,
    expiresAt: Date.now() + 1000 * 60 * 4,
  };

  logger.info("pesapal_token_request_success");
  return response.token;
}

export async function getPesapalTransactionStatus(
  orderTrackingId: string,
): Promise<PesapalTransactionStatusResponse> {
  logger.info("pesapal_status_request_start", { orderTrackingId });

  const url = new URL(`${getBaseUrl()}/api/Transactions/GetTransactionStatus`);
  url.searchParams.set("orderTrackingId", orderTrackingId);

  const token = await getPesapalAuthToken();
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error("pesapal_status_request_failed", {
      orderTrackingId,
      status: response.status,
      error: text,
    });
    throw new Error(`Pesapal status request failed (${response.status}): ${text}`);
  }

  const payload = await parsePesapalResponse<PesapalTransactionStatusResponse>(response);
  logger.info("pesapal_status_request_success", {
    orderTrackingId,
    paymentStatus: payload.payment_status_description ?? null,
  });
  return payload;
}

export function normalizePesapalPaymentState(
  rawStatus: string | null | undefined,
): NormalizedPesapalPaymentState {
  const normalized = rawStatus?.trim().toUpperCase();

  if (normalized === "COMPLETED") {
    return "paid";
  }

  if (normalized === "FAILED" || normalized === "REVERSED") {
    return "failed";
  }

  if (normalized === "INVALID") {
    return "cancelled";
  }

  return "pending";
}
