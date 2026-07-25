import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Platform Admin</h1>
            <p className="text-xs text-muted-foreground">Cross-organization billing oversight</p>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/platform-admin" className="hover:underline">
            Payments
          </Link>
          <Link href="/platform-admin/organizations" className="hover:underline">
            Organizations
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
