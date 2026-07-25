"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calculatePrice, PRICING_CONFIG } from "@/lib/billing/pricing-config";
import { formatINR } from "@/lib/format";
import type { NavSection } from "@/lib/nav";

type ModuleOption = { key: NavSection["key"]; title: string };

export function PlanSelector({ moduleOptions }: { moduleOptions: ModuleOption[] }) {
  const [numUsers, setNumUsers] = useState<number>(PRICING_CONFIG.minimumUsers);
  const [modules, setModules] = useState<string[]>(moduleOptions.map((m) => m.key));

  const price = useMemo(() => calculatePrice(numUsers, modules), [numUsers, modules]);
  const belowMinimum = numUsers < PRICING_CONFIG.minimumUsers;

  function toggleModule(key: string, checked: boolean) {
    setModules((prev) => (checked ? [...prev, key] : prev.filter((m) => m !== key)));
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Plan calculator</h2>
        <p className="text-xs text-muted-foreground">
          {formatINR(PRICING_CONFIG.pricePerModulePerUserPerMonth)} per module, per user, per
          month · minimum {PRICING_CONFIG.minimumUsers} users · {Math.round(PRICING_CONFIG.volumeDiscountRate * 100)}% off at {PRICING_CONFIG.volumeDiscountThreshold}+ users
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="numUsers">Number of users</Label>
        <Input
          id="numUsers"
          type="number"
          min={PRICING_CONFIG.minimumUsers}
          value={numUsers}
          onChange={(e) => setNumUsers(Number(e.target.value) || 0)}
          className="w-32"
        />
        {belowMinimum && (
          <p className="text-xs text-destructive">
            Minimum purchase is {PRICING_CONFIG.minimumUsers} users.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Modules</Label>
        <div className="grid grid-cols-2 gap-2">
          {moduleOptions.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={modules.includes(m.key)}
                onCheckedChange={(checked) => toggleModule(m.key, checked === true)}
              />
              {m.title}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>
            {price.numUsers} users × {price.numModules} modules ×{" "}
            {formatINR(price.pricePerModulePerUserPerMonth)}
          </span>
          <span>{formatINR(price.basePrice)}</span>
        </div>
        {price.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Volume discount ({Math.round(price.discountRate * 100)}%)</span>
            <span>−{formatINR(price.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Monthly total</span>
          <span>{formatINR(price.finalPrice)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatINR(price.pricePerUserPerMonth)} per user / month
        </p>
      </div>

      <Button
        className="w-full"
        disabled={belowMinimum || modules.length === 0}
        nativeButton={false}
        render={
          <Link
            href={`/subscription/payment?numUsers=${numUsers}&modules=${modules.join(",")}`}
          />
        }
      >
        Proceed to payment
      </Button>
    </div>
  );
}
