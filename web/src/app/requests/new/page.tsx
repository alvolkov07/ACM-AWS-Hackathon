import Link from "next/link";
import { redirect } from "next/navigation";

import { NewRequestForm } from "@/components/new-request-form";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBuyerProfileForUser } from "@/lib/db/repositories/buyer-profiles";

export default async function NewRequestPage() {
  const user = getCurrentUser();
  const profile = await getBuyerProfileForUser(user.userId);

  if (!profile) {
    redirect("/profile");
  }

  return (
    <PageContainer className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">New request</h1>
        <p className="text-muted-foreground">
          Describe the service you need. Matching uses rules for now.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What do you need?</CardTitle>
          <CardDescription>
            For {profile.companyName} in {profile.state}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NewRequestForm defaultService={profile.defaultService} />
          <Button asChild variant="ghost">
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
