import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">403 - Access denied</h1>
      <p className="mt-3 text-slate-600">
        Your account is authenticated but does not have permission to access this area.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/login">
          <Button variant="outline">Back to login</Button>
        </Link>
        <Link href="/">
          <Button>Go to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

