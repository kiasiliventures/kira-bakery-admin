import Image from "next/image";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, Package, ClipboardList, Boxes, BadgeDollarSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/admin/logout-button";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/cakes", label: "Cake Pricing", icon: BadgeDollarSign },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/orders", label: "Orders", icon: ClipboardList },
];

type Props = {
  user: {
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  };
};

export function TopNav({ user }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 bg-kira-red text-white">
      <div className="mx-auto flex h-full w-full max-w-[1320px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icons/logo-square.png"
              alt="Kira Bakery Admin"
              width={173}
              height={192}
              className="h-10 w-auto md:hidden"
              priority
            />
            <Image
              src="/icons/logo-rectangle.png"
              alt="Kira Bakery Admin"
              width={500}
              height={232}
              className="hidden h-10 w-auto md:block"
              priority
            />
            <span className="sr-only">Kira Bakery Admin</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1 rounded-[10px] px-3 py-2 text-sm text-white/90 hover:bg-white/15 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-[10px] bg-white/10 px-2 py-1.5 hover:bg-white/15">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/30 text-xs font-semibold">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden text-sm md:block">{user.role}</span>
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{user.name}</DropdownMenuItem>
            <DropdownMenuItem>{user.email}</DropdownMenuItem>
            <div className="p-2">
              <LogoutButton />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
