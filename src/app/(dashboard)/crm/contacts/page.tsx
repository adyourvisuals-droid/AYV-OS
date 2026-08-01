import Link from "next/link";
import { Users, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listContacts } from "@/modules/crm/contacts/service";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ContactsPage() {
  const { organization } = await getActiveOrg();
  const contacts = await listContacts(organization.id);

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People at the companies you work with."
        actions={
          <Button render={<Link href="/crm/contacts/new" />}>
            <Plus /> New contact
          </Button>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add a contact to start tracking conversations."
          action={
            <Button render={<Link href="/crm/contacts/new" />} size="sm">
              <Plus /> New contact
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link
                      href={`/crm/contacts/${contact.id}`}
                      className="font-medium hover:underline"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{contact.company?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{contact.owner?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
