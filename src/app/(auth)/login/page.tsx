import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/");
  }

  return (
    <div className="mx-auto mt-14 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>KiRA Bakery Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
