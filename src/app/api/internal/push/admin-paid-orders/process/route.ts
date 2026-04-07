import { z } from "zod";
import { jsonOk } from "@/lib/http/responses";
import {
  extractBearerToken,
  InternalRequestAuthError,
  requireInternalRequestSigningSecret,
  verifyInternalRequestToken,
} from "@/lib/internal-auth";
import { processAdminPushDispatchQueue } from "@/lib/push/admin-paid-order-notifications";

const ADMIN_PAID_ORDER_PUSH_PURPOSE = "admin_paid_order_push_dispatch";

const requestBodySchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
});

async function handleProcessRequest(request: Request) {
  try {
    const providedToken = extractBearerToken(request);
    if (!providedToken) {
      return Response.json({ message: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = requestBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          message: "Invalid admin paid-order push request.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    verifyInternalRequestToken({
      token: providedToken,
      secret: requireInternalRequestSigningSecret("STOREFRONT_INTERNAL_AUTH_TOKEN"),
      issuer: "kira-bakery-storefront",
      audience: "kira-bakery-admin",
      purpose: ADMIN_PAID_ORDER_PUSH_PURPOSE,
      method: "POST",
      path: new URL(request.url).pathname,
      orderId: parsed.data.orderId,
    });

    const stats = await processAdminPushDispatchQueue({
      orderId: parsed.data.orderId,
      limit: 1,
    });

    return jsonOk({ stats });
  } catch (error) {
    if (error instanceof InternalRequestAuthError) {
      return Response.json({ message: error.message }, { status: 401 });
    }

    return Response.json(
      {
        message: error instanceof Error ? error.message : "Unable to process admin paid-order push.",
      },
      { status: 500 },
    );
  }
}

export const POST = handleProcessRequest;
