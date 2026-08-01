"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RelationSelect({
  name,
  placeholder,
  defaultValue,
  options,
  allowEmpty = true,
}: {
  name: string;
  placeholder: string;
  defaultValue?: string | null;
  options: { id: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? undefined}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value="__none__">None</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
