'use client';

import { useState } from 'react';
import { ShieldOff } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { AutomationsTab } from './automations-tab';
import { CustomFieldsTab } from './custom-fields-tab';
import { OrganizationTab } from './organization-tab';
import { RolesTab } from './roles-tab';
import { ServiceCatalogTab } from './service-catalog-tab';
import { TeamTab } from './team-tab';

type SettingsTab = 'team' | 'roles' | 'automations' | 'custom-fields' | 'organization' | 'catalog';

export default function SettingsPage() {
  const { canAny } = useAuth();

  const availableTabs: { key: SettingsTab; label: string; visible: boolean }[] = [
    { key: 'organization', label: 'Organisation', visible: canAny(PERMISSIONS.ORG_READ) },
    { key: 'team', label: 'Team & hierarchy', visible: canAny(PERMISSIONS.USER_READ) },
    { key: 'roles', label: 'Roles & permissions', visible: canAny(PERMISSIONS.ROLE_READ) },
    { key: 'automations', label: 'Automations', visible: canAny(PERMISSIONS.AUTOMATION_READ) },
    { key: 'catalog', label: 'Service catalog', visible: canAny(PERMISSIONS.PACKAGE_READ) },
    {
      key: 'custom-fields',
      label: 'Custom fields',
      visible: canAny(PERMISSIONS.SETTING_READ, PERMISSIONS.CUSTOM_FIELD_MANAGE),
    },
  ];
  const visibleTabs = availableTabs.filter((tab) => tab.visible);

  const [tab, setTab] = useState<SettingsTab | null>(null);
  const activeTab = tab && visibleTabs.some((entry) => entry.key === tab) ? tab : visibleTabs[0]?.key;

  if (visibleTabs.length === 0) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-6">
          <EmptyState
            icon={<ShieldOff className="h-6 w-6" aria-hidden />}
            title="Nothing to configure here"
            description="You don't have access to any settings modules yet."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure roles, automation rules and custom fields." />

      <div className="flex gap-1 border-b border-subtle px-6">
        {visibleTabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`relative px-3 py-2.5 text-body-sm font-medium transition-colors ${
              activeTab === entry.key ? 'text-brand-600' : 'text-secondary hover:text-primary'
            }`}
          >
            {entry.label}
            {activeTab === entry.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'automations' && <AutomationsTab />}
        {activeTab === 'custom-fields' && <CustomFieldsTab />}
        {activeTab === 'catalog' && <ServiceCatalogTab />}
      </div>
    </>
  );
}
