import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function DataTable({
  searchPlaceholder,
  onSearch,
  actions,
  children,
}: {
  searchPlaceholder: string;
  onSearch?: (value: string) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9"
            onChange={(event) => onSearch?.(event.target.value)}
          />
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}
