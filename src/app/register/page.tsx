import { redirect } from "next/navigation";
import { readSessionCookie, decrypt } from "@/lib/session";
import { roleHome } from "@/lib/nav";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);
  if (session?.userId) {
    redirect(session.isSuperAdmin ? "/platform-admin" : (roleHome[session.accessRole] ?? "/"));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <RegisterForm />
    </div>
  );
}
