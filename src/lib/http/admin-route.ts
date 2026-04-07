import { NextResponse } from "next/server";
import { requireRole, type RequestIdentity } from "@/lib/auth/authorize";
import type { AllowedRole } from "@/lib/auth/roles";
import { runAfterResponse } from "@/lib/http/after-response";
import { mapUnknownError, jsonError } from "@/lib/http/responses";
import { assertSameOriginMutation, getRequestIp } from "@/lib/http/route-helpers";
import { logger } from "@/lib/logger";
import { scheduleAdminPushDispatchQueueProcessing } from "@/lib/push/admin-paid-order-notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";

type HandlerContext<TParams extends Record<string, string> = Record<string, string>> = {
  identity: RequestIdentity;
  params: TParams;
  ip: string;
};

export function withAdminRoute<TParams extends Record<string, string> = Record<string, string>>(
  config: {
    allowedRoles: readonly AllowedRole[];
    rateLimit?: { limit: number; windowMs: number };
    actionName: string;
  },
  handler: (request: Request, ctx: HandlerContext<TParams>) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    routeContext: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    try {
      const params = await routeContext.params;
      assertSameOriginMutation(request);
      const identity = await requireRole(config.allowedRoles);
      const ip = getRequestIp(request);
      const rateLimit = config.rateLimit ?? { limit: 60, windowMs: 60_000 };
      await enforceRateLimit({
        key: `${config.actionName}:${identity.user.id}`,
        limit: rateLimit.limit,
        windowMs: rateLimit.windowMs,
      });

      logger.info("admin_route_authorized", {
        action: config.actionName,
        userId: identity.user.id,
        role: identity.profile.role,
        ip,
      });

      runAfterResponse(async () => {
        await scheduleAdminPushDispatchQueueProcessing(config.actionName);
      });

      return await handler(request, { identity, params, ip });
    } catch (error) {
      const mapped = mapUnknownError(error, config.actionName);
      return jsonError(mapped);
    }
  };
}
