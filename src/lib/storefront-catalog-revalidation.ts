import "server-only";

import { requireEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http/fetch";
import {
  requireInternalRequestSigningSecret,
  signInternalRequestToken,
} from "@/lib/internal-auth";
import { logger } from "@/lib/logger";

const STOREFRONT_CATALOG_REVALIDATION_TIMEOUT_MS = 8_000;
const STOREFRONT_CATALOG_REVALIDATION_PURPOSE = "storefront_catalog_revalidation";

export type StorefrontCatalogRevalidationSource =
  | "admin_product_create"
  | "admin_product_patch"
  | "admin_product_delete"
  | "admin_variant_create"
  | "admin_variant_patch";

type TriggerStorefrontCatalogRevalidationInput = {
  source: StorefrontCatalogRevalidationSource;
  productIds: string[];
};

type TriggerStorefrontCatalogRevalidationResult = {
  attempted: boolean;
  accepted: boolean;
  productIds: string[];
  tags: string[];
  paths: string[];
};

function getStorefrontBaseUrl() {
  return requireEnv("STOREFRONT_BASE_URL").replace(/\/+$/, "");
}

function getStorefrontSigningSecret() {
  return requireInternalRequestSigningSecret("STOREFRONT_INTERNAL_AUTH_TOKEN");
}

function normalizeProductIds(productIds: string[]) {
  return [...new Set(productIds.map((productId) => productId.trim()).filter(Boolean))];
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getResponseStringArray(payload: unknown, key: "tags" | "paths") {
  const record = payload as Record<string, unknown> | null;

  if (
    record
    && typeof record === "object"
    && key in record
    && Array.isArray(record[key])
  ) {
    return record[key].filter((value): value is string => typeof value === "string");
  }

  return [];
}

function getResponseMessage(payload: unknown) {
  const record = payload as Record<string, unknown> | null;

  if (
    record
    && typeof record === "object"
    && typeof record.message === "string"
  ) {
    return record.message;
  }

  return null;
}

export async function triggerStorefrontCatalogRevalidation(
  input: TriggerStorefrontCatalogRevalidationInput,
): Promise<TriggerStorefrontCatalogRevalidationResult> {
  const productIds = normalizeProductIds(input.productIds);
  const path = "/api/internal/catalog/revalidate";
  const url = `${getStorefrontBaseUrl()}${path}`;
  const token = signInternalRequestToken({
    secret: getStorefrontSigningSecret(),
    issuer: "kira-bakery-admin",
    audience: "kira-bakery-storefront",
    purpose: STOREFRONT_CATALOG_REVALIDATION_PURPOSE,
    method: "POST",
    path,
  });

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: input.source,
          productIds,
        }),
        cache: "no-store",
      },
      {
        operationName: "Storefront catalog revalidation",
        timeoutMs: STOREFRONT_CATALOG_REVALIDATION_TIMEOUT_MS,
      },
    );
    const payload = await parseResponsePayload(response);
    const tags = getResponseStringArray(payload, "tags");
    const paths = getResponseStringArray(payload, "paths");

    if (!response.ok) {
      logger.error("storefront_catalog_revalidation_failed", {
        source: input.source,
        productIds,
        status: response.status,
        message: getResponseMessage(payload),
      });

      return {
        attempted: true,
        accepted: false,
        productIds,
        tags,
        paths,
      };
    }

    logger.info("storefront_catalog_revalidation_triggered", {
      source: input.source,
      productIds,
      tags,
      paths,
    });

    return {
      attempted: true,
      accepted: true,
      productIds,
      tags,
      paths,
    };
  } catch (error) {
    logger.error("storefront_catalog_revalidation_request_failed", {
      source: input.source,
      productIds,
      error: error instanceof Error ? error.message : "unknown_error",
    });

    return {
      attempted: true,
      accepted: false,
      productIds,
      tags: [],
      paths: [],
    };
  }
}
