"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { login, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Boxes } from "lucide-react";

const personas = [
  {
    name: "Manan Vora",
    role: "Admin / Leadership",
    email: "manan.vora@eostechno.com",
    blurb: "Full access — every module",
  },
  {
    name: "Nikhil Bhatt",
    role: "Sales Rep",
    email: "nikhil.bhatt@eostechno.com",
    blurb: "CRM — pipeline & clients",
  },
  {
    name: "Suresh Yadav",
    role: "Installation Crew",
    email: "suresh.yadav@eostechno.com",
    blurb: "Field — check-in / check-out",
  },
  {
    name: "Pooja Nair",
    role: "HR",
    email: "pooja.nair@eostechno.com",
    blurb: "HRMS — attendance, leave, payroll",
  },
  {
    name: "Tanvi Mehta",
    role: "Procurement",
    email: "tanvi.mehta@eostechno.com",
    blurb: "Vendors — records & purchase orders",
  },
  {
    name: "Ankit Shah",
    role: "Finance",
    email: "ankit.shah@eostechno.com",
    blurb: "Finance — expense claims & budgets",
  },
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function selectPersona(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "demo123";
    formRef.current?.requestSubmit();
  }

  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
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
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials, or pick a demo account on the right.
            </p>
          </div>

          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                placeholder="you@eostechno.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                placeholder="demo123"
                required
                autoComplete="current-password"
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending} className="mt-1">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Demo password for every account: <span className="font-mono">demo123</span>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              New organization?{" "}
              <Link href="/register" className="underline">
                Start a free trial
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2.5">
        <p className="px-1 text-xs font-medium text-muted-foreground">
          Quick sign-in — try a role
        </p>
        {personas.map((p) => (
          <button
            key={p.email}
            type="button"
            disabled={pending}
            onClick={() => selectPersona(p.email)}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
          >
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.blurb}</p>
            </div>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {p.role}
            </span>
          </button>
        ))}
      </div>

      <div className="lg:col-span-2">
        <p className="text-center text-xs text-muted-foreground">
          Need help? Contact{" "}
          <a href="mailto:digitallyexist@gmail.com" className="underline">
            digitallyexist@gmail.com
          </a>{" "}
          · +91 96256 33868
        </p>
      </div>
    </div>
  );
}
