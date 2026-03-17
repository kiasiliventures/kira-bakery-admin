import { mapUnknownError, jsonError, jsonOk } from "@/lib/http/responses";
import { getPublicCakePrices } from "@/lib/cakes/data";

export async function GET() {
  try {
    const prices = await getPublicCakePrices();
    return jsonOk({ prices });
  } catch (error) {
    return jsonError(mapUnknownError(error, "get_cake_prices"));
  }
}
