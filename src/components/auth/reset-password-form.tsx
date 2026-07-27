"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { resetPassword } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Boxes } from "lucide-react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(resetPassword, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Password reset — sign in with your new password.");
      router.push("/login");
    }
  }, [state, router]);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Exist Digitally</p>
            <p className="text-xs text-muted-foreground">Ops Platform</p>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="mt-1">
            {pending ? "Resetting…" : "Reset password"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
