import { mapUnknownError, jsonError, jsonOk } from "@/lib/http/responses";
import { getPublicCakeConfig } from "@/lib/cakes/data";

export async function GET() {
  try {
    const config = await getPublicCakeConfig();
    return jsonOk({ config });
  } catch (error) {
    return jsonError(mapUnknownError(error, "get_cake_config"));
  }
}
