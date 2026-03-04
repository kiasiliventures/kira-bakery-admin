"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types/domain";

type Props = {
  users: Profile[];
};

export function UserRoleManager({ users }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const updateRole = async (userId: string, role: string) => {
    setStatus("");
    setLoadingId(userId);
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update role");
      setLoadingId(null);
      return;
    }
    router.refresh();
    setLoadingId(null);
  };

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div>
            <p className="font-medium text-slate-900">{user.email}</p>
            <p className="text-xs text-slate-500">{user.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              defaultValue={user.role}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              onChange={(event) => updateRole(user.id, event.target.value)}
              disabled={loadingId === user.id}
            >
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="staff">staff</option>
            </select>
          </div>
        </div>
      ))}
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
