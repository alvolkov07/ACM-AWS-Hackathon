import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getServiceRequestById } from "@/lib/db/repositories/service-requests";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RequestEmailsStubPage({ params }: PageProps) {
  const { id } = await params;
  const user = getCurrentUser();
  const request = await getServiceRequestById(id, user.userId);
  if (!request) {
    notFound();
  }

  return (
    <PageContainer className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground">
          Drafting and approving supplier emails arrives in Stage 7.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Your selected suppliers are ready. Email drafts will show up here
            next.
          </CardDescription>
        </CardHeader>
      </Card>
      <Button asChild variant="secondary">
        <Link href={`/requests/${id}`}>Back to request</Link>
      </Button>
    </PageContainer>
  );
}
