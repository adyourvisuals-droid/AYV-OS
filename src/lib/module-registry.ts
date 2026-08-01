import type { ReactNode } from "react";

export type ModuleNavItem = {
  label: string;
  href: string;
  /** A rendered icon element (e.g. `<Target className="size-4" />`), not a
   *  component reference — this crosses the server -> client boundary into
   *  the sidebar, and only rendered elements (not bare function refs) are
   *  serializable there. */
  icon: ReactNode;
};

export type ModuleNavSection = {
  label: string;
  items: ModuleNavItem[];
};

export type ModuleDescriptor = {
  id: string;
  label: string;
  icon: ReactNode;
  basePath: string;
  sections: ModuleNavSection[];
};

/**
 * Every product module (CRM, and future modules like Projects or Finance)
 * registers itself here. The dashboard shell renders navigation purely
 * from this registry, so adding a module means adding one entry — no
 * changes to the shell itself.
 */
const registry: ModuleDescriptor[] = [];

export function registerModule(module: ModuleDescriptor) {
  registry.push(module);
}

export function getModules(): ModuleDescriptor[] {
  return registry;
}
