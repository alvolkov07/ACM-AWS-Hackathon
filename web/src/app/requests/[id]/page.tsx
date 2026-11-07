import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchPanel, type MatchPanelItem } from "@/components/match-panel";
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
import { serialize } from "@/lib/api/http";
import { getCompanyById } from "@/lib/db/repositories/companies";
import { listMatches } from "@/lib/db/repositories/matches";
import { listProducts } from "@/lib/db/repositories/products";
import { getServiceRequestById } from "@/lib/db/repositories/service-requests";
import { SERVICE_LABELS } from "@/lib/db/schemas/service-labels";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = getCurrentUser();
  const request = await getServiceRequestById(id, user.userId);
  if (!request) {
    notFound();
  }

  const matches = await listMatches({ requestId: request._id });
  const enriched: MatchPanelItem[] = [];

  for (const match of matches) {
    const company = await getCompanyById(match.companyId);
    const products = await listProducts({
      companyId: match.companyId,
      service: request.service,
    });
    const selectedProductIds = new Set(
      match.productIds.map((productId) => productId.toHexString()),
    );

    enriched.push(
      serialize({
        ...match,
        company,
        products: products.map((product) => ({
          ...product,
          checked:
            match.selected &&
            selectedProductIds.has(product._id.toHexString()),
        })),
      }) as unknown as MatchPanelItem,
    );
  }

  return (
    <PageContainer className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {SERVICE_LABELS[request.service]} request
          </h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-muted-foreground max-w-3xl">{request.prompt}</p>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Quantity: {request.quantity ?? "—"} · Notes:{" "}
            {request.notes || "—"}
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Suppliers</h2>
        <MatchPanel requestId={id} initialMatches={enriched} />
      </section>
    </PageContainer>
  );
}
