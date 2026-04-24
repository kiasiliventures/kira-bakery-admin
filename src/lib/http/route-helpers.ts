import { type ZodType } from "zod";
import { badRequest, forbidden } from "@/lib/http/errors";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  const body = await request.json().catch(() => {
    throw badRequest("Invalid JSON body");
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Validation failed", parsed.error.flatten());
  }

  return parsed.data;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_PROXY_MARKER_HEADERS = ["x-vercel-id", "cf-ray", "fly-region"];

function getForwardedHeaderValue(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) {
    return null;
  }

  return value
    .split(",")[0]
    ?.trim() || null;
}

function hasKnownProxyMarker(request: Request): boolean {
  return TRUSTED_PROXY_MARKER_HEADERS.some((header) =>
    Boolean(request.headers.get(header)),
  );
}

function toFingerprintPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.:_-]+/g, "-").slice(0, 96);
}

function hashFingerprintPart(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = getForwardedHeaderValue(request, "x-forwarded-proto");
  const forwardedHost = getForwardedHeaderValue(request, "x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  const protocol = forwardedProto ?? url.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

function extractOriginFromUrl(value: string, headerName: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw forbidden(`Invalid ${headerName} header`);
  }
}

export function assertSameOriginMutation(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const expectedOrigin = getRequestOrigin(request);
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    if (originHeader !== expectedOrigin) {
      throw forbidden("Cross-site mutation request rejected");
    }
    return;
  }

  const refererHeader = request.headers.get("referer");
  if (!refererHeader) {
    throw forbidden("Missing Origin or Referer header");
  }

  const refererOrigin = extractOriginFromUrl(refererHeader, "Referer");
  if (refererOrigin !== expectedOrigin) {
    throw forbidden("Cross-site mutation request rejected");
  }
}

export function getRequestIp(request: Request): string {
  const cloudflareIp = getForwardedHeaderValue(request, "cf-connecting-ip");
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const flyIp = getForwardedHeaderValue(request, "fly-client-ip");
  if (flyIp) {
    return flyIp;
  }

  if (hasKnownProxyMarker(request)) {
    const forwarded = getForwardedHeaderValue(request, "x-forwarded-for");
    if (forwarded) {
      return forwarded;
    }

    const realIp = getForwardedHeaderValue(request, "x-real-ip");
    if (realIp) {
      return realIp;
    }
  }

  return "unknown";
}

export function getSafeClientFingerprint(request: Request): string {
  const ip = toFingerprintPart(getRequestIp(request) || "unknown");
  const userAgent =
    request.headers.get("user-agent")?.trim().replace(/\s+/g, " ") ||
    "unknown";

  return `ip:${ip}:ua:${hashFingerprintPart(userAgent)}`;
}
