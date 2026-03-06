import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, badRequest, internalError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function jsonOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: AppError): NextResponse<ApiFailure> {
  const retryAfterSeconds =
    error.status === 429 &&
    error.details &&
    typeof error.details === "object" &&
    "retryAfterSeconds" in error.details &&
    typeof error.details.retryAfterSeconds === "number"
      ? error.details.retryAfterSeconds
      : undefined;

  return NextResponse.json(
    { ok: false, error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
    },
  );
}

export function mapUnknownError(error: unknown, context: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return badRequest("Validation failed", error.flatten());
  }

  logger.error("unhandled_error", {
    context,
    error: error instanceof Error ? error.message : "unknown",
  });
  return internalError();
}
