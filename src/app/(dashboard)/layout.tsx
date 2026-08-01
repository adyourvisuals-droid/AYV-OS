import Link from "next/link";

import { getActiveOrg } from "@/lib/session";
import { getModules } from "@/lib/modules";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization, memberships } = await getActiveOrg();
  const modules = getModules();
  const activeModule = modules[0];

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            AYV OS
          </Link>
        </div>
        <div className="border-b border-sidebar-border px-2 py-2">
          <OrgSwitcher
            current={{ id: organization.id, name: organization.name }}
            options={memberships.map((m) => ({
              id: m.organization.id,
              name: m.organization.name,
            }))}
          />
        </div>
        {activeModule ? <SidebarNav module={activeModule} /> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <span className="text-sm text-muted-foreground">
            {organization.name}
          </span>
          <UserMenu name={user.name} email={user.email} />
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
