import { NextResponse } from "next/server";
import { cancelPendingOrdersWithoutTrackingIds } from "@/lib/payments/reverify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("Missing required environment variable: CRON_SECRET");
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const result = await cancelPendingOrdersWithoutTrackingIds();

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cron failure";

    logger.error("pending_orders_without_tracking_cleanup_failed", {
      error: message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
