import { redirect } from "next/navigation";
import { readSessionCookie, decrypt } from "@/lib/session";
import { roleHome } from "@/lib/nav";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);
  if (session?.userId) {
    redirect(roleHome[session.accessRole] ?? "/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </div>
  );
}
