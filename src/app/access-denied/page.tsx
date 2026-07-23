import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { roleHome, roleLabel } from "@/lib/nav";

export default async function AccessDeniedPage() {
  const user = await getCurrentUser();
  const home = roleHome[user.accessRole] ?? "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">Access restricted</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account ({roleLabel[user.accessRole]}) doesn&apos;t have access to that module in
          this demo.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href={home} />}>
        Back to my dashboard
      </Button>
    </div>
  );
}
