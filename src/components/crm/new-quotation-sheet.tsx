"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQuotation } from "@/lib/actions/crm";
import { formatINR } from "@/lib/format";
import { Plus, X } from "lucide-react";

type LineItemRow = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function emptyRow(key: string): LineItemRow {
  return { key, description: "", quantity: "1", unitPrice: "" };
}

export function NewQuotationSheet({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createQuotation, undefined);
  const idPrefix = useId();
  const [rows, setRows] = useState<LineItemRow[]>([emptyRow(`${idPrefix}-0`)]);

  useEffect(() => {
    if (state?.success) {
      toast.success("Quotation created");
      setOpen(false);
      setRows([emptyRow(`${idPrefix}-0`)]);
    }
  }, [state, idPrefix]);

  const total = rows.reduce((sum, row) => {
    const qty = Number(row.quantity);
    const price = Number(row.unitPrice);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  function updateRow(key: string, patch: Partial<LineItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(`${idPrefix}-${prev.length}-${Date.now()}`)]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Quotation
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New quotation</SheetTitle>
          <SheetDescription>Build a quote line by line — the total is calculated for you.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Client</Label>
              <Select name="clientId" required>
                <SelectTrigger id="clientId" className="w-full">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Valid until</Label>
              <Input id="validUntil" name="validUntil" type="date" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" size="xs" variant="outline" onClick={addRow}>
                <Plus />
                Add item
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.key} className="flex items-start gap-2">
                  <Input
                    name="description"
                    placeholder="Description"
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    className="w-16"
                  />
                  <Input
                    name="unitPrice"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Unit price"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={rows.length === 1}
                    onClick={() => removeRow(row.key)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-mono text-sm font-semibold">{formatINR(total)}</span>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create quotation"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
