import { badRequest } from "@/lib/http/errors";
import { mapUnknownError, jsonError, jsonOk } from "@/lib/http/responses";
import { assertSameOriginMutation, getRequestIp, parseJsonBody } from "@/lib/http/route-helpers";
import { createCakeCustomRequest, getPublicCakePrices } from "@/lib/cakes/data";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { cakeCustomRequestCreateSchema } from "@/lib/schemas/cakes";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await enforceRateLimit({
      key: `public_cake_custom_request:${getRequestIp(request)}`,
      limit: 10,
      windowMs: 15 * 60_000,
    });

    const input = await parseJsonBody(request, cakeCustomRequestCreateSchema);
    const prices = await getPublicCakePrices();
    const selectedPrice = prices.find((price) => price.id === input.priceId);

    if (!selectedPrice) {
      throw badRequest("The selected cake combination is no longer available.");
    }

    if (
      selectedPrice.flavourId !== input.flavourId
      || selectedPrice.shapeId !== input.shapeId
      || selectedPrice.sizeId !== input.sizeId
      || selectedPrice.tierOptionId !== input.tierOptionId
      || selectedPrice.toppingId !== input.toppingId
    ) {
      throw badRequest("Cake selection does not match the current pricing matrix.");
    }

    const created = await createCakeCustomRequest({
      customerName: input.customerName,
      phone: input.phone,
      email: input.email || undefined,
      notes: input.notes || undefined,
      eventDate: input.eventDate,
      messageOnCake: input.messageOnCake || undefined,
      price: selectedPrice,
    });

    return jsonOk(
      {
        requestId: created.id,
        status: created.status,
        createdAt: created.created_at,
      },
      201,
    );
  } catch (error) {
    return jsonError(mapUnknownError(error, "create_cake_custom_request"));
  }
}
