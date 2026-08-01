import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No workspace found</CardTitle>
        <CardDescription>
          Your account isn&apos;t linked to an organization yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button render={<Link href="/register" />} className="w-full">
          Create a workspace
        </Button>
      </CardContent>
    </Card>
  );
}
