import { mapUnknownError, jsonError, jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { createCakeCustomRequest } from "@/lib/cakes/data";
import { cakeCustomRequestCreateSchema } from "@/lib/schemas/cakes";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, cakeCustomRequestCreateSchema);
    const created = await createCakeCustomRequest(input);

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
