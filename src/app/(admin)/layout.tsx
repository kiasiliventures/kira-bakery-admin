import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";
import { Badge } from "@/components/ui/badge";
import { guardPage } from "@/lib/auth/page-guard";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/settings/users", label: "Users" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await guardPage(["admin", "manager", "staff"]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">KiRA Bakery</p>
            <h1 className="text-lg font-semibold text-slate-900">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-indigo-100 text-indigo-700">{identity.profile.role}</Badge>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
