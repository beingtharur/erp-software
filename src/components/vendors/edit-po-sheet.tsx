"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { updatePurchaseOrder } from "@/lib/actions/vendor";
import { Pencil } from "lucide-react";

type PoForEdit = {
  id: string;
  vendorId: string;
  itemsDescription: string;
  amount: number;
  orderDate: Date | string;
  expectedDelivery: Date | string;
  status: string;
};

function toDateInputValue(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function EditPurchaseOrderSheet({
  po,
  vendors,
}: {
  po: PoForEdit;
  vendors: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updatePurchaseOrder, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Purchase order updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <Pencil className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit purchase order</SheetTitle>
          <SheetDescription>Update order details.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="poId" value={po.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`vendorId-${po.id}`}>Vendor</Label>
            <Select name="vendorId" required defaultValue={po.vendorId}>
              <SelectTrigger id={`vendorId-${po.id}`} className="w-full">
                <SelectValue placeholder="Select vendor">
                  {(value: unknown) => vendors.find((v) => v.id === value)?.name ?? "Select vendor"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`itemsDescription-${po.id}`}>Items</Label>
            <Textarea
              id={`itemsDescription-${po.id}`}
              name="itemsDescription"
              rows={3}
              required
              defaultValue={po.itemsDescription}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`amount-${po.id}`}>Amount (₹)</Label>
            <Input
              id={`amount-${po.id}`}
              name="amount"
              type="number"
              min={0}
              step={100}
              required
              defaultValue={po.amount}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`orderDate-${po.id}`}>Order date</Label>
              <Input
                id={`orderDate-${po.id}`}
                name="orderDate"
                type="date"
                required
                defaultValue={toDateInputValue(po.orderDate)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`expectedDelivery-${po.id}`}>Expected delivery</Label>
              <Input
                id={`expectedDelivery-${po.id}`}
                name="expectedDelivery"
                type="date"
                required
                defaultValue={toDateInputValue(po.expectedDelivery)}
              />
            </div>
          </div>

          <input type="hidden" name="status" value={po.status} />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
