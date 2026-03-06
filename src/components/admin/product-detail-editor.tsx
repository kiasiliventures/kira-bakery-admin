"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { VariantsTable } from "@/components/admin/variants-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/lib/types";

export function ProductDetailEditor({ product }: { product: Product }) {
  const [available, setAvailable] = React.useState(product.status === "Available");
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img src={product.image} alt={product.name} className="h-72 w-full rounded-2xl object-cover" />
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Change image
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input defaultValue={product.name} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-kira-border px-3 py-2">
              <Label>Availability</Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea defaultValue={product.description} />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product Variants</CardTitle>
        </CardHeader>
        <CardContent>
          <VariantsTable variants={product.variants} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => toast({ title: "Product changes saved." })}>Save Changes</Button>
      </div>
    </div>
  );
}
