import { TopNav } from "@/components/admin/top-nav";
import { ToastProvider } from "@/components/ui/toast";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatRole(role: string | null | undefined): string {
  if (!role) return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  let profileRole = "staff";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profileRole = profile?.role ?? "staff";
  }

  const topNavUser = {
    name:
      (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user?.email?.split("@")[0] ||
      "Account",
    email: user?.email ?? "No email",
    role: formatRole(profileRole),
    avatarUrl:
      typeof user?.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <TopNav user={topNavUser} isAdmin={profileRole === "admin"} />
        <main className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-[88px] md:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
