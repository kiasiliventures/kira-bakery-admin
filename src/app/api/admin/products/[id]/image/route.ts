import { badRequest, notFound } from "@/lib/http/errors";
import { withAdminRoute } from "@/lib/http/admin-route";
import { jsonOk } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const IMAGE_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidImageSignature(raw: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return raw.length >= 4 && raw[0] === 0xff && raw[1] === 0xd8 && raw[raw.length - 2] === 0xff && raw[raw.length - 1] === 0xd9;
  }

  if (contentType === "image/png") {
    return (
      raw.length >= 8 &&
      raw[0] === 0x89 &&
      raw[1] === 0x50 &&
      raw[2] === 0x4e &&
      raw[3] === 0x47 &&
      raw[4] === 0x0d &&
      raw[5] === 0x0a &&
      raw[6] === 0x1a &&
      raw[7] === 0x0a
    );
  }

  if (contentType === "image/webp") {
    return (
      raw.length >= 12 &&
      raw.subarray(0, 4).toString("ascii") === "RIFF" &&
      raw.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

export const POST = withAdminRoute<{ id: string }>(
  {
    allowedRoles: ["admin", "manager"],
    actionName: "upload_product_image",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (request, { params }) => {
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: product, error: productLookupError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (productLookupError) {
      throw new Error(`Product lookup failed: ${productLookupError.message}`);
    }
    if (!product) {
      throw notFound("Product not found");
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      throw badRequest("Image file is required");
    }

    if (fileEntry.size <= 0) {
      throw badRequest("Image file is empty");
    }
    if (fileEntry.size > MAX_IMAGE_BYTES) {
      throw badRequest("Image file must be 5MB or smaller");
    }
    if (!ALLOWED_IMAGE_TYPES.has(fileEntry.type)) {
      throw badRequest("Only JPEG, PNG, and WebP images are allowed");
    }

    const safeFileName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFileName) {
      throw badRequest("Invalid file name");
    }

    const raw = Buffer.from(await fileEntry.arrayBuffer());
    if (!hasValidImageSignature(raw, fileEntry.type)) {
      throw badRequest("Uploaded file content does not match its image type");
    }

    const path = `products/${params.id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(path, raw, {
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(path);

    const publicUrl = publicUrlData.publicUrl;
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        image_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (updateError) {
      await supabaseAdmin.storage.from(IMAGE_BUCKET).remove([path]);
      throw new Error(`Product image update failed: ${updateError.message}`);
    }

    return jsonOk({
      path,
      publicUrl,
      product: updatedProduct,
    });
  },
);
