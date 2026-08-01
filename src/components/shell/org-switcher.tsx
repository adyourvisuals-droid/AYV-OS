"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveOrg } from "@/app/(dashboard)/actions";

type OrgOption = {
  id: string;
  name: string;
};

export function OrgSwitcher({
  current,
  options,
}: {
  current: OrgOption;
  options: OrgOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (options.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-sidebar-foreground">
        {current.name}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-sidebar-foreground outline-none hover:bg-sidebar-accent">
        <span className="truncate">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => {
              startTransition(async () => {
                await setActiveOrg(org.id);
                router.refresh();
              });
            }}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate">{org.name}</span>
              {org.id === current.id ? <Check className="size-4 shrink-0" /> : null}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
