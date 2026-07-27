import { redirect } from "next/navigation";
import Link from "next/link";
import { readSessionCookie, decrypt } from "@/lib/session";
import { roleHome } from "@/lib/nav";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);
  if (session?.userId) {
    redirect(session.isSuperAdmin ? "/platform-admin" : (roleHome[session.accessRole] ?? "/"));
  }

  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          This reset link is missing its token.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <ResetPasswordForm token={token} />
    </div>
  );
}
