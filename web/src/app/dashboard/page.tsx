import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBuyerProfileForUser } from "@/lib/db/repositories/buyer-profiles";
import { listServiceRequests } from "@/lib/db/repositories/service-requests";
import { SERVICE_LABELS } from "@/lib/db/schemas/service-labels";

export default async function DashboardPage() {
  const user = getCurrentUser();
  const profile = await getBuyerProfileForUser(user.userId);
  const requests = profile
    ? await listServiceRequests({ userId: user.userId })
    : [];

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your service requests and matching progress.
          </p>
        </div>
        {profile ? (
          <Button asChild>
            <Link href="/requests/new">New request</Link>
          </Button>
        ) : null}
      </div>

      {!profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Set up your buyer profile</CardTitle>
            <CardDescription>
              Create an agent profile before opening supply requests.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Button asChild>
              <Link href="/profile">Create agent profile</Link>
            </Button>
          </div>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No requests yet</CardTitle>
            <CardDescription>
              Describe what you need and we will rank suppliers with rules
              (AI comes later).
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Button asChild>
              <Link href="/requests/new">New request</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request._id.toHexString()}>
              <Link
                href={`/requests/${request._id.toHexString()}`}
                className="hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {SERVICE_LABELS[request.service]}
                    </p>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {request.prompt}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
