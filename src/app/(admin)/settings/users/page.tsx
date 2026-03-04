import { UserRoleManager } from "@/components/admin/user-role-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardPage } from "@/lib/auth/page-guard";
import { getProfiles } from "@/lib/supabase/queries";

export default async function UsersSettingsPage() {
  await guardPage(["admin"]);
  const users = await getProfiles();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">User Roles</h2>
      <Card>
        <CardHeader>
          <CardTitle>Role administration</CardTitle>
        </CardHeader>
        <CardContent>
          <UserRoleManager users={users} />
        </CardContent>
      </Card>
    </div>
  );
}

