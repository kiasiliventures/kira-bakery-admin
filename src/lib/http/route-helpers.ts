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

function getForwardedHeaderValue(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) {
    return null;
  }

  return value
    .split(",")[0]
    ?.trim() || null;
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
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
