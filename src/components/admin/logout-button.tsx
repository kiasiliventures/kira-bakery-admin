"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="outline"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

