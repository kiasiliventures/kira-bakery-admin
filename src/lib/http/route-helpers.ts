import { type ZodType } from "zod";
import { badRequest } from "@/lib/http/errors";

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

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

