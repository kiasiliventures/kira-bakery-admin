import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex);
    let value = trimmed.slice(separatorIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials in .env.local");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,name,image_url")
    .is("image_url", null);

  if (productsError) {
    throw new Error(`Failed to load products: ${productsError.message}`);
  }

  const updated = [];

  for (const product of products ?? []) {
    const folder = `products/${product.id}`;
    const { data: files, error: listError } = await supabase.storage
      .from("product-images")
      .list(folder, { limit: 100, sortBy: { column: "name", order: "desc" } });

    if (listError) {
      throw new Error(`Failed to list storage for ${product.id}: ${listError.message}`);
    }

    const file = files?.find((entry) => entry.name);
    if (!file) continue;

    const objectPath = `${folder}/${file.name}`;
    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(objectPath);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        image_url: publicUrlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (updateError) {
      throw new Error(`Failed to update ${product.id}: ${updateError.message}`);
    }

    updated.push({
      id: product.id,
      name: product.name,
      imageUrl: publicUrlData.publicUrl,
    });
  }

  console.log(JSON.stringify({ updatedCount: updated.length, updated }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
