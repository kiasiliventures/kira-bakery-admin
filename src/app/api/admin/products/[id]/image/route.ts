import { badRequest } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { parseJsonBody } from "@/lib/http/route-helpers";
import { productImageUploadSchema } from "@/lib/schemas/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const IMAGE_BUCKET = "product-images";

export const POST = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "upload_product_image",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const input = await parseJsonBody(request, productImageUploadSchema);
    const supabaseAdmin = createSupabaseAdminClient();

    const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFileName) {
      throw badRequest("Invalid file name");
    }

    const raw = Buffer.from(input.base64File, "base64");
    const path = `products/${params.id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(path, raw, {
        contentType: input.contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(path);

    return jsonOk({
      path,
      publicUrl: publicUrlData.publicUrl,
    });
  },
);

