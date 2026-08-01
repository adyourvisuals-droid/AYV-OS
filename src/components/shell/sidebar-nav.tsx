"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ModuleDescriptor } from "@/lib/module-registry";

export function SidebarNav({ module }: { module: ModuleDescriptor }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {module.sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.label}
          </span>
          {section.items.map((item) => {
            const active =
              item.href === module.basePath
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors [&>svg]:size-4 [&>svg]:shrink-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
