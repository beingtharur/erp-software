"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Boxes } from "lucide-react";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

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

        {state?.success ? (
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, we&apos;ve sent a link to reset your
              password. It&apos;s valid for 1 hour.
            </p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

              <Button type="submit" disabled={pending} className="mt-1">
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
