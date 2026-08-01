"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils-shared";

export type LineItem = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

const EMPTY_ITEM: LineItem = { name: "", description: "", quantity: 1, unitPrice: 0 };

export function LineItemsEditor({
  name,
  defaultItems,
  currency = "USD",
  taxPercent = 0,
}: {
  name: string;
  defaultItems?: LineItem[];
  currency?: string;
  taxPercent?: number;
}) {
  const [items, setItems] = useState<LineItem[]>(
    defaultItems && defaultItems.length > 0 ? defaultItems : [EMPTY_ITEM]
  );

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal * (1 + taxPercent / 100);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_1fr_80px_120px_36px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Item</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span />
        </div>
        {items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1fr_80px_120px_36px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
          >
            <Input
              value={item.name}
              onChange={(e) => updateItem(index, { name: e.target.value })}
              placeholder="Service"
            />
            <Input
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              placeholder="Description"
            />
            <Input
              type="number"
              min={0}
              step="1"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              disabled={items.length === 1}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
      >
        <Plus /> Add line item
      </Button>
      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex w-56 justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        {taxPercent ? (
          <div className="flex w-56 justify-between">
            <span className="text-muted-foreground">Tax ({taxPercent}%)</span>
            <span>{formatCurrency(total - subtotal, currency)}</span>
          </div>
        ) : null}
        <div className="flex w-56 justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
